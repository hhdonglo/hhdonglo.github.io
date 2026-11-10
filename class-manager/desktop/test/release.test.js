/* The minimum release suite, at the level of the server script: run with `npm test` in class-manager/desktop.
   It follows one live quiz from set-up to released results, as the review of the project asks, and checks the
   failure cases a class meets in practice: duplicate submissions, invalid codes, a lost connection and a
   course whose content cannot be reached. The browser half of the suite is in test/browser/. */
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { classroom } = require("./classroom");

const CODE = "26271"; // Week 1: a join code with no Key row, valid because the course has a bank for week 1

// Runs one paced quiz of n questions; every student answers each question, the ones in `wrong` choose a wrong letter.
function runQuiz(c, n, answer) {
  assert.equal(c.host("host", { code: CODE }).ok, true);
  assert.equal(c.host("control", { code: CODE, act: "set", field: "n_questions", value: String(n) }).ok, true);
  assert.equal(c.host("control", { code: CODE, act: "lobby" }).ok, true);
  for (const s of c.students) assert.equal(c.post({ kind: "join", name: s.name, id: s.id, code: CODE }), "ok");
  const st = c.host("control", { code: CODE, act: "start" });
  assert.equal(st.ok, true, JSON.stringify(st));
  for (let q = 1; q <= n; q++) {
    for (const s of c.students) assert.equal(c.post({ kind: "answer", name: s.name, id: s.id, code: CODE, q: String(q), answer: answer(s, q), conf: "M" }), "ok");
    assert.equal(c.host("control", { code: CODE, act: "next" }).ok, true);
  }
}

test("1 to 7: a quiz is set up, joined, answered, discussed, stored, analysed and released", () => {
  const c = classroom({ students: 30 });
  // 1. The lecturer creates and configures the quiz.
  const h = c.host("host", { code: CODE });
  assert.equal(h.ok, true); assert.equal(h.controlled, true);
  assert.equal(c.host("control", { code: CODE, act: "set", field: "n_questions", value: "5" }).ok, true);
  assert.equal(c.host("control", { code: CODE, act: "lobby" }).ok, true);
  // 2. Students join with the join code.
  for (const s of c.students) assert.equal(c.post({ kind: "join", name: s.name, id: s.id, code: CODE }), "ok");
  assert.equal(c.host("host", { code: CODE }).joined, 30);
  assert.equal(c.host("control", { code: CODE, act: "start" }).ok, true);
  const qs = c.get({ action: "questions", code: CODE }).questions;
  assert.equal(qs.length, 5); assert.ok(qs.every((q) => q.stem && q.opts.length >= 4), "questions without answers");
  assert.ok(!JSON.stringify(qs).match(/"answer"/), "the question list carries no answers");
  // 3. Students answer at the same moment: every answer arrives once.
  const letters = ["A", "B", "C", "D"];
  c.students.forEach((s, i) => assert.equal(c.post({ kind: "answer", name: s.name, id: s.id, code: CODE, q: "1", answer: letters[i % 4], conf: "H" }), "ok"));
  assert.equal(c.host("host", { code: CODE }).answered, 30);
  // 4. The lecturer opens a second vote after discussion; students answer again.
  assert.equal(c.host("control", { code: CODE, act: "revote" }).ok, true);
  c.students.forEach((s) => c.post({ kind: "answer", name: s.name, id: s.id, code: CODE, q: "1", answer: "A", conf: "H" }));
  const hv = c.host("host", { code: CODE });
  assert.ok(hv.firstVote, "the first vote is kept beside the second");
  for (let q = 1; q <= 5; q++) {
    if (q > 1) c.students.forEach((s, i) => c.post({ kind: "answer", name: s.name, id: s.id, code: CODE, q: String(q), answer: letters[(i + q) % 4] }));
    assert.equal(c.host("control", { code: CODE, act: "next" }).ok, true);
  }
  assert.equal(c.host("host", { code: CODE }).state, "ended");
  // 5. Responses are stored, held until release: nothing in the released results yet.
  const held = c.host("held_status");
  assert.equal(held.ok, true); assert.equal(held.quiz, 30, "30 results wait for release");
  assert.equal(c.backend.tab("Form Responses 1").length, 1, "only the header before release");
  assert.equal(c.backend.tab("Item_Log").length - 1, 30 * 5, "one item row per student per question");
  // 7. The lecturer releases; scores reach Form Responses 1 and the grids.
  assert.equal(c.host("control", { code: CODE, act: "release" }).ok, true);
  const fr = c.backend.tab("Form Responses 1");
  assert.equal(fr.length - 1, 30);
  // 6. The statistics are computed from the saved records, and agree with them.
  const S = c.backend.stats({});
  assert.equal(S.ok, true);
  const scores = fr.slice(1).map((r) => Number(r[9]));
  const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
  assert.equal(S.quizzes.length, 1);
  assert.equal(S.quizzes[0].students, 30);
  assert.ok(Math.abs(S.quizzes[0].stats.mean - 100 * mean / 5) < 0.051, "class mean from the stored scores");
  // Each student can read their own result, and the stored score is the score they are shown.
  const s0 = c.students[0];
  const rc = c.post({ kind: "join", name: s0.name, id: s0.id, code: CODE, want: "receipt" }).receipt; // the receipt the phone keeps
  assert.ok(rc, "joining gives the phone a receipt");
  assert.equal(c.call({ action: "result", code: CODE, id: s0.id }).found, false, "without the receipt, no result");
  assert.equal(c.call({ action: "result", code: CODE, id: s0.id, rc: c.post({ kind: "join", name: "x", id: c.students[1].id, code: CODE, want: "receipt" }).receipt }).found, false, "another student's receipt opens nothing");
  const r0 = c.call({ action: "result", code: CODE, id: s0.id, rc });
  assert.equal(r0.found, true);
  assert.equal(r0.score, Number(fr.find((r) => r[2] === s0.id)[9]));
  assert.ok(mean >= 0 && mean <= 5);
});

