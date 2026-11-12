/* Class graphs (distribution, box plot, scatter, day selector, refresh): run with `npm test` in class-manager/desktop. */
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const S = require("../app/charts/stats");
const D = require("../app/charts/days");
const { distribution } = require("../app/charts/distribution");
const { boxplot } = require("../app/charts/boxplot");
const { scatter } = require("../app/charts/scatter");
const P = require("../app/charts/panel");

const rows = (vs) => vs.map((v, i) => ({ id: "10" + String(i).padStart(4, "0"), name: "S" + i, v }));
const many = rows([56, 57, 58, 58, 59, 59, 60, 60, 60, 61, 61, 62, 62, 63, 64, 100, 5]); // id 100015 is high, 100016 is low

test("stats: mean, sample SD, quartiles, skew and correlation agree with hand figures", () => {
  assert.equal(S.mean([2, 4, 6]), 4); assert.equal(S.sd([2, 4, 6]), 2);
  const q = S.quartiles([1, 2, 3, 4, 5]); assert.deepEqual([q.q1, q.median, q.q3], [2, 3, 4]);
  assert.equal(S.skew([1, 2, 3, 4, 5]), 0); assert.ok(S.skew([1, 1, 1, 2, 9]) > 0);
  assert.ok(Math.abs(S.pearson([{ x: 1, y: 2 }, { x: 2, y: 4 }, { x: 3, y: 6 }]) - 1) < 1e-9);
  assert.equal(S.sd([5]), null); assert.equal(S.mean([]), null);
});

test("stats: outliers beyond k SD are listed high and low, most extreme first", () => {
  const o = S.outliers(many, 2);
  assert.deepEqual(o.high.map((r) => r.v), [100]); assert.deepEqual(o.low.map((r) => r.v), [5]);
  assert.equal(S.outliers(many, 5).high.length, 0);
  const h = S.histogram([0, 5, 99, 100], 10, 0, 100); assert.equal(h[0], 2); assert.equal(h[9], 2);
});

test("distribution: curve, caption, outlier list opening the student, and a table", () => {
  const h = distribution(many, { label: "Quiz average", k: 2 });
  assert.match(h, /What this shows/); assert.match(h, /dist-curve/); assert.match(h, /Unusually high/); assert.match(h, /Unusually low/);
  assert.match(h, /data-student='100015'/); assert.match(h, /View as a table/); assert.doesNotMatch(h, /Small sample/);
});

test("distribution: under 10 students gets a warning and no curve; nothing gets a plain sentence", () => {
  const h = distribution(rows([40, 50, 60]), { label: "Attendance" });
  assert.match(h, /Small sample/); assert.doesNotMatch(h, /dist-curve/); assert.match(h, /View as a table/);
  assert.match(distribution([], {}), /No performance figures/);
});

test("box plot: outliers are dots that open the student; a small measure is warned", () => {
  const h = boxplot([{ label: "Quiz average", rows: many }, { label: "Attendance", rows: rows([80, 90, 100]) }]);
  assert.match(h, /box-out/); assert.match(h, /data-student=/); assert.match(h, /Small sample[^<]*Attendance/); assert.match(h, /View as a table/);
  assert.match(boxplot([]), /No figures yet/);
});

test("scatter: dots open the student; the relationship is stated only from 10 students", () => {
  const pts = Array.from({ length: 12 }, (_, i) => ({ id: "2" + i, name: "P" + i, x: 50 + i * 4, y: 40 + i * 4 }));
  const h = scatter(pts, { yLabel: "Quiz average" });
  assert.match(h, /scat-dot/); assert.match(h, /data-student='20'/); assert.match(h, /strong positive relationship/); assert.match(h, /not a cause/);
  assert.match(scatter(pts.slice(0, 4)), /Small sample/);
  assert.match(scatter([]), /Not enough students/);
});

