/* A student's own answers to a quiz, wherever CM keeps them, so the phone can show the score the moment the quiz ends.
   One responsibility: find one student's answers for the current round of a quiz. Showing a score is not recording it: nothing is written here, and
   Submit or Discard (rules/held.js) stays the lecturer's decision. Places looked at, in order:
   a student off the class list: the holding area (rules/unlisted.js);
   a student on the list: released results (Form Responses 1), held results (Staged_Quiz), then the live answers (Answers) while the quiz is still open.
   answersFor(store, code, id, o) returns an array of letters ("" for no answer) or null when this student has nothing for the round. o = {site, random}. */
"use strict";
const C = require("./quiz-control");
const R = require("./quiz-results");
const U = require("./unlisted");

const up = (v) => String(v).trim().toUpperCase();
const lettersOf = (r) => { const s = String(r[10] || ""); return s ? s.split("").map((ch) => (ch === "-" ? "" : ch)) : r.slice(2, 7).map(String); }; // r: ID, Join Code, Q1..Q5, Score, Round, Questions, Answers

function fromHolding(store, id, code, rnd, n) {
  const mine = U.recordsOf(store, id).filter((r) => up(r.ref) === code), out = new Array(n).fill(""); let any = false;
  const sub = mine.filter((r) => r.kind === "quiz submit" && (Number(r.detail.round) || 0) === rnd).pop();
  if (sub) { (sub.detail.ans || []).forEach((a, i) => { if (i < n) out[i] = String(a || ""); }); return out; }
  mine.filter((r) => r.kind === "quiz answer" && (Number(r.detail.round) || 0) === rnd).sort((a, b) => (Number(a.detail.vote) === 2) - (Number(b.detail.vote) === 2)).forEach((r) => {
    const q = Number(r.detail.q); if (q >= 1 && q <= n) { out[q - 1] = String(r.detail.answer || ""); any = true; }
  });
  return any ? out : null;
}

function answersFor(store, code, id, o) {
  const cx = C.ctl(store, code), n = cx ? C.quizN(cx) : 5, rnd = R.roundOf(store, code);
  if (U.isUnlisted(store, id)) return fromHolding(store, id, code, rnd, n);
  const find = (rows) => rows.find((r) => String(r[0]).trim() === id && up(r[1]) === code && (Number(r[8]) || 0) === rnd);
  const released = find(R.respRows(store).map((r) => r.slice(2, 14)));
  if (released) return lettersOf(released);
  const staged = find(((store.rows("Staged_Quiz") || []).slice(1)).filter((r) => r.some((c) => c !== "" && c != null)).map((r) => r.slice(2, 14)));
  if (staged) return lettersOf(staged);
  const live = R.latestAnswers(store, code)[id];
  return live ? live.ans : null;
}

module.exports = { answersFor };
