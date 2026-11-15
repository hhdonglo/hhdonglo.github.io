"use strict";
// The clickable dashboard: groups behind each number, the risk zones, the linked correlation views, the drawings, and the two server fixes.
const test = require("node:test");
const assert = require("node:assert");
const G = require("../app/dashboard/groups");
const C = require("../app/dashboard/charts");
const R = require("../app/dashboard/rules");
const V = require("../app/dashboard/render");
const { classroom } = require("./classroom");

const stu = (i, o) => Object.assign({ id: String(1000 + i), name: "S" + i, group: "On track", attendance: 90, quizAverage: 80, marks: [1, 1, 1], trajectory: [{ quiz: "Week 1", pct: 80 }], practiceAttempts: 0, practiceRecent: 0, change: null }, o);
const cls = () => ({
  rosterSize: 8, thresholds: { effort: 70, perf: 50, idle: 14, misses: 2 }, groupNames: ["On track", "Needs a check-in"],
  attendance: { rate: 80, sessions: 3, bySession: [{ label: "S1", rate: 90 }, { label: "S2", rate: 80 }, { label: "S3", rate: 70 }] },
  quizzes: [{ quiz: "Week 1", stats: { mean: 65 }, participation: 90 }], practice: { last7Days: 12, studentsLast7Days: 3 },
  students: [stu(1), stu(2, { attendance: 50, quizAverage: 40, marks: [0, 1, 0], group: "Needs a check-in", trajectory: [{ quiz: "Week 1", pct: 40 }] }), stu(3, { attendance: 50, quizAverage: 70 }),
    stu(4, { attendance: 95, quizAverage: 30, trajectory: [{ quiz: "Week 1", pct: 30 }] }), stu(5, { attendance: 85, quizAverage: 60, practiceAttempts: 5, practiceRecent: 1, change: 4 }),
    stu(6, { attendance: 60, quizAverage: 45, practiceAttempts: 1, change: -6 }), stu(7, { attendance: 75, quizAverage: 75, practiceAttempts: 8, practiceRecent: 1, change: 8 }), stu(8, { attendance: null, quizAverage: null })]
});

test("risk zones split students by the two thresholds and say who is not plotted", () => {
  const z = G.riskZones(cls()), by = Object.fromEntries(z.zones.map((x) => [x.key, x.students.map((s) => s.id)]));
  assert.deepStrictEqual(by.both, ["1002", "1006"]); assert.deepStrictEqual(by.attendance, ["1003"]); assert.deepStrictEqual(by.quiz, ["1004"]);
  assert.strictEqual(z.missing, 1); assert.strictEqual(z.ok.length, 3);
});

test("every number has bars, and each bar carries the students behind it", () => {
  const d = G.drills(cls());
  assert.deepStrictEqual(d.attendance.bars[0].students.map((x) => x.id), ["1002"]); // absent at S1
  assert.deepStrictEqual(d.attendance.bars[0].label, "S1"); assert.strictEqual(d.students.bars.length, 2);
  assert.deepStrictEqual(d.learning.bars[0].students.map((s) => s.id), ["1002", "1004"]); // scored below 50
  assert.strictEqual(d.practice.bars[0].students.length, 2); assert.strictEqual(d.practice.bars[0].value + d.practice.bars[1].value, 8);
  const a = G.drills(Object.assign(cls(), {})).attendance; assert.ok(a.bars.every((b) => Array.isArray(b.students)));
  assert.deepStrictEqual(G.drills(cls()).attendance.bars.map((b) => b.what), ["absent", "absent", "absent"]);
});

test("a relation shows n and r and says association, and refuses a tiny sample", () => {
  const v = G.correlations(cls()), a = v.find((x) => x.key === "att-quiz");
  assert.strictEqual(a.n, 7); assert.ok(a.r !== null); assert.match(a.text, /n = 7 students/); assert.match(a.text, /not what causes what/);
  const small = G.correlations({ students: [stu(1), stu(2)] }).find((x) => x.key === "prac-change");
  assert.strictEqual(small.r, null); assert.match(small.text, /too few/);
  assert.strictEqual(G.pearson([{ x: 1, y: 1 }, { x: 2, y: 2 }, { x: 3, y: 3 }, { x: 4, y: 4 }, { x: 5, y: 5 }]), 1);
  assert.strictEqual(G.pearson([{ x: 1, y: 2 }, { x: 1, y: 3 }, { x: 1, y: 4 }, { x: 1, y: 5 }, { x: 1, y: 6 }]), null); // no spread in x
});

test("drawings are labelled SVG with data hooks for clicks; the chosen zone highlights the same dots", () => {
  const d = cls(), z = G.riskZones(d), svg = C.risk(z, "both");
  assert.match(svg, /^<svg/); assert.match(svg, /data-zone='both'/); assert.strictEqual((svg.match(/class='dot on'/g) || []).length, 2);
  const bars = C.bars(G.drills(d).attendance, 1); assert.match(bars, /data-bar='1'/); assert.match(bars, /aria-pressed='true'/);
  const rel = C.relation(G.correlations(d)[0], { 1002: 1 }); assert.strictEqual((rel.match(/class='dot on'/g) || []).length, 1);
  assert.match(C.relation(G.correlations({ students: [] })[0], null), /too few/);
  assert.ok(!/NaN|undefined/.test(svg + bars + rel));
});

test("the top of the dashboard: five clickable numbers, the risk chart, the linked views; names are escaped", () => {
  const d = cls(); d.students[0].name = "<b>x</b>";
  const html = V.top(d, undefined, undefined);
  assert.strictEqual(R.statCards(d).length, 5); assert.strictEqual((html.match(/data-drill='/g) || []).length, 5);
  assert.match(html, /id='drisk'/); assert.match(html, /id='dcorr'/); assert.match(html, /Association, not proof of cause/); assert.ok(!html.includes("<b>x</b>"));
  const tiny = V.riskCard({ students: [stu(1)], thresholds: {} }); assert.match(tiny, /at least 5 students/);
});

test("no practice recorded does not flag a student on its own, but is noted beside a real reason", () => {
  const c = classroom({ students: 4 });
  const stats = c.host("insights");
  assert.strictEqual(stats.ok, true); assert.strictEqual(stats.attention.length, 0); // before the fix every student was flagged
});

test("lecturer sign-in says whether the password or the join code was refused", () => {
  const c = classroom({ students: 2 });
  const wk = c.call({ action: "host", code: "26276", hostkey: c.key }); // shaped like a week, not in the course: a signed-in lecturer can still open it
  assert.strictEqual(wk.ok, true); assert.match(wk.note, /Week 6 has no question bank/); assert.strictEqual(c.call({ action: "host", code: "26276", hostkey: "wrong password here" }).why, "password");
  assert.deepStrictEqual(c.call({ action: "host", code: "ZZZZ", hostkey: "wrong password here" }).why, "password");
  assert.deepStrictEqual(c.call({ action: "host", code: "ZZZZ", hostkey: c.key }).why, "join code");
  assert.strictEqual(c.call({ action: "host", code: "26279", hostkey: c.key }).ok, true); // a known join code opens
});
