/* Class Analytics board: the ranked table of topics that need attention, lowest first, with a growth arrow from the change on repeat questions. */
(function (root) {
  "use strict";
  var U = root.cmBoardUtil || require("./util"), has = U.has;
  function growth(g) {
    if (!has(g)) return "<span class='bd-flat'>–</span>";
    return g > 0 ? "<span class='bd-up'><b aria-hidden='true'>▲</b> +" + g + "</span>" : g < 0 ? "<span class='bd-down'><b aria-hidden='true'>▼</b> −" + Math.abs(g) + "</span>" : "<span class='bd-flat'><b aria-hidden='true'>▶</b> 0</span>";
  }
  function table(rows) {
    if (!rows.length) return "<p class='bd-empty'>Topics appear here once quiz answers are linked to lectures. The lowest topics come first.</p>";
    return "<table class='bd-table'><thead><tr><th>#</th><th>Topic</th><th>Correct</th><th>Change</th></tr></thead><tbody>" + rows.map(function (r) {
      return "<tr><td>" + r.rank + "</td><td>" + U.esc(U.short(r.label, 34)) + (r.small ? " <span class='bd-small'>few answers</span>" : "") + "</td><td><span class='bd-meter'><i style='width:" + Math.max(2, Math.min(100, r.pct)) + "%'></i></span> " + U.r1(r.pct) + "%</td><td>" + growth(r.gain) + "</td></tr>";
    }).join("") + "</tbody></table><p class='bd-foot'>Change is the gain in points on repeated questions.</p>";
  }
  var api = { table: table };
  if (typeof module === "object" && module.exports) module.exports = api; else root.cmBoardRanked = api;
})(typeof window !== "undefined" ? window : globalThis);
