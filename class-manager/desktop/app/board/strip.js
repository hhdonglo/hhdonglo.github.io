/* Class Analytics board: the lecture plan as a compact strip (replaces the old text card). A small donut (held, behind, still to come), a bar with
   a marker for where the course should be today, a one-word state badge and short chips for due, next and missed lectures. The sentences are in
   tooltips. Takes the lecture progress object and returns HTML. Runs in the CM window and in Node. */
(function (root) {
  "use strict";
  var U = root.cmBoardUtil || require("./util"), M = root.cmBoardModel || require("./model"), D = root.cmBoardDonut || require("./donut");
  var LABEL = { ontrack: "On track", ahead: "Ahead", behind: "Behind", met: "Target met", ended: "Semester ended", notstarted: "Not started", count: "Dates needed", none: "No target" };
  var BAD = { behind: 1, ended: 1 }, GOOD = { ontrack: 1, ahead: 1, met: 1 };
  function lec(l) { return l.label + (l.title ? ", " + l.title : ""); }
  function chip(k, v, title, cls) { return "<span class='lpc-chip " + (cls || "") + "' title='" + U.esc(title || "") + "'><i>" + U.esc(k) + "</i> " + U.esc(v) + "</span>"; }
  function bar(p) {
    var pct = p.target ? Math.min(100, Math.round(100 * p.held / p.target)) : 0, mark = p.target && p.expected != null ? Math.min(100, Math.round(100 * p.expected / p.target)) : null;
    return "<div class='lpc-bar' role='img' aria-label='" + U.esc(p.held + " of " + p.target + " lectures held" + (mark != null ? ", " + p.expected + " expected by today" : "")) + "'><span class='lpc-fill' style='width:" + pct + "%'></span>" +
      (mark != null ? "<span class='lpc-exp' style='left:" + mark + "%' title='Expected by today'></span>" : "") + "</div>";
  }
  function html(p) {
    p = p || {};
    var pl = M.plan(p), state = LABEL[p.state] || "", cls = BAD[p.state] ? "bad" : GOOD[p.state] ? "good" : "";
    var tip = [p.headline, p.detail].filter(Boolean).join(" ");
    var s = p.schedule || {}, chips = "";
    if (s.due) chips += chip("Due", s.due.label, lec(s.due));
    if (s.next) chips += chip("Next", s.next.label, lec(s.next));
    if (s.missed && s.missed.length) chips += chip("Missed", s.missed.map(function (l) { return l.label.replace(/^Lecture\s+/i, "L"); }).join(" "), s.missed.map(lec).join("; "), "bad");
    return "<div class='lpc-head'><h3 id='lp-h' title='Lectures against the semester target'>Lecture plan</h3><span class='lpc-badge " + cls + "' title='" + U.esc(tip) + "'>" + U.esc(state) + "</span></div>" +
      (pl.empty ? "<p class='lpc-empty' title='" + U.esc(pl.why) + "'>" + U.esc(U.short(pl.why, 60)) + "</p>" :
        "<div class='lpc-body'>" + D.svg(pl.slices, { big: pl.pct + "%", small: pl.held + " of " + pl.target }, "Lecture plan") +
        "<div class='lpc-side'>" + bar(p) + "<p class='lpc-nums' title='" + U.esc(tip) + "'><b>" + p.held + "</b>/" + p.target + " held" + (p.weekNow ? " <span>week " + p.weekNow + "/" + p.weeksTotal + "</span>" : "") + "</p>" +
        "<div class='lpc-chips'>" + chips + "</div></div></div>");
  }
  var api = { html: html, LABEL: LABEL };
  if (typeof module === "object" && module.exports) module.exports = api; else root.cmBoardStrip = api;
})(typeof window !== "undefined" ? window : globalThis);
