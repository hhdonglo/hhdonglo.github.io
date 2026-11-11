/* Learning Progress charts: run with `npm test` in class-manager/desktop (Node 20 or later, no Electron needed).
   Unit tests feed the chart modules made-up data; one test renders the charts from the real server figures of the made-up class. */
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const C = require("../app/charts/core");
const { masteryDistribution, rows } = require("../app/charts/mastery-distribution");
const { heatmap, build } = require("../app/charts/heatmap");

const lv = (s, d, b, n) => ({ "Secure": s, "Developing": d, "Beginning": b, "Not enough evidence": n });
const outcomes = [
  { key: "L1.1", label: "Draw vectors", linked: true, students: 10, levels: lv(4, 3, 2, 1) },
  { key: "L1.2", label: "Add vectors", linked: true, students: 0, levels: lv(0, 0, 0, 0) },
];
const so = (key, current, level, answers) => ({ key, current, level, answers, gain: null });
const students = [
  { id: "1", name: "Ada", outcomes: [so("L1.1", 90, "Secure", 5)] },
  { id: "2", name: "Ben", outcomes: [so("L1.1", 30, "Beginning", 4)] },
  { id: "3", name: "Cy", outcomes: [so("L1.1", 100, "Not enough evidence", 1)] },
  { id: "4", name: "Di", outcomes: [] },
];

test("mastery distribution: counts and shares come from the levels, and a row with no students is left out", () => {
  const r = rows(outcomes); assert.equal(r.length, 1);
  assert.equal(r[0].total, 10); assert.deepEqual(r[0].parts.map((p) => p.n), [4, 3, 2, 1]); assert.equal(r[0].parts[0].share, 40);
  const h = masteryDistribution(outcomes);
  assert.match(h, /10 students/); assert.match(h, /4 Secure, 3 Developing, 2 Beginning, 1 Not enough evidence/); assert.match(h, /View as a table/);
  assert.doesNotMatch(h, /Add vectors/);
});

test("mastery distribution: nothing to show reads as not enough evidence, never an empty chart", () => {
  assert.match(masteryDistribution([]), /Not enough evidence yet/);
  assert.match(masteryDistribution(undefined), /Not enough evidence yet/);
});

test("heat map: weakest first, a thin record is a dot and not a low score, a student with no answers is left out", () => {
  const m = build(students, outcomes);
  assert.deepEqual(m.rows.map((r) => r.name), ["Ben", "Ada", "Cy"]);
  const h = heatmap(students, outcomes);
  assert.match(h, /data-id='2'/); assert.doesNotMatch(h, /data-id='4'/);
  assert.match(h, /not enough evidence, 1 answers/); assert.match(h, />90</); assert.match(h, />·</);
  assert.doesNotMatch(h, />100</, "one answer is never shown as 100%");
});

test("heat map: text is escaped and the column limit is stated", () => {
  const many = Array.from({ length: 30 }, (_, i) => ({ key: "L" + i, label: i === 0 ? "<b>x</b>" : "Obj " + i, students: 1, levels: lv(1, 0, 0, 0) }));
  const st = [{ id: "9", name: "A&B", outcomes: many.map((o) => so(o.key, 80, "Secure", 5)) }];
  const h = heatmap(st, many);
  assert.doesNotMatch(h, /<b>x/); assert.match(h, /A&amp;B/); assert.match(h, /Only the first 24 objectives/);
});

test("the charts agree with the server figures of the made-up class", () => {
  const { createBackend } = require("../backend");
  const { writeSample } = require("./sample-class");
  const { readSite } = require("./sample-pedagogy");
  const WEB = path.resolve(__dirname, "..", "..");
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "cm-charts-")), "workbook.json");
  createBackend({ webRoot: WEB, dataFile: file, readSite, log: () => {} }).flush();
  writeSample(file);
  const B = createBackend({ webRoot: WEB, dataFile: file, readSite, log: () => {} });
  const t = B.doPost({ callback: "cb", hostkey: B.hostKey(), action: "learning_progress" }).text;
  const lp = JSON.parse(/^cb\(([\s\S]*)\)\s*;?\s*$/.exec(t)[1]);
  assert.ok(lp.ok && lp.outcomes.length && lp.students.length);
  const r = rows(lp.outcomes);
  r.forEach((x) => { const o = lp.outcomes.find((y) => y.key === x.key); assert.equal(x.total, o.students); });
  const m = build(lp.students, lp.outcomes);
  assert.ok(m.rows.length > 0 && m.cols.length > 0);
  const h = heatmap(lp.students, lp.outcomes);
  assert.equal((h.match(/<tr tabindex/g) || []).length, m.rows.length);
});

