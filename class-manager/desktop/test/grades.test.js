/* The clean Grades table (grades/): ordered columns, one column per quiz week, "no record", real times, timeline, Excel layout. */
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { createBackend } = require("../backend");
const { sampleClass } = require("./sample-class");
const { build, practiceLabel } = require("../grades/build");
const vm = require("../grades/view-model");
const { toMs, shown } = require("../grades/times");

const WEB = path.resolve(__dirname, "..", "..");
const sample = sampleClass();
const backend = createBackend({ webRoot: WEB, dataFile: path.join(fs.mkdtempSync(path.join(os.tmpdir(), "cm-gr-")), "workbook.json"), log: () => {} });
Object.entries(sample.tabs).forEach(([name, rows]) => backend.setRows(name, rows));
backend.rosterSync(sample.ids.map((id, i) => [id, "S" + i]), true);
const read = (n) => backend.rawRows(n);
const g = build(read), v = vm.forScreen(g);

test("columns are grouped and ordered, with no duplicates", () => {
  assert.deepEqual(v.groups.map((x) => x.label), ["Attendance", "Quizzes", "Practice"]);
  const labels = v.columns.map((c) => c.group + ":" + c.label);
  assert.equal(new Set(labels).size, labels.length);
  assert.deepEqual(v.columns.filter((c) => c.group === "Quizzes").map((c) => c.label), ["Week 1", "Week 2", "Week 3", "Week 4"]);
  assert.ok(!v.columns.some((c) => /taken|code/i.test(c.label)), "no stray columns");
});

test("one live quiz week is one column even when two join codes were used", () => {
  const rows = [["Timestamp", "First Name", "ID", "Join Code", "Q1", "Q2", "Q3", "Q4", "Q5", "Score", "Round", "Questions", "Answers", "Week"],
    ["2026-11-01T10:00:00Z", "A", "10690001", "111", "", "", "", "", "", 2, 0, 5, "", 1], ["2026-11-01T11:00:00Z", "A", "10690001", "222", "", "", "", "", "", 4, 0, 5, "", 1]];
  const t = build((n) => (n === "Form Responses 1" ? rows : n === "Roster" ? [["ID", "Name"], ["10690001", "A"]] : null));
  assert.equal(t.groups[0].columns.length, 1);
  assert.equal(t.rows[0].cells["q:w1"].t, "4 / 5", "the latest try is the one shown");
});

test("a student with no records reads 'no record' and a score reads as a score", () => {
  const empty = build((n) => (n === "Roster" ? [["ID", "Name"], ["20001111", "Nobody"]] : null)), ev = vm.forScreen(empty);
  assert.equal(ev.rows[0].lastText, "no record");
  assert.equal(ev.summary.withRecords, 0);
  const first = v.rows[0], q = first.cells["q:w1"];
  assert.match(q.t, /^\d \/ 5$/); assert.ok(q.when.length > 8);
});

test("every value carries the time it was entered, and the times differ", () => {
  const whens = new Set(); v.rows.forEach((r) => v.columns.forEach((c) => { if (r.cells[c.key].when) whens.add(r.cells[c.key].when); }));
  assert.ok(whens.size > 10, "many different entry times, not one import time");
  const s = g.rows[0], times = Object.values(s.cells).map((c) => c.at).filter((x) => x !== null);
  assert.equal(s.last, Math.max(...times, ...g.entries(s.id).map((e) => e.at || 0)));
});

test("a student's timeline is dated, newest first, and covers attendance, quizzes and practice", () => {
  const e = g.entries(g.rows[0].id);
  for (let i = 1; i < e.length; i++) assert.ok(e[i - 1].at >= e[i].at);
  assert.deepEqual([...new Set(e.map((x) => x.kind))].sort(), ["Attendance", "Practice", "Quiz"]);
  assert.ok(vm.timelineForScreen(e)[0].when);
});

test("Excel follows the screen: Grades first, then Timeline", () => {
  const sheets = vm.forExcel(g, (id) => g.entries(id));
  assert.deepEqual(sheets.map((s) => s.name), ["Grades", "Timeline"]);
  assert.deepEqual(sheets[0].rows[0].slice(0, 3), ["Student ID", "Name", "Attendance: Sessions attended"]);
  assert.equal(sheets[0].rows[0].at(-1), "Last activity");
  assert.equal(sheets[0].rows.length, v.rows.length + 1);
  assert.ok(sheets[1].rows.length > v.rows.length);
});

test("times in any record format are read; marks are not mistaken for times", () => {
  assert.equal(toMs("2026-11-12T03:13:48Z"), Date.parse("2026-11-12T03:13:48Z"));
  assert.equal(toMs("12/11/2026 03:13:48"), new Date(2026, 10, 12, 3, 13, 48).getTime());
  assert.equal(toMs(5), null); assert.equal(toMs(""), null);
  assert.match(shown(new Date(2026, 10, 12, 14, 5).getTime()), /^12 Nov 2026, 14:05$/);
  assert.equal(practiceLabel("Lecture 3 practice").label, "Lecture 3"); assert.equal(practiceLabel("Lecture 3 (missed only)"), null);
});
