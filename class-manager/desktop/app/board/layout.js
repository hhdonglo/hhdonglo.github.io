/* Class Analytics board: the card layout, as numbers. Each card has a key, a width in columns of a 12 column grid, an optional height in pixels,
   a place in the order and a hidden flag. Defaults put charts first and text-heavy cards last. Pure functions, no page: arrange.js applies
   them and saves the lecturer's changes. Runs in the CM window and in Node (the tests). */
(function (root) {
  "use strict";
  var COLS = 12, MIN_W = 2, MIN_H = 120, STEP_H = 20;
  // Width in columns by card key (12 columns; 3 to 4 cards per row on a wide screen). Unknown cards get DEFAULT_W.
  var WIDTH = { "bd-prog": 6, "bd-break": 3, "bd-rank": 3, "bd-satt": 4, "bd-sscore": 4, "bd-srisk": 4, "bd-smast": 4, "bd-spread": 4, "bd-aside": 4, "bd-tmast": 6, "bd-tover": 6, "bd-tcorr": 12, "bd-ins": 6, "c-class-health": 3, "c-this-week-in-the-class": 4, "c-is-the-class-learning": 12, "c-areas-to-target": 6 };
  var DEFAULT_W = 4;
  // Text-heavy cards sit after the graphs unless the lecturer moves them.
  var TEXT = { "bd-ins": 1, "c-class-health": 1, "c-this-week-in-the-class": 1, "c-is-the-class-learning": 1, "bd-aside": 1, "c-areas-to-target": 1 };
  function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }
  function clampW(w) { return clamp(Math.round(w), MIN_W, COLS); }
  function snapH(h) { return Math.max(MIN_H, Math.round(h / STEP_H) * STEP_H); }
  function slug(s) { return String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "card"; }
  // keys: card keys in page order. saved: { key: { w, h, order, hidden } } from the lecturer. Returns the cards in display order with every field filled.
  function resolve(keys, saved) {
    saved = saved || {};
    var out = keys.map(function (k, i) {
      var s = saved[k] || {};
      return { key: k, w: s.w ? clampW(s.w) : (WIDTH[k] || DEFAULT_W), h: s.h ? snapH(s.h) : null, hidden: !!s.hidden, order: typeof s.order === "number" ? s.order : (TEXT[k] ? 1000 : 0) + i * 10 };
    });
    return out.sort(function (a, b) { return a.order - b.order; });
  }
  // Put `key` just before `before` (or at the end when before is null). Returns new orders, 10 apart, for all keys in display order.
  function move(list, key, before) {
    var keys = list.map(function (c) { return c.key; }).filter(function (k) { return k !== key; });
    var at = before ? keys.indexOf(before) : keys.length; if (at < 0) at = keys.length;
    keys.splice(at, 0, key);
    var o = {}; keys.forEach(function (k, i) { o[k] = i * 10; }); return o;
  }
  // One step earlier (-1) or later (1) for the keyboard.
  function step(list, key, dir) {
    var keys = list.map(function (c) { return c.key; }), i = keys.indexOf(key), j = i + dir;
    if (i < 0 || j < 0 || j >= keys.length) return null;
    return move(list, key, dir < 0 ? keys[j] : (keys[j + 1] || null));
  }
  var api = { COLS: COLS, MIN_W: MIN_W, MIN_H: MIN_H, STEP_H: STEP_H, clampW: clampW, snapH: snapH, slug: slug, resolve: resolve, move: move, step: step };
  if (typeof module === "object" && module.exports) module.exports = api; else root.cmBoardLayout = api;
})(typeof window !== "undefined" ? window : globalThis);
