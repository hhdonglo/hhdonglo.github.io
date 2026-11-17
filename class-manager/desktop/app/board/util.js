/* Class Analytics board: small shared helpers (escaping, rounding, colours). Runs in the CM window and in Node. */
(function (root) {
  "use strict";
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function r1(n) { return Math.round(n * 10) / 10; }
  function plural(n, one, many) { return n + " " + (n === 1 ? one : many); }
  function has(v) { return v !== null && v !== undefined && !isNaN(v); }
  function short(s, n) { s = String(s == null ? "" : s); return s.length > n ? s.slice(0, n - 1) + "…" : s; }
  // The chart panels are white in both CM themes (Hope, 2026-11-17); orange and gold are the accents, red and green only carry meaning.
  var COLOR = { orange: "#E8772E", deep: "#C2531B", gold: "#E0A526", sand: "#F3D08A", ink: "#1F2D45", muted: "#5A6579", grid: "#E6E9F0", ghost: "#EDEFF4", good: "#1F8F5F", bad: "#C03A2B" };
  var api = { esc: esc, r1: r1, plural: plural, has: has, short: short, COLOR: COLOR };
  if (typeof module === "object" && module.exports) module.exports = api; else root.cmBoardUtil = api;
})(typeof window !== "undefined" ? window : globalThis);
