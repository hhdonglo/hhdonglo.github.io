/* Held items: what was stopped but not yet decided. One responsibility: list the closed attendance sessions and the held quiz results one by one,
   and submit or discard a single one. Stopping records nothing; only Submit puts a session or a quiz against the class list, the grid and the totals.
   Attendance rules are rules/attendance.js, quiz result rules are rules/quiz-results.js, quiz state is rules/quiz-control.js. */
"use strict";
const AT = require("./attendance");
const QR = require("./quiz-results");
const C = require("./quiz-control");

const up = (v) => String(v).trim().toUpperCase();
const stagedRows = (store) => { const r = store.rows("Staged_Quiz") || []; return r.slice(1).filter((x) => x.some((c) => c !== "" && c != null)); };

// {ok, sessions: [{code, label, present, absent, notOnList}], quizzes: [{code, round, title, week, count}]}
function items(store) {
  const roster = AT.rosterSet(store), total = Object.keys(roster).length, sessions = [], groups = {};
  AT.sessions(store).forEach((s) => {
    if (s.status !== "Closed") return;
    const ids = Object.keys(AT.present(store, s.label)), listed = ids.filter((id) => roster[id]).length;
    sessions.push({ code: s.code, label: AT.column(s.label), present: listed, absent: Math.max(0, total - listed), notOnList: ids.length - listed });
  });
  stagedRows(store).forEach((r) => {
    const code = up(r[3]), round = Number(r[10]) || 0, k = code + "|" + round;
    if (!groups[k]) { const c = C.ctl(store, code); groups[k] = { code, round, title: c ? String(c.v[9] || "") : "", week: Number(r[13]) || 0, count: 0 }; }
    groups[k].count++;
  });
  return { ok: true, sessions, quizzes: Object.keys(groups).map((k) => groups[k]) };
}

// Submit one held quiz. A quiz that is stopped and still current is released through its own control row, so students see their results as the lecturer set.
function submitQuiz(store, code, round, o, quizO) {
  const c = C.ctl(store, code), cur = c ? Number(c.v[16]) || 0 : -1;
  const n = stagedRows(store).filter((r) => up(r[3]) === code && (Number(r[10]) || 0) === round).length;
  if (!n) return { ok: false, why: "nothing is held for that quiz" };
  if (c && round === cur && C.eff(c) === "ended") { const r = C.act(store, { act: "release" }, code, quizO); return r.ok === false ? r : { ok: true, released: n }; }
  return Object.assign({ ok: true }, QR.commit(store, code, true, o, round));
}
const discardQuiz = (store, code, round) => Object.assign({ ok: true }, QR.discard(store, code, true, round));

module.exports = { items, submitQuiz, discardQuiz };
