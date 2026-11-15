/* The student table (db/students.js): unique IDs, equal to the class list, readable only through CM, and in the Excel workbook. */
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { createBackend } = require("../backend");
const excel = require("../excel");

const WEB = path.resolve(__dirname, "..", "..");
const tmp = (p) => fs.mkdtempSync(path.join(os.tmpdir(), p));
const backendIn = (dir) => createBackend({ webRoot: WEB, dataFile: path.join(dir, "workbook.json"), log: () => {} });

test("the student table follows the class list, one row per ID", () => {
  const dir = tmp("cm-stu-"); const b = backendIn(dir);
  b.rosterSync([["20001111", "Abena Mensah"], ["20002222", "Kojo"]], true);
  b.flush();
  assert.deepEqual(b.students.list(), [{ id: "20001111", name: "Abena Mensah" }, { id: "20002222", name: "Kojo" }]);
  assert.equal(b.students.has(" 20002222 "), true);
  assert.deepEqual(b.students.get("20001111"), { id: "20001111", name: "Abena Mensah" });
  assert.equal(b.students.get("99999999"), null);
  b.rosterSync([["20003333", "Esi"]], true); b.flush();
  assert.deepEqual(b.students.list().map((s) => s.id), ["20003333"], "removed students leave the table");
  b.close();
  const again = backendIn(dir);
  assert.equal(again.students.count(), 1, "and it is still there after a restart");
  again.close();
});

test("an ID listed twice is merged into one student and reported with both rows, never silently overwritten", () => {
  const b = backendIn(tmp("cm-dup-"));
  b.sheet("Roster", true).clear();
  b.sheet("Roster").getRange(1, 1, 4, 2).setValues([["Student ID", "Name"], ["20004444", "Ama"], ["020004444.0", "Ama B"], ["20005555", "Yaw"]]);
  b.flush();
  assert.deepEqual(b.students.list(), [{ id: "20004444", name: "Ama" }, { id: "20005555", name: "Yaw" }]);
  assert.deepEqual(b.rawRows("Roster").slice(1), [["20004444", "Ama"], ["20005555", "Yaw"]], "one row per student in the class list too");
  const n = b.idNotices();
  assert.equal(n.length, 1); assert.equal(n[0].id, "20004444"); assert.equal(n[0].namesDiffer, true);
  assert.deepEqual(n[0].names.sort(), ["Ama", "Ama B"]);
  assert.equal(n[0].entries.length, 2, "both source rows are shown");
  assert.equal(b.resolveIdNotice("Roster", "20004444", "Ama B"), true);
  assert.equal(b.idNotices().length, 0); assert.equal(b.students.get("20004444").name, "Ama B", "the lecturer's choice");
  b.close();
});

test("IDs and names are not readable in the database file", () => {
  const dir = tmp("cm-stu-enc-");
  const { createVault } = require("../vault");
  const vault = createVault({ keyFile: path.join(dir, "data.key"), protected: true, protect: (x) => x, unprotect: (x) => x });
  const b = createBackend({ webRoot: WEB, dataFile: path.join(dir, "data", "workbook.json"), vault, log: () => {} });
  b.rosterSync([["20006666", "Kwame Boateng"]], true); b.close();
  const raw = fs.readFileSync(path.join(dir, "data", "course.db"));
  assert.ok(!raw.includes("20006666") && !raw.includes("Boateng"));
});

test("the Excel download has a Students sheet first, then one sheet per tab", () => {
  const sheets = excel.resultsSheets([{ name: "Roster" }], () => [["Student ID", "Name"]], [{ id: "1", name: "A" }]);
  assert.deepEqual(sheets.map((s) => s.name), ["Students", "Roster"]);
  assert.deepEqual(sheets[0].rows, [["Student ID", "Name"], ["1", "A"]]);
});
