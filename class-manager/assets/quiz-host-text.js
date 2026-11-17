/* Plain words for the lecturer's live quiz screen (quiz-host.html). One job: the sentences and labels, so they are easy to find, change and test.
   No page code here: every function takes values and returns text or option lists. */
(function (root) {
  "use strict";

  // How a "when is it shown" setting is read by the lecturer. The stored value (OnRelease, Immediate, Never) never changes.
  var WHEN = [["OnRelease", "When released"], ["Immediate", "Immediately"], ["Never", "Never"]];
  function whenLabel(v) { for (var i = 0; i < WHEN.length; i++) if (WHEN[i][0] === v) return WHEN[i][1]; return String(v); }

  var plural = function (n, one, many) { return n + " " + (n === 1 ? one : many); };

  // The line under the buttons after the lecturer pressed one. act: the action sent; d: the answer; joined: students who joined the quiz.
  var DONE = { message: null, start: "Quiz started.", pause: "Quiz paused.", resume: "Quiz resumed.", end: "Quiz ended.", release: "Results released.", next: "Moved to the next question.", prev: "Moved to the previous question.", lobby: "Waiting room opened.", newround: "Fresh waiting room ready.", reset: "Quiz reset.", set: "Setting saved.", init: "Lecturer control switched on." };
  function actLine(act, d, joined, sent) {
    if (!d) return null;
    if (!d.ok) return "Not done: " + (d.why || "refused") + ".";
    if (act === "message") {
      if (!sent) return "Message cleared. It is removed from the students' phones.";
      var n = Math.max(0, Number(joined) || 0);
      return "Message sent to " + plural(n, "student", "students") + (n === 0 ? ". Students who join later will see it." : ". Students who join later will see it too.");
    }
    return DONE[act] || "Done.";
  }

  // The options of the Week list: every week with a question bank, plus the quiz's own week when it has none yet, so the list is never blank.
  function weekOptions(weeks, current) {
    var out = [], keys = Object.keys(weeks || {}).sort(function (a, b) { return a - b; });
    keys.forEach(function (k) { out.push([k, "Week " + k + ": " + weeks[k]]); });
    var cur = String(current || ""); if (cur && !(weeks && weeks[cur])) out.push([cur, "Week " + cur + ": no questions yet"]);
    if (!out.length) out.push(["1", "No question banks yet"]);
    return out;
  }

  // The options of the Number of questions list, from 5 to the most this quiz can have, always including the current choice.
  function countOptions(max, current) {
    var out = [], hi = Math.max(Number(max) || 0, Number(current) || 0, 5);
    for (var n = 5; n <= hi; n++) out.push(String(n));
    return out;
  }

  var api = { WHEN: WHEN, whenLabel: whenLabel, actLine: actLine, weekOptions: weekOptions, countOptions: countOptions };
  root.QuizHostText = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
