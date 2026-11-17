/* Class Analytics board: the page parts. Each function turns model.js results into an HTML string by calling the chart modules. No calculation here.
   Panels are separate functions so a refresh (new lecture progress, a chosen tab) redraws one panel, not the page. */
(function (root) {
  "use strict";
  var U = root.cmBoardUtil || require("./util"), M = root.cmBoardModel || require("./model"), K = root.cmBoardKpi || require("./kpi");
  var D = root.cmBoardDonut || require("./donut"), BL = root.cmBoardBarline || require("./barline"), RK = root.cmBoardRanked || require("./ranked"), F = root.cmBoardFindings || require("./findings");
  var TM = root.cmBoardTopicsModel || require("./topics-model"), TP = root.cmBoardTopics || require("./topics-panels"); // topic mastery, trends, correlations (topics-*.js)
  var STATE = { held: "Held", behind: "Behind", ontrack: "On track", ahead: "Ahead", met: "Target met", ended: "Ended" };
  function head(title, note) { return "<div class='bd-head'><h3>" + U.esc(title) + "</h3>" + (note ? "<span>" + U.esc(note) + "</span>" : "") + "</div>"; }

  function planPanel(lp) {
    var p = M.plan(lp), h = head("Lecture plan", p.empty ? "" : p.state in STATE ? STATE[p.state] : "");
    if (p.empty) return h + "<div class='bd-plan'>" + D.svg([], null, "Lecture plan") + "<div><p class='bd-empty'>" + U.esc(p.why) + "</p></div></div>";
    return h + "<div class='bd-plan'>" + D.svg(p.slices, { big: p.pct + "%", small: "of " + p.target + " held" }, "Lecture plan") + D.legend(p.slices) + "</div>" +
      (p.lines.length ? "<dl class='bd-lines'>" + p.lines.map(function (l) { return "<div><dt>" + U.esc(l.k) + "</dt><dd>" + U.esc(l.v) + "</dd></div>"; }).join("") + "</dl>" : "") +
      "<p class='bd-foot'>" + U.esc(p.headline) + (p.week ? " Week " + U.esc(p.week) + "." : "") + "</p>";
  }

  function progressPanel(d, lp, tab) {
    var tabs = M.progress(d, lp), cur = tabs.filter(function (t) { return t.key === tab; })[0] || tabs[0];
    return head("Class progress over time", "Click a bar for the students behind it") +
      "<div class='bd-tabs' role='tablist'>" + tabs.map(function (t) { return "<button type='button' role='tab' data-bd-tab='" + t.key + "' aria-selected='" + (t === cur) + "'>" + U.esc(t.title) + "</button>"; }).join("") + "</div>" +
      BL.svg(cur) + BL.key(cur);
  }

  function breakPanel(d, view) {
    var g = view === "groups", m = g ? M.groupDonut(d) : M.topicDonut(d);
    return head("Category breakdown", "") + "<div class='bd-tabs' role='tablist'><button type='button' role='tab' data-bd-view='topics' aria-selected='" + !g + "'>By topic</button><button type='button' role='tab' data-bd-view='groups' aria-selected='" + g + "'>By group</button></div>" +
      "<div class='bd-plan'>" + D.svg(m.slices, m.centre, m.title) + D.legend(m.slices) + "</div>" +
      "<p class='bd-foot'>" + (g ? "Groups are suggestions for your review." : m.total ? "Share of " + U.plural(m.total, "lecture topic", "lecture topics") + " by what the answers show." : "Topics appear once quiz answers are linked to lectures.") + "</p>";
  }
  function rankedPanel(d) { return head("Topics needing attention", "Lowest first") + RK.table(M.ranked(d, 6)); }
  function insightsPanel(d, lp) { return head("Insights", "From the numbers only") + F.list(M.findings(d, lp).concat(TM.insights(d)).slice(0, 8)); }

  // The spread of quiz averages in plain numbers: a white card with the five figures (the bars are in Class graphs).
  function spreadCard(d) {
    var sp = M.spread(d);
    return "<section class='bd-card' id='bd-spread' aria-label='How quiz averages are spread'>" + head("How quiz averages are spread", sp.n ? U.plural(sp.n, "student", "students") + " with a quiz result" : "") +
      (sp.n ? "<dl class='bd-facts'><div><dt>Median</dt><dd>" + sp.median + "%</dd></div><div><dt>Middle half</dt><dd>" + sp.q1 + "% to " + sp.q3 + "%</dd></div><div><dt>Lowest</dt><dd>" + sp.min + "%</dd></div><div><dt>Highest</dt><dd>" + sp.max + "%</dd></div></dl>" +
        "<p class='bd-foot'>The middle half is the range holding the central half of the class. Bands, outliers and the fitted curve are in Class graphs below; click a band to list its students.</p>" : "<p class='bd-empty'>Appears once students have a quiz result.</p>") + "</section>";
  }
  // Sessions with no check-ins are not counted (rules/class-stats.js). Said plainly, so a missing session is never a mystery.
  function setAsideCard(d) {
    var nh = (d.attendance && d.attendance.notHeld) || [];
    if (!nh.length) return "";
    return "<section class='bd-card' id='bd-aside' aria-label='Sessions not counted'>" + head("Sessions not counted", U.plural(nh.length, "session", "sessions")) +
      "<p class='bd-empty'>Nobody checked in at " + nh.map(function (x) { return U.esc(String(x.label).replace(/\s+\d{4}$/, "")); }).join(", ") + ", so " + (nh.length === 1 ? "it is" : "they are") + " treated as not held. They do not lower the attendance rates and do not flag students. A session counts as soon as one student has checked in.</p></section>";
  }
  // The whole board. Panels carry ids so they can be redrawn one by one (interact.js).
  function html(d, lp, st) {
    st = st || {};
    return K.row(M.kpis(d)) + "<section class='card ddrill' id='ddrill' aria-live='polite' hidden></section>" +
      "<div class='bd-grid'><section class='bd-card bd-w2' id='bd-plan' aria-label='Lecture plan'>" + planPanel(lp) + "</section>" +
      "<section class='bd-card bd-w3' id='bd-prog' aria-label='Class progress over time'>" + progressPanel(d, lp, st.tab) + "</section>" +
      "<section class='bd-card' id='bd-break' aria-label='Category breakdown'>" + breakPanel(d, st.view) + "</section>" +
      "<section class='bd-card' id='bd-rank' aria-label='Topics needing attention'>" + rankedPanel(d) + "</section>" +
      "<section class='bd-card' id='bd-ins' aria-label='Insights'>" + insightsPanel(d, lp) + "</section></div>" + TP.html(d);
  }
  var api = { spreadCard: spreadCard, setAsideCard: setAsideCard, html: html, planPanel: planPanel, progressPanel: progressPanel, breakPanel: breakPanel, rankedPanel: rankedPanel, insightsPanel: insightsPanel };
  if (typeof module === "object" && module.exports) module.exports = api; else root.cmBoardView = api;
})(typeof window !== "undefined" ? window : globalThis);
