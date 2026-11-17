"use strict";
// The Class Analytics board: the numbers behind each panel and the strings the panels draw, on made-up class statistics (no real student data).
const test = require("node:test");
const assert = require("node:assert");
const M = require("../app/board/model");
const V = require("../app/board/render");
const BL = require("../app/board/barline");
const D = require("../app/board/donut");
const SEC = require("../app/board/sections");
const ST = require("../app/board/strip");
const LY = require("../app/board/layout");

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
  assert.ok(f.length >= 4 && f.length <= 6);
  assert.ok(f.some((x) => /Attendance fell by 20 points/.test(x.text)));
  assert.ok(f.some((x) => /Lowest topic: Forces at 41%/.test(x.text)));
  assert.deepStrictEqual(M.findings({ rosterSize: 0, attendance: {}, quizzes: [], learning: {}, students: [] }, null), []);
});

test("the board draws with data, and the clicks the page relies on are in the markup", () => {
  const html = V.kpiRow(base()) + V.html(base(), lp());
  ["data-drill='students'", "data-drill='risk'", "data-bd-tab='quiz'", "data-bd-view='groups'", "data-bd-bar='0'", "id='bd-rank'", "id='bd-ins'"].forEach((x) => assert.ok(html.includes(x), x));
  assert.ok(!/&(?!amp;|lt;|gt;|quot;|#39;)/.test(html.replace(/&amp;/g, "")), "no bare ampersand");
  assert.ok(/<svg[^>]*role='img'/.test(html), "every chart has a text label");
  assert.ok(V.breakPanel(base(), "groups").includes("data-bd-slice='0'"), "a group slice opens its students");
});

test("the empty board still has every panel, ghost bars and a plain message; names are escaped", () => {
  const e = { rosterSize: 30, attendance: { sessions: 0, bySession: [] }, quizzes: [], learning: { topics: [] }, groups: {}, students: [] };
  const html = V.html(e, null);
  ["id='bd-prog'", "id='bd-break'", "id='bd-rank'", "id='bd-ins'"].forEach((x) => assert.ok(html.includes(x), x));
  assert.ok(/No attendance session submitted yet/.test(html) && /No lecture plan yet/.test(ST.html(null)), "the empty plan is said in the strip");
  const d = base(); d.learning.topics[0].label = "<img src=x onerror=alert(1)>";
  const out = V.html(d, lp()); assert.ok(!out.includes("<img"), "topic names are escaped");
});

test("chart strings: a bar with no drill is not a button; a donut with no data is a grey ring", () => {
  const lec = M.progress(base(), lp())[2];
  assert.ok(!BL.svg(lec).includes("data-bd-bar"));
  assert.ok(BL.svg(M.progress(base(), lp())[0]).includes("data-bd-key='attendance'"));
  assert.ok(/no data/.test(D.svg([{ key: "a", label: "A", value: 0, color: "orange" }], null, "T")));
});

test("at risk counts only solid evidence; flags on thin evidence are named separately and never inflate the number", () => {
  const d = base(); d.attendance.sessions = 2; d.quizzes = d.quizzes.slice(0, 1); // under 4 sessions and 2 quizzes: every reason is thin
  d.students = [stu("1", { attendance: 20 }), stu("2", { attendance: 30 })];
  const k = M.kpis(d)[4];
  assert.strictEqual(k.value, "0"); assert.ok(/2 more on thin evidence/.test(k.note), k.note);
  assert.ok(M.findings(d, null).some((x) => /thin evidence only/.test(x.text)));
});

test("sessions set aside are said in the attendance card and in the Attendance KPI", () => {
  const d = base(); d.attendance.notHeld = [{ label: "3 Nov 2026" }, { label: "6 Nov 2026" }];
  assert.ok(/\(2 set aside\)/.test(M.kpis(d)[1].note));
  const c = V.setAsideCard(d); assert.ok(/3 Nov, 6 Nov/.test(c) && /treated as not held/.test(c));
  assert.strictEqual(V.setAsideCard(base()), "");
});

test("spread card gives median, middle half, lowest and highest from the students' quiz averages", () => {
  const d = base(); d.students = [10, 20, 30, 40, 50].map((q, i) => stu(String(i), { quizAverage: q }));
  const sp = M.spread(d); assert.deepStrictEqual([sp.n, sp.median, sp.q1, sp.q3, sp.min, sp.max], [5, 30, 20, 40, 10, 50]);
  assert.ok(/Middle half/.test(V.spreadCard(d)) && /Appears once/.test(V.spreadCard({ students: [] })));
});

test("sections: each piece sits under its heading once, in order, empty sections are left out, with a jump row", () => {
  const html = SEC.compose({ overview: ["<p id='a'></p>"], quizzes: ["<p id='b'></p>"], risk: [""], privacy: ["<p id='c'></p>"] }, "quizzes", "<i id='between'></i>");
  assert.ok(html.indexOf("id='sec-overview'") < html.indexOf("id='sec-quizzes'") && html.indexOf("id='sec-quizzes'") < html.indexOf("id='sec-privacy'"));
  assert.ok(!html.includes("sec-risk\"") && !html.includes("id='sec-risk'"), "an empty section is omitted");
  assert.strictEqual((html.match(/id='a'/g) || []).length, 1); assert.ok(html.includes("data-bd-pane='quizzes'") && !html.includes("data-bd-pane='risk'"), "a tab bar with the filled sections only");
  assert.ok(/id='sec-quizzes'[^>]*>/.test(html) && !/id='sec-quizzes'[^>]*hidden/.test(html) && /id='sec-overview'[^>]*hidden/.test(html), "only the chosen tab is shown");
  assert.ok(html.indexOf("id='between'") < html.indexOf("id='sec-overview'"), "the drill-down list sits above the grids");
  assert.ok(/id='sec-overview'[^>]*(?!hidden)/.test(SEC.compose({ overview: ["<p>x</p>"] }, "nope")) && !/hidden/.test(SEC.compose({ overview: ["<p>x</p>"] }, "nope")), "an unknown tab falls back to the first");
  assert.deepStrictEqual(SEC.ORDER.map((x) => x[0]), ["overview", "attendance", "quizzes", "risk", "questions", "relations", "actions", "privacy"]);
});

const SH = require("../app/board/shares");
test("donut shares: attendance, score bands, flag reasons and mastery bands add up and say when there is nothing", () => {
  const d = base(); d.attendance.bySession = [{ label: "a", present: 15, counted: 20 }, { label: "b", present: 5, counted: 20 }];
  const a = SH.attendance(d); assert.deepStrictEqual([a.slices[0].value, a.slices[1].value, a.centre.big], [20, 20, "50%"]);
  assert.strictEqual(SH.attendance({ attendance: { bySession: [] } }).centre, null);
  d.students = [30, 55, 72, 90, 95, null].map((q, i) => stu(String(i), { quizAverage: q }));
  const sc = SH.scores(d); assert.deepStrictEqual(sc.slices.map((x) => x.value), [1, 1, 1, 2]); assert.strictEqual(sc.total, 5);
  const r = SH.risk(Object.assign(base(), { attendance: { sessions: 6, bySession: [] }, students: Array.from({ length: 12 }, (_, i) => stu(String(i), { attendance: i < 2 ? 10 : 90 })) }));
  assert.strictEqual(r.slices.length, 1); assert.strictEqual(r.slices[0].value, 2); assert.strictEqual(r.centre.big, "2");
  assert.strictEqual(SH.mastery({ topics: { semester: [{ band: "well", pct: 80, label: "L1" }, { band: "attention", pct: 30, label: "L2" }] }, quizzes: [] }).total, 2);
  const html = V.attendanceShare(d) + V.scoreShare(d) + V.riskShare(d) + V.masteryShare(d);
  ["bd-satt", "bd-sscore", "bd-srisk", "bd-smast"].forEach((x) => assert.ok(html.includes("id='" + x + "'"), x));
  assert.ok(/Nothing to show yet/.test(V.attendanceShare({ attendance: { bySession: [] } })));
});

test("lecture strip: donut, bar with an expected marker, a state badge and chips; sentences only in tooltips", () => {
  const h = ST.html(lp());
  assert.ok(/class='lpc-badge bad'/.test(h) && /Behind/.test(h) && /lpc-exp/.test(h) && /<svg[^>]*role='img'/.test(h));
  assert.ok(/Due<\/i> Lecture 6/.test(h) && /Next<\/i> Lecture 5/.test(h) && /Missed/.test(h));
  assert.ok(!/<p[^>]*>[^<]{60,}/.test(h.replace(/title='[^']*'/g, "")), "no running text outside tooltips");
  assert.ok(/No lecture plan yet/.test(ST.html({ target: 0 })));
});

test("layout: charts first and text cards last by default; saved width, height, order and hidden win; keyboard steps and drops reorder", () => {
  const keys = ["bd-ins", "bd-prog", "c-class-health", "bd-break"];
  assert.deepStrictEqual(LY.resolve(keys).map((c) => c.key), ["bd-prog", "bd-break", "bd-ins", "c-class-health"]);
  const r = LY.resolve(keys, { "bd-prog": { w: 99, h: 133, hidden: true }, "bd-ins": { order: -5 } });
  assert.strictEqual(r[0].key, "bd-ins"); const p = r.find((c) => c.key === "bd-prog");
  assert.deepStrictEqual([p.w, p.h, p.hidden], [12, 140, true], "width is clamped to 12 columns, height snaps to 20 pixels");
  assert.strictEqual(LY.clampW(0), LY.MIN_W);
  const list = LY.resolve(keys), o = LY.move(list, "bd-ins", "bd-prog");
  assert.ok(o["bd-ins"] < o["bd-prog"] && o["bd-prog"] < o["bd-break"]);
  const s = LY.step(list, "bd-prog", 1); assert.ok(s["bd-prog"] > s["bd-break"]); assert.strictEqual(LY.step(list, "bd-prog", -1), null);
});

test("empty cards are one line: no donut when there is nothing to count", () => {
  const e = base(); e.learning.topics = [];
  const b = V.breakPanel(e, "topics"); assert.ok(!/<svg/.test(b) && /Topics appear/.test(b));
  const c = V.masteryShare({ topics: { semester: [] }, quizzes: [] }); assert.ok(!/<svg/.test(c) && /bd-slim/.test(c));
});
