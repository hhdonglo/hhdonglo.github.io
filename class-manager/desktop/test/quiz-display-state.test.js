/* The quiz projector is never blank: every answer, including "no such quiz", "no question bank" and "no answer", has words on screen. */
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { classroom } = require("./classroom");
const { notice } = require("../../assets/quiz-display-state");

const CODE = "26271"; // the join base 2627 followed by week 1

test("a week-shaped join code without a question bank still shows the projector, with a note (it used to answer ok:false and the page stayed blank)", () => {
  const c = classroom({ students: 2, engine: "js" });
  try {
    c.state.missing = /live_quizzes/; // this course has no bank for the week
    const d = c.call({ action: "display", code: CODE });
    assert.equal(d.ok, true);
    assert.equal(d.joined, 0);
    assert.match(d.note, /Week 1 has no question bank/);
    assert.match(notice(d, "x"), /no question bank/);
  } finally { c.backend.close(); }
});

test("a code that no quiz uses is refused with a reason, and the projector explains it", () => {
  const c = classroom({ students: 2, engine: "js" });
  try {
    const d = c.call({ action: "display", code: "99999" });
    assert.equal(d.ok, false);
    assert.equal(d.why, "no such code");
    assert.match(notice(d, "x"), /No quiz has this join code/);
  } finally { c.backend.close(); }
});

test("lobby, running and ended quizzes draw without a notice; no answer at all says so", () => {
  const c = classroom({ students: 2, engine: "js" });
  try {
    c.host("control", { code: CODE, act: "init" });
    let d = c.call({ action: "display", code: CODE });
    assert.equal(d.ok, true); assert.equal(d.status.state, "ready"); assert.equal(notice(d, "x"), "");
    c.host("control", { code: CODE, act: "set", field: "q_seconds", value: "0" }); c.host("control", { code: CODE, act: "start" });
    d = c.call({ action: "display", code: CODE }); assert.equal(d.status.state, "running"); assert.equal(notice(d, "x"), "");
    c.host("control", { code: CODE, act: "end" });
    d = c.call({ action: "display", code: CODE }); assert.equal(d.status.state, "ended"); assert.equal(notice(d, "x"), "");
    assert.equal(notice(null, "CM did not answer."), "CM did not answer.");
    assert.match(notice({ ok: true, controlled: false }, "x"), /not been set up/);
  } finally { c.backend.close(); }
});
