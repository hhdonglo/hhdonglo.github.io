"use strict";
const test = require("node:test"), assert = require("node:assert");
const s = require("../summary");
const d = { rosterSize: 40, attendance: { rate: 82, earlierRate: 85, recentRate: 79, sessions: 5 }, summary: { missedInARow: 3 }, thresholds: { misses: 3 },
  quizzes: [{ quiz: "Quiz 1", students: 38, stats: { mean: 61 } }], learning: { verdict: "Partly", confidence: "Medium", topics: [{ label: "Vectors", pct: 45 }, { label: "Units", pct: 80 }] },
  targets: [{ kind: "Topic", title: "Vectors", n: 40, action: "Revisit it.", name: "SECRET" }], students: [{ id: 1001, name: "Ama" }] };
test("aggregates carry no student data", () => { const a = s.aggregates(d); assert.ok(!/Ama|1001|SECRET/.test(JSON.stringify(a))); assert.equal(a.students, 40); });
test("rule text is written from the numbers", () => { const t = s.ruleText(s.aggregates(d)); assert.match(t, /Attendance is 82%/); assert.match(t, /down 6 points/); assert.match(t, /Vectors \(45%\)/); assert.ok(!/&/.test(t)); });
test("weekly uses the local text when AI is off or has no key", async () => {
  assert.equal((await s.weekly(d, { enabled: false })).source, "local");
  assert.equal((await s.weekly(d, { enabled: true, loadKey: () => "" })).source, "local");
  assert.match(s.ruleText(s.aggregates({})), /No class list/);
});