test("8: a student reads only their own record, and only with their own access code", () => {
  const c = classroom({ students: 3 });
  runQuiz(c, 5, () => "A");
  c.host("control", { code: CODE, act: "release" });
  const [a, b] = c.students;
  const mine = c.call({ action: "my_results", id: a.id, code: c.codes[a.id] });
  assert.equal(mine.ok, true, JSON.stringify(mine));
  assert.ok(!JSON.stringify(mine).includes(b.id), "nothing about another student");
  assert.notEqual(c.call({ action: "my_results", id: b.id, code: c.codes[a.id] }).ok, true, "a classmate's code opens nothing");
  assert.notEqual(c.call({ action: "my_results", id: b.id, code: "" }).ok, true, "an ID alone opens nothing");
  assert.notEqual(c.call({ action: "chat", id: b.id, code: c.codes[a.id] }).ok, true);
  // Lecturer actions need the host key.
  assert.notEqual(c.call({ action: "class_stats" }).ok, true);
  assert.notEqual(c.call({ action: "class_stats", hostkey: "wrong" }).ok, true);
});

test("9: duplicate submissions, invalid codes, late or closed answers", () => {
  const c = classroom({ students: 2 });
  const [a] = c.students;
  // Invalid join codes are refused, not stored.
  assert.equal(c.post({ kind: "answer", name: a.name, id: a.id, code: "99999", q: "1", answer: "A" }), "bad answer");
  assert.equal(c.post({ kind: "quiz", name: a.name, id: a.id, code: "NOPE", q1: "A" }), "bad code");
  assert.equal(c.get({ action: "status", code: "NOPE" }).known, false);
  // An answer before the quiz starts is refused.
  c.host("host", { code: CODE });
  c.host("control", { code: CODE, act: "lobby" });
  assert.equal(c.post({ kind: "join", name: a.name, id: a.id, code: CODE }), "ok");
  assert.equal(c.post({ kind: "answer", name: a.name, id: a.id, code: CODE, q: "1", answer: "A" }), "not open");
  c.host("control", { code: CODE, act: "start" });
  // An answer to a question that is not open is refused; a changed answer replaces the first one.
  assert.equal(c.post({ kind: "answer", name: a.name, id: a.id, code: CODE, q: "2", answer: "A" }), "wrong question");
  assert.equal(c.post({ kind: "answer", name: a.name, id: a.id, code: CODE, q: "1", answer: "B" }), "ok");
  assert.equal(c.post({ kind: "answer", name: a.name, id: a.id, code: CODE, q: "1", answer: "C" }), "ok");
  // A repeated join (a reconnecting phone) does not make a second student.
  assert.equal(c.post({ kind: "join", name: a.name, id: a.id, code: CODE }), "ok");
  const hj = c.host("host", { code: CODE });
  assert.equal(hj.joined + hj.inprogress + hj.submitted, 1, "one student, however often the phone joins");
  c.host("control", { code: CODE, act: "end" });
  const rows = c.backend.tab("Staged_Quiz").filter((r) => r[2] === a.id);
  assert.equal(rows.length, 1, "one held result per student, however many answers were sent");
  assert.equal(rows[0][4], "C", "the last answer counts");
  // After the end, answers are refused.
  assert.equal(c.post({ kind: "answer", name: a.name, id: a.id, code: CODE, q: "1", answer: "A" }), "not open");
  // Bad letters and missing fields are refused.
  assert.equal(c.post({ kind: "answer", name: "", id: a.id, code: CODE, q: "1", answer: "A" }), "bad answer");
  assert.equal(c.post({ kind: "answer", name: a.name, id: a.id, code: CODE, q: "1", answer: "Z" }), "bad answer");
});

