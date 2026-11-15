/* Class Manager analytics: intervention tracking. The lecturer records support given to some students (a check-in, a tutoring offer, an e-mail).
   Later results are compared with students who were not given it, over the same quizzes. This is an association: students are not chosen at random,
   so the text never says the support caused the change. Plain data in, plain data out. */
(function (root) {
  "use strict";
  var E = root.cmEvidence || (typeof require === "function" ? require("./evidence") : null);
  function mean(xs) { return xs.length ? Math.round(10 * xs.reduce(function (a, b) { return a + b; }, 0) / xs.length) / 10 : null; }
  // One record: { id, kind, date, afterQuiz (quizzes held when it was recorded), ids: [student ids], note }
  // students: [{id, trajectory: [{quiz, pct}]}] in quiz order.
  function compare(rec, students) {
    var given = {}; (rec.ids || []).forEach(function (i) { given[i] = 1; });
    var k = rec.afterQuiz || 0, a = [], b = [];
    (students || []).forEach(function (s) {
      var t = s.trajectory || []; if (t.length <= k || k < 1) return;
      var before = mean(t.slice(0, k).map(function (x) { return x.pct; })), after = mean(t.slice(k).map(function (x) { return x.pct; }));
      (given[s.id] ? a : b).push(Math.round(10 * (after - before)) / 10);
    });
    var ca = mean(a), cb = mean(b), diff = ca !== null && cb !== null ? Math.round(10 * (ca - cb)) / 10 : null;
    var conf = E ? E.confidence(Math.min(a.length, b.length)) : null, text;
    if (!a.length) text = "None of the " + (rec.ids || []).length + " students have a quiz after this yet, so there is nothing to compare.";
    else if (!b.length || diff === null) text = a.length + " students given this have a result after it, but no one to compare with.";
    else text = "Students given this changed by " + (ca > 0 ? "+" : "") + ca + " points on later quizzes (n = " + a.length + "); the others changed by " + (cb > 0 ? "+" : "") + cb + " (n = " + b.length + "). A difference of " + (diff > 0 ? "+" : "") + diff + " points. This is an association, not proof that it worked: students were not chosen at random.";
    return { id: rec.id, kind: rec.kind, date: rec.date, given: a.length, compared: b.length, givenChange: ca, comparedChange: cb, diff: diff, confidence: conf, text: text };
  }
  var api = { compare: compare };
  if (typeof module === "object" && module.exports) module.exports = api; else root.cmInterventions = api;
})(typeof window !== "undefined" ? window : globalThis);
