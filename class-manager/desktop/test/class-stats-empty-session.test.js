"use strict";
// A session where nobody checked in was not held: it is set aside, so it cannot drag every rate down or flag the whole class.
const test = require("node:test");
const assert = require("node:assert");
const S = require("../rules/class-stats");

const ids = ["10690001", "10690002", "10690003", "10690004"];
const tabs = {
  Roster: [["Student ID", "Name"]].concat(ids.map((id, i) => [id, "Student " + i])),
  // two real sessions (3 of 4 and 2 of 4 present) and two where nobody checked in
  Attendance: [["Student ID", "3 Nov 2026", "4 Nov 2026", "6 Nov 2026", "10 Nov 2026"]].concat(ids.map((id, i) => [id, 0, i < 3 ? 1 : 0, 0, i < 2 ? 1 : 0]))
};
const store = { now: () => new Date("2026-11-17T12:00:00Z"), rows: (t) => tabs[t] || null };

test("sessions with no check-ins are set aside and every rate uses only the sessions that were held", () => {
  const d = S.classStats(store, {}, "t");
  assert.strictEqual(d.attendance.sessions, 2);
  assert.deepStrictEqual(d.attendance.notHeld.map((x) => x.label.replace(/\s+\d{4}$/, "")), ["3 Nov", "6 Nov"]);
  assert.strictEqual(d.attendance.rate, 62.5, "5 present of 8 marks in the two held sessions");
  assert.deepStrictEqual(d.students[0].marks, [1, 1]); assert.strictEqual(d.students[0].attendance, 100);
  assert.strictEqual(d.students[3].attendance, 0);
});

test("a class where no session was ever attended has no sessions rather than a rate of 0", () => {
  const t2 = { Roster: tabs.Roster, Attendance: [["Student ID", "3 Nov 2026"]].concat(ids.map((id) => [id, 0])) };
  const d = S.classStats({ now: store.now, rows: (t) => t2[t] || null }, {}, "t");
  assert.strictEqual(d.attendance.sessions, 0); assert.strictEqual(d.attendance.rate, null); assert.strictEqual(d.attendance.notHeld.length, 1);
});
