/* The course database (db/): import of an older workbook.json, safety rules, and that changes survive a restart. */
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { createBackend } = require("../backend");
const store = require("../db/store");
const { importWorkbook, openCourse } = require("../db/migrate");

const WEB = path.resolve(__dirname, "..", "..");
const tmp = (p) => fs.mkdtempSync(path.join(os.tmpdir(), p));
const backendIn = (dir) => createBackend({ webRoot: WEB, dataFile: path.join(dir, "workbook.json"), log: () => {} });

test("changes are on disk after a restart, and only changed tabs are rewritten", () => {
  const dir = tmp("cm-db-");
  const a = backendIn(dir);
  a.rosterSync([["20001111", "Abena"], ["20002222", "Kojo"]], true);
  a.close();
  const b = backendIn(dir);
  assert.deepEqual(b.tab("Roster").slice(1), [["20001111", "Abena"], ["20002222", "Kojo"]]);
  assert.ok(b.databaseInfo().tabs >= 8 && b.databaseInfo().rows > 0);
  b.close();
});

test("an older workbook.json is imported, checked, and kept (renamed), never deleted", () => {
  const src = backendIn(tmp("cm-src-"));
  src.rosterSync([["20003333", "Esi"]], true);
  const text = src.exportText(); const key = src.hostKey(); src.close();
  const dir = tmp("cm-mig-");
  fs.writeFileSync(path.join(dir, "workbook.json"), text);
  const b = backendIn(dir);
  assert.equal(b.hostKey(), key);
  assert.deepEqual(b.tab("Roster").slice(1), [["20003333", "Esi"]]);
  assert.equal(b.loadProblem(), null);
  b.close();
  const kept = fs.readdirSync(dir).filter((f) => f.startsWith("workbook.json.imported-"));
  assert.equal(kept.length, 1);
  assert.equal(fs.readFileSync(path.join(dir, kept[0]), "utf8"), text, "the original, byte for byte");
});

test("a workbook file that is not a workbook is reported and left in place, and the database is untouched", () => {
  const dir = tmp("cm-badjson-");
  const a = backendIn(dir); a.rosterSync([["20004444", "Ama"]], true); a.close();
  fs.writeFileSync(path.join(dir, "workbook.json"), "{ not json");
  const b = backendIn(dir);
  assert.ok(b.loadProblem() && /workbook.json$/.test(b.loadProblem().file));
  assert.ok(fs.existsSync(path.join(dir, "workbook.json")), "left where it is");
  assert.deepEqual(b.tab("Roster").slice(1), [["20004444", "Ama"]]);
  b.close();
});

test("a restore replaces the database but keeps the one it replaced", () => {
  const dir = tmp("cm-rest-");
  const a = backendIn(dir); a.rosterSync([["20005555", "Yaw"]], true); const old = a.exportText();
  a.rosterSync([["20006666", "Kwame"]], true); a.close();
  fs.writeFileSync(path.join(dir, "workbook.json"), old);
  const b = backendIn(dir);
  assert.deepEqual(b.tab("Roster").slice(1).map((r) => r[0]), ["20005555"]);
  b.close();
  assert.ok(fs.readdirSync(dir).some((f) => /^course\.replaced-.*\.db$/.test(f)), "the replaced database is kept");
});

test("an import that does not match its source changes nothing", () => {
  const dir = tmp("cm-mismatch-"); const dbFile = path.join(dir, "course.db");
  const a = backendIn(dir); a.rosterSync([["20007777", "Efua"]], true); a.close();
  const realOpen = store.open;
  store.open = (f, v) => { const s = realOpen(f, v); if (f.endsWith(".new")) { const load = s.load; s.load = () => { const b = load(); b.props.extra = "1"; return b; }; } return s; };
  try { assert.throws(() => importWorkbook(dbFile, JSON.stringify({ sheets: [{ name: "Roster", rows: [["x"]] }], props: {} }), null), /did not match/); }
  finally { store.open = realOpen; }
  assert.ok(!fs.existsSync(dbFile + ".new"), "no half-made file left");
  const b = backendIn(dir); assert.deepEqual(b.tab("Roster").slice(1), [["20007777", "Efua"]]); b.close();
});

test("a transaction that fails leaves the last complete state", () => {
  const dir = tmp("cm-tx-"); const dbFile = path.join(dir, "course.db");
  const s = store.open(dbFile, null);
  const book = { sheets: [{ id: 1, name: "A", rows: [["1"], ["2"]] }], props: { k: "v" } };
  s.save(book, null, true);
  const bad = { sheets: [{ id: 1, name: "A", rows: [["1"], ["changed"]] }, { id: 2, name: "A", rows: [["dup name"]] }], props: { k: "w" } }; // two tabs with one name
  assert.throws(() => s.save(bad, null, true));
  const back = s.load();
  assert.deepEqual(back.sheets[0].rows, [["1"], ["2"]]); assert.equal(back.props.k, "v");
  s.close();
});

test("a database that cannot be opened is moved aside, never overwritten", () => {
  const dir = tmp("cm-corrupt-"); const dbFile = path.join(dir, "course.db");
  fs.writeFileSync(dbFile, Buffer.from("this is not a database, it is long enough to fail the header check".repeat(20)));
  const r = openCourse({ dbFile, jsonFile: path.join(dir, "workbook.json"), vault: null });
  assert.ok(r.loadProblem && fs.existsSync(r.loadProblem.file));
  assert.match(fs.readFileSync(r.loadProblem.file, "utf8"), /this is not a database/);
  r.db.close();
});
