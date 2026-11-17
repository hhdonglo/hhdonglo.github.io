/* Moving a held student into the course, after the lecturer added the ID to the class list (and only then).
   One responsibility: replay what the student did while unlisted into the live tabs, then clear the holding area for that ID.
   - Attendance: the check-in row in Attendance_Log becomes "On roster: Yes", and a session already submitted gets a 1 in the grid for this student.
   - Quizzes: the join and the answers go into Presence and Answers, the item log gets this student's lines, and the result is held with the other held
     results (Staged_Quiz) to be released by the lecturer as usual; Master and Scores change only on that release.
   Nothing here adds to the class list: unlisted-ipc.js does that on the lecturer's say, then calls move(). */
"use strict";
const { normalizeId } = require("../ids");
const AT = require("./attendance");
const C = require("./quiz-control");
const R = require("./quiz-results");
const U = require("./unlisted");

const up = (v) => String(v).trim().toUpperCase();
const blanks = (n) => new Array(n).fill("");

function moveAttendance(store, id, recs) {
  let marked = 0;
  const labels = recs.filter((r) => r.kind === "attendance").map((r) => r.ref);
  if (!labels.length) return marked;
  const log = (store.rows(AT.LOG) || []).map((r) => r.slice());
  log.forEach((r, i) => { if (i > 0 && normalizeId(r[2]) === id && labels.indexOf(String(r[1])) >= 0 && String(r[3]) === "No") r[3] = "Yes"; });
  store.setRows(AT.LOG, log);
  const grid = store.rows(AT.GRID); if (!grid || !grid.length) return marked;
  const head = grid[0].map((h) => String(h).trim());
  labels.forEach((label) => { // a session already submitted has its column in the grid; one still open or held is counted when it is submitted
    const ci = head.indexOf(AT.column(label)); if (ci < 1) return;
    let at = grid.findIndex((r, i) => i > 0 && normalizeId(r[0]) === id);
    if (at < 0) { grid.push([id]); at = grid.length - 1; }
    while (grid[at].length <= ci) grid[at].push("");
    grid[at][ci] = 1; marked++;
  });
  store.setRows(AT.GRID, grid);
  return marked;
}

function moveQuiz(store, id, name, recs, o) {
  const out = { quizzes: 0, held: 0 }, now = store.now(), codes = {};
  recs.filter((r) => r.kind.indexOf("quiz") === 0).forEach((r) => { (codes[up(r.ref)] = codes[up(r.ref)] || []).push(r); });
  Object.keys(codes).forEach((code) => {
    const rs = codes[code], cf = C.ctl(store, code); let letters = [], ids = [], disc = [];
    const N = cf ? C.quizN(cf) : 5, wk = cf ? (Number(cf.v[20]) || 1) : "";
    try { letters = C.lettersFor(store, code, cf, o); ids = cf ? C.qids(cf) : []; disc = cf ? C.discussedOf(cf) : []; } catch (e) { letters = []; } // no question bank: the answers are kept, no score is made
    const mark = (ans) => (letters.length ? C.mark(letters, ans).reduce((x, y) => x + y, 0) : 0);
    const join = rs.filter((r) => r.kind === "quiz join")[0];
    const have = (rnd) => R.respRows(store).some((r) => String(r[2]).trim() === id && up(r[3]) === code && (Number(r[10]) || 0) === rnd);
    const rounds = {};
    rs.filter((r) => r.kind === "quiz answer").forEach((r) => {
      const d = r.detail, rnd = Number(d.round) || 0, g = rounds[rnd] || (rounds[rnd] = { ans: blanks(N), conf: blanks(N), first: blanks(N) });
      R.addAnswer(store, [new Date(r.time), id, name, code, d.q, d.answer, rnd, d.conf || "", d.vote || 0]);
      if (d.q >= 1 && d.q <= N) { g.ans[d.q - 1] = String(d.answer); g.conf[d.q - 1] = String(d.conf || ""); if (Number(d.vote) !== 2) g.first[d.q - 1] = String(d.answer); }
    });
    Object.keys(rounds).forEach((k) => {
      const rnd = Number(k), g = rounds[k];
      if (!have(rnd)) { R.addHeld(store, R.rowFor(now, name, id, code, g.ans, mark(g.ans), rnd, N, wk)); out.held++; }
      if (letters.length) R.addItems(store, R.itemRows(now, code, rnd, wk, ids, letters, { [id]: g }, disc));
    });
    rs.filter((r) => r.kind === "quiz submit").forEach((r) => {
      const d = r.detail, rnd = Number(d.round) || 0, ans = (d.ans || []).map((a) => String(a || ""));
      if (!have(rnd) && !rounds[rnd]) { R.addHeld(store, R.rowFor(new Date(r.time), name, id, code, ans, mark(ans), rnd, Number(d.n) || 5, d.week || "")); out.held++; }
    });
    if (join || rs.length) R.presence(store, code, id, name, rs.some((r) => r.kind === "quiz submit") || Object.keys(rounds).length ? "submitted" : (join && join.detail.status) || "joined");
    out.quizzes++;
  });
  return out;
}

// ids: [{ id, name }] already on the class list. Returns { moved, attendance, quizzes, held }.
function move(store, picks, o) {
  const sum = { moved: 0, attendance: 0, quizzes: 0, held: 0 }, ids = [];
  (picks || []).forEach((p) => {
    const id = normalizeId(p.id); if (!id || U.isUnlisted(store, id)) return; // never moves anyone who is not on the class list
    const recs = U.recordsOf(store, id), listRow = U.list(store).items.find((x) => x.id === id), name = String(p.name || (listRow && listRow.name) || "").trim();
    sum.attendance += moveAttendance(store, id, recs);
    const q = moveQuiz(store, id, name, recs, o); sum.quizzes += q.quizzes; sum.held += q.held;
    ids.push(id); sum.moved++;
  });
  U.markAdded(store, ids);
  return sum;
}

module.exports = { move, moveAttendance, moveQuiz };