test("9: a timed quiz keeps only the first submission per student", () => {
  const c = classroom({ students: 1 });
  const [a] = c.students;
  c.host("host", { code: CODE });
  c.host("control", { code: CODE, act: "set", field: "mode", value: "timed" });
  c.host("control", { code: CODE, act: "start" });
  assert.equal(c.post({ kind: "quiz", name: a.name, id: a.id, code: CODE, q1: "A", q2: "B" }), "ok");
  assert.equal(c.post({ kind: "quiz", name: a.name, id: a.id, code: CODE, q1: "C", q2: "C" }), "duplicate");
});

test("9: wrong host keys lock out after repeated tries; wrong access codes lock the ID", () => {
  const c = classroom({ students: 1 });
  const [a] = c.students;
  for (let i = 0; i < 30; i++) assert.equal(c.call({ action: "hostcheck", hostkey: "guess" + i }).ok, false);
  assert.equal(c.call({ action: "hostcheck", hostkey: c.key }).ok, false, "locked even for the right key");
  const d = classroom({ students: 1 });
  for (let i = 0; i < 6; i++) assert.notEqual(d.call({ action: "my_results", id: d.students[0].id, code: "AAAA-AAA" + i }).ok, true);
  assert.notEqual(d.call({ action: "my_results", id: d.students[0].id, code: d.codes[d.students[0].id] }).ok, true, "locked for ten minutes");
  assert.ok(a);
});

test("9: when the course content cannot be reached, the server answers with an error rather than failing", () => {
  const c = classroom({ students: 1 });
  c.host("host", { code: CODE });
  c.host("control", { code: CODE, act: "start" });
  c.backend.dropSiteCache();
  c.state.offline = true;
  const q = c.get({ action: "questions", code: "26272" });
  assert.ok(Array.isArray(q.questions));
  assert.equal(c.get({ action: "status", code: "NOPE" }).known, false);
  assert.equal(c.get({ action: "portal_status" }).portal, 1, "the portal still answers");
  c.state.offline = false;
});

test("10: records survive a restart of the app, with the same host key", () => {
  const c = classroom({ students: 4 });
  runQuiz(c, 5, (s, q) => (q % 2 ? "A" : "B"));
  c.host("control", { code: CODE, act: "release" });
  const before = c.backend.tab("Form Responses 1");
  c.reopen();
  assert.deepEqual(c.backend.tab("Form Responses 1"), before);
  assert.equal(c.backend.hostKey(), c.key);
  assert.equal(c.call({ action: "my_results", id: c.students[0].id, code: c.codes[c.students[0].id] }).ok, true);
});
