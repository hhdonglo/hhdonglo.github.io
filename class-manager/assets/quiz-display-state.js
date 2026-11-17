/* The words the quiz projector shows when it has no quiz to draw, so that it is never blank.
   Used by quiz-display.html and by desktop/test/quiz-display-state.test.js. No other dependency. */
(function (root) {
  "use strict";
  // d = the answer to action=display (or null when nothing answered); noAnswer = the sentence for "no answer at all".
  // Returns "" when the quiz can be drawn without comment.
  function notice(d, noAnswer) {
    if (!d) return noAnswer || "CM did not answer. Check the connection, then try again.";
    if (d.ok === false) return "No quiz has this join code. Check the code on the host page, then enter it again.";
    if (d.note) return d.note;
    if (d.controlled === false) return "This quiz has not been set up yet. Open the host page and press Start when the class is ready.";
    return "";
  }
  var api = { notice: notice };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.QuizDisplayState = api;
})(typeof window !== "undefined" ? window : this);
