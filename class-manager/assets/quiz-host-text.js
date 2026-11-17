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

  // Exercises or Diagnostic quiz. The stored value is "standard" or "concept" (the same names the website uses); the lecturer reads the labels.
  function typeLabel(t) { return t === "concept" ? "Diagnostic quiz" : "Exercises"; }
  function typeNote(t, conceptWeeks) {
    if (t === "concept") return "Diagnostic quiz is on: short concept questions, not for marks. Students see their own score, but nothing is recorded in Grades. The class diagnostic below shows which concepts the class missed.";
    var ks = Object.keys(conceptWeeks || {}).sort(function (a, b) { return a - b; });
    return "Exercises are the normal practice questions. A Diagnostic quiz is available for: " + (ks.map(function (k) { return "Week " + k + " (" + conceptWeeks[k] + ")"; }).join(", ") || "no weeks yet (add a diagnostic bank under Quizzes and Questions)") + ".";
  }
  // The weeks the Week list offers: for a diagnostic only the weeks that have a diagnostic bank.
  function weeksFor(weeks, conceptWeeks, diagnostic) {
    if (!diagnostic) return weeks || {};
    var out = {}; Object.keys(weeks || {}).forEach(function (k) { if (conceptWeeks && conceptWeeks[k]) out[k] = weeks[k]; });
    return out;
  }
  // The class diagnostic tables: per concept (weakest first) and per question. dg = {byTag:[{tag,answered,right}], byQ:[{q,tag,answered,right}]}.
  function diagHtml(dg, esc) {
    var share = function (r, n) { return n ? Math.round(100 * r / n) : null; };
    var h = "<table><thead><tr><th>Concept</th><th>Right</th><th>Share right</th></tr></thead><tbody>";
    dg.byTag.slice().sort(function (a, b) { return (a.answered ? a.right / a.answered : 2) - (b.answered ? b.right / b.answered : 2); }).forEach(function (t) {
      var pc = share(t.right, t.answered); h += "<tr><td>" + esc(t.tag) + "</td><td>" + t.right + " / " + t.answered + "</td><td>" + (pc === null ? "waiting" : '<span class="bar"><i style="width:' + Math.round(pc * 1.6) + 'px"></i> ' + pc + "%</span>") + "</td></tr>";
    });
    h += "</tbody></table><table><thead><tr><th>Q</th><th>Concept</th><th>Right</th><th>Share</th></tr></thead><tbody>";
    dg.byQ.forEach(function (r) { var pc = share(r.right, r.answered); h += "<tr><td>" + r.q + "</td><td>" + esc(r.tag) + "</td><td>" + r.right + " / " + r.answered + "</td><td>" + (pc === null ? "" : pc + "%") + "</td></tr>"; });
    return h + "</tbody></table>";
  }

  var api = { WHEN: WHEN, whenLabel: whenLabel, actLine: actLine, weekOptions: weekOptions, countOptions: countOptions, typeLabel: typeLabel, typeNote: typeNote, weeksFor: weeksFor, diagHtml: diagHtml };
  root.QuizHostText = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
