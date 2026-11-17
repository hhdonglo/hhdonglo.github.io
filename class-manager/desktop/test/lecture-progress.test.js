"use strict";
// Lectures held against the semester target, on made-up dates.
const test = require("node:test");
const assert = require("node:assert");
const P = require("../rules/lecture-progress");
const L = require("../rules/lecture-log");

// Tuesdays and Thursdays, 2 Nov 2026 to 25 Jan 2027, 26 lectures planned.
const base = { target: 26, start: "2026-11-02", end: "2027-01-25", days: "2,4" };
const dates = (n) => Array.from({ length: n }, (_, i) => new Date(Date.UTC(2026, 10, 3 + i)).toISOString().slice(0, 10));

test("no target: says so, still counts what was held", () => {
  const s = P.status({ heldDates: ["2026-11-03"], today: "2026-11-10" });
  assert.strictEqual(s.state, "none"); assert.strictEqual(s.held, 1);
});

test("target without dates gives held and left only", () => {
  const s = P.status({ target: 13, heldDates: dates(4), today: "2026-11-10" });
  assert.strictEqual(s.state, "count"); assert.strictEqual(s.left, 9); assert.strictEqual(s.behind, 0);
});

test("before the first day nothing is owed", () => {
  const s = P.status(Object.assign({}, base, { heldDates: [], today: "2026-10-30" }));
  assert.strictEqual(s.state, "notstarted"); assert.strictEqual(s.behind, 0);
});

test("on the timetable: behind, with how many to add and over how many weeks", () => {
  // by 24 Nov there were 7 teaching days before it (3,5,10,12,17,19 Nov and 24 not yet): 6 slots; the lecturer held 3.
  const s = P.status(Object.assign({}, base, { heldDates: ["2026-11-03", "2026-11-05", "2026-11-10"], today: "2026-11-24" }));
  assert.strictEqual(s.state, "behind"); assert.ok(s.behind >= 2); assert.strictEqual(s.left, 23);
  assert.ok(/extra session/.test(s.detail)); assert.ok(s.weeksLeft >= 8);
});

test("held as expected is on track, more is ahead", () => {
  const ok = P.status(Object.assign({}, base, { heldDates: dates(8), today: "2026-11-24" }));
  assert.ok(["ontrack", "ahead"].indexOf(ok.state) >= 0);
  const ahead = P.status(Object.assign({}, base, { heldDates: dates(20), today: "2026-11-24" }));
  assert.strictEqual(ahead.state, "ahead");
});

test("two sessions on one day are one lecture, a cancelled day never counts", () => {
  const s = P.status(Object.assign({}, base, { heldDates: ["2026-11-03", "2026-11-03", "2026-11-05"], cancelledDates: ["2026-11-05"], today: "2026-11-10" }));
  assert.strictEqual(s.held, 1);
});

test("without teaching days the target is spread evenly over the semester", () => {
  const s = P.status({ target: 12, start: "2026-11-01", end: "2026-12-12", heldDates: [], today: "2026-11-22" }); // 21 of 42 days gone
  assert.strictEqual(s.expected, 6); assert.strictEqual(s.state, "behind");
});

test("target met and semester ended", () => {
  assert.strictEqual(P.status(Object.assign({}, base, { heldDates: dates(26), today: "2026-12-01" })).state, "met");
  const e = P.status(Object.assign({}, base, { heldDates: dates(20), today: "2027-02-01" }));
  assert.strictEqual(e.state, "ended"); assert.strictEqual(e.left, 6);
});

test("the dismissal key changes when a lecture is saved", () => {
  const a = P.status(Object.assign({}, base, { heldDates: ["2026-11-03"], today: "2026-11-24" }));
  const b = P.status(Object.assign({}, base, { heldDates: ["2026-11-03", "2026-11-05"], today: "2026-11-24" }));
  assert.notStrictEqual(a.key, b.key);
});

// A store with the attendance control tab and settings, as the rules see it.
function store(sessions, props) {
  const tabs = { Attendance_Control: [["Code", "Label", "Status", "Opened", "Closed", "Secret"]].concat(sessions) };
  const pr = Object.assign({}, props);
  return { rows: (t) => tabs[t] || null, setRows: (t, r) => { tabs[t] = r; }, prop: (k) => (k in pr ? pr[k] : null), setProp: (k, v) => { if (v == null) delete pr[k]; else pr[k] = v; }, now: () => new Date(2026, 10, 24, 10) };
}
const sess = (day, status) => ["1000", day, status, new Date(2026, 10, day, 9).toISOString(), "", "x"];
const settings = { lectureTarget: 26, startDate: "2026-11-02", endDate: "2027-01-25", teachingDays: "2,4" };

test("closed and submitted attendance sessions count; open and discarded do not", () => {
  const r = L.report(store([sess(3, "Closed"), sess(5, "Submitted"), sess(10, "Open"), sess(12, "Discarded")]), settings);
  assert.strictEqual(r.held, 2);
});

test("a second session the same day does not count twice", () => {
  const r = L.report(store([sess(3, "Submitted"), sess(3, "Closed")]), settings);
  assert.strictEqual(r.held, 1);
});

test("the lecturer can add a make-up, cancel a day, and remove a mark; marks live in the course settings", () => {
  const s = store([sess(3, "Submitted")]);
  assert.ok(L.mark(s, "2026-11-07", "makeup").ok);
  assert.strictEqual(L.report(s, settings).held, 2);
  L.mark(s, "2026-11-03", "cancelled");
  assert.strictEqual(L.report(s, settings).held, 1);
  L.mark(s, "2026-11-03", null);
  assert.strictEqual(L.report(s, settings).held, 2);
  assert.ok(!L.mark(s, "not a date", "held").ok);
});

test("works with no class list: nothing here reads the roster", () => {
  const r = L.report(store([]), settings);
  assert.strictEqual(r.held, 0); assert.ok(r.state === "behind" || r.state === "ontrack");
});
