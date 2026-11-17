/* My topics: a student's own mastery by lecture topic in My results, with plain advice on what to revise.
   The figures come from the server's `topics` list for this one student (rules/topics); this file only lays them out. Runs in the portal and in Node (the tests). */
(function (root) {
  "use strict";
  var NAME = { well: "Well mastered", developing: "Developing", attention: "Needs attention", early: "Too early to say" };
  var CLS = { well: "ok", developing: "mid", attention: "low", early: "" };
  function html(topics, esc, pracPage) {
    esc = esc || function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
    if (!topics || !topics.length) return '<h2 style="margin-top:.9rem">My topics</h2><p class="note">Nothing to show yet. Do a practice quiz with your ID entered, or take part in a live quiz.</p>';
    var first = topics.filter(function (t) { return t.band === "attention" || t.band === "developing"; }).slice(0, 3);
    var h = '<h2 style="margin-top:.9rem">My topics</h2>';
    if (first.length) h += '<p><b>Revise first:</b> ' + first.map(function (t) { return esc(t.label); }).join(", ") + '.</p>';
    else if (topics.some(function (t) { return t.band === "well"; })) h += '<p class="note">No topic is below 70 per cent in your answers so far.</p>';
    h += topics.map(function (t) {
      var w = t.pct === null || t.pct === undefined ? 0 : Math.max(2, t.pct), link = (pracPage && (t.band === "attention" || t.band === "developing" || t.band === "early")) ? '<br><a href="' + pracPage(t.lecture) + '">Practice ' + esc(t.label) + ' <span aria-hidden="true">&rsaquo;</span></a>' : "";
      return '<div class="lv ' + CLS[t.band] + '"><span class="t">' + esc(t.label + (t.title ? ": " + t.title : "")) + '</span><span class="p">' + (t.pct === null || t.pct === undefined ? "–" : t.pct + "%") + '</span>' +
        '<span class="bar" role="img" aria-label="' + esc(t.label + ", " + (t.pct === null ? "no figure" : t.pct + " percent") + ", " + NAME[t.band]) + '"><i style="width:' + w + '%"></i></span>' +
        '<span class="s"><b>' + NAME[t.band] + '.</b> ' + t.right + ' of ' + t.asked + ' answers correct. ' + esc(t.advice) + link + '</span></div>';
    }).join("");
    return h + '<p class="note">From your own answers only: live quizzes, your latest practice for each lecture and your latest mock exam. Well mastered is 70 per cent or more, developing 50 to 69, needs attention below 50. A topic needs 3 of your answers before it is judged.</p>';
  }
  var api = { html: html };
  if (typeof module === "object" && module.exports) module.exports = api; else root.cmMyTopics = api;
})(typeof window !== "undefined" ? window : globalThis);
