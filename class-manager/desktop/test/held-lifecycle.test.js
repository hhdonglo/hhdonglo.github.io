/* Stop, then Submit or Discard: stopping attendance or a quiz records nothing for students; the stopped item is held, survives a restart,
   and only Submit puts it against the class list, grades and attendance totals. Discard erases it. Unlisted IDs stay apart. */
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { classroom } = require("./classroom");
const { fromBackend } = require("../rules/store");
const AT = require("../rules/attendance");

const dev = (n) => "phonedevice" + n + "abcdefghijklmnopqrstuvwxyz", CODE = "26271", OFF = "55555555";
const tab = (c, name) => (c.backend.rawRows(name) || []).slice(1);
const tokenOf = (c) => AT.linkFor(AT.openSession(fromBackend(c.backend)).secret, Math.floor(Date.now() / 30000));

function takeAttendance(c, n, extraId) {
  assert.equal(c.host("attend_open", { nogeo: "1" }).ok, true);
  const t = tokenOf(c);
  c.students.slice(0, n).forEach((s, i) => { assert.equal(c.call({ action: "attend", id: s.id, dev: dev(i), t }).ok, true); });
  if (extraId) { c.call({ action: "attend", id: extraId, dev: dev(9), t }); }
}
function runQuiz(c) {
  c.host("control", { code: CODE, act: "init" }); c.host("control", { code: CODE, act: "set", field: "q_seconds", value: "0" }); c.host("control", { code: CODE, act: "start" });
  c.students.forEach((s) => c.call({ kind: "join", name: s.name, id: s.id, code: CODE }));
  for (let q = 1; q <= 5; q++) { c.students.forEach((s) => c.call({ kind: "answer", name: s.name, id: s.id, code: CODE, q, answer: "A" })); if (q < 5) c.host("control", { code: CODE, act: "next" }); }
  return c.host("control", { code: CODE, act: "end" });
}

test("stopping attendance holds it: no grid column, nothing submitted, and it survives a restart", () => {
  const c = classroom({ students: 3, engine: "js" });
  takeAttendance(c, 2, OFF);
  const closed = c.host("attend_close"); assert.equal(closed.ok, true); assert.equal(closed.held, true);
  assert.equal(tab(c, "Attendance").length, 0, "stop never writes the attendance grid");
  const held = c.host("held_items"); assert.equal(held.sessions.length, 1);
  assert.deepEqual([held.sessions[0].present, held.sessions[0].absent, held.sessions[0].notOnList], [2, 1, 1], "the unlisted ID is counted apart");
  c.reopen();
  assert.equal(c.host("held_items").sessions.length, 1, "still held after CM restarts");
  assert.equal(tab(c, "Attendance").length, 0);
  c.backend.close();
});

test("submitting one held session records it; the other stays held; discarding erases it", () => {
  const c = classroom({ students: 3, engine: "js" });
  takeAttendance(c, 2); c.host("attend_close");
  const first = c.host("held_items").sessions[0];
  takeAttendance(c, 3); c.host("attend_close");
  const two = c.host("held_items").sessions; assert.equal(two.length, 2);
  const second = two.find((s) => s.code !== first.code);
  const r = c.host("attend_submit", { session: first.code }); assert.equal(r.ok, true); assert.equal(r.submitted.length, 1);
  assert.equal(c.host("held_items").sessions.length, 1);
  const grid = c.backend.rawRows("Attendance"); assert.equal(grid.length, 4); assert.equal(grid[0].length, 2, "one column only");
  const d = c.host("attend_discard", { session: second.code }); assert.equal(d.ok, true); assert.equal(d.discarded, 1);
  assert.equal(c.host("held_items").sessions.length, 0);
  assert.equal(c.backend.rawRows("Attendance")[0].length, 2, "the discarded session left no column");
  assert.equal(tab(c, "Attendance_Log").filter((x) => String(x[1]) === second.label || false).length, 0);
  c.backend.close();
});

test("a stopped quiz is held until Submit; Discard erases it; held results survive a restart", () => {
  const c = classroom({ students: 3, engine: "js" });
  assert.equal(runQuiz(c).ok, true);
  assert.equal(tab(c, "Form Responses 1").length, 0, "stop records nothing");
  let held = c.host("held_items"); assert.equal(held.quizzes.length, 1); assert.equal(held.quizzes[0].count, 3); assert.equal(held.quizzes[0].code, CODE);
  c.reopen(); held = c.host("held_items"); assert.equal(held.quizzes[0].count, 3, "still held after CM restarts");
  const q = held.quizzes[0];
  const s = c.host("held_release_quiz", { code: q.code, round: q.round }); assert.equal(s.ok, true); assert.equal(s.released, 3);
  assert.equal(tab(c, "Form Responses 1").length, 3); assert.equal(c.host("held_items").quizzes.length, 0);
  c.backend.close();
  const c2 = classroom({ students: 3, engine: "js" }); runQuiz(c2);
  const q2 = c2.host("held_items").quizzes[0], d = c2.host("held_discard_quiz", { code: q2.code, round: q2.round });
  assert.equal(d.ok, true); assert.equal(d.discarded, 3); assert.equal(tab(c2, "Form Responses 1").length, 0); assert.equal(c2.host("held_items").quizzes.length, 0);
  c2.backend.close();
});

test("held items need the password", () => {
  const c = classroom({ students: 1, engine: "js" });
  assert.equal(c.call({ action: "held_items" }).ok, false);
  assert.equal(c.call({ action: "attend_submit", session: "1" }).ok, false);
  c.backend.close();
});
