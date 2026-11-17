"use strict";
// The Class Analytics board: the numbers behind each panel and the strings the panels draw, on made-up class statistics (no real student data).
const test = require("node:test");
const assert = require("node:assert");
const M = require("../app/board/model");
const V = require("../app/board/render");
const BL = require("../app/board/barline");
const D = require("../app/board/donut");

const stu = (id, o) => Object.assign({ id, name: "Student " + id, group: "On track", missedInARow: 0, change: null, quizzesTaken: 3, attendance: 90, quizAverage: 70, practiceRecent: 1 }, o);
const base = () => ({
  rosterSize: 20, thresholds: { misses: 2, idle: 14 }, groupNames: ["On track", "Working hard but struggling", "Disengaged", "Needs a check-in", "Not enough data"],
  attendance: { rate: 82, sessions: 5, recentRate: 70, earlierRate: 90, bySession: [90, 88, 85, 75, 70].map((r, i) => ({ label: "2 Nov 2026".replace("2", String(i + 2)), rate: r })) },
  quizzes: [60, 65, 72].map((m, i) => ({ quiz: "Q" + i, stats: { mean: m }, participation: 70 + i })),
  learning: { verdict: "Learning", topics: [{ label: "Forces", pct: 41, gain: -3, verdict: "Not yet learning", small: false }, { label: "Energy", pct: 77, gain: 12, verdict: "Learning", small: false }, { label: "Momentum", pct: 58, gain: null, verdict: "Mixed", small: true }] },
  groups: { "On track": 12, "Working hard but struggling": 3, "Disengaged": 3, "Needs a check-in": 2, "Not enough data": 0 },
  students: [stu("1"), stu("2", { missedInARow: 3 }), stu("3", { practiceRecent: 0 })], summary: {}
});
const lp = () => ({ state: "behind", target: 12, held: 4, left: 8, expected: 6, behind: 2, weekNow: 5, weeksTotal: 12, headline: "Behind target: 2 lectures behind",
  days: [{ date: "2026-10-19", how: "attendance" }, { date: "2026-10-26", how: "attendance" }, { date: "2026-11-02", how: "cancelled" }, { date: "2026-11-09", how: "marked held" }],
  schedule: { due: { label: "Lecture 6", title: "Work" }, next: { label: "Lecture 5", title: "" }, missed: [{ label: "Lecture 5" }] } });

test("KPIs: five cards, trend arrows only where two numbers exist, practice counted from the student records", () => {
  const k = M.kpis(base());
  assert.deepStrictEqual(k.map((x) => x.key), ["students", "attendance", "learning", "practice", "risk"]);
  assert.strictEqual(k[1].delta.dir, "down"); assert.strictEqual(k[1].delta.text, "−20 pts");
  assert.strictEqual(k[2].value, "72%"); assert.strictEqual(k[2].delta.dir, "up");
  assert.strictEqual(k[3].value, "2");
  assert.strictEqual(k[0].delta, null);
  const few = base(); few.attendance.sessions = 2; assert.strictEqual(M.kpis(few)[1].delta, null, "a trend needs at least four sessions");
});

test("lecture plan: held, behind and still to come add up to the plan; no plan gives an empty state", () => {
  const p = M.plan(lp());
  assert.strictEqual(p.held + p.behind + p.still, 12); assert.strictEqual(p.pct, 33); assert.strictEqual(p.lines.length, 3);
  assert.strictEqual(M.plan(null).empty, true); assert.strictEqual(M.plan({ target: 0, held: 3 }).empty, true);
  const over = lp(); over.held = 14; over.behind = 0; assert.strictEqual(M.plan(over).held, 12, "never more than the plan");
});

test("progress series: attendance, quiz and cumulative lectures (cancelled days do not count)", () => {
  const s = M.progress(base(), lp());
  assert.deepStrictEqual(s.map((x) => x.key), ["attendance", "quiz", "lectures"]);
  assert.deepStrictEqual(s[2].bars, [1, 2, 3]); assert.strictEqual(s[2].refs[0].value, 12); assert.strictEqual(s[2].refs[1].value, 6);
  assert.strictEqual(s[0].line[0], 90); assert.strictEqual(s[0].line[1], 89, "running average");
  assert.strictEqual(s[0].labels[0], "2 Nov", "the year is dropped from the axis");
  assert.strictEqual(s[1].drill, "learning"); assert.strictEqual(s[2].drill, null);
});

test("breakdown and ranked table come from the learning topics, lowest first, with the growth", () => {
  const t = M.topicDonut(base()); assert.strictEqual(t.total, 3); assert.strictEqual(t.centre.big, "33%");
  const r = M.ranked(base()); assert.deepStrictEqual(r.map((x) => x.label), ["Forces", "Momentum", "Energy"]); assert.strictEqual(r[0].gain, -3);
  const g = M.groupDonut(base()); assert.strictEqual(g.total, 20); assert.strictEqual(g.slices[0].drill, 0);
});

test("findings are worked out from the numbers and never more than five", () => {
  const f = M.findings(base(), lp());
  assert.ok(f.length >= 4 && f.length <= 5);
  assert.ok(f.some((x) => /Attendance fell by 20 points/.test(x.text)));
  assert.ok(f.some((x) => /Lowest topic: Forces at 41%/.test(x.text)));
  assert.deepStrictEqual(M.findings({ rosterSize: 0, attendance: {}, quizzes: [], learning: {}, students: [] }, null), []);
});

test("the board draws with data, and the clicks the page relies on are in the markup", () => {
  const html = V.html(base(), lp());
  ["data-drill='students'", "data-drill='risk'", "id='ddrill'", "data-bd-tab='quiz'", "data-bd-view='groups'", "data-bd-bar='0'", "id='bd-plan'", "id='bd-rank'", "id='bd-ins'"].forEach((x) => assert.ok(html.includes(x), x));
  assert.ok(!/&(?!amp;|lt;|gt;|quot;|#39;)/.test(html.replace(/&amp;/g, "")), "no bare ampersand");
  assert.ok(/<svg[^>]*role='img'/.test(html), "every chart has a text label");
  assert.ok(V.breakPanel(base(), "groups").includes("data-bd-slice='0'"), "a group slice opens its students");
});

test("the empty board still has every panel, ghost bars and a plain message; names are escaped", () => {
  const e = { rosterSize: 30, attendance: { sessions: 0, bySession: [] }, quizzes: [], learning: { topics: [] }, groups: {}, students: [] };
  const html = V.html(e, null);
  ["id='bd-plan'", "id='bd-prog'", "id='bd-break'", "id='bd-rank'", "id='bd-ins'"].forEach((x) => assert.ok(html.includes(x), x));
  assert.ok(/No attendance session submitted yet/.test(html) && /No lecture plan yet/.test(html));
  const d = base(); d.learning.topics[0].label = "<img src=x onerror=alert(1)>";
  const out = V.html(d, lp()); assert.ok(!out.includes("<img"), "topic names are escaped");
});

test("chart strings: a bar with no drill is not a button; a donut with no data is a grey ring", () => {
  const lec = M.progress(base(), lp())[2];
  assert.ok(!BL.svg(lec).includes("data-bd-bar"));
  assert.ok(BL.svg(M.progress(base(), lp())[0]).includes("data-bd-key='attendance'"));
  assert.ok(/no data/.test(D.svg([{ key: "a", label: "A", value: 0, color: "orange" }], null, "T")));
});
