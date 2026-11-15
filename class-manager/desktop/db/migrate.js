/* Opening a course's database, and the safe import of an older workbook.json.
   One responsibility: decide what is on disk and bring it to a database that has been checked.
   Rules (they exist so that no course data is ever lost or damaged):
   - workbook.json, if present, is an INBOX: a first start after the upgrade, or a restored backup, drops one there.
   - The inbox is imported into a NEW database file, read back and compared (tabs, rows, every cell) with the source.
     Only then does it replace the old database. The old database and the inbox are kept, renamed, never deleted.
   - A database that cannot be opened or read (another computer's key, damage) is moved aside and reported; it is never overwritten. */
"use strict";
const fs = require("fs");
const path = require("path");
const store = require("./store");
const { toJson, fromJson } = require("./codec");

const stampNow = () => new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14) + String(Date.now() % 1000).padStart(3, "0");

function parseWorkbookText(text) {
  const book = fromJson(text);
  if (!book || !Array.isArray(book.sheets)) throw new Error("not a Class Manager workbook");
  if (!book.props || typeof book.props !== "object") book.props = {};
  book.sheets.forEach((s, i) => { s.id = i + 1; s.rows = (s.rows || []).map((r) => (Array.isArray(r) ? r : [])); });
  return book;
}
const sorted = (o) => Object.keys(o).sort().map((k) => [k, o[k]]); // the database returns settings in key order
function sameBook(a, b) { return toJson({ s: a.sheets.map((x) => [x.name, x.rows]), p: sorted(a.props) }) === toJson({ s: b.sheets.map((x) => [x.name, x.rows]), p: sorted(b.props) }); }

function moveAside(file, why) {
  const aside = file.replace(/\.db$/, "") + ".unreadable-" + stampNow() + ".db";
  for (const ext of ["", "-wal", "-shm"]) { try { if (fs.existsSync(file + ext)) fs.renameSync(file + ext, aside + ext); } catch (e) { if (!ext) throw e; } }
  return { file: aside, why };
}

// Imports workbook text into a new database next to dbFile, checks it, then puts it in place.
function importWorkbook(dbFile, text, vault) {
  const book = parseWorkbookText(text);
  const tmp = dbFile + ".new";
  for (const ext of ["", "-wal", "-shm"]) { try { fs.unlinkSync(tmp + ext); } catch (e) { /* none */ } }
  const s = store.open(tmp, vault);
  s.replaceAll(book); s.setMeta("imported_from", "workbook.json"); s.setMeta("imported_at", new Date().toISOString());
  const back = s.load();
  const ok = s.check() && sameBook(book, back);
  s.close();
  if (!ok) { for (const ext of ["", "-wal", "-shm"]) { try { fs.unlinkSync(tmp + ext); } catch (e) { /* none */ } } throw new Error("the imported copy did not match the workbook, so nothing was changed"); }
  let replaced = null;
  if (fs.existsSync(dbFile)) { replaced = dbFile.replace(/\.db$/, "") + ".replaced-" + stampNow() + ".db"; for (const ext of ["", "-wal", "-shm"]) { try { if (fs.existsSync(dbFile + ext)) fs.renameSync(dbFile + ext, replaced + ext); } catch (e) { /* ignore */ } } }
  fs.renameSync(tmp, dbFile);
  return { tabs: book.sheets.length, rows: book.sheets.reduce((n, x) => n + x.rows.length, 0), replaced };
}

// Opens the course. Returns {db, book, loadProblem, imported}.
function openCourse(opts) {
  const { dbFile, jsonFile, vault } = opts, log = opts.log || (() => {});
  let loadProblem = null, imported = null;
  if (jsonFile && fs.existsSync(jsonFile)) {
    try {
      const raw = fs.readFileSync(jsonFile);
      imported = importWorkbook(dbFile, vault ? vault.decode(raw) : raw.toString("utf8"), vault);
      fs.renameSync(jsonFile, jsonFile + ".imported-" + stampNow()); // kept: the original is never deleted
      log("workbook imported into the database: " + imported.tabs + " tabs, " + imported.rows + " rows");
    } catch (e) {
      // An inbox file that cannot be used stays exactly where it is, and is reported; the database (if any) is untouched.
      loadProblem = { file: jsonFile, why: String(e.message || e) };
      log("workbook file could not be imported: " + loadProblem.why);
    }
  }
  let db, book;
  try { db = store.open(dbFile, vault); book = db.load(); if (!db.check()) throw new Error("the database failed its integrity check"); }
  catch (e) {
    try { if (db) db.close(); } catch (e2) { /* ignore */ }
    if (!loadProblem) { loadProblem = moveAside(dbFile, String(e.message || e)); log("database could not be read; kept as " + loadProblem.file); }
    db = store.open(dbFile, vault); book = db.load();
  }
  return { db, book, loadProblem, imported };
}

// The course as workbook JSON text (what backups and backup files hold), read from the database file while no course is open.
function readWorkbookText(dbFile, vault) {
  if (!fs.existsSync(dbFile)) return null;
  const s = store.open(dbFile, vault);
  try { const b = s.load(); return toJson({ sheets: b.sheets.map((x) => ({ name: x.name, id: x.id, rows: x.rows })), props: b.props }); } finally { s.close(); }
}

module.exports = { openCourse, importWorkbook, readWorkbookText, parseWorkbookText };
