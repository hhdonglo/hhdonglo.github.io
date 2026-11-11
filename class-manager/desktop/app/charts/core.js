/* Class Manager charts: shared helpers (no chart is drawn here).
   Every chart module returns an HTML string from plain data and does no calculation of its own: the figures come from the server
   script (learningProgress_). The same file runs in the app window (window.cmCharts) and in Node (the tests). */
(function (root) {
  "use strict";
  var LEVELS = ["Secure", "Developing", "Beginning", "Not enough evidence"];
  var LEVEL_CLASS = { "Secure": "g-on", "Developing": "g-hard", "Beginning": "g-need", "Not enough evidence": "g-none" };
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  // Labels of lectures whose questions are not linked to an objective carry a long suffix from the server; charts drop it and say so once.
  function short(label) { return String(label == null ? "" : label).replace(/\s*\(not linked to an objective\)\s*$/, ""); }
  function pct(n, of) { return of ? Math.round(1000 * n / of) / 10 : null; }
  // A sentence shown in place of a chart that has nothing to draw. Never an empty or zero chart.
  function empty(text) { return "<p class='note ch-empty'>" + esc(text) + "</p>"; }
  // The legend for the four levels, shared by every chart that colours by level.
  function legend() { return "<p class='note lv-legend'>" + LEVELS.map(function (k) { return "<span><i class='" + LEVEL_CLASS[k] + "'></i>" + esc(k) + "</span>"; }).join("") + "</p>"; }
  // Every chart also offers its numbers as a table, for screen readers and for checking the figures.
  function asTable(caption, head, rows) {
    return "<details class='ch-table'><summary>View as a table</summary><div class='tbl ins-tbl short'><table><caption class='sr'>" + esc(caption) + "</caption><thead><tr>" +
      head.map(function (h) { return "<th>" + esc(h) + "</th>"; }).join("") + "</tr></thead><tbody>" +
      rows.map(function (r) { return "<tr>" + r.map(function (c) { return "<td>" + esc(c) + "</td>"; }).join("") + "</tr>"; }).join("") + "</tbody></table></div></details>";
  }
  var api = { LEVELS: LEVELS, LEVEL_CLASS: LEVEL_CLASS, esc: esc, short: short, pct: pct, empty: empty, legend: legend, asTable: asTable };
  if (typeof module === "object" && module.exports) module.exports = api; else root.cmCharts = Object.assign(root.cmCharts || {}, api);
})(typeof window !== "undefined" ? window : globalThis);
