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

test("an ID listed twice is kept once and reported, never silently merged with another name", () => {
  const b = backendIn(tmp("cm-dup-"));
  b.sheet("Roster", true).clear();
  b.sheet("Roster").getRange(1, 1, 4, 2).setValues([["Student ID", "Name"], ["20004444", "Ama"], ["20004444", "Ama B"], ["20005555", "Yaw"]]);
  b.flush();
  assert.deepEqual(b.students.list(), [{ id: "20004444", name: "Ama" }, { id: "20005555", name: "Yaw" }]);
  assert.deepEqual(b.students.issues().duplicateIds, ["20004444"]);
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
