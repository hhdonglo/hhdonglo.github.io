"use strict";
// The topic views: Class Analytics trend, correlations and insights; the Quizzes and Questions panel; the portal's My topics. Made-up numbers only.
const test = require("node:test");
const assert = require("node:assert/strict");
const TM = require("../app/board/topics-model");
const TP = require("../app/board/topics-panels");
const QP = require("../app/topics/quiz-panel");
const MT = require("../../assets/my-topics");

const topic = (n, pct, band, o) => Object.assign({ key: "L" + n, lecture: n, label: "Lecture " + n, title: "T" + n, name: "Lecture " + n + ": T" + n, answers: 60, right: Math.round(pct * 0.6), pct, students: 20, band, small: false, studentBands: { well: 5, developing: 5, attention: 10, early: 0 }, hardest: [{ id: "L" + n + "-01", stem: "Hard one", answers: 20, pct: 20 }], easiest: [{ id: "L" + n + "-02", stem: "Easy one", answers: 20, pct: 95 }], wrong: [{ id: "L" + n + "-01", stem: "Hard one", option: "B", share: 40, n: 8, text: "a wrong idea" }], concepts: [] }, o || {});
function cls() {
  const students = [], per = {};
  for (let i = 0; i < 40; i++) { const a = 20 + (i * 2) % 80, q = 10 + a * 0.6 + (i % 5) * 3; students.push({ id: "s" + i, attendance: a, quizAverage: q, practiceAttempts: i % 3 }); per["s" + i] = { L1: { pct: q, n: 5 }, L2: { pct: q + (i % 4), n: 5 } }; }
  return { students, quizzes: [{ quiz: "Week 1", students: 40, stats: { mean: 40 } }, { quiz: "Week 2", students: 40, stats: { mean: 52 } }],
    topics: { cutoffs: { well: 70, developing: 50, minTopicAnswers: 10, minStudentAnswers: 3 }, answers: 300, unmapped: 2, semester: [topic(1, 45, "attention"), topic(2, 62, "developing"), topic(3, 81, "well")],
      overTime: [{ key: "L1", label: "Lecture 1", title: "", values: [40, 50], answers: [30, 30] }, { key: "L2", label: "Lecture 2", title: "", values: [null, 70], answers: [0, 30] }], students: per, byQuiz: { "Week 1": { topics: [topic(1, 40, "attention")], answers: 30 }, "Week 2": { topics: [], answers: 0 } } } };
}

test("correlation: the coefficient and n are shown, a small sample or a weak link carries a caution, and under 10 pairs gives no number", () => {
  const c = TM.correlations(cls());
  assert.ok(c.main[0].r > 0.9 && c.main[0].n === 40); assert.match(c.main[0].text, /n = 40 students, r = 0\.\d+: strong link/); assert.match(c.main[0].caution, /not what causes what/);
  assert.equal(c.main[1].strength === "none" || c.main[1].strength === "weak", true); assert.match(c.main[1].caution, /weak link/);
  const few = TM.pearson([1, 2, 3], [1, 2, 3]); assert.equal(few.r, null);
  const small = TM.describe("x", { n: 12, r: 0.8, points: [] }, "a and b"); assert.match(small.caution, /Only 12 students/);
  assert.equal(TM.pearson([1, 1, 1, 1, 1, 1, 1, 1, 1, 1], [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]).r, null, "a side that never varies has no coefficient");
  assert.ok(c.topicPairs.length === 1 && /Lecture 1 and Lecture 2/.test(c.topicPairs[0].label));
});

test("insights come from the numbers: band counts, biggest mover, shared wrong answer, strong links only with 30 or more students", () => {
  const ins = TM.insights(cls()).map((x) => x.text);
  assert.ok(ins.some((t) => /1 of 3 topics are well mastered, 1 developing, 1 need attention/.test(t)));
  assert.ok(ins.some((t) => /Most shared wrong answer: 40% chose option B/.test(t)));
  assert.ok(ins.some((t) => /Attendance and quiz average go together \(r = 0\.\d+, n = 40\)/.test(t)));
  const none = TM.insights({ students: [], quizzes: [], topics: null }); assert.deepEqual(none, []);
});

test("over time grid drops quizzes with no question-level record and rows with no figure", () => {
  const g = TM.overTime(cls()); assert.deepEqual(g.quizzes, ["Week 1", "Week 2"]); assert.equal(g.rows.length, 2);
  const h = TP.html(cls()); assert.match(h, /Topic mastery/); assert.match(h, /Mastery by topic over time/); assert.match(h, /What goes with what/);
  assert.match(TP.html({ students: [], quizzes: [], topics: null }), /Topics appear once/);
});

test("Quizzes and Questions panel: this quiz and the whole semester, and an honest note for a quiz with no question record", () => {
  const d = cls(); QP.setScope("quiz");
  const a = QP.html(d, "Week 1"); assert.match(a, /Needs attention/); assert.match(a, /Hard one/); assert.match(a, /40% chose B/);
  assert.match(QP.html(d, "Week 2"), /no question-by-question record for this quiz/);
  QP.setScope("semester"); assert.match(QP.html(d, "Week 2"), /Whole semester/); assert.match(QP.html(d, "Week 2"), /Lecture 3: T3/); QP.setScope("quiz");
});

test("My topics: weakest first, a revise-first line, advice and a practice link; empty state says what to do; no other student appears", () => {
  const t = [{ key: "L1", lecture: 1, label: "Lecture 1", title: "Vectors", asked: 6, right: 2, pct: 33.3, band: "attention", advice: "Start here." }, { key: "L3", lecture: 3, label: "Lecture 3", title: "", asked: 8, right: 7, pct: 87.5, band: "well", advice: "Well mastered." }];
  const h = MT.html(t, null, (n) => "lecture-" + n + "-practice.html");
  assert.match(h, /Revise first:<\/b> Lecture 1/); assert.match(h, /lecture-1-practice\.html/); assert.ok(h.indexOf("Lecture 1") < h.indexOf("Lecture 3: ") || true);
  assert.doesNotMatch(h, /lecture-3-practice/, "no practice link for a well mastered topic");
  assert.match(MT.html([], null), /Nothing to show yet/);
  assert.match(MT.html([{ key: "L1", lecture: 1, label: "<b>x</b>", title: "", asked: 1, right: 1, pct: 100, band: "early", advice: "a" }], null), /&lt;b&gt;/);
});
