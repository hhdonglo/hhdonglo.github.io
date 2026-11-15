/* Class Manager analytics: concept tracking. How each topic (a lecture's questions) is going, live and in practice, and which to revisit.
   Input is the question statistics and the per-lecture totals from the class statistics. Plain data in, plain data out. */
(function (root) {
  "use strict";
  var E = root.cmEvidence || (typeof require === "function" ? require("./evidence") : null);
  var REVISIT = 60; // below this percent correct, with enough answers, a topic is worth revisiting
  function avg(xs) { xs = xs.filter(function (x) { return x !== null && x !== undefined; }); return xs.length ? Math.round(10 * xs.reduce(function (a, b) { return a + b; }, 0) / xs.length) / 10 : null; }
  // lectures: [{lecture, answers, pct}]; questions: [{lecture, live, livePct, practice, practicePct}]; titles: {lectureNumber: "Vectors"} optional.
  function track(lectures, questions, titles, rosterSize) {
    return (lectures || []).filter(function (l) { return l.lecture >= 0; }).map(function (l) {
      var qs = (questions || []).filter(function (q) { return q.lecture === l.lecture; });
      var live = avg(qs.filter(function (q) { return q.live >= 5; }).map(function (q) { return q.livePct; })), prac = avg(qs.filter(function (q) { return q.practice >= 5; }).map(function (q) { return q.practicePct; }));
      var conf = E ? E.confidence(l.answers >= 1 ? Math.min(l.answers, rosterSize || l.answers) : 0) : null;
      var status = l.pct === null || l.answers < 30 ? "too early" : l.pct < REVISIT ? "revisit" : l.pct >= 80 ? "secure" : "developing";
      var gap = live !== null && prac !== null ? Math.round(10 * (prac - live)) / 10 : null;
      return { lecture: l.lecture, title: (titles && titles[l.lecture]) || "Lecture " + l.lecture, pct: l.pct, answers: l.answers, live: live, practice: prac, gap: gap, status: status, confidence: conf,
        note: status === "revisit" ? "Below " + REVISIT + "% correct: worth revisiting in class." : gap !== null && gap <= -15 ? "Students do better in practice than live: check the live questions." : "" };
    });
  }
  var api = { REVISIT: REVISIT, track: track };
  if (typeof module === "object" && module.exports) module.exports = api; else root.cmConcepts = api;
})(typeof window !== "undefined" ? window : globalThis);
