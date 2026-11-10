/* Class statistics: run with `npm test` in class-manager/desktop (Node 20 or later, no Electron needed).
   The backend runs the real server script against a temporary workbook filled with the made-up class in sample-class.js,
   and each figure is checked against a count made here directly from the same rows. */
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { createBackend } = require("../backend");
const { writeSample } = require("./sample-class");

const WEB = path.resolve(__dirname, "..", "..");
function freshClass() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cm-stats-"));
  const file = path.join(dir, "workbook.json");
  createBackend({ webRoot: WEB, dataFile: file, log: () => {} }).flush(); // the first run creates the standard tabs
  const sample = writeSample(file);
  return { sample, backend: createBackend({ webRoot: WEB, dataFile: file, log: () => {} }) };
}
const { sample, backend } = freshClass();
const S = backend.stats({});
const grid = sample.tabs.Attendance;
const near = (a, b, msg) => assert.ok(Math.abs(a - b) < 0.051, `${msg}: ${a} vs ${b}`);

test("attendance rate per session and for the term", () => {
  assert.equal(S.attendance.sessions, grid[0].length - 1);
  let present = 0, counted = 0;
  for (let c = 1; c < grid[0].length; c++) {
    const col = grid.slice(1).map((r) => r[c]);
    const p = col.filter((v) => v === 1).length;
    present += p; counted += col.length;
    near(S.attendance.bySession[c - 1].rate, 100 * p / col.length, "session " + c);
  }
  near(S.attendance.rate, 100 * present / counted, "term rate");
});

test("consecutive misses count back from the latest session", () => {
  sample.ids.forEach((id, i) => {
    const row = grid[i + 1].slice(1); let run = 0;
    for (let k = row.length - 1; k >= 0 && row[k] === 0; k--) run++;
    assert.equal(S.students.find((s) => s.id === id).missedInARow, run, sample.names[i]);
  });
  // Student 8 stopped coming after the fifth session.
  assert.ok(S.students[7].missedInARow >= 3);
  assert.equal(S.summary.missedInARow, S.students.filter((s) => s.missedInARow >= 2).length);
});

test("arrival minutes are measured from opening the check-in", () => {
  const log = sample.tabs.Attendance_Log.slice(1), ctl = sample.tabs.Attendance_Control.slice(1);
  const opened = Object.fromEntries(ctl.map((r) => [r[1], Date.parse(r[3])]));
  const mins = log.map((r) => (r[0].getTime() - opened[r[1]]) / 60000);
  const total = S.attendance.arrival.bands.reduce((a, b) => a + b.n, 0);
  assert.equal(total, mins.length);
  assert.equal(S.attendance.arrival.bands[0].n, mins.filter((m) => m < 2).length);
  const sorted = mins.slice().sort((a, b) => a - b), mid = (sorted.length - 1) / 2;
  near(S.attendance.arrival.median, Math.round(10 * (sorted[Math.floor(mid)] + sorted[Math.ceil(mid)]) / 2) / 10, "median arrival");
});

test("quiz score distribution: mean, median, quartiles and histogram", () => {
  const resp = sample.tabs["Form Responses 1"].slice(1);
  S.quizzes.forEach((q) => {
    const pcts = resp.filter((r) => "Week " + r[13] === q.quiz).map((r) => 100 * r[9] / 5).sort((a, b) => a - b);
    assert.equal(q.stats.n, pcts.length, q.quiz);
    near(q.stats.mean, Math.round(10 * pcts.reduce((a, b) => a + b, 0) / pcts.length) / 10, q.quiz + " mean");
    const at = (p) => { const h = (pcts.length - 1) * p, lo = Math.floor(h); return pcts[lo] + (pcts[Math.ceil(h)] - pcts[lo]) * (h - lo); };
    near(q.stats.median, at(0.5), q.quiz + " median");
    near(q.stats.q1, at(0.25), q.quiz + " q1");
    near(q.stats.q3, at(0.75), q.quiz + " q3");
    assert.equal(q.stats.hist.reduce((a, b) => a + b, 0), pcts.length);
    assert.equal(q.stats.hist[9], pcts.filter((x) => x >= 90).length);
  });
});

test("completion compares submissions with students who joined", () => {
  const pres = sample.tabs.Presence.slice(1), resp = sample.tabs["Form Responses 1"].slice(1);
  const q = S.quizzes[0], code = "5201";
  const joined = new Set(pres.filter((r) => r[3] === code).map((r) => r[1])).size;
  const done = resp.filter((r) => r[3] === code).length;
  assert.equal(q.joined, joined);
  near(q.completion, 100 * done / joined, "completion");
});

test("item difficulty, option counts and the most chosen wrong option", () => {
  const items = sample.tabs.Item_Log.slice(1).filter((r) => r[6] === "L1-Q2");
  const q = S.questions.find((x) => x.id === "L1-Q2");
  near(q.livePct, 100 * items.filter((r) => r[9] === 1).length / items.length, "proportion correct in live quizzes");
  for (const L of ["A", "B", "C", "D", "E"]) assert.equal(q.dist[L], items.filter((r) => r[7] === L).length, "option " + L);
  assert.equal(q.blank, items.filter((r) => r[7] === "").length);
  assert.equal(q.wrongTop, "B"); // the sample's planted misconception
  assert.ok(q.discrimination !== null && q.discrimination >= -1 && q.discrimination <= 1);
});

