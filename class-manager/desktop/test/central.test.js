/* The ID is the primary key: loads merge by student ID, repeat loads add only what is new, and a different name for the same ID is
   flagged and never written. Also the course reset (course-reset.js). All data is made up. Run with `npm test` in class-manager/desktop. */
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { plan, nameKey } = require("../import-plan");
const { apply } = require("../import-apply");
const { mergeCleans } = require("../autoload/working");
const { resetCourse, listResets, restoreReset } = require("../course-reset");
const { classroom } = require("./classroom");

const tmp = (p) => fs.mkdtempSync(path.join(os.tmpdir(), p));
const local = (c) => ({ read: (n) => c.backend.rows(n) });
const hooks = (c) => ({ addToClassList: (rows) => c.backend.rosterSync(rows, false), rebuild: () => { c.backend.rebuildMarks(); c.backend.buildFromRoster(); } });
const book = (rows) => [{ name: "Roster", rows: [["Student ID", "First name", "Last name"]].concat(rows) }];
const load = (c, rows) => { const p = plan(book(rows), local(c), { addMissing: true }); if (p.report.changes) apply(p.ops, c.backend, hooks(c)); return p.report; };
const nameOf = (c, id) => (c.backend.rows("Roster").find((r) => String(r[0]) === id) || [])[1];

test("names are compared without case, commas or order", () => {
  assert.equal(nameKey("Mensah, Ama"), nameKey("ama MENSAH"));
  assert.notEqual(nameKey("Ama Mensah"), nameKey("Ama Boateng"));
});

test("repeat loads merge by ID: new students are added, gaps are filled, a different name is flagged and not written", () => {
  const c = classroom();
  let r = load(c, [["20000001", "Ama", "Mensah"], ["20000002", "", ""]]);
  assert.equal(r.students.toAdd, 2);
  assert.equal(nameOf(c, "20000001"), "Ama Mensah");
  r = load(c, [["20000001", "Ama", "Mensah"], ["20000002", "Kofi", "Boateng"], ["20000003", "Efua", "Owusu"]]);
  assert.equal(r.students.toAdd, 1, "only the new student is added");
  assert.equal(r.students.namesFilled, 1, "the student with no name is given one");
  assert.equal(r.students.nameConflicts, 0);
  assert.equal(nameOf(c, "20000002"), "Kofi Boateng");
  r = load(c, [["20000001", "Ama", "Boateng"]]); // same ID, another name
  assert.equal(r.students.nameConflicts, 1);
  assert.deepEqual(r.students.conflicts[0], { id: "20000001", existing: "Ama Mensah", incoming: "Ama Boateng" });
  assert.equal(nameOf(c, "20000001"), "Ama Mensah", "the existing name is kept");
  const again = plan(book([["20000001", "Ama", "Mensah"], ["20000002", "Kofi", "Boateng"], ["20000003", "Efua", "Owusu"]]), local(c), { addMissing: true });
  assert.equal(again.report.changes, 0, "loading the same file again changes nothing");
});

test("two files that give one ID two names are flagged and the first name is kept", () => {
  const a = { classList: [["20000001", "Ama", "Mensah"]], results: [], attempts: [], attendance: { sessions: [], rows: [] }, questions: [] };
  const b = { classList: [["20000001", "Abena", "Mensah"], ["20000002", "Kofi", "Boateng"]], results: [], attempts: [], attendance: { sessions: [], rows: [] }, questions: [] };
  const m = mergeCleans([a, b]);
  assert.deepEqual(m.classList.map((r) => r.join(" ")), ["20000001 Ama Mensah", "20000002 Kofi Boateng"]);
  assert.equal(m.conflicts.length, 1);
});

test("a large load is planned quickly", () => {
  const c = classroom(), rows = [];
  for (let i = 0; i < 20000; i++) rows.push([String(30000000 + i), "F" + i, "L" + i]);
  const t0 = Date.now(); const p = plan(book(rows), local(c), { addMissing: true });
  assert.equal(p.report.students.toAdd, 20000); assert.ok(Date.now() - t0 < 3000, "took " + (Date.now() - t0) + " ms");
});

function courseFolder(linked) {
  const base = tmp("cm-reset-");
  fs.writeFileSync(path.join(base, "settings.json"), '{"courseCode":"PHYS 143"}');
  fs.mkdirSync(path.join(base, "course")); fs.writeFileSync(path.join(base, "course", "lecture1.json"), "{}");
  fs.mkdirSync(path.join(base, "authoring")); fs.mkdirSync(path.join(base, "working")); fs.mkdirSync(path.join(base, "data")); fs.writeFileSync(path.join(base, "data", "workbook.json"), "RECORDS");
  fs.mkdirSync(path.join(base, "backups")); fs.writeFileSync(path.join(base, "backups", "b.cmv"), "B");
  return base;
}

test("reset: setup only moves the setup aside, keeps the records and the backups, and can be restored", () => {
  const base = courseFolder();
  const r = resetCourse(base, "setup");
  assert.ok(r.ok);
  assert.deepEqual(r.moved.sort(), ["authoring", "course", "settings.json", "working"]);
  assert.ok(!fs.existsSync(path.join(base, "settings.json")));
  assert.equal(fs.readFileSync(path.join(base, "data", "workbook.json"), "utf8"), "RECORDS");
  assert.ok(fs.existsSync(path.join(base, "backups", "b.cmv")));
  assert.equal(fs.readFileSync(path.join(base, r.name, "settings.json"), "utf8").includes("PHYS 143"), true, "moved, not deleted");
  assert.equal(listResets(base).length, 1);
  const back = restoreReset(base, r.name);
  assert.ok(back.ok);
  assert.ok(fs.existsSync(path.join(base, "course", "lecture1.json")));
  assert.equal(listResets(base).length, 0);
});

test("reset: setup and records also moves the data; restoring over a newer start sets that aside first", () => {
  const base = courseFolder();
  const r = resetCourse(base, "all", { now: new Date(2026, 10, 11, 20, 0, 0) });
  assert.ok(r.moved.includes("data"));
  fs.mkdirSync(path.join(base, "data")); fs.writeFileSync(path.join(base, "data", "workbook.json"), "NEW");
  const back = restoreReset(base, r.name);
  assert.ok(back.ok && back.setAside);
  assert.equal(fs.readFileSync(path.join(base, "data", "workbook.json"), "utf8"), "RECORDS");
  assert.equal(fs.readFileSync(path.join(base, back.setAside, "data", "workbook.json"), "utf8"), "NEW", "nothing is lost by a restore");
});

test("reset: a linked content folder is never touched, and a bad scope or name does nothing", () => {
  const base = courseFolder();
  const r = resetCourse(base, "setup", { linked: true });
  assert.ok(!r.moved.includes("course"));
  assert.ok(fs.existsSync(path.join(base, "course")));
  assert.equal(resetCourse(base, "everything").ok, false);
  assert.equal(restoreReset(base, "../etc").ok, false);
});
