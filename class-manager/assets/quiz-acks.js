/* What the class server has confirmed for a student's live quiz answers, kept on the phone.
   One responsibility: remember, per question, whether the server said "ok" for the answer now chosen, and word the end screen from that.
   Used by quiz.html (answers are sent one by one in a lecturer-paced quiz); tested in desktop/test/quiz-acks.test.js. */
(function (root) {
  "use strict";
  var WHY = { "not joined": "you had not joined when the question opened", "wrong question": "the lecturer had already moved to the next question", "question closed": "time was up for that question",
    "not open": "the quiz was not open", "bad code": "the join code was not recognised", "late": "late joining is closed" };
  function create() {
    var got = {}; // question number -> {answer, outcome}
    return {
      // the answer chosen for a question, not yet confirmed
      chosen: function (q, a) { got[q] = { answer: a, outcome: "" }; },
      // the server's reply for that answer; ignored when the student has since changed it
      reply: function (q, a, outcome) { if (got[q] && got[q].answer === a) got[q].outcome = String(outcome || ""); },
      confirmed: function () { return Object.keys(got).filter(function (q) { return got[q].outcome === "ok"; }).length; },
      refused: function () { return Object.keys(got).filter(function (q) { return got[q].outcome && got[q].outcome !== "ok"; }).map(function (q) { return { q: Number(q), why: WHY[got[q].outcome] || got[q].outcome }; }); },
      // answers chosen but with no reply at all (the phone could not reach the server): to send again
      pending: function () { return Object.keys(got).filter(function (q) { return !got[q].outcome; }).map(function (q) { return { q: Number(q), answer: got[q].answer }; }); },
      // the end screen's words when the phone cannot ask for its own score; null when nothing was confirmed, so the caller keeps its own wording
      endNote: function () {
        var n = this.confirmed(); if (!n) return null;
        return "The class server received " + n + " answer" + (n === 1 ? "" : "s") + " from you. Your lecturer will release the results.";
      }
    };
  }
  var api = { create: create, WHY: WHY };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.QuizAcks = api;
})(typeof window !== "undefined" ? window : this);
