/* Class Manager analytics: HTML for the evidence, item, concept, intervention and fairness cards. No data access here: it takes the results of the
   sibling modules. Runs in the CM window (window.cmAnalyticsView) and in Node. */
(function (root) {
  "use strict";
  var E = root.cmEvidence || (typeof require === "function" ? require("./evidence") : null);
  function esc(s) { return String(s === null || s === undefined ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function card(title, body, note) { return "<section class='card acard'><h3>" + esc(title) + "</h3>" + body + (note ? "<p class='muted small'>" + esc(note) + "</p>" : "") + "</section>"; }
  function items(res) {
    var g = res.groups, row = function (name, list) { return list.length ? "<li><b>" + esc(name) + " (" + list.length + ")</b>: " + list.map(function (i) { return esc(i.id); }).join(", ") + "</li>" : ""; };
    var body = "<ul class='alist'>" + row("Review the wording or the key", g.review) + row("Very hard", g.hard) + row("Very easy", g.easy) + row("Too few answers", g.small) + "</ul>";
    if (!g.review.length && !g.hard.length && !g.easy.length) body = "<p>No question needs review yet.</p>" + body;
    var det = res.items.filter(function (i) { return i.flags.length && i.group !== "small"; }).slice(0, 5).map(function (i) { return "<li><b>" + esc(i.id) + "</b>: " + i.flags.map(esc).join("; ") + "</li>"; }).join("");
    return card("Questions to review", body + (det ? "<ul class='alist'>" + det + "</ul>" : ""), "A question is judged once at least " + 10 + " students have answered it.");
  }
  function concepts(list) {
    if (!list.length) return card("Concepts", "<p>No lecture has results yet.</p>");
    var bars = list.map(function (c) {
      var w = c.pct === null ? 0 : c.pct;
      return "<li class='crow'><span class='clab'>" + esc(c.title) + "</span><span class='cbar' role='img' aria-label='" + esc(c.title + ": " + (c.pct === null ? "no result" : c.pct + " percent correct")) + "'><i style='width:" + w + "%' class='cs-" + c.status.replace(/\s+/g, "-") + "'></i></span><span class='cval'>" + (c.pct === null ? "no data" : c.pct + "%") + " " + esc(c.status) + "</span></li>";
    }).join("");
    var notes = list.filter(function (c) { return c.note; }).map(function (c) { return "<li>" + esc(c.title) + ": " + esc(c.note) + "</li>"; }).join("");
    return card("Concepts across the course", "<ul class='clist'>" + bars + "</ul>" + (notes ? "<ul class='alist'>" + notes + "</ul>" : ""), "Percent of live answers that were correct. A topic is marked once it has 30 answers.");
  }
  function interventions(list) {
    if (!list.length) return card("Support given", "<p>No support recorded yet. Record a check-in or tutoring offer to see whether later results move.</p>");
    return card("Support given", "<ul class='alist'>" + list.map(function (r) { return "<li><b>" + esc(r.kind) + "</b> (" + esc(r.date) + "): " + esc(r.text) + (r.confidence ? " " + E.badge(r.confidence) : "") + "</li>"; }).join("") + "</ul>", "Compared with students not given support, over the same quizzes.");
  }
  function fairness(f) {
    if (f.empty) return card("Results by group", "<p>Give students a Group in the class list to compare results between groups.</p>");
    var max = 100, rows = f.groups.map(function (g) { return "<li class='crow'><span class='clab'>Group " + esc(g.group) + " (n = " + g.n + ")</span><span class='cbar' role='img' aria-label='Group " + esc(g.group) + " quiz average " + (g.quiz === null ? "none" : g.quiz + " percent") + "'><i style='width:" + Math.min(max, g.quiz || 0) + "%'></i></span><span class='cval'>" + (g.quiz === null ? "no data" : g.quiz + "%") + (g.confidence ? " " + E.badge(g.confidence) : "") + "</span></li>"; }).join("");
    return card("Results by group", "<ul class='clist'>" + rows + "</ul><p" + (f.flagged ? " class='warnline'" : "") + ">" + esc(f.note) + "</p>", "Groups are the teaching groups of the class list. No personal characteristics are used. A gap is a prompt to check conditions, not a judgement of students.");
  }
  var api = { esc: esc, items: items, concepts: concepts, interventions: interventions, fairness: fairness };
  if (typeof module === "object" && module.exports) module.exports = api; else root.cmAnalyticsView = api;
})(typeof window !== "undefined" ? window : globalThis);
