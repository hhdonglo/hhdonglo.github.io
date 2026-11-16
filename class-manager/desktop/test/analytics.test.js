"use strict";
const test = require("node:test"), assert = require("node:assert");
const ev = require("../app/analytics/evidence"), it = require("../app/analytics/items"), co = require("../app/analytics/concepts"),
  iv = require("../app/analytics/interventions"), fa = require("../app/analytics/fairness"), vw = require("../app/analytics/render");

test("evidence: small n is too little, coverage lowers the level", () => {
  assert.equal(ev.confidence(3).level, "Too little");
  assert.equal(ev.confidence(8).level, "Low");
  assert.equal(ev.confidence(40, 1).level, "High");
  assert.equal(ev.confidence(40, 0.6).level, "Medium");
  assert.match(ev.badge(ev.confidence(3)), /Too little/);
});
test("items: groups by flag, small samples are not judged", () => {
  const r = it.analyse([
    { id: "Q1", lecture: 1, answers: 40, live: 40, pct: 10, discrimination: 0.3, key: "A", dist: { A: 4, B: 30 }, wrongTop: "B", wrongTopN: 30 },
    { id: "Q2", lecture: 1, answers: 40, live: 40, pct: 95, discrimination: 0.3, key: "A", dist: { A: 38 }, wrongTopN: 1 },
    { id: "Q3", lecture: 1, answers: 3, live: 3, pct: 50, discrimination: null },
    { id: "Q4", lecture: 1, answers: 40, live: 40, pct: 55, discrimination: -0.2, key: "A", dist: { A: 22 }, wrongTopN: 5 }]);
  assert.deepEqual(r.groups.small.map(x => x.id), ["Q3"]);
  assert.ok(r.groups.review.some(x => x.id === "Q1") && r.groups.review.some(x => x.id === "Q4"));
  assert.deepEqual(r.groups.easy.map(x => x.id), ["Q2"]);
  assert.equal(r.points.length, 3);
});
test("concepts: status needs 30 answers, gap live vs practice", () => {
  const c = co.track([{ lecture: 1, answers: 50, pct: 40 }, { lecture: 2, answers: 10, pct: 90 }], [{ lecture: 1, live: 10, livePct: 40, practice: 10, practicePct: 70 }], { 1: "Vectors" }, 50);
  assert.equal(c[0].status, "revisit"); assert.equal(c[0].title, "Vectors"); assert.equal(c[0].gap, 30); assert.equal(c[1].status, "too early");
});
test("interventions: compares change, words it as association", () => {
  const mk = (id, a, b) => ({ id, trajectory: [{ pct: a }, { pct: a }, { pct: b }, { pct: b }] });
  const ss = [mk(1, 40, 60), mk(2, 40, 60), mk(3, 50, 50), mk(4, 50, 52)];
  const r = iv.compare({ id: "i1", kind: "Check-in", date: "2026-11-01", afterQuiz: 2, ids: [1, 2] }, ss);
  assert.equal(r.givenChange, 20); assert.equal(r.comparedChange, 1); assert.equal(r.diff, 19);
  assert.match(r.text, /association, not proof/);
  assert.match(iv.compare({ afterQuiz: 5, ids: [1] }, ss).text, /nothing to compare/);
});
test("interventions: compared only with students whose earlier results were similar", () => {
  const mk = (id, a, b) => ({ id, trajectory: [{ pct: a }, { pct: a }, { pct: b }, { pct: b }] });
  // Given: started at 40. Student 3 started at 45 (similar); student 4 at 90 (not similar, would flatter the comparison).
  const ss = [mk(1, 40, 60), mk(3, 45, 47), mk(4, 90, 90)];
  const r = iv.compare({ id: "i1", kind: "Tutoring", date: "2026-11-01", afterQuiz: 2, ids: [1] }, ss);
  assert.equal(r.matched, true);
  assert.deepEqual(r.comparedIds, ["3"], "the far-off student is left out");
  assert.match(r.text, /similar earlier results/);
  assert.deepEqual(r.givenIds, ["1"]);
  // With no similar student at all, everyone else is used and the text says so.
  const r2 = iv.compare({ id: "i2", kind: "Tutoring", date: "2026-11-01", afterQuiz: 2, ids: [1] }, [mk(1, 40, 60), mk(4, 90, 90)]);
  assert.equal(r2.matched, false);
  assert.match(r2.text, /No student with similar earlier results/);
});
test("the Support given card records as well as reports", () => {
  const html = vw.interventions([{ id: "i1", kind: "Check-in", date: "2026-11-01", text: "x", note: "after lecture 3", given: 1, compared: 1, givenIds: ["20004444"], comparedIds: ["20005555"], confidence: null }]);
  assert.ok(html.includes("sp-kind") && html.includes("sp-ids") && html.includes("data-an-form='support'"), "the record form is on the card");
  assert.match(html, /students behind these numbers/);
  assert.match(html, /20004444/);
  const fs2 = require("fs"), path2 = require("path");
  assert.ok(fs2.readFileSync(path2.join(__dirname, "..", "preload.js"), "utf8").includes("cm:addIntervention"), "the screen can reach the backend");
  assert.ok(fs2.readFileSync(path2.join(__dirname, "..", "app", "analytics", "panel.js"), "utf8").includes("data-an-form='support'"), "the panel submits the form");
});
test("fairness: needs groups of 10, flags a gap, no cohorts is empty", () => {
  const ss = [], co2 = {};
  for (let i = 0; i < 20; i++) { ss.push({ id: i, quizAverage: i < 10 ? 70 : 55 }); co2[i] = i < 10 ? "A" : "B"; }
  const r = fa.byGroup(ss, co2);
  assert.equal(r.gap.points, 15); assert.ok(r.flagged); assert.match(r.note, /teaching conditions/);
  assert.ok(fa.byGroup(ss, {}).empty);
  assert.equal(fa.byGroup(ss.slice(0, 6), { 0: "A", 1: "A", 2: "A", 3: "B", 4: "B", 5: "B" }).usable, false);
});
test("render: escapes and shows every card", () => {
  assert.match(vw.items(it.analyse([])), /No question needs review/);
  assert.match(vw.concepts([]), /No lecture/);
  assert.match(vw.interventions([]), /No support recorded/);
  assert.match(vw.fairness({ empty: true }), /Group in the class list/);
  assert.equal(vw.esc("<b>"), "&lt;b&gt;");
});

test("panel builds from real class statistics", () => {
  const { classroom } = require("./classroom");
  const c = classroom({ students: 12 }); const d = c.host("class_stats");
  const pn = require("../app/analytics/panel");
  const html = pn.build(d, { interventions: [], cohorts: {}, termClosed: false, aiSummary: false, hasKey: false, privacyNotice: "x" }, null);
  assert.match(html, /<h3>Concepts/); assert.match(html, /Privacy and records/); assert.match(html, /Results by group/);
});