// A made-up class: three sessions (two on dated days), two quizzes.
const cls = {
  attendance: { bySession: [{ label: "03/11/2026 Lecture 1" }, { label: "10/11/2026 Lecture 2" }, { label: "Lab week" }] },
  quizzes: [{ quiz: "Week 1", date: "03/11/2026" }, { quiz: "Week 2", date: "10/11/2026" }],
  students: [
    { id: "1", name: "Ada", marks: [1, 1, 1], trajectory: [{ quiz: "Week 1", pct: 80 }, { quiz: "Week 2", pct: 100 }] },
    { id: "2", name: "Ben", marks: [1, 0, null], trajectory: [{ quiz: "Week 1", pct: 40 }] },
  ],
};

test("days: one entry per date, quiz and session on the same date share a day, an undated session stands alone", () => {
  const tl = D.timeline(cls);
  assert.equal(tl.length, 3); assert.equal(tl[0].label, "03/11/2026"); assert.equal(tl[0].what, "attendance and quiz"); assert.equal(tl[2].label, "Lab week");
  assert.equal(D.parseDate("10/11/2026 Lecture 2"), Date.UTC(2026, 10, 10)); assert.equal(D.parseDate("Lab week"), null);
});

test("days: today is chosen when there is a class today, otherwise the latest day", () => {
  const tl = D.timeline(cls);
  assert.equal(D.pick(tl, new Date(2026, 10, 10, 12)), 1); assert.equal(D.pick(tl, new Date(2026, 11, 25)), 2); assert.equal(D.pick([], 0), -1);
});

test("days: 'up to' and 'this day only' give different figures for the same day", () => {
  const tl = D.timeline(cls), upTo = D.figures(cls, tl, 1, "to"), on = D.figures(cls, tl, 1, "on");
  assert.deepEqual([upTo[0].att, upTo[0].quiz], [100, 90]); assert.deepEqual([on[0].att, on[0].quiz], [100, 100]);
  assert.deepEqual([upTo[1].att, upTo[1].quiz], [50, 40]); assert.deepEqual([on[1].att, on[1].quiz], [0, null]);
});

test("panel: renders for the chosen day, keeps it through a redraw, and falls back when the day is gone", () => {
  P.reset();
  let h = P.render(cls); assert.match(h, /Class graphs/); assert.match(h, /id='gx-day'/); assert.match(h, /What this shows/);
  P.chosen(D.timeline(cls)[0].key, cls, () => {}); h = P.render(cls); assert.match(h, /Up to 03\/11\/2026/);
  P.handle({ closest: () => ({ getAttribute: () => "mode:on" }) }, cls, () => {}); assert.match(P.render(cls), /On 03\/11\/2026 only/);
  P.state.day = "d0"; assert.match(P.render(cls), /Lab week|10\/11\/2026/); // a day that no longer exists
  assert.match(P.render({ attendance: { bySession: [] }, quizzes: [], students: [] }), /appear once there is a session/);
  P.reset();
});

test("panel: the watcher redraws only when the stamp changes", async () => {
  let stamp = 1, calls = 0;
  const stop = P.watch(() => Promise.resolve({ ok: true, stamp }), () => { calls++; }, 10);
  await new Promise((r) => setTimeout(r, 60)); assert.equal(calls, 0);
  stamp = 2; await new Promise((r) => setTimeout(r, 60)); assert.equal(calls, 1);
  await new Promise((r) => setTimeout(r, 60)); assert.equal(calls, 1); stop();
});

test("wiring: scripts are loaded in order, the stamp is exposed, the panel is mounted on the overview", () => {
  const home = fs.readFileSync(path.join(__dirname, "../app/home.html"), "utf8");
  const at = (f) => home.indexOf("charts/" + f + ".js");
  ["core", "stats", "days", "distribution", "boxplot", "scatter", "panel"].forEach((f) => assert.ok(at(f) > 0, f));
  assert.ok(at("core") < at("stats") && at("stats") < at("days") && at("distribution") < at("panel") && at("panel") < home.indexOf("insights.js"));
  assert.match(fs.readFileSync(path.join(__dirname, "../preload.js"), "utf8"), /stamp: call\("cm:stamp"\)/);
  assert.match(fs.readFileSync(path.join(__dirname, "../main.js"), "utf8"), /on\("cm:stamp"/);
  const ins = fs.readFileSync(path.join(__dirname, "../app/insights.js"), "utf8");
  assert.match(ins, /id='gx'/); assert.match(ins, /panel\.watch/);
});
