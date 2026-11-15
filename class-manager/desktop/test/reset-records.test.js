/* Reset erases everything one course keeps, and only that course; a following import reports truthfully. */
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { createBackend } = require("../backend");
const { resetCourse, describe } = require("../course-reset");
const { sampleClass } = require("./sample-class");
const { makeXlsx } = require("./web-export");
const { classroom } = require("./classroom");

const WEB = path.resolve(__dirname, "..", "..");
const tmp = (p) => fs.mkdtempSync(path.join(os.tmpdir(), p));
const open = (base) => createBackend({ webRoot: WEB, dataFile: path.join(base, "data", "workbook.json"), log: () => {} });

// A course folder as CM makes it: data (database), notes, backups, sync state, a linked place, settings.
function makeCourse(root, id, ids) {
  const base = path.join(root, "courses", id); fs.mkdirSync(path.join(base, "notes"), { recursive: true }); fs.mkdirSync(path.join(base, "backups"), { recursive: true });
  fs.writeFileSync(path.join(base, "settings.json"), JSON.stringify({ courseCode: id }));
  fs.writeFileSync(path.join(base, "notes", "n.md"), "note about a student"); fs.writeFileSync(path.join(base, "backups", "workbook-1.cmv"), "old copy");
  fs.writeFileSync(path.join(base, "sync-state.bin"), "x"); fs.writeFileSync(path.join(base, "sync-device.json"), "{}");
  fs.writeFileSync(path.join(base, "linked-folder.json"), JSON.stringify({ folder: "/somewhere", items: { notes: "sync", attendance: "sync", classList: "sync" } }));
  const b = open(base), s = sampleClass(); // the same student IDs in both courses on purpose
  Object.entries(s.tabs).forEach(([name, rows]) => b.setRows(name, rows));
  b.rosterSync(ids.map((x) => [x, "N" + x]), true); b.setSecret("relay.private", "key"); b.receipts.put("k1", "{}");
  return { base, b };
}
const dataRows = (b) => b.tabs().filter((t) => t.name !== "Key").reduce((n, t) => n + Math.max(0, t.rows - 1), 0);

test("reset everything leaves no records of the course, and no other course is touched", () => {
  const root = tmp("cm-rs-"), s = sampleClass();
  const A = makeCourse(root, "phys-143", s.ids), B = makeCourse(root, "math-101", s.ids);
  assert.ok(dataRows(A.b) > 100 && A.b.students.count() === s.ids.length);
  const beforeB = JSON.stringify(B.b.exportText());
  A.b.close();
  const r = resetCourse(A.base, "all");
  assert.equal(r.ok, true); assert.equal(r.unlinked, true);
  ["data", "notes", "backups", "sync-state.bin", "sync-device.json"].forEach((x) => assert.ok(r.moved.includes(x), x + " moved"));
  ["notes", "backups", "sync-state.bin", "sync-device.json"].forEach((x) => assert.ok(!fs.existsSync(path.join(A.base, x)), x + " is gone from the course"));
  const fresh = open(A.base);
  const brandNew = open(tmp("cm-new-")); // the same as a course that was never used
  assert.deepEqual(fresh.tabs(), brandNew.tabs(), "every tab is as in a new course: no attendance, no records");
  assert.equal(dataRows(fresh), dataRows(brandNew)); brandNew.close();
  assert.ok(!fresh.tabs().some((t) => ["Attendance", "Attendance_Log", "Attempts", "Item_Log", "Presence", "Access_Codes", "Groups", "Messages"].includes(t.name)), "no record tabs exist at all");
  assert.equal(fresh.students.count(), 0); assert.equal(fresh.secret("relay.private"), null); assert.equal(fresh.receipts.get("k1"), null);
  assert.deepEqual(fresh.rawRows("Roster").slice(1), []);
  assert.equal(JSON.parse(fs.readFileSync(path.join(A.base, "linked-folder.json"), "utf8")).items.attendance, "local", "nothing is pulled back from the linked place");
  fresh.close();
  // The other course, with the same IDs, is exactly as it was.
  assert.equal(JSON.stringify(B.b.exportText()), beforeB); assert.equal(B.b.students.count(), s.ids.length);
  assert.ok(dataRows(B.b) > 100);
  B.b.close();
});

test("reset setup only keeps the records", () => {
  const root = tmp("cm-rs2-"), A = makeCourse(root, "c1", ["20001111"]); A.b.close();
  const r = resetCourse(A.base, "setup");
  assert.ok(!r.moved.includes("data") && !r.moved.includes("notes"));
  const b = open(A.base); assert.equal(b.students.count(), 1); b.close();
});

test("erase for good deletes the moved-aside copy; the screen lists exactly what goes", () => {
  const root = tmp("cm-rs3-"), A = makeCourse(root, "c1", ["20001111"]); A.b.close();
  const r = resetCourse(A.base, "all", { discardUndo: true });
  assert.equal(r.discarded, true);
  assert.deepEqual(fs.readdirSync(A.base).filter((x) => /^reset-/.test(x)), []);
  assert.ok(describe("all").some((x) => /Attendance/.test(x)) && describe("all").some((x) => /backup/i.test(x)));
});

test("after a reset the import preview tells the truth: with 'add the students' ticked they are counted as new", async () => {
  const handlers = new Map(), s = sampleClass(), root = tmp("cm-rsi-");
  const file = path.join(root, "PHYS 143 Quizzes (Responses).xlsx");
  fs.writeFileSync(file, await makeXlsx(Object.entries(s.tabs).map(([name, rows]) => ({ name, rows }))));
  const c = classroom(); c.id = "t1"; c.backups = { make: () => ({ ok: true, name: "b" }) };
  require("../import-ipc").register({ on: (ch, fn) => handlers.set(ch, fn), dialog: { showOpenDialog: async () => ({ canceled: false, filePaths: [file] }) }, winOf: () => null, shell: null });
  const e = { sender: { send() {} } }, call = (ch, ...a) => handlers.get(ch)(c, e, ...a);
  const off = await call("cm:importPick", { addMissing: false });
  assert.equal(off.report.students.classList, 0);
  assert.ok(off.report.students.notOnList >= s.ids.length && off.report.students.notOnListIds.length > 0, "unmatched IDs are listed, not dropped");
  assert.equal(off.report.changes, 0);
  const on = await call("cm:importPick", { addMissing: true }); // what the screen shows when its box is ticked
  assert.equal(on.report.students.notOnList, 0); assert.ok(on.report.students.toAdd >= s.ids.length); assert.ok(on.report.changes > 0, "the file is not 'nothing new'");
});
