"use strict";
// Course details found in loaded files, and IDs that do not conform to the class list. Made-up data only.
const test = require("node:test");
const assert = require("node:assert");
const { findDetails, isoDate } = require("../autoload/course-details");
const { plan } = require("../import-plan");

test("dates are read in the common layouts", () => {
  assert.strictEqual(isoDate("04/11/2026"), "2026-11-04");
  assert.strictEqual(isoDate("2026-11-04"), "2026-11-04");
  assert.strictEqual(isoDate("4 November 2026"), "2026-11-04");
  assert.strictEqual(isoDate("31/02/2026"), "");
  assert.strictEqual(isoDate("hello"), "");
});

test("labelled details are found with the file they came from", () => {
  const f = findDetails([{ file: "info/PHYS 143 outline.xlsx", rows: [
    ["Course code:", "PHYS 143"], ["Course title", "Mechanics and Waves"], ["Lecturer: Dr Test Person"], ["Semester", "First semester 2026/27"],
    ["First day of teaching", "02/11/2026"], ["Last day of teaching", "2027-02-26"], ["Class times", "Tuesday 09:30 to 11:20"]] }], new Date(Date.UTC(2026, 10, 18)));
  assert.strictEqual(f.code.value, "PHYS 143"); assert.strictEqual(f.title.value, "Mechanics and Waves"); assert.strictEqual(f.lecturer.value, "Dr Test Person");
  assert.strictEqual(f.semester.value, "First semester 2026/27"); assert.strictEqual(f.start.value, "2026-11-02"); assert.strictEqual(f.end.value, "2027-02-26");
  assert.strictEqual(f.times.value, "Tuesday 09:30 to 11:20");
  assert.strictEqual(f.week.value, "3"); assert.ok(f.week.worked); assert.strictEqual(f.code.from, "info/PHYS 143 outline.xlsx");
});

test("a course code is taken from file names when no cell gives it, and ID-like words are not codes", () => {
  const f = findDetails([{ file: "PHYS143_GROUP_E.csv", rows: [["Student ID", "Name"]] }, { file: "PHYS 143 Quizzes.xlsx", rows: [] }]);
  assert.strictEqual(f.code.value, "PHYS 143");
  assert.deepStrictEqual(findDetails([{ file: "ID 1234.csv", rows: [] }]), {});
});

test("nothing found means nothing suggested", () => {
  assert.deepStrictEqual(findDetails([{ file: "scores.csv", rows: [["Student ID", "Marks"], ["20000001", "7"]] }]), {});
});

test("IDs that do not conform to the class list are flagged and never added silently", () => {
  const local = { read: (n) => (n === "Roster" ? [["Student ID", "Name"], ["20000001", "A"], ["20000002", "B"]] : []) };
  const book = [{ name: "Attendance", rows: [["Student ID", "04/11/2026"], ["20000001", 1], ["20009999", 1], ["123", 1], ["20000002", 1]] }];
  const r = plan(book, local, { onlyClassList: true, addMissing: false }).report.students;
  assert.strictEqual(r.flaggedCount, 2);
  assert.deepStrictEqual(r.flagged.map((x) => x.why).sort(), ["not a valid student ID (4 to 12 digits)", "not on the class list"]);
  assert.strictEqual(r.toAdd, 0);
  const withAdd = plan(book, local, { onlyClassList: true, addMissing: true }).report.students;
  assert.strictEqual(withAdd.flaggedCount, 2); assert.strictEqual(withAdd.toAdd, 1, "only the valid ID is added, and only when ticked");
});
