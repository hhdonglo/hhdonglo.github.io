"use strict";
// The dashboard rules and page parts, on made-up class statistics (no real student data).
const test = require("node:test");
const assert = require("node:assert");
const R = require("../app/dashboard/rules");
const V = require("../app/dashboard/render");

const stu = (id, o) => Object.assign({ id, name: "Student " + id, group: "On track", missedInARow: 0, change: null }, o);
const base = () => ({
  rosterSize: 20, thresholds: { misses: 2 },
  attendance: { rate: 85, sessions: 5, recentRate: 70, earlierRate: 90, bySession: [90, 88, 85, 75, 70].map((r, i) => ({ label: "S" + i, rate: r })) },
  quizzes: [60, 65, 72].map((m, i) => ({ quiz: "Q" + i, stats: { mean: m }, participation: 70 + i })),
  learning: { verdict: "Learning", confidence: "Medium", action: "Keep going" },
  groups: {}, targets: [{ title: "Topic A", evidence: "40% correct", small: false }],
  students: [stu("1001"), stu("1002", { missedInARow: 3 }), stu("1003", { group: "Disengaged", change: -20 })]
});

test("lights: thresholds and missing values", () => {
  assert.strictEqual(R.light(90, 60, 80), "lt-good");
  assert.strictEqual(R.light(70, 60, 80), "lt-watch");
  assert.strictEqual(R.light(40, 60, 80), "lt-bad");
  assert.strictEqual(R.light(null, 60, 80), "lt-none");
});

test("setup progress counts steps and treats unknown setup as nothing to show", () => {
  const sp = R.setupProgress({ steps: { course: true, classList: false, materials: false } });
  assert.strictEqual(sp.done, 1); assert.strictEqual(sp.pct, 33); assert.ok(!sp.complete);
  assert.ok(R.setupProgress(undefined).complete);
  assert.strictEqual(V.setupTracker(undefined), "");
});

test("stat cards: four cards, a small class is amber with the reason", () => {
  const cards = R.statCards(base());
  assert.deepStrictEqual(cards.map((c) => c.key), ["students", "attendance", "learning", "risk"]);
  assert.strictEqual(cards[3].value, "2");
  const d = base(); d.rosterSize = 6;
  const att = R.statCards(d)[1];
  assert.strictEqual(att.light, "lt-watch"); assert.ok(/Small class/.test(att.reason));
});

test("priority queue: highest score first, only flagged students", () => {
  const q = R.priorityQueue(base());
  assert.deepStrictEqual(q.map((x) => x.id), ["1002", "1003"]);
  assert.ok(q[0].why[0].includes("3 sessions"));
  assert.strictEqual(R.priorityQueue(base(), 1).length, 1);
});

test("today card: setup first, then live attendance, then students", () => {
  const acts = R.todayCard(base(), { steps: { course: true, classList: true, materials: false } }, { attendance: { status: "Closed" } });
  assert.ok(/materials/.test(acts[0].text)); assert.strictEqual(acts[1].go, "view:class"); assert.ok(acts.length <= 4);
  assert.ok(R.todayCard({ rosterSize: 20, students: [], attendance: { sessions: 0 } }, { steps: { course: true, classList: true, materials: true } })[0].text.includes("Take attendance"));
});

test("trends need three points; fewer says so", () => {
  const t = R.trends(base());
  assert.ok(t[0].enough && t[0].change === -20);
  const d = base(); d.quizzes = [{ stats: { mean: 50 }, participation: 60 }];
  assert.ok(!R.trends(d)[1].enough);
  assert.ok(/Too few/.test(V.spark([1, 2], "%", "x")));
});

test("health is the worst light, with reasons; no data is said plainly", () => {
  const h = R.health(base());
  assert.strictEqual(h.light, "lt-watch"); assert.ok(h.reasons.length);
  assert.strictEqual(R.health({ rosterSize: 0, students: [] }).word, "Needs attention");
});

test("insights: attendance fall and small class sentences, from the numbers only", () => {
  const xs = R.insights(base());
  assert.ok(xs.some((x) => /fell by 20/.test(x)));
  const d = base(); d.rosterSize = 5;
  assert.ok(R.insights(d).some((x) => /fewer than 10/.test(x)));
});

test("page parts escape names and give every light a word", () => {
  const d = base(); d.students[1].name = "<b>x</b>";
  const html = V.top(d, { steps: { course: true, classList: true, materials: true } }, null);
  assert.ok(!html.includes("<b>x</b>")); assert.ok(/Good|Watch|Act/.test(html));
});
