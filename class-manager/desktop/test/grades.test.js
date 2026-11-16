/* The clean Grades table (grades/): ordered columns, one column per quiz date, "no record", real times, timeline, Excel layout. */
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
const g = build(read), v = vm.forScreen(g), T = (id) => v.tables.find((t) => t.id === id);
const FR_HEAD = ["Timestamp", "First Name", "ID", "Join Code", "Q1", "Q2", "Q3", "Q4", "Q5", "Score", "Round", "Questions", "Answers", "Week"];
const fr = (ts, id, code, score, week) => [ts, "A", id, code, "", "", "", "", "", score, 0, 5, "", week];
const ros = [["ID", "Name"], ["10690001", "A"], ["10690002", "B"]];

test("each group is its own table: Quizzes, Attendance, Practice", () => {
  assert.deepEqual(v.tables.map((t) => t.label), ["Quizzes", "Attendance", "Practice"]);
  assert.equal(T("quizzes").columns.length, 4, "four quiz dates");
  assert.ok(!v.tables.some((t) => t.columns.some((c) => /taken|^code|attended|%/i.test(c.label))), "no stray columns");
  assert.ok(T("quizzes").columns.every((c) => /^\d{1,2} [A-Z][a-z]{2} \d{4}$/.test(c.label)), "quiz columns are headed by their date");
  assert.ok(T("attendance").columns.every((c) => /^\d{1,2} [A-Z][a-z]{2} \d{4}( #\d+)?$/.test(c.label)));
});

test("quiz columns run oldest first and every roster student is a row", () => {
  const t = T("quizzes"), times = t.columns.map((c) => Date.parse(c.label + " 12:00"));
  assert.deepEqual(times, times.slice().sort((a, b) => a - b));
  assert.equal(t.rows.length, sample.ids.length);
});

test("a quiz is one column even when two join codes were used, and the latest try shows", () => {
  const rows = [FR_HEAD, fr("2026-11-01T10:00:00Z", "10690001", "111", 2, 1), fr("2026-11-01T11:00:00Z", "10690001", "222", 4, 1)];
  const t = build((n) => (n === "Form Responses 1" ? rows : n === "Roster" ? ros : null));
  assert.equal(t.groups[0].columns.length, 1);
  assert.equal(t.rows[0].cells["q:w1"].t, "4 / 5");
});

test("two quizzes on one day get a clear label; an empty cell is blank; off-roster IDs never become rows", () => {
  const rows = [FR_HEAD, fr("2026-11-02T10:00:00Z", "10690001", "111", 3, 1), fr("2026-11-02T14:00:00Z", "10690002", "222", 5, 2), fr("2026-11-02T14:00:00Z", "99999999", "222", 5, 2)];
  const t = vm.forScreen(build((n) => (n === "Form Responses 1" ? rows : n === "Roster" ? ros : null))).tables[0];
  assert.deepEqual(t.columns.map((c) => c.label), ["2 Nov 2026 (Week 1)", "2 Nov 2026 (Week 2)"]);
  assert.equal(t.rows.length, 2);
  assert.equal(t.rows[0].cells["q:w2"].t, ""); assert.ok(t.rows[0].cells["q:w2"].empty);
});

test("attendance is its own table with one column per session date", () => {
  const grid = [["Student ID", "02/11/2026", "02/11/2026 #2", "03/11/2026"], ["10690001", 1, 0, 1], ["10690002", 0, 1, ""]];
  const t = vm.forScreen(build((n) => (n === "Attendance" ? grid : n === "Roster" ? ros : null))).tables[0];
  assert.deepEqual(t.columns.map((c) => c.label), ["2 Nov 2026", "2 Nov 2026 #2", "3 Nov 2026"]);
  assert.deepEqual(t.rows[0].cells["att:0"].t, "1"); assert.equal(t.rows[0].cells["att:1"].t, "0");
  assert.ok(t.rows[1].cells["att:2"].empty);
});

test("a student with no records has empty cells and a score reads as a score", () => {
  const empty = vm.forScreen(build((n) => (n === "Roster" ? [["ID", "Name"], ["20001111", "Nobody"]] : null)));
  assert.equal(empty.tables.length, 0); assert.equal(empty.summary.withRecords, 0);
  const q = T("quizzes").rows[0].cells[T("quizzes").columns[0].key];
  assert.match(q.t, /^\d \/ 5$/); assert.ok(q.when.length > 8);
});

test("every value carries the time it was entered, and the times differ", () => {
  const whens = new Set(); v.tables.forEach((t) => t.rows.forEach((r) => t.columns.forEach((c) => { if (r.cells[c.key].when) whens.add(r.cells[c.key].when); })));
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

test("Excel follows the screen: one sheet per table (ID, Name, dates), then Timeline", () => {
  const sheets = vm.forExcel(g, (id) => g.entries(id));
  assert.deepEqual(sheets.map((s) => s.name), ["Quizzes", "Attendance", "Practice", "Timeline"]);
  assert.deepEqual(sheets[0].rows[0].slice(0, 2), ["Student ID", "Name"]);
  assert.deepEqual(sheets[0].rows[0].slice(2), T("quizzes").columns.map((c) => c.label));
  assert.equal(sheets[0].rows.length, v.tables[0].rows.length + 1);
  assert.ok(sheets[3].rows.length > v.tables[0].rows.length);
});

test("times in any record format are read; marks are not mistaken for times", () => {
  assert.equal(toMs("2026-11-12T03:13:48Z"), Date.parse("2026-11-12T03:13:48Z"));
  assert.equal(toMs("12/11/2026 03:13:48"), new Date(2026, 10, 12, 3, 13, 48).getTime());
  assert.equal(toMs(5), null); assert.equal(toMs(""), null);
  assert.match(shown(new Date(2026, 10, 12, 14, 5).getTime()), /^12 Nov 2026, 14:05$/);
  assert.equal(practiceLabel("Lecture 3 practice").label, "Lecture 3"); assert.equal(practiceLabel("Lecture 3 (missed only)"), null);
});

test("a session heading that came in as a long date string reads as a clean short date", () => {
  const { sessionLabel, sessionDate } = require("../rules/session-label");
  assert.equal(sessionLabel("Attendance Tue Nov 03 2026 00:00:00 GMT+0000 (Greenwich Mean Time)"), "3 Nov 2026");
  assert.equal(sessionLabel("04/11/2026"), "4 Nov 2026"); assert.equal(sessionLabel("04/11/2026 #2"), "4 Nov 2026 #2");
  assert.equal(sessionLabel("Midterm"), "Midterm"); assert.equal(sessionDate("04/11/2026"), "2026-11-04");
  const grid = [["Student ID", "Attendance Tue Nov 03 2026 00:00:00 GMT+0000 (Greenwich Mean Time)"], ["10690001", 1]];
  const t = vm.forScreen(build((n) => (n === "Attendance" ? grid : n === "Roster" ? ros : null))).tables[0];
  assert.deepEqual(t.columns.map((c) => c.label), ["3 Nov 2026"]);
});

test("attendance bands: who comes and who does not, with names beside IDs", () => {
  const { attendanceBands } = require("../rules/attendance-bands");
  const st = [{ id: "1", name: "A", attendance: 100, present: 4, sessions: 4, missedInARow: 0 }, { id: "2", name: "B", attendance: 50, present: 2, sessions: 4, missedInARow: 1 },
    { id: "3", name: "C", attendance: 0, present: 0, sessions: 4, missedInARow: 4 }, { id: "4", name: "D", attendance: null, present: 0, sessions: 0, missedInARow: 0 }];
  const r = attendanceBands(st);
  assert.equal(r.counted, 3); assert.equal(r.never, 1); assert.equal(r.attending, 2);
  assert.deepEqual(r.bands.map((b) => b.count), [1, 0, 1, 0, 1]);
  assert.equal(r.bands[4].students[0].name, "C"); assert.equal(r.bands[0].pct, 33.3);
});
