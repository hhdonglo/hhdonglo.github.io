"use strict";
const test = require("node:test"), assert = require("node:assert");
const X = require("../app/charts/explore-data"), V = require("../app/charts/explore-view");
const students = [];
for (let i = 0; i < 24; i++) students.push({ id: String(3000 + i), name: "S" + i, quizAverage: i < 20 ? 30 + i * 3 : null, attendance: 80, practiceAttempts: i % 7, change: i % 3 === 0 ? 12 : i % 3 === 1 ? -15 : 0, missedInARow: i % 4, group: i < 12 ? "On track" : "Needs a check-in", trajectory: i < 18 ? [{ quiz: "Q1", pct: 50 }] : [] });
const d = { students, groupNames: ["On track", "Needs a check-in", "Disengaged"], quizzes: [{ quiz: "Q1" }], lectures: [{ lecture: 1, answers: 40, pct: 55 }, { lecture: 2, answers: 10, pct: 80 }],
  questions: [{ id: "L1-Q1", lecture: 1, answers: 20, pct: 15, discrimination: -0.1 }, { id: "L1-Q2", lecture: 1, answers: 20, pct: 85, discrimination: 0.5 }, { id: "L2-Q1", lecture: 2, answers: 3, pct: 50, discrimination: 0.3 }] };
const total = (c) => c.bars.reduce((a, b) => a + b.n, 0);
test("spread puts every student with a result in exactly one band", () => { const c = X.spread(d); assert.equal(c.bars.length, 10); assert.equal(total(c), 20); assert.ok(c.bars.every((b) => b.students.length === b.n)); });
test("change buckets cover the students with a change; student ids are unique per chart", () => {
  const c = X.change(d), ids = [].concat(...c.bars.map((b) => b.students.map((s) => s.id))); assert.equal(ids.length, new Set(ids).size); assert.equal(total(c), 24);
});
test("participation lists who did not take the quiz", () => { const c = X.participation(d); assert.equal(c.bars[0].n, 6); assert.equal(c.bars[0].value, 75); assert.match(c.bars[0].what, /did not take/); });
test("missed counts back to the latest session", () => { assert.equal(total(X.missed(d)), 24); });
test("practice and groups mark small groups and keep the association wording", () => {
  const p = X.practice(d); assert.match(p.caption, /not what causes what/);
  const g = X.groups(d, { 3000: "A", 3001: "A", 3002: "B" }); assert.equal(g.length, 2);
  assert.ok(g[1].bars.every((b) => b.small)); assert.match(g[1].caption, /not a difference between students/);
  assert.ok(g[0].bars.length === 2); // the group with no students is left out
});
test("topics and items list questions, and need 10 answers to place a question", () => {
  const t = X.topics(d); assert.equal(t.kind, "question"); assert.equal(t.bars[0].students[0].id, "L1-Q1"); assert.ok(t.bars[1].small);
  const [dif, dis] = X.items(d); assert.equal(total(dif), 2); assert.equal(dis.bars[0].n, 1);
});
test("each screen gets charts and the view escapes and offers a table", () => {
  ["overview", "attendance", "quizzes", "students"].forEach((s) => assert.ok(X.forScreen(s, d, {}).length > 0));
  assert.equal(X.forScreen("nowhere", d, {}).length, 0);
  const html = V.card(X.spread(d), 3, false); assert.match(html, /View as a table/); assert.match(html, /data-student=/);
  const evil = { key: "k", title: "<b>", hint: "", caption: "", unit: "%", max: 100, kind: "student", bars: [{ label: "<i>", value: 1, n: 1, small: true, students: [{ id: "1", name: "<script>" }] }] };
  assert.ok(!/<script>|<i>/.test(V.card(evil, 0, false)));
});
