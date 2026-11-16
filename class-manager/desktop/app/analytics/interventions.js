/* Class Manager analytics: intervention tracking. The lecturer records support given to some students (a check-in, a tutoring offer, an e-mail).
   Later results are compared with students who were not given it, over the same quizzes. This is an association: students are not chosen at random,
   so the text never says the support caused the change. Plain data in, plain data out. */
(function (root) {
  "use strict";
  var E = root.cmEvidence || (typeof require === "function" ? require("./evidence") : null);
  function mean(xs) { return xs.length ? Math.round(10 * xs.reduce(function (a, b) { return a + b; }, 0) / xs.length) / 10 : null; }
  var TOLERANCE = 10; // a comparison student counts as similar when the average of their earlier quizzes is within this many points of a student given the support
  // One record: { id, kind, date, afterQuiz (quizzes held when it was recorded), ids: [student ids], note }
  // students: [{id, trajectory: [{quiz, pct}]}] in quiz order.
  // The students not given the support are compared only with those whose earlier results were similar (within TOLERANCE points), so a group that started
  // much stronger or weaker is not set against it. With no similar student, everyone else is used and the text says so.
  function compare(rec, students) {
    var given = {}; (rec.ids || []).forEach(function (i) { given[String(i)] = 1; });
    var k = rec.afterQuiz || 0, a = [], b = [];
    (students || []).forEach(function (s) {
      var t = s.trajectory || []; if (t.length <= k || k < 1) return;
      var before = mean(t.slice(0, k).map(function (x) { return x.pct; })), after = mean(t.slice(k).map(function (x) { return x.pct; }));
      (given[String(s.id)] ? a : b).push({ id: String(s.id), before: before, change: Math.round(10 * (after - before)) / 10 });
    });
    var similar = b.filter(function (x) { return a.some(function (y) { return Math.abs(x.before - y.before) <= TOLERANCE; }); });
    var matched = a.length > 0 && similar.length > 0, pool = matched ? similar : b;
    var ca = mean(a.map(function (x) { return x.change; })), cb = mean(pool.map(function (x) { return x.change; })), diff = ca !== null && cb !== null ? Math.round(10 * (ca - cb)) / 10 : null;
    var conf = E ? E.confidence(Math.min(a.length, pool.length)) : null, text;
    if (!a.length) text = "None of the " + (rec.ids || []).length + " students have a quiz after this yet, so there is nothing to compare.";
    else if (!pool.length || diff === null) text = a.length + " students given this have a result after it, but no one to compare with.";
    else text = "Students given this changed by " + (ca > 0 ? "+" : "") + ca + " points on later quizzes (n = " + a.length + "); " + (matched ? "students with similar earlier results, not given it, " : "the others ") + "changed by " + (cb > 0 ? "+" : "") + cb + " (n = " + pool.length + "). A difference of " + (diff > 0 ? "+" : "") + diff + " points." + (matched ? "" : " No student with similar earlier results was available, so everyone else was used.") + " This is an association, not proof that it worked: students were not chosen at random.";
    return { id: rec.id, kind: rec.kind, date: rec.date, note: rec.note || "", given: a.length, compared: pool.length, givenChange: ca, comparedChange: cb, diff: diff, matched: matched, confidence: conf, text: text,
      givenBefore: mean(a.map(function (x) { return x.before; })), comparedBefore: mean(pool.map(function (x) { return x.before; })),
      givenIds: a.map(function (x) { return x.id; }), comparedIds: pool.map(function (x) { return x.id; }), recorded: (rec.ids || []).length };
  }
  var api = { compare: compare, TOLERANCE: TOLERANCE };
  if (typeof module === "object" && module.exports) module.exports = api; else root.cmInterventions = api;
})(typeof window !== "undefined" ? window : globalThis);
