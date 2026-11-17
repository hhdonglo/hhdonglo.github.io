/* Class Manager: shows slides without a blink. One responsibility: decide when a slide is swapped in.
   The slide on screen stays exactly as it is until the next one has been drawn off screen; then the two are swapped in a single step.
   The next, previous and after-next pages are drawn in advance, so a change is normally immediate. Nothing here knows about PDF or the page:
   the renderer (slide-renderer.js) draws, and paint() puts a drawn page on screen. Used by present.js. */
(function (root) {
  "use strict";
  var C = root.cmSlideCache || (typeof require === "function" ? require("./slide-cache") : null);

  // o.pages: number of pages. o.size(): { w, h, dpr } of the box the slide fills. o.draw(page, size, stale): Promise of a drawn page (or null).
  // o.paint(drawn): put a drawn page on screen in one step. o.shown(page): called right after a page is on screen. o.max: pages kept.
  function create(o) {
    var cache = C.createCache(o.max || 5), want = 0, shownPage = 0, busy = {}, gen = 0;

    function sizeNow() { var s = o.size(); return { w: s.w, h: s.h, dpr: s.dpr, key: C.sizeKey(s.w, s.h, s.dpr) }; }
    function needed(page, myGen) { return myGen === gen && C.wanted(want, o.pages).indexOf(page) >= 0; }

    // Draw one page (once, even when asked for twice) and keep it. Resolves to the drawn page, or null when it was no longer needed.
    function prepare(page) {
      var size = sizeNow(), mine = gen, slot = size.key + "/" + page;
      if (cache.key() === size.key && cache.has(page)) return Promise.resolve(cache.get(page));
      if (busy[slot]) return busy[slot];
      busy[slot] = Promise.resolve().then(function () {
        if (!needed(page, mine)) return null;
        return o.draw(page, size, function () { return !needed(page, mine); });
      }).then(function (drawn) {
        delete busy[slot];
        if (drawn && mine === gen) cache.set(size.key, page, drawn, want);
        return drawn || null;
      }, function (err) { delete busy[slot]; throw err; });
      return busy[slot];
    }

    // Draw the neighbours one after another, never in front of the page the presenter is waiting for.
    function ahead() {
      var mine = gen, list = C.wanted(want, o.pages).slice(1);
      return list.reduce(function (chain, p) { return chain.then(function () { return mine === gen ? prepare(p).catch(function () {}) : null; }); }, Promise.resolve());
    }

    function commit(page, drawn) {
      if (page !== want) return;       // the presenter has moved on: a later call decides what is shown
      o.paint(drawn); shownPage = page; o.shown(page);
    }

    // Ask for a page. Resolves once it is on screen, or once a later request has replaced this one.
    function show(page) {
      want = page;
      var size = sizeNow(), hit = cache.key() === size.key ? cache.get(page) : null;
      if (hit) { commit(page, hit); ahead(); return Promise.resolve(true); }
      return prepare(page).then(function (drawn) { if (drawn) { commit(page, drawn); ahead(); return want === page; } return false; });
    }

    // The box changed size: pages drawn at the old size are dropped, and the slide on screen stays until the current page is drawn again.
    function resize() { gen++; busy = {}; cache.clear(); return want ? show(want) : Promise.resolve(false); }

    return { show: show, resize: resize, current: function () { return shownPage; }, cached: function () { return cache.pages(); }, stop: function () { gen++; want = 0; cache.clear(); } };
  }

  var api = { create: create };
  if (typeof module === "object" && module.exports) module.exports = api; else root.cmSlideShow = api;
})(typeof window !== "undefined" ? window : globalThis);
