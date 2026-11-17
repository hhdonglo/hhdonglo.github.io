/* Class Analytics board: the Insights panel. Short sentences computed by model.js from the class numbers; never written by AI. */
(function (root) {
  "use strict";
  var U = root.cmBoardUtil || require("./util"), I = root.cmBoardIcons || require("./icons");
  function list(items) {
    if (!items.length) return "<p class='bd-empty'>Findings appear after a few sessions and quizzes. Each one is worked out from the numbers on this page.</p>";
    return "<ul class='bd-finds'>" + items.map(function (f) { return "<li><span class='bd-fi'>" + I.icon(f.icon, "bd-ico") + "</span><span>" + U.esc(f.text) + "</span></li>"; }).join("") + "</ul>";
  }
  var api = { list: list };
  if (typeof module === "object" && module.exports) module.exports = api; else root.cmBoardFindings = api;
})(typeof window !== "undefined" ? window : globalThis);
