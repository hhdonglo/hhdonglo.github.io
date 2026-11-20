"use strict";

const fs = require("node:fs");
const { DatabaseSync } = require("node:sqlite");
const { createCodec } = require("../db/codec");
const { readConfig } = require("../db/module-config");
const { defaultModules } = require("../module-registry");

const eventTables = ["Attendance_Control", "Quiz_Control", "Form Responses 1", "Staged_Quiz"];
function snapshot(file, vault) {
  if (!fs.existsSync(file)) return { rawRows: () => [], secret: () => null, enabledModules: defaultModules };
  const db = new DatabaseSync(file, { readOnly: true });
  try {
    const { unpack } = createCodec(vault);
    const enabled = readConfig(db) || defaultModules();
    const rows = db.prepare("SELECT row_no, data FROM cell_row JOIN sheet ON sheet.id = cell_row.sheet_id WHERE sheet.name = ? ORDER BY row_no");
    const tables = new Map(eventTables.map(name => [name, rows.all(name).map(row => unpack(row.data))]));
    const prop = db.prepare("SELECT value FROM prop WHERE key = ?").get("cm.secret.academic-memory");
    const memory = prop ? unpack(prop.value) : null;
    return { rawRows: name => tables.get(name) || [], secret: () => memory, enabledModules: () => enabled };
  } finally {
    db.close();
  }
}

module.exports = { snapshot };
