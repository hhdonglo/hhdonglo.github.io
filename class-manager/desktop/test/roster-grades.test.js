/* "Roster with grades": one row per roster student, quiz dates, quiz average, attendance figures, in the Grades tables, Excel and CSV;
   and the honest count of IDs flagged by imports. */
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { build } = require("../grades/build");
const vm = require("../grades/view-model");
const { withRoster } = require("../grades/roster-table");
const { classroom } = require("./classroom");
const O = require("../offlist");

const FR = ["Timestamp", "First Name", "ID", "Join Code", "Q1", "Q2", "Q3", "Q4", "Q5", "Score", "Round", "Questions", "Answers", "Week"];
const fr = (ts, id, score, week) => [ts, "A", id, "c" + week, "", "", "", "", "", score, 0, 5, "", week];
const data = {
  Roster: [["ID", "Name"], ["10690001", "EVE ONE"], ["10690002", "ZED TWO"], ["10690003", "NO RECORDS"]],
  "Form Responses 1": [FR, fr("2026-11-02T10:00:00Z", "10690001", 5, 1), fr("2026-11-09T10:00:00Z", "10690001", 3, 2), fr("2026-11-09T10:00:00Z", "10690002", 4, 2), fr("2026-11-09T10:00:00Z", "99999999", 5, 2)],
  Attendance: [["ID", "Tue Nov 03 2026", "Tue Nov 10 2026"], ["10690001", 1, 1], ["10690002", 1, 0], ["99999999", 1, 1]]
};
const read = (n) => data[n] || null;
const T = (g) => vm.forScreen(g).tables.find((t) => t.id === "roster");

test("Roster with grades is the first table, one row per roster student, never an unknown ID", () => {
  const v = vm.forScreen(build(read));
  assert.equal(v.tables[0].id, "roster"); assert.equal(v.tables[0].label, "Roster with grades");
  assert.deepEqual(v.tables[0].rows.map((r) => r.id), ["10690001", "10690002", "10690003"]);
});

test("it carries quiz dates, quiz average, sessions attended and attendance percent", () => {
  const t = T(build(read)), lab = t.columns.map((c) => c.label), row = (id) => t.rows.find((r) => r.id === id), cell = (id, l) => row(id).cells[t.columns[lab.indexOf(l)].key];
  assert.ok(lab.includes("Quiz average") && lab.includes("Sessions attended") && lab.includes("Attendance %"));
  assert.equal(cell("10690001", "Quiz average").t, "80%"); // (5/5 + 3/5) / 2
  assert.equal(cell("10690001", "Sessions attended").t, "2 / 2");
  assert.equal(cell("10690002", "Attendance %").t, "50%");
  assert.equal(cell("10690002", "Quiz average").t, "80%");
});

test("a student with no records stays blank and is not counted as having records", () => {
  const t = T(build(read)), r = t.rows.find((x) => x.id === "10690003");
  assert.equal(r.entries, 0); assert.ok(Object.values(r.cells).every((c) => c.empty));
  assert.equal(t.summary.withRecords, 2);
});

test("the other tables are unchanged by it, and Excel and CSV get the sheet first", () => {
  const g = build(read), v = vm.forScreen(g), sheets = vm.forExcel(g, (id) => g.entries(id));
  assert.deepEqual(v.tables.slice(1).map((t) => t.id), ["quizzes", "attendance"]);
  assert.equal(sheets[0].name, "Roster with grades"); assert.equal(sheets[0].rows[0][0], "Student ID"); assert.equal(sheets[0].rows.length, 4);
  assert.equal(withRoster(g).groups.length, g.groups.length + 1); assert.equal(g.groups[0].id !== "roster", true, "build() output is not modified");
});

test("flagged IDs are counted once however many files they came from", () => {
  const c = classroom({ students: 1 }), b = c.backend;
  O.flag(b, [{ id: "22244230" }, { id: "22521330" }], "whole-course.xlsx"); O.flag(b, [{ id: "22244230" }], "attendance.xlsx");
  const s = O.flagSummary(O.flagged(b));
  assert.deepEqual(s, { ids: 2, files: 2, entries: 3 }); b.close();
});
