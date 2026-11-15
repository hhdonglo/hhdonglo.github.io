/* Class Manager dashboard: who is at risk, and why. Plain data in, plain data out; no page, no server.
   A student is at risk when at least one reason below holds. Practice is optional work, so having no practice is NEVER a reason on its own.
   A reason built on little data (few sessions, one quiz) makes the student's flag "thin evidence" rather than strong, and the page says so.
   Thresholds come from the lecturer's settings (Students, Engagement rules). Runs in the CM window (window.cmRisk) and in Node (the tests). */
(function (root) {
  "use strict";
  var MIN_SESSIONS = 4, MIN_QUIZZES = 2; // fewer than this and a reason is shown as thin evidence
  var n = function (v) { return v === null || v === undefined || v === "" ? null : Number(v); };
  function atRisk(d) {
    var th = d.thresholds || {}, effort = n(th.effort) === null ? 70 : th.effort, perf = n(th.perf) === null ? 50 : th.perf, misses = n(th.misses) === null ? 2 : th.misses;
    var sessions = (d.attendance && d.attendance.sessions) || 0, quizzes = (d.quizzes || []).length;
    var defs = [
      { key: "attendance", label: "Attendance below " + effort + "%", rule: "Attendance under " + effort + "% of submitted sessions", thin: sessions < MIN_SESSIONS, test: function (s) { return n(s.attendance) !== null && s.attendance < effort; } },
      { key: "missed", label: "Missed " + misses + " or more sessions in a row", rule: "Absent from the last " + misses + " or more sessions", thin: sessions < MIN_SESSIONS, test: function (s) { return n(s.missedInARow) !== null && s.missedInARow >= misses; } },
      { key: "quiz", label: "Quiz average below " + perf + "%", rule: "Quiz average under " + perf + "% over at least " + MIN_QUIZZES + " quizzes", thin: quizzes < MIN_QUIZZES, test: function (s) { return n(s.quizAverage) !== null && s.quizAverage < perf && (s.quizzesTaken || 0) >= Math.min(MIN_QUIZZES, quizzes || MIN_QUIZZES); } },
      { key: "noquiz", label: "Took none of the quizzes", rule: "Took none of the " + quizzes + " quizzes released", thin: quizzes < MIN_QUIZZES, test: function (s) { return quizzes >= MIN_QUIZZES && (s.quizzesTaken || 0) === 0; } },
      { key: "fall", label: "Last quiz fell by 15 points or more", rule: "Latest quiz at least 15 points under the one before", thin: true, test: function (s) { return n(s.change) !== null && s.change <= -15; } }
    ];
    var by = {}, mine = {};
    defs.forEach(function (r) { by[r.key] = []; });
    (d.students || []).forEach(function (s) { defs.forEach(function (r) { if (r.test(s)) { by[r.key].push({ id: s.id, name: s.name || s.id }); (mine[s.id] = mine[s.id] || { id: s.id, name: s.name || s.id, reasons: [], strong: false }); mine[s.id].reasons.push(r.key); if (!r.thin) mine[s.id].strong = true; } }); });
    var all = Object.keys(mine).map(function (k) { return mine[k]; });
    var strong = all.filter(function (s) { return s.strong; });
    return { total: all.length, strong: strong.length, thin: all.length - strong.length, students: all, strongStudents: strong.map(function (s) { return { id: s.id, name: s.name }; }), thinStudents: all.filter(function (s) { return !s.strong; }).map(function (s) { return { id: s.id, name: s.name }; }),
      reasons: defs.map(function (r) { return { key: r.key, label: r.label, rule: r.rule, thin: r.thin, students: by[r.key] }; }), sessions: sessions, quizzes: quizzes, minSessions: MIN_SESSIONS, minQuizzes: MIN_QUIZZES };
  }
  var api = { atRisk: atRisk, MIN_SESSIONS: MIN_SESSIONS, MIN_QUIZZES: MIN_QUIZZES };
  if (typeof module === "object" && module.exports) module.exports = api; else root.cmRisk = api;
})(typeof window !== "undefined" ? window : globalThis);