test("each student's trajectory, change and percentile", () => {
  const s = S.students[1];
  assert.equal(s.trajectory.length, s.quizzesTaken);
  const t = s.trajectory;
  near(s.change, t[t.length - 1].pct - t[t.length - 2].pct, "change");
  const avgs = S.students.filter((x) => x.quizAverage !== null).map((x) => x.quizAverage);
  const top = S.students.filter((x) => x.quizAverage === Math.max(...avgs));
  top.forEach((x) => assert.ok(x.percentile >= 90, "the highest average sits at the top"));
  assert.ok(S.students.filter((x) => x.quizAverage === Math.min(...avgs)).every((x) => x.percentile <= 10));
});

test("engagement groups follow the stated rules", () => {
  const th = S.thresholds;
  S.students.forEach((s) => {
    if (s.group === "Not enough data") return;
    const hiE = s.effort >= th.effort, hiP = s.performance !== null && s.performance >= th.perf;
    const want = s.performance === null ? "Needs a check-in" : hiE ? (hiP ? "On track" : "Working hard but struggling") : (hiP ? "Disengaged" : "Needs a check-in");
    assert.equal(s.group, want, s.name);
    assert.ok(s.why.length >= 2, "reasons are given");
  });
  assert.equal(S.students[0].group, "On track");
  assert.equal(S.students[1].group, "Working hard but struggling");
  assert.equal(S.students[2].group, "Disengaged");
  assert.equal(S.students[3].group, "Needs a check-in");
  const n = Object.values(S.groups).reduce((a, b) => a + b, 0);
  assert.equal(n, sample.ids.length);
});

test("thresholds are adjustable and change the groups", () => {
  const strict = backend.stats({ effort: 95, perf: 90 });
  assert.equal(strict.thresholds.effort, 95);
  assert.ok(strict.groups["On track"] < S.groups["On track"]);
  const silly = backend.stats({ effort: 500, perf: -4, idle: 0, misses: "x" });
  assert.deepEqual({ ...silly.thresholds }, { effort: 100, perf: 0, idle: 1, misses: 2 }); // a plain copy: the script runs in its own realm
});

test("one student in full, and only for students on the class list", () => {
  const one = backend.studentStats({ id: sample.ids[1] });
  assert.equal(one.ok, true);
  assert.equal(one.student.name, sample.names[1]);
  assert.equal(one.sessions.length, grid[0].length - 1);
  assert.ok(Array.isArray(one.mastery));
  assert.equal(backend.studentStats({ id: "99999999" }).ok, false);
});

test("the web address refuses class statistics without the host key", () => {
  assert.match(backend.doGet({ action: "class_stats" }).getContent(), /host key not accepted/);
  assert.match(backend.doGet({ action: "student_stats", id: sample.ids[0] }).getContent(), /host key not accepted/);
});

test("an empty class gives empty statistics, not an error", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cm-empty-"));
  const b = createBackend({ webRoot: WEB, dataFile: path.join(dir, "workbook.json"), log: () => {} });
  const e = b.stats({});
  assert.equal(e.ok, true);
  assert.equal(e.attendance.sessions, 0);
  assert.equal(e.quizzes.length, 0);
  assert.equal(e.students.length, 0);
});

test("is the class learning: a verdict only with enough evidence, with the evidence shown", () => {
  const L = S.learning;
  assert.ok(L.verdicts.includes(L.verdict));
  assert.notEqual(L.verdict, "Not enough data");
  const rep = L.signals.find((x) => x.key === "repeat");
  assert.ok(rep && rep.n >= 30 && rep.value === 1, "repeated questions improve in the sample");
  const l2 = L.topics.find((t) => t.lecture === 2);
  assert.notEqual(l2.verdict, "Learning", "lecture 2 was made not to improve");
  assert.equal(L.topics.find((t) => t.lecture === 1).verdict, "Learning");
  assert.ok(L.action.length > 20 && L.minimum.length > 20);
});

test("one quiz never gives a verdict", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cm-one-"));
  const file = path.join(dir, "workbook.json");
  createBackend({ webRoot: WEB, dataFile: file, log: () => {} }).flush();
  writeSample(file);
  const book = JSON.parse(fs.readFileSync(file, "utf8"));
  const keep = (name, f) => { const sh = book.sheets.find((x) => x.name === name); sh.rows = [sh.rows[0]].concat(sh.rows.slice(1).filter(f)); };
  keep("Form Responses 1", (r) => r[13] === 1);
  keep("Item_Log", (r) => r[3] === 1);
  keep("Attempts", () => false);
  fs.writeFileSync(file, JSON.stringify(book));
  const one = createBackend({ webRoot: WEB, dataFile: file, log: () => {} }).stats({});
  assert.equal(one.quizzes.length, 1);
  assert.equal(one.learning.verdict, "Not enough data");
});

test("areas to target are ranked, with evidence, sample size and an action", () => {
  assert.ok(S.targets.length > 0);
  for (let i = 1; i < S.targets.length; i++) assert.ok(S.targets[i - 1].weight >= S.targets[i].weight);
  S.targets.forEach((t) => { assert.ok(t.evidence && t.action && typeof t.n === "number", t.title); assert.doesNotMatch(t.evidence + t.action + t.title, /&/); });
  assert.ok(S.targets.some((t) => t.kind === "Question" && /option B/.test(t.title)), "the planted misconception is found");
});
