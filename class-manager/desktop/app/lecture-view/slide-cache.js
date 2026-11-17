/* Class Manager: the rules behind smooth slide changes. One responsibility: plain functions with no screen and no files, so they can be tested.
   Which pages to have ready, how large a page is drawn on this screen, and which drawn pages to keep. Used by slide-show.js. */
(function (root) {
  "use strict";

  // The pages to have ready, most needed first: the one on screen, then the next, the previous, and the one after next.
  function wanted(page, pages) {
    var out = [];
    [0, 1, -1, 2].forEach(function (d) { var p = page + d; if (p >= 1 && p <= pages && out.indexOf(p) < 0) out.push(p); });
    return out;
  }

  // The size a page is drawn at so that the whole page fits the box (like "fit to window"), in screen pixels and in drawing pixels.
  // pageW and pageH are the page's own proportions; dpr (screen sharpness) is capped so a large screen does not use too much memory.
  function fit(pageW, pageH, boxW, boxH, dpr) {
    var w = Math.max(1, Number(pageW) || 1), h = Math.max(1, Number(pageH) || 1);
    var bw = Math.max(1, Number(boxW) || 1), bh = Math.max(1, Number(boxH) || 1);
    var k = Math.min(bw / w, bh / h), d = Math.min(2, Math.max(1, Number(dpr) || 1));
    var cssW = Math.max(1, Math.floor(w * k)), cssH = Math.max(1, Math.floor(h * k));
    return { cssW: cssW, cssH: cssH, pxW: Math.round(cssW * d), pxH: Math.round(cssH * d), scale: k * d };
  }

  // The drawn pages kept for the pages in use. A new box size or sharpness gives a new key, so pages drawn at another size are never shown.
  function sizeKey(boxW, boxH, dpr) { return Math.round(boxW) + "x" + Math.round(boxH) + "@" + (Math.min(2, Math.max(1, Number(dpr) || 1))); }
  function createCache(max) {
    var items = {}, key = "", limit = Math.max(3, max || 5);
    return {
      get: function (page) { return items[page] || null; },
      has: function (page) { return !!items[page]; },
      // Keep a page for the given key. A different key empties the cache first. When full, the page furthest from "near" goes.
      set: function (k, page, value, near) {
        if (k !== key) { items = {}; key = k; }
        items[page] = value;
        var keys = Object.keys(items);
        while (keys.length > limit) {
          var far = keys.reduce(function (a, b) { return Math.abs(a - near) >= Math.abs(b - near) ? a : b; });
          delete items[far]; keys = Object.keys(items);
        }
      },
      key: function () { return key; },
      clear: function () { items = {}; key = ""; },
      pages: function () { return Object.keys(items).map(Number).sort(function (a, b) { return a - b; }); }
    };
  }

  var api = { wanted: wanted, fit: fit, sizeKey: sizeKey, createCache: createCache };
  if (typeof module === "object" && module.exports) module.exports = api; else root.cmSlideCache = api;
})(typeof window !== "undefined" ? window : globalThis);
