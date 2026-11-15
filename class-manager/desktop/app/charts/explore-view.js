/* Class Manager analytics charts: HTML for one extra chart card. Draws the bars with the dashboard's bar drawing (cmDashCharts.bars), then the
   caption, a table of the same numbers with n, and the place where the students behind a clicked bar are listed.
   Runs in the CM window (window.cmExploreView) and in Node (the tests). */
(function (root) {
  "use strict";
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  var D = function () { return root.cmDashCharts || (typeof require === "function" ? require("../dashboard/charts") : null); };
  var CAP = 8;

  function listHtml(c, i, all) {
    var b = c.bars[i]; if (!b) return "<span class='note'>Choose a bar to see " + (c.kind === "question" ? "its questions" : "its students") + ".</span>";
    if (!b.students.length) return "<span class='note'>" + esc(b.label) + ": nobody.</span>";
    var cap = all ? b.students.length : CAP;
    var btns = b.students.slice(0, cap).map(function (s) { return c.kind === "question" ? "<span class='xq'>" + esc(s.name) + "</span>" : "<button type='button' class='link' data-student='" + esc(s.id) + "'>" + esc(s.name) + "</button>"; }).join("");
    return "<span class='note'>" + esc(b.label) + " · " + b.students.length + " " + esc(b.what || (c.kind === "question" ? "questions" : "students")) + (b.small ? " (small group, read with care)" : "") + ":</span>" + btns +
      (b.students.length > cap ? "<button type='button' class='zb' data-xall='1'>Show all " + b.students.length + "</button>" : "");
  }
  function tableHtml(c) {
    return "<details class='xt'><summary>View as a table</summary><table><thead><tr><th scope='col'>" + esc(c.title) + "</th><th scope='col'>Value</th><th scope='col'>n</th></tr></thead><tbody>" +
      c.bars.map(function (b) { return "<tr><th scope='row'>" + esc(b.label) + "</th><td>" + (b.value === null || b.value === undefined ? "no data" : esc(b.value + (c.unit === "%" ? "%" : ""))) + "</td><td>" + b.n + (b.small ? " (small)" : "") + "</td></tr>"; }).join("") + "</tbody></table></details>";
  }
  function card(c, sel, all) {
    var drill = { title: c.title, unit: c.unit, max: c.max, bars: c.bars.map(function (b) { return { label: b.label + (b.small ? "*" : ""), value: b.value }; }) };
    var small = c.bars.some(function (b) { return b.small && b.n > 0; });
    return "<section class='card acard xc' data-xc='" + esc(c.key) + "'><h3>" + esc(c.title) + "</h3><p class='note'>" + esc(c.hint) + "</p>" +
      (c.bars.length ? D().bars(drill, sel === undefined ? null : sel) : "<p class='note'>Nothing to show yet.</p>") +
      "<div class='zlist' aria-live='polite'>" + listHtml(c, sel === undefined || sel === null ? -1 : sel, all) + "</div>" +
      "<p class='note small'>" + esc(c.caption) + (small ? " * Fewer than 5 students." : "") + "</p>" + tableHtml(c) + "</section>";
  }
  var api = { card: card, listHtml: listHtml, CAP: CAP };
  if (typeof module === "object" && module.exports) module.exports = api; else root.cmExploreView = api;
})(typeof window !== "undefined" ? window : globalThis);