test("shared helpers", () => { assert.equal(C.pct(1, 3), 33.3); assert.equal(C.pct(1, 0), null); assert.equal(C.esc("<&>"), "&lt;&amp;&gt;"); });

const { classProgress, studentProgress } = require("../app/charts/progress-over-time");
const { learningGain, studentVsClass, discussionPairs } = require("../app/charts/bars");
const { engagement } = require("../app/charts/engagement");

test("progress over time: class line carries counts, a band only with four students, and says what it measures", () => {
  const tl = [{ week: "02/11/2026", students: 3, answers: 9, mean: 40, median: 33.3, q1: null, q3: null }, { week: "09/11/2026", students: 6, answers: 30, mean: 60, median: 62, q1: 50, q3: 70 }];
  const h = classProgress(tl);
  assert.match(h, /6 st\./); assert.match(h, /not necessarily better understanding/); assert.match(h, /View as a table/);
  assert.equal((h.match(/class='pt-band'/g) || []).length, 0, "one week with a quartile is not a band");
  assert.match(classProgress([]), /Not enough evidence yet/);
});

test("progress over time: student line shows the class mean and the answer count; a week the class lacks is a gap", () => {
  const h = studentProgress([{ week: "02/11/2026", n: 2, pct: 50 }, { week: "09/11/2026", n: 5, pct: 80 }], [{ week: "09/11/2026", students: 8, mean: 65 }]);
  assert.match(h, /class mean 65%/); assert.match(h, /2 ans\./); assert.match(h, /fewer than three answers/);
});

test("learning gain: signed, with the count, and objectives without a gain are left out", () => {
  const h = learningGain([{ label: "A", gain: 37, n: 12 }, { label: "B", gain: -10, n: 5 }, { label: "C", gain: null, n: 0 }]);
  assert.match(h, /\+37 pts/); assert.match(h, /−10 pts/); assert.match(h, /gn-down/); assert.doesNotMatch(h, />C</);
  assert.match(learningGain([{ label: "C", gain: null }]), /Not enough evidence yet/);
});

test("student versus class: thin evidence draws no student bar, never a zero", () => {
  const h = studentVsClass([{ key: "L1.1", label: "A", current: 80, level: "Secure", answers: 5 }, { key: "L1.2", label: "B", current: 100, level: "Not enough evidence", answers: 1 }], { "L1.1": { current: 70 }, "L1.2": { current: 60 } });
  assert.match(h, /This student not enough evidence|B: This student not enough evidence/); assert.match(h, /80%/); assert.match(h, /Class mean 70%/);
});

test("discussion pairs and engagement", () => {
  assert.equal(discussionPairs([]), "");
  assert.match(discussionPairs([{ week: 3, q: 1, qid: "L3-Q1", beforePct: 42, afterPct: 76, pairs: 20 }]), /42%/);
  assert.match(engagement({ attendance: 80, quizzesTaken: 3, practiceAttempts: 4, missedInARow: 1 }), /missed the last 1/);
  assert.match(engagement({ attendance: null, quizzesTaken: 0, practiceAttempts: 0, missedInARow: 0 }), /Live quizzes taken/);
});

test("the server gives the class timeline and the student's class comparison", () => {
  const { createBackend } = require("../backend");
  const { writeSample } = require("./sample-class");
  const { readSite } = require("./sample-pedagogy");
  const WEB = path.resolve(__dirname, "..", "..");
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "cm-charts2-")), "workbook.json");
  createBackend({ webRoot: WEB, dataFile: file, readSite, log: () => {} }).flush();
  const sample = writeSample(file);
  const B = createBackend({ webRoot: WEB, dataFile: file, readSite, log: () => {} });
  const host = (p) => JSON.parse(/^cb\(([\s\S]*)\)\s*;?\s*$/.exec(B.doPost(Object.assign({ callback: "cb", hostkey: B.hostKey() }, p)).text)[1]);
  const lp = host({ action: "learning_progress" });
  assert.ok(lp.timeline.length >= 2);
  lp.timeline.forEach((w) => { assert.ok(w.students >= 1 && w.mean >= 0 && w.mean <= 100 && w.median >= 0); if (w.q1 !== null) assert.ok(w.students >= 4 && w.q1 <= w.median && w.median <= w.q3); });
  assert.equal(lp.timeline.reduce((a, w) => a + w.answers, 0) > 0, true);
  const r = host({ action: "student_stats", id: sample.ids[1] });
  const p = r.profile;
  assert.ok(p.classTimeline.length && p.classByKey && p.engagement);
  p.progress.outcomes.forEach((o) => assert.ok(p.classByKey[o.key] || o.answers === 0, "class figure for " + o.key));
  const h = studentProgress(p.progress.timeline, p.classTimeline); assert.match(h, /class mean/);
});
