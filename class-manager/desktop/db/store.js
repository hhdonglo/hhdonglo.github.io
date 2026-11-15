/* The course database: one SQLite file per course (data/course.db), built into Node, no server and no account.
   One responsibility: keep the course's tabs, rows and settings on disk, quickly and safely.
   - load() returns the whole course as {sheets, props}; save({sheets, props}, dirty) writes only what changed,
     in one transaction, so a power cut leaves the last complete state, never half of one.
   - Rows are stored sealed (codec.js); the sheet number and row number are plain, so rows can be found and counted without opening them.
   See db/README.md. */
"use strict";
const fs = require("fs");
const path = require("path");
const { DatabaseSync } = require("node:sqlite");
const { createCodec } = require("./codec");

const SCHEMA_VERSION = 1;
const SCHEMA = `
  CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL) WITHOUT ROWID;
  CREATE TABLE IF NOT EXISTS sheet (id INTEGER PRIMARY KEY, name TEXT NOT NULL UNIQUE, position INTEGER NOT NULL);
  CREATE TABLE IF NOT EXISTS cell_row (sheet_id INTEGER NOT NULL REFERENCES sheet(id) ON DELETE CASCADE, row_no INTEGER NOT NULL, data BLOB NOT NULL, PRIMARY KEY (sheet_id, row_no)) WITHOUT ROWID;
  CREATE TABLE IF NOT EXISTS prop (key TEXT PRIMARY KEY, value BLOB NOT NULL) WITHOUT ROWID;
`;

function open(file, vault) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec("PRAGMA journal_mode = WAL; PRAGMA synchronous = FULL; PRAGMA foreign_keys = ON;");
  db.exec(SCHEMA);
  const codec = createCodec(vault);
  const q = {
    meta: db.prepare("SELECT value FROM meta WHERE key = ?"),
    setMeta: db.prepare("INSERT INTO meta(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"),
    sheets: db.prepare("SELECT id, name FROM sheet ORDER BY position"),
    rows: db.prepare("SELECT row_no, data FROM cell_row WHERE sheet_id = ? ORDER BY row_no"),
    props: db.prepare("SELECT key, value FROM prop"),
    upsertSheet: db.prepare("INSERT INTO sheet(id, name, position) VALUES(?, ?, ?) ON CONFLICT(id) DO UPDATE SET name = excluded.name, position = excluded.position"),
    dropSheet: db.prepare("DELETE FROM sheet WHERE id = ?"),
    upsertRow: db.prepare("INSERT INTO cell_row(sheet_id, row_no, data) VALUES(?, ?, ?) ON CONFLICT(sheet_id, row_no) DO UPDATE SET data = excluded.data"),
    dropRowsFrom: db.prepare("DELETE FROM cell_row WHERE sheet_id = ? AND row_no >= ?"),
    upsertProp: db.prepare("INSERT INTO prop(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"),
    dropProp: db.prepare("DELETE FROM prop WHERE key = ?"),
    allSheetIds: db.prepare("SELECT id FROM sheet")
  };
  const written = new Map(); // "sheetId:row" -> the text last written, so unchanged rows are not written again
  const writtenProps = new Map();

  function transaction(fn) {
    db.exec("BEGIN IMMEDIATE");
    try { fn(); db.exec("COMMIT"); } catch (e) { try { db.exec("ROLLBACK"); } catch (e2) { /* already closed */ } throw e; }
  }

  function getMeta(key) { const r = q.meta.get(key); return r ? r.value : null; }
  function setMeta(key, value) { q.setMeta.run(key, String(value)); }

  function load() {
    const book = { sheets: [], props: {} };
    for (const s of q.sheets.all()) {
      const rows = [];
      for (const r of q.rows.all(s.id)) { const row = codec.unpack(r.data); rows[r.row_no] = row; written.set(s.id + ":" + r.row_no, JSON.stringify(row)); }
      for (let i = 0; i < rows.length; i++) if (rows[i] === undefined) rows[i] = [];
      book.sheets.push({ name: s.name, id: s.id, rows });
    }
    for (const p of q.props.all()) { const v = codec.unpack(p.value); book.props[p.key] = v; writtenProps.set(p.key, JSON.stringify(v)); }
    return book;
  }

  // dirty: Set of sheet objects that changed, or null for "check everything"; propsDirty: whether settings changed.
  function save(book, dirty, propsDirty) {
    transaction(() => {
      const ids = new Set(book.sheets.map((s) => s.id));
      for (const r of q.allSheetIds.all()) if (!ids.has(r.id)) { q.dropSheet.run(r.id); for (const k of [...written.keys()]) if (k.startsWith(r.id + ":")) written.delete(k); }
      book.sheets.forEach((s, pos) => {
        if (dirty && !dirty.has(s)) return;
        q.upsertSheet.run(s.id, s.name, pos);
        s.rows.forEach((row, i) => {
          const text = JSON.stringify(row || []), key = s.id + ":" + i;
          if (written.get(key) === text) return;
          q.upsertRow.run(s.id, i, codec.pack(row || [])); written.set(key, text);
        });
        q.dropRowsFrom.run(s.id, s.rows.length);
        for (const k of [...written.keys()]) if (k.startsWith(s.id + ":") && Number(k.slice(String(s.id).length + 1)) >= s.rows.length) written.delete(k);
      });
      if (propsDirty !== false) {
        for (const [k, v] of Object.entries(book.props)) { const text = JSON.stringify(v); if (writtenProps.get(k) !== text) { q.upsertProp.run(k, codec.pack(v)); writtenProps.set(k, text); } }
        for (const k of [...writtenProps.keys()]) if (!(k in book.props)) { q.dropProp.run(k); writtenProps.delete(k); }
      }
    });
  }

  // Used only when a workbook file is imported into an empty database (db/migrate.js).
  function replaceAll(book) {
    transaction(() => { db.exec("DELETE FROM cell_row; DELETE FROM sheet; DELETE FROM prop;"); written.clear(); writtenProps.clear(); });
    save(book, null, true);
  }
  function isEmpty() { return q.allSheetIds.all().length === 0 && q.props.all().length === 0; }
  function check() { const r = db.prepare("PRAGMA integrity_check").get(); return r && Object.values(r)[0] === "ok"; }
  function counts() {
    const tabs = db.prepare("SELECT COUNT(*) n FROM sheet").get().n, rows = db.prepare("SELECT COUNT(*) n FROM cell_row").get().n;
    return { tabs, rows };
  }
  function close() { try { db.exec("PRAGMA wal_checkpoint(TRUNCATE)"); } catch (e) { /* ignore */ } db.close(); }

  if (getMeta("schema_version") === null) setMeta("schema_version", SCHEMA_VERSION);
  return { load, save, replaceAll, isEmpty, check, counts, getMeta, setMeta, close, file };
}

module.exports = { open, SCHEMA_VERSION };
