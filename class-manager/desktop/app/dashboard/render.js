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
  // One small line icon per card (decorative: the label says the same in words).
  var ICON = {
    students: "<circle cx='9' cy='8' r='3'/><path d='M3 19c0-3.3 2.7-6 6-6s6 2.7 6 6'/><circle cx='17' cy='9' r='2.2'/><path d='M16 14c2.8 0 5 2 5 5'/>",
    attendance: "<rect x='4' y='5' width='16' height='15' rx='2.5'/><path d='M4 10h16M8 3v4M16 3v4M9 15l2 2 4-4'/>",
    learning: "<path d='M4 17l5-5 4 3 7-8'/><path d='M15 7h5v5'/>",
    practice: "<path d='M13 3L5 14h6l-1 7 8-11h-6z'/>",
    risk: "<path d='M12 4l9 16H3z'/><path d='M12 10v4M12 17.5v.5'/>"
  };
  var TILE = { students: "t-blue", attendance: "t-green", learning: "t-purple", practice: "t-orange", risk: "t-red" };
  function stat(c) { // a button: a click opens the chart and the students behind the number (interact.js)
    return "<button type='button' class='card dstat " + (TILE[c.key] || "") + " " + c.light + "' data-drill='" + esc(c.key) + "' aria-pressed='false'><svg class='ico' viewBox='0 0 24 24' aria-hidden='true'>" + (ICON[c.key] || "") + "</svg><span class='tbig'>" + esc(c.value) + "</span><span class='lbl'>" + esc(c.label) + "</span><span class='note'>" + esc(c.text) + "</span>" +
      (c.light === "lt-none" ? "" : "<span class='lt'><i></i>" + WORD[c.light] + (c.reason ? " · " + esc(c.reason) : "") + "</span>") + "<span class='more'>See what is behind this</span></button>";
  }
  function statCards(d) { return "<div class='dstats' role='group' aria-label='Click a number to see what is behind it'>" + R.statCards(d).map(stat).join("") + "</div><section class='card ddrill' id='ddrill' aria-live='polite' hidden></section>"; }
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
  // Four large tiles that open the tools a lecturer reaches for first. They only navigate (data-dgo, handled with the Today buttons).
  function controls() {
    var T = [["view:class", "Attendance", "Open, monitor, close", "t-green", ICON.attendance], ["view:quizzes", "Quizzes and Questions", "Prepare, start, control", "t-purple", ICON.practice],
      ["view:students", "Students", "Records and notes", "t-blue", ICON.students], ["view:progress", "Learning Progress", "Graphs by day", "t-orange", ICON.learning]];
    return "<section class='dctl' aria-label='Class tools'><h3>Class tools</h3><div class='dtiles'>" + T.map(function (t) { return "<button type='button' class='dtile " + t[3] + "' data-dgo='" + t[0] + "'><svg class='ico' viewBox='0 0 24 24' aria-hidden='true'>" + t[4] + "</svg><b>" + esc(t[1]) + "</b><span>" + esc(t[2]) + "</span></button>"; }).join("") + "</div></section>";
  }
  // The first insight as one callout, with a button to the full list.
  function callout(d) {
    var xs = R.insights(d); if (!xs.length) return "";
    return "<div class='dcall' role='note'><svg class='ico' viewBox='0 0 24 24' aria-hidden='true'><path d='M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z'/></svg><p><b>Insight:</b> " + esc(xs[0]) + "</p></div>";
  }
  // Who needs attention, as a chart: attendance against quiz average with three zones. A click on a zone lists its students (interact.js).
  function riskCard(d) {
    var G = root.cmGroups || require("./groups"), C = root.cmDashCharts || require("./charts"), z = G.riskZones(d);
    var head = "<section class='card drisk' id='drisk' aria-labelledby='drk-h'><div class='card-head'><h3 id='drk-h'>Who needs attention</h3><span class='note'>Click a zone to list its students</span></div>";
    if (z.points.length < G.MIN_POINTS) return head + "<p class='note'>Needs at least " + G.MIN_POINTS + " students with both attendance and a quiz average. " + z.points.length + " so far.</p></section>";
    return head + "<div id='drisk-chart'>" + C.risk(z, null) + "</div><div class='zbar' role='group' aria-label='Zones'>" + z.zones.map(function (x) { return "<button type='button' class='zb' data-zone='" + x.key + "' aria-pressed='false'>" + esc(x.label) + " · " + x.students.length + "</button>"; }).join("") + "</div>" +
      "<div class='zlist' id='drisk-list' aria-live='polite'>Choose a zone to see its students.</div>" + (z.missing ? "<p class='note'>" + z.missing + (z.missing === 1 ? " student has" : " students have") + " no attendance or no quiz yet and are not on the chart.</p>" : "") + "</section>";
  }
  // What goes with what: three linked views. Selecting a zone above highlights the same students here. Always labelled as association.
  function corrCard(d) {
    var G = root.cmGroups || require("./groups"), C = root.cmDashCharts || require("./charts"), vs = G.correlations(d);
    return "<section class='card dcorr' id='dcorr' aria-labelledby='dc-h'><div class='card-head'><h3 id='dc-h'>What goes with what</h3><span class='note'>Association, not proof of cause</span></div>" +
      "<div class='zbar' role='group' aria-label='Comparison'>" + vs.map(function (v, i) { return "<button type='button' class='zb' data-corr='" + i + "' aria-pressed='" + (i === 0) + "'>" + esc(v.title) + "</button>"; }).join("") + "</div>" +
      "<div id='dcorr-chart'>" + C.relation(vs[0], null) + "</div><p class='note' id='dcorr-text'>" + esc(vs[0].text) + "</p></section>";
  }
  // The page is built in this order (insights.js): head (the hard numbers), then the charts, then grid (who needs attention, what goes with what, trends), then ops.
  function head(d) { return statCards(d); }
  function grid(d, slim) { // slim: the Class Analytics board already shows trends and insights, so they are not repeated
    return "<div class='dgrid'>" + riskCard(d) + corrCard(d) + (slim ? "" : trendsCard(d) + insightsCard(d)) + healthCard(d) + "</div>" + (slim ? "" : callout(d));
  }
  // Today, setup and the class tools: needed, but not what the page is about, so they sit in a section the lecturer can open.
  function ops(d, setup, live) {
    var sp = R.setupProgress(setup);
    var sum = "Today and setup" + (sp.complete ? "" : " · " + sp.done + " of " + sp.of + " setup steps done");
    return "<details class='card ops' id='dops'><summary>" + esc(sum) + "</summary><div class='opsbody'>" + today(d, setup, live) + setupTracker(setup) + controls() + "</div></details>";
  }
  // Kept for the tests and for older callers: everything in one string, analytics first.
  function top(d, setup, live) { return head(d) + grid(d) + ops(d, setup, live); }
  var api = { head: head, grid: grid, ops: ops, spark: spark, statCards: statCards, setupTracker: setupTracker, today: today, queue: queue, controls: controls, callout: callout, riskCard: riskCard, corrCard: corrCard, trendsCard: trendsCard, healthCard: healthCard, insightsCard: insightsCard, top: top };
  if (typeof module === "object" && module.exports) module.exports = api; else root.cmDashView = api;
})(typeof window !== "undefined" ? window : globalThis);
