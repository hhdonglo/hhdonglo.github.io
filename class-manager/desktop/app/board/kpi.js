/* Class Analytics board: the KPI cards. Each card is a button; the existing click handler (dashboard/interact.js) opens the students behind it. */
(function (root) {
  "use strict";
  var U = root.cmBoardUtil || require("./util"), I = root.cmBoardIcons || require("./icons");
  var ARROW = { up: "▲", down: "▼", flat: "▶" };
  function trend(k) {
    if (!k.delta) return "";
    var good = k.delta.dir === "flat" ? "flat" : (k.delta.dir === "up") === !k.goodDown ? "good" : "bad";
    return "<span class='bd-delta " + good + "'><b aria-hidden='true'>" + ARROW[k.delta.dir] + "</b> " + U.esc(k.delta.text) + " <span>" + U.esc(k.delta.label) + "</span></span>";
  }
  function card(k) {
    return "<button type='button' class='dstat bd-kpi' data-drill='" + U.esc(k.key) + "' aria-pressed='false'>" + I.icon(k.icon, "bd-ico bd-ico-lg") +
      "<span class='bd-kl'>" + U.esc(k.label) + "</span><span class='bd-kv'>" + U.esc(k.value) + "</span><span class='bd-kn'>" + U.esc(k.note) + "</span>" + trend(k) + "</button>";
  }
  function row(kpis) { return "<div class='bd-kpis' role='group' aria-label='Key numbers. Click one for the students behind it.'>" + kpis.map(card).join("") + "</div>"; }
  var api = { card: card, row: row };
  if (typeof module === "object" && module.exports) module.exports = api; else root.cmBoardKpi = api;
})(typeof window !== "undefined" ? window : globalThis);
