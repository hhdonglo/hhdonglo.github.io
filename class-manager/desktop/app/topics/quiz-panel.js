/* Quizzes and Questions: the Topics panel for the chosen quiz (or the whole semester).
   Reads the `topics` block of the class statistics (rules/topics). Lays out; calculates nothing. Runs in the CM window (window.cmQuizTopics) and in Node (the tests). */
(function (root) {
  "use strict";
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  var has = function (v) { return v !== null && v !== undefined && !isNaN(v); };
  var NAME = { well: "Well mastered", developing: "Developing", attention: "Needs attention", early: "Too early to say" };
  var scope = "quiz"; // "quiz" or "semester"

  function view(d, quizName) {
    var T = d.topics; if (!T) return null;
    if (scope === "semester") return { title: "Whole semester", note: "Live quizzes, each student's latest practice for each lecture, and the latest mock exam.", topics: T.semester, answers: T.answers };
    var q = T.byQuiz && T.byQuiz[quizName];
    return { title: quizName, note: "Only the answers given in this live quiz.", topics: q ? q.topics : [], answers: q ? q.answers : 0 };
  }
  function row(t) {
    var sb = t.studentBands || {}, w = has(t.pct) ? Math.max(2, t.pct) : 0;
    return "<li class='tp-" + t.band + "'><span class='tp-name'>" + esc(t.label + (t.title ? ": " + t.title : "")) + "</span><span class='tp-bar' role='img' aria-label='" + esc(t.label + " " + (has(t.pct) ? t.pct + " percent correct" : "no figure") + ", " + NAME[t.band]) + "'><i style='width:" + w + "%'></i></span><b class='tp-pct'>" + (has(t.pct) ? t.pct + "%" : "–") + "</b>" +
      "<span class='tp-meta'>" + NAME[t.band] + ". " + t.answers + " answers from " + t.students + " students: " + (sb.well || 0) + " well mastered, " + (sb.developing || 0) + " developing, " + (sb.attention || 0) + " need attention." + (t.small ? " <em>Few answers.</em>" : "") + "</span></li>";
  }
  function qline(q, extra) { return "<li><b>" + esc(q.id) + "</b> " + (q.stem ? esc(q.stem) : "") + " <span class='note'>" + extra + "</span></li>"; }
  function lists(topics) {
    var well = topics.filter(function (t) { return t.band === "well"; }), weak = topics.filter(function (t) { return t.band === "attention"; }), dev = topics.filter(function (t) { return t.band === "developing"; });
    var names = function (xs) { return xs.length ? xs.map(function (t) { return esc(t.label) + " (" + t.pct + "%)"; }).join(", ") : "None"; };
    var hard = [], easy = [], wrong = [];
    topics.forEach(function (t) { t.hardest.forEach(function (q) { hard.push(q); }); t.easiest.forEach(function (q) { easy.push(q); }); t.wrong.forEach(function (w) { wrong.push(w); }); });
    hard.sort(function (a, b) { return a.pct - b.pct; }); easy.sort(function (a, b) { return b.pct - a.pct; }); wrong.sort(function (a, b) { return b.share - a.share; });
    return "<div class='tp-sum'><div><p class='lbl'>Well mastered</p><p>" + names(well) + "</p></div><div><p class='lbl'>Developing</p><p>" + names(dev) + "</p></div><div><p class='lbl'>Needs attention</p><p>" + names(weak) + "</p></div></div>" +
      "<div class='tp-qs'><div><p class='lbl'>Hardest questions</p><ul>" + (hard.slice(0, 3).map(function (q) { return qline(q, q.pct + "% of " + q.answers); }).join("") || "<li class='note'>None with 5 answers yet</li>") + "</ul></div>" +
      "<div><p class='lbl'>Easiest questions</p><ul>" + (easy.slice(0, 3).map(function (q) { return qline(q, q.pct + "% of " + q.answers); }).join("") || "<li class='note'>None with 5 answers yet</li>") + "</ul></div>" +
      "<div><p class='lbl'>Common wrong answers</p><ul>" + (wrong.slice(0, 3).map(function (w) { return qline(w, w.share + "% chose " + w.option + (w.text ? " (" + esc(w.text) + ")" : "")); }).join("") || "<li class='note'>No wrong answer chosen by a quarter or more</li>") + "</ul></div></div>";
  }
  function html(d, quizName) {
    var v = view(d, quizName), tabs = "<div class='bd-tabs tp-tabs' role='tablist'><button type='button' role='tab' data-tp='quiz' aria-selected='" + (scope === "quiz") + "'>This quiz</button><button type='button' role='tab' data-tp='semester' aria-selected='" + (scope === "semester") + "'>Whole semester</button></div>";
    var head = "<div class='card-head'><h3>Topics</h3><span class='note'>" + (v ? esc(v.title) : "") + "</span></div>";
    if (!v) return head + "<p class='note'>Topic figures are not available.</p>";
    if (!v.topics.length) return head + tabs + "<p class='note'>" + (scope === "quiz" ? "CM has no question-by-question record for this quiz (it was imported as totals, or no answers are released yet), so it cannot be split by topic. Quizzes run in CM and released show their topics here." : "No released answers linked to a lecture yet.") + "</p>";
    var rows = v.topics.slice().sort(function (a, b) { return (has(a.pct) ? a.pct : 101) - (has(b.pct) ? b.pct : 101); });
    return head + tabs + "<p class='note'>" + esc(v.note) + " " + v.answers + " answers.</p><ul class='tp-list'>" + rows.map(row).join("") + "</ul>" + lists(v.topics) +
      "<p class='note'>Well mastered is 70% or more of answers correct, needs attention is under 50%. A topic needs 10 answers before it gets a band. The students counted in each band need 3 of their own answers.</p>";
  }
  var api = { html: html, setScope: function (s) { scope = s === "semester" ? "semester" : "quiz"; }, getScope: function () { return scope; } };
  if (typeof module === "object" && module.exports) module.exports = api; else root.cmQuizTopics = api;
})(typeof window !== "undefined" ? window : globalThis);
