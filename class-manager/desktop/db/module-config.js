"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");
const { createCodec } = require("./codec");
const { defaultModules, validateModules } = require("../module-registry");

const VERSION = 1;

class CourseMigrationError extends Error {
  constructor(file, cause, snapshot) {
    super("Course database " + file + ": " + cause.message +
      (snapshot ? " Recovery snapshot: " + snapshot : ""), { cause });
    this.name = "CourseMigrationError";
  }
}

function hasTable(db, name) {
  return !!db.prepare("SELECT 1 FROM sqlite_schema WHERE type = 'table' AND name = ?").get(name);
}

function readConfig(db) {
  if (!hasTable(db, "course_modules")) return null;
  const rows = db.prepare("SELECT id, version, enabled FROM course_modules").all();
  if (rows.length !== 1 || rows[0].id !== 1) throw new Error("The course module configuration is incomplete.");
  if (rows[0].version !== VERSION) throw new Error("Unsupported course module version: " + rows[0].version);
  return validateModules(JSON.parse(rows[0].enabled));
}

function verifySnapshot(file, vault) {
  const db = new DatabaseSync(file, { readOnly: true });
  try {
    const results = db.prepare("PRAGMA integrity_check").all();
    if (results.length !== 1 || results[0].integrity_check !== "ok") throw new Error("The recovery snapshot failed its integrity check.");
    const { unpack } = createCodec(vault);
    for (const [table, column] of [["cell_row", "data"], ["prop", "value"], ["student", "data"], ["id_notice", "data"]]) {
      if (!hasTable(db, table)) continue;
      for (const row of db.prepare("SELECT " + column + " AS payload FROM " + table).iterate()) unpack(row.payload);
    }
  } finally {
    db.close();
  }
}

// Run before opening the course for normal writes or replacing it from a workbook.
function preflight(file, vault, schemaVersion, initialModules = defaultModules()) {
  if (!fs.existsSync(file)) return { enabled: validateModules(initialModules) };
  let db, directory, snapshot, inspected = false;
  try {
    db = new DatabaseSync(file, { readOnly: true });
    const hasMeta = hasTable(db, "meta");
    inspected = true;
    if (hasMeta) {
      const marker = db.prepare("SELECT value FROM meta WHERE key = 'schema_version'").get();
      if (marker && String(marker.value) !== String(schemaVersion)) {
        throw new Error("Unsupported course database schema version: " + marker.value);
      }
    }
    const enabled = readConfig(db);
    if (enabled !== null) return { enabled };
    directory = fs.mkdtempSync(path.join(path.dirname(file), "module-migration-"));
    // Reserve a private file before SQLite writes it. VACUUM INTO includes committed WAL state.
    snapshot = path.join(directory, "course.db");
    fs.closeSync(fs.openSync(snapshot, "wx", 0o600));
    db.prepare("VACUUM INTO ?").run(snapshot);
    verifySnapshot(snapshot, vault);
    return { enabled: defaultModules(), snapshot };
  } catch (error) {
    // Keep the established unreadable-file recovery only for files that cannot be recognized as SQLite.
    if (!inspected && [11, 26].includes(error.errcode)) return { enabled: defaultModules() };
    if (directory) {
      try { fs.rmSync(directory, { recursive: true, force: true }); } catch { /* preserve the original error */ }
    }
    throw new CourseMigrationError(file, error);
  } finally {
    if (db) db.close();
  }
}

function initialize(db, enabled) {
  if (readConfig(db.raw) !== null) return;
  const value = JSON.stringify(validateModules(enabled));
  db.transaction(() => {
    db.raw.exec("CREATE TABLE course_modules (id INTEGER PRIMARY KEY CHECK (id = 1), version INTEGER NOT NULL, enabled TEXT NOT NULL)");
    db.raw.prepare("INSERT INTO course_modules (id, version, enabled) VALUES (1, ?, ?)").run(VERSION, value);
    readConfig(db.raw);
  });
}

function save(db, enabled) {
  const ids = validateModules(enabled);
  db.transaction(() => {
    db.raw.prepare("UPDATE course_modules SET enabled = ? WHERE id = 1 AND version = ?").run(JSON.stringify(ids), VERSION);
    const stored = readConfig(db.raw);
    if (JSON.stringify(stored) !== JSON.stringify(ids)) throw new Error("The course module configuration was not saved.");
  });
  return ids;
}

module.exports = { CourseMigrationError, preflight, initialize, save, readConfig };
