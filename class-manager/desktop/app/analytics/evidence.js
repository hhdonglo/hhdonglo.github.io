/* Class Manager analytics: how much to trust a number. Plain data in, plain data out. Runs in the CM window (window.cmEvidence) and in Node (the tests).
   A figure from a handful of students, or from few of the class, is shown with a plain label so it is not read as a fact. */
(function (root) {
  "use strict";
  var LEVELS = ["Too little", "Low", "Medium", "High"];
  // n: students (or answers) behind the figure. coverage: share of the class it covers, 0 to 1 (optional).
  function confidence(n, coverage) {
    n = Number(n) || 0;
    var lvl = n < 5 ? 0 : n < 10 ? 1 : n < 30 ? 2 : 3, why = [];
    if (n < 5) why.push("only " + n + (n === 1 ? " student" : " students"));
    else if (n < 10) why.push("fewer than 10 students");
    if (coverage !== undefined && coverage !== null && coverage < 0.5 && lvl > 1) { lvl--; why.push("under half the class is covered"); }
    if (coverage !== undefined && coverage !== null && coverage < 0.8 && lvl === 3) { lvl = 2; why.push("under 80% of the class is covered"); }
    return { level: LEVELS[lvl], rank: lvl, n: n, why: why.length ? why.join("; ") : "enough students to read the figure", ok: lvl >= 2 };
  }
  function badge(c) { return "<span class='evb ev-" + c.level.toLowerCase().replace(/\s+/g, "-") + "' title='" + String(c.why).replace(/'/g, "&#39;") + "'>Evidence: " + c.level + "</span>"; }
  var api = { LEVELS: LEVELS, confidence: confidence, badge: badge };
  if (typeof module === "object" && module.exports) module.exports = api; else root.cmEvidence = api;
})(typeof window !== "undefined" ? window : globalThis);
