/* rules/quiz-control.js controls a quiz in the same way as the Apps Script: the same actions give the same states, refusals, questions and letters. */
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const { classroom } = require("./classroom");
const Q = require("../rules/quiz-control");
const { fromBackend } = require("../rules/store");

const WEB = path.resolve(__dirname, "..", ".."), PACK = path.join(WEB, "course-packs", "phys143", "files");
const site = (p) => { const a = path.join(PACK, p); return JSON.parse(fs.readFileSync(fs.existsSync(a) ? a : path.join(WEB, p), "utf8")); };
// Times differ by a few milliseconds between the two sides: compare them as seconds from the server's clock.
const norm = (r) => {
  const o = JSON.parse(JSON.stringify(r, (k, v) => (k === "_session" ? undefined : v)));
  const st = o.status; if (st) { ["endTime", "qDeadline"].forEach((k) => { if (st[k] > 1e9) st[k] = Math.round((st[k] - st.serverNow) / 1000) || 0; }); delete st.serverNow; delete st.quizType; /* the diagnostic mode is new in CM; the old script has none */ if (st.remainingMs) st.remainingMs = Math.round(st.remainingMs / 1000); }
  return o;
};
function pair() {
  const script = classroom({ students: 2 }), mod = classroom({ students: 2 });
  [script, mod].forEach((c) => c.backend.setProp("draw_salt", ":abcd1234"));
  const o = { site, random: () => "00000000", finalize() {}, commit() {}, discard: () => ({ discarded: 0 }) };
  const store = fromBackend(mod.backend);
  return {
    script, mod, store,
    both(p, code) { const a = script.host("control", Object.assign({ code }, p)), b = Q.act(store, p, code, o); assert.deepEqual(norm(b), norm(a), JSON.stringify(p)); return b; },
    close() { script.backend.close(); mod.backend.close(); }
  };
}
const CODE = "26271";

test("a paced quiz from start to review, step by step", () => {
  const P = pair(), st = (r) => r.status;
  assert.equal(P.both({ act: "start" }, CODE).ok, false, "not lecturer-controlled yet");
  P.both({ act: "init" }, CODE); P.both({ act: "init" }, CODE);
  P.both({ act: "set", field: "q_seconds", value: "30" }, CODE); P.both({ act: "set", field: "n_questions", value: "7" }, CODE);
  P.both({ act: "set", field: "title", value: "Week 1" }, CODE); P.both({ act: "set", field: "allow_late_join", value: "no" }, CODE);
  P.both({ act: "set", field: "show_score", value: "immediate" }, CODE); P.both({ act: "set", field: "show_leaderboard", value: "never" }, CODE);
  P.both({ act: "set", field: "nothing", value: "x" }, CODE); P.both({ act: "set", field: "week", value: "3" }, CODE);
  P.both({ act: "lobby" }, CODE); P.both({ act: "reset" }, CODE); P.both({ act: "ready" }, CODE);
  const started = P.both({ act: "start" }, CODE);
  assert.equal(st(started).totalQ, 7); assert.equal(st(started).qids.length, 7);
  P.both({ act: "start" }, CODE); P.both({ act: "reset" }, CODE);
  P.both({ act: "revote" }, CODE); P.both({ act: "revote" }, CODE);
  P.both({ act: "pause" }, CODE); P.both({ act: "extend", min: "2" }, CODE); P.both({ act: "resume" }, CODE); P.both({ act: "resume" }, CODE);
  for (let i = 0; i < 7; i++) P.both({ act: "next" }, CODE);
  P.both({ act: "reopen", min: "1" }, CODE); P.both({ act: "end" }, CODE); P.both({ act: "end" }, CODE);
  P.both({ act: "review" }, CODE); P.both({ act: "reviewnext" }, CODE); P.both({ act: "reviewprev" }, CODE); P.both({ act: "reviewprev" }, CODE); P.both({ act: "reviewoff" }, CODE); P.both({ act: "reviewnext" }, CODE);
  P.both({ act: "message", text: "=SUM(1)" }, CODE); P.both({ act: "bogus" }, CODE); P.both({ act: "init" }, "NOSUCH");
  P.both({ act: "release" }, CODE); P.both({ act: "discard" }, CODE);
  P.close();
});

test("restart: a new round with new or the same questions, and the draw is the script's draw", () => {
  const P = pair();
  P.both({ act: "init" }, CODE); P.both({ act: "start" }, CODE);
  const first = P.both({ act: "restartsame" }, CODE); assert.equal(first.status.round, 1);
  const again = P.both({ act: "start" }, CODE);
  P.both({ act: "restart" }, CODE); P.both({ act: "start" }, CODE); P.both({ act: "newround" }, CODE);
  assert.equal(again.status.qids.length, 5);
  P.close();
});

test("a timed quiz counts down, pauses and ends the same way, and letters come from the bank", () => {
  const P = pair();
  P.both({ act: "init" }, CODE); P.both({ act: "set", field: "mode", value: "timed" }, CODE); P.both({ act: "set", field: "duration_min", value: "5" }, CODE);
  P.both({ act: "start" }, CODE); P.both({ act: "pause" }, CODE); P.both({ act: "extend", min: "3" }, CODE); P.both({ act: "resume" }, CODE);
  P.both({ act: "end" }, CODE); P.both({ act: "reopen" }, CODE); P.both({ act: "next" }, CODE);
  P.close();
});

test("letters and marks from a quiz's questions", () => {
  const P = pair(); P.both({ act: "init" }, CODE); P.both({ act: "start" }, CODE);
  const o = { site, random: () => "x" }, c = Q.ctl(P.store, CODE), letters = Q.lettersFor(P.store, CODE, c, o);
  assert.equal(letters.length, 5); assert.ok(letters.every((l) => /^[A-E]$/.test(l)));
  assert.deepEqual(Q.mark(letters, letters), [1, 1, 1, 1, 1]); assert.deepEqual(Q.mark(letters, ["", "", "", "", ""]), [0, 0, 0, 0, 0]);
  P.close();
});
