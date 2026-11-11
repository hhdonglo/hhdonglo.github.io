/* Class Manager dashboard: the page parts. Each function turns the results of rules.js into an HTML string. No calculation here.
   Colour is never the only signal: every light has a word. */
(function (root) {
  "use strict";
  var R = root.cmDash || (typeof require === "function" ? require("./rules") : {});
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  var WORD = { "lt-good": "Good", "lt-watch": "Watch", "lt-bad": "Act", "lt-none": "No data" };

  function spark(vals, unit, label) { // a small line; the numbers are in the title
    if (vals.length < 3) return "<span class='note'>Too few points for a trend</span>";
    var W = 96, H = 26, lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals), span = hi - lo || 1;
    var pts = vals.map(function (v, i) { return (2 + i * (W - 4) / (vals.length - 1)).toFixed(1) + "," + (H - 3 - (H - 6) * (v - lo) / span).toFixed(1); }).join(" ");
    return "<svg class='spark' viewBox='0 0 " + W + " " + H + "' role='img' aria-label='" + esc(label + ": " + vals.join(", ") + unit) + "'><polyline points='" + pts + "'/></svg>";
  }
  function stat(c) {
    return "<div class='card dstat " + c.light + "'><p class='lbl'>" + esc(c.label) + "</p><p class='tbig'>" + esc(c.value) + "</p><p class='note'>" + esc(c.text) + "</p>" +
      "<p class='lt'><i></i>" + WORD[c.light] + (c.reason ? " · " + esc(c.reason) : "") + "</p></div>";
  }
  function statCards(d) { return "<div class='dstats'>" + R.statCards(d).map(stat).join("") + "</div>"; }
  function setupTracker(setup) {
    var sp = R.setupProgress(setup); if (sp.complete) return "";
    return "<section class='card dsetup' aria-label='Setup progress'><div class='card-head'><h3>Set up your course</h3><span class='note'>" + sp.done + " of " + sp.of + " done</span></div>" +
      "<div class='pbar' role='progressbar' aria-valuemin='0' aria-valuemax='100' aria-valuenow='" + sp.pct + "'><span style='width:" + sp.pct + "%'></span></div>" +
      "<ul class='todo'>" + sp.steps.map(function (s) { return "<li class='" + (s.done ? "done" : "") + "'><span class='mk'>" + (s.done ? "✓" : "○") + "</span> " + esc(s.label) + (s.done ? "" : " <button type='button' class='link' data-setup='" + esc(s.setup) + "'>Open</button>") + "</li>"; }).join("") + "</ul></section>";
  }
  function today(d, setup, live) {
    var acts = R.todayCard(d, setup, live);
    return "<section class='card dtoday' aria-labelledby='dt-h'><div class='card-head'><h3 id='dt-h'>Today</h3><span class='note'>What to do next</span></div>" +
      (acts.length ? "<ul class='dacts'>" + acts.map(function (a) { return "<li><span>" + esc(a.text) + "</span><button type='button' class='btn sm' data-dgo='" + esc(a.go) + "'>" + esc(a.label) + "</button></li>"; }).join("") + "</ul>" : "<p class='note'>Add a class list to begin.</p>") + "</section>";
  }
  function queue(d) {
    var q = R.priorityQueue(d, 5);
    return "<section class='card dqueue' aria-labelledby='dq-h'><div class='card-head'><h3 id='dq-h'>Who needs attention</h3><span class='note'>Suggestions for your review</span></div>" +
      (q.length ? "<ol class='dq'>" + q.map(function (x) { return "<li><button type='button' class='link' data-student='" + esc(x.id) + "'>" + esc(x.name) + "</button> <span class='note'>" + esc(x.why.join("; ")) + "</span></li>"; }).join("") + "</ol>" : "<p class='note'>No one is flagged. Flags appear as attendance and quiz results arrive.</p>") + "</section>";
  }
  function trendsCard(d) {
    return "<section class='card dtrends' aria-labelledby='dr-h'><div class='card-head'><h3 id='dr-h'>Trends</h3><span class='note'>Last sessions and quizzes</span></div><ul class='dtr'>" +
      R.trends(d).map(function (t) { return "<li><span class='lbl'>" + esc(t.label) + "</span>" + spark(t.vals, t.unit, t.label) + "<span class='tnum'>" + (t.last === null ? "–" : t.last + t.unit) + (t.change === null ? "" : " <span class='note'>(" + (t.change > 0 ? "+" : "") + t.change + ")</span>") + "</span></li>"; }).join("") + "</ul></section>";
  }
  function healthCard(d) {
    var h = R.health(d);
    return "<section class='card dhealth " + h.light + "' aria-labelledby='dh-h'><div class='card-head'><h3 id='dh-h'>Class health</h3><span class='lt'><i></i>" + esc(h.word) + "</span></div>" +
      (h.reasons.length ? "<ul class='note'>" + h.reasons.map(function (r) { return "<li>" + esc(r) + "</li>"; }).join("") + "</ul>" : "<p class='note'>Nothing needs attention.</p>") + "</section>";
  }
  function insightsCard(d) {
    var xs = R.insights(d);
    return "<section class='card dins' aria-labelledby='di-h'><div class='card-head'><h3 id='di-h'>Teaching insights</h3><span class='note'>From the numbers only</span></div>" +
      (xs.length ? "<ul>" + xs.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul>" : "<p class='note'>Insights appear after a few sessions and quizzes.</p>") + "</section>";
  }
  // The whole top of the dashboard.
  function top(d, setup, live) {
    return today(d, setup, live) + setupTracker(setup) + statCards(d) + "<div class='dgrid'>" + queue(d) + healthCard(d) + trendsCard(d) + insightsCard(d) + "</div>";
  }
  var api = { spark: spark, statCards: statCards, setupTracker: setupTracker, today: today, queue: queue, trendsCard: trendsCard, healthCard: healthCard, insightsCard: insightsCard, top: top };
  if (typeof module === "object" && module.exports) module.exports = api; else root.cmDashView = api;
})(typeof window !== "undefined" ? window : globalThis);
