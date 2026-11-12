/* 0.17.0: remove and restore a student, readable headings, clickable graph regions, roster-integrity marks, attendance time: `npm test`. */
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const RS = require("../remove-student");
const H = require("../app/headings");
const P = require("../app/charts/panel");
const D = require("../app/charts/days");

function fake() {
  const t = {
    Roster: [["Student ID", "Name"], ["20250001", "Ada"], ["20250002", "Ben"]],
    Attendance: [["Student ID", "03/11/2026"], ["20250001", 1], ["20250002", 0]],
    Master: [["Student ID", "Name", "Last updated"], ["20250001", "Ada", ""], ["20250002", "Ben", ""]],
    Scores: [["Student ID", "Total"], ["20250001", 4], ["20250002", 2]],
    Attempts: [["Timestamp", "Student ID"], ["x", "20250002"]],
  };
  return { t, rawRows: (n) => (t[n] ? t[n].map((r) => r.slice()) : null), setRows: (n, rows) => { t[n] = rows.map((r) => r.slice()); } };
}

test("remove: the student leaves the class tabs, the rows are kept, the logs are untouched", () => {
  const b = fake(), r = RS.remove(b, "20250002", () => new Date("2026-11-12T10:00:00Z"));
  assert.deepEqual([r.ok, r.id, r.name], [true, "20250002", "Ben"]);
  ["Roster", "Attendance", "Master", "Scores"].forEach((n) => assert.equal(b.t[n].length, 2, n));
  assert.equal(b.t.Attempts.length, 2); // the log keeps its row
  assert.deepEqual(RS.removed(b), [{ when: "2026-11-12T10:00:00.000Z", id: "20250002", name: "Ben" }]);
});

test("restore: every row comes back exactly, once, and the removed list is empty again", () => {
  const b = fake(), before = JSON.stringify(b.t);
  RS.remove(b, "20250002");
  assert.equal(RS.restore(b, "20250002").ok, true);
  ["Roster", "Attendance", "Master", "Scores"].forEach((n) => assert.equal(b.t[n].filter((r) => r[0] === "20250002").length, 1, n));
  assert.deepEqual(RS.removed(b), []);
  const back = JSON.stringify({ ...b.t, Removed_Students: undefined });
  assert.equal(JSON.stringify(JSON.parse(back).Roster.map((r) => r[0]).sort()), JSON.stringify(JSON.parse(before).Roster.map((r) => r[0]).sort()));
});

test("remove: an unknown or invalid ID is refused and nothing changes", () => {
  const b = fake(), before = JSON.stringify(b.t);
  assert.equal(RS.remove(b, "abc").ok, false); assert.equal(RS.remove(b, "20259999").ok, false); assert.equal(RS.restore(b, "20250001").ok, false);
  assert.equal(JSON.stringify(b.t), before);
});

test("headings: raw names become readable, the plain ones are left alone", () => {
  assert.equal(H.readable("Quiz 26271"), "Quiz (code 26271)");
  assert.equal(H.readable("Quiz QUIZZES TAKEN (quiz)"), "Quiz: Quizzes taken (quiz)");
  assert.equal(H.readable("Practice Intro"), "Practice: Intro");
  ["Week 1", "Quiz 3", "Practice 1", "Student ID", "Last updated", "PHYS 143 Mock exam", "Lab 2 - Week 5", ""].forEach((h) => assert.equal(H.readable(h), h));
});

test("days: an undated quiz is shown with its readable name", () => {
  const tl = D.timeline({ attendance: { bySession: [] }, quizzes: [{ quiz: "Quiz QUIZZES TAKEN", date: "" }], students: [] });
  assert.equal(tl[0].label, "Quiz: Quizzes taken");
});

const cls = {
  attendance: { bySession: [{ label: "03/11/2026" }] }, quizzes: [{ quiz: "Week 1", date: "03/11/2026" }],
  students: Array.from({ length: 12 }, (_, i) => ({ id: "2025" + String(1000 + i), name: "S" + i, marks: [i < 6 ? 0 : 1], trajectory: [{ quiz: "Week 1", pct: i < 6 ? 20 + i : 80 + i }] })),
};

test("regions: a band, a box and a quarter of the scatter list their students, and follow the data", () => {
  P.reset(); const noop = () => {};
  P.handle({ closest: () => ({ getAttribute: () => "band:2" }) }, cls, noop);
  let h = P.render(cls); assert.match(h, /Quiz average from 20 to 30 percent: 6 students/); assert.match(h, /data-student='20251000'/);
  P.handle({ closest: () => ({ getAttribute: () => "quad:ur" }) }, cls, noop);
  h = P.render(cls); assert.match(h, /higher attendance, higher performance: 6 students/);
  P.handle({ closest: () => ({ getAttribute: () => "box:0" }) }, cls, noop); assert.match(P.render(cls), /middle half of quiz average/);
  const live = JSON.parse(JSON.stringify(cls)); live.students[0].trajectory[0].pct = 90; // data change: student 0 leaves band 2
  P.handle({ closest: () => ({ getAttribute: () => "band:2" }) }, live, noop); assert.match(P.render(live), /from 20 to 30 percent: 5 students/);
  P.handle({ closest: () => ({ getAttribute: () => "clear" }) }, live, noop); assert.match(P.render(live), /Click a bar, a box/);
  P.reset();
});

test("wiring: the Grades table removes by click, marks IDs off the class list, readable headings, attendance time", () => {
  const home = fs.readFileSync(path.join(__dirname, "../app/home.html"), "utf8");
  assert.match(home, /id="rm-d"/); assert.match(home, /removeStudent/); assert.match(home, /cmHeadings\.readable/);
  assert.match(home, /class='off'/); assert.match(home, /not on the class list/); assert.match(home, /Attendance_Control/);
  assert.ok(home.indexOf("headings.js") > 0 && home.indexOf("headings.js") < home.indexOf("charts/days.js"));
  assert.match(fs.readFileSync(path.join(__dirname, "../main.js"), "utf8"), /cm:restoreStudent/);
  assert.match(fs.readFileSync(path.join(__dirname, "../preload.js"), "utf8"), /restoreStudent: call/);
  assert.match(fs.readFileSync(path.join(__dirname, "../app/folder.js"), "utf8"), /source of truth/);
});
