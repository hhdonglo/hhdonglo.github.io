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
    var form = "<form class='sp-form' data-an-form='support'><p class='row' style='flex-wrap:wrap;gap:.5rem .9rem;align-items:flex-end'>" +
      "<label style='font-weight:400'>What was given<br><input class='f' id='sp-kind' maxlength='60' placeholder='Check-in, tutoring offer, e-mail' required></label>" +
      "<label style='font-weight:400'>Student IDs (separated by spaces or commas)<br><input class='f' id='sp-ids' inputmode='numeric' placeholder='22583439 22583440' required style='min-width:16rem'></label>" +
      "<label style='font-weight:400'>Note (optional)<br><input class='f' id='sp-note' maxlength='300' style='min-width:12rem'></label>" +
      "<button class='btn' type='submit'>Record</button></p><p class='small muted'>CM compares these students' later quizzes with students whose earlier results were similar. The comparison is an association, never proof.</p></form>";
    if (!list.length) return card("Support given", "<p>No support recorded yet. Record a check-in or tutoring offer to see whether later results move.</p>" + form);
    var rows = list.map(function (r) {
      var who = (r.givenIds && r.givenIds.length) || (r.comparedIds && r.comparedIds.length) ?
        "<details class='small'><summary>The students behind these numbers</summary><p class='small'>Given (" + r.given + "): " + esc((r.givenIds || []).join(", ") || "none") + "</p><p class='small'>Compared with (" + r.compared + "): " + esc((r.comparedIds || []).join(", ") || "none") + "</p></details>" : "";
      return "<li><b>" + esc(r.kind) + "</b> (" + esc(r.date) + "): " + esc(r.text) + (r.confidence ? " " + E.badge(r.confidence) : "") + (r.note ? "<br><span class='small muted'>" + esc(r.note) + "</span>" : "") + who + "</li>";
    }).join("");
    return card("Support given", "<ul class='alist'>" + rows + "</ul>" + form, "Students given support are compared with students whose earlier quiz results were similar, over the same quizzes.");
  }
  function fairness(f) {
    if (f.empty) return card("Results by group", "<p>Give students a Group in the class list to compare results between groups.</p>");
    var max = 100, rows = f.groups.map(function (g) { return "<li class='crow'><span class='clab'>Group " + esc(g.group) + " (n = " + g.n + ")</span><span class='cbar' role='img' aria-label='Group " + esc(g.group) + " quiz average " + (g.quiz === null ? "none" : g.quiz + " percent") + "'><i style='width:" + Math.min(max, g.quiz || 0) + "%'></i></span><span class='cval'>" + (g.quiz === null ? "no data" : g.quiz + "%") + (g.confidence ? " " + E.badge(g.confidence) : "") + "</span></li>"; }).join("");
    return card("Results by group", "<ul class='clist'>" + rows + "</ul><p" + (f.flagged ? " class='warnline'" : "") + ">" + esc(f.note) + "</p>", "Groups are the teaching groups of the class list. No personal characteristics are used. A gap is a prompt to check conditions, not a judgement of students.");
  }
  var api = { esc: esc, items: items, concepts: concepts, interventions: interventions, fairness: fairness };
  if (typeof module === "object" && module.exports) module.exports = api; else root.cmAnalyticsView = api;
})(typeof window !== "undefined" ? window : globalThis);
