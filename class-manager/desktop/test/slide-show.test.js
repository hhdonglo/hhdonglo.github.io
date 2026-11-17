"use strict";
// Smooth slide changes (app/lecture-view/slide-cache.js and slide-show.js): the slide on screen is replaced only by a page that is already drawn,
// the neighbouring pages are drawn in advance, and a page drawn for another screen size is never shown. Plain functions, no screen, no PDF.
const test = require("node:test");
const assert = require("node:assert");
const C = require("../app/lecture-view/slide-cache");
const SS = require("../app/lecture-view/slide-show");

const tick = () => new Promise((r) => setImmediate(r));
const settle = async () => { for (let i = 0; i < 20; i++) await tick(); };

// A fake renderer: draw() takes "ms" milliseconds per page (a gate the test opens by hand) and records what it was asked for.
function rig(pages, opts) {
  const log = { drawn: [], painted: [], shown: [] }, gates = {};
  let box = { w: 1280, h: 720, dpr: 1 };
  const show = SS.create({
    pages, max: (opts && opts.max) || 5, size: () => box,
    draw: (page, size, stale) => new Promise((res) => {
      const finish = () => { if (stale()) return res(null); log.drawn.push(page + "@" + size.w); res({ page, w: size.w }); };
      if (opts && opts.manual) gates[page] = finish; else finish();
    }),
    paint: (d) => log.painted.push(d.page + "@" + d.w), shown: (p) => log.shown.push(p)
  });
  return { show, log, gates, resize(w, h) { box = { w, h, dpr: 1 }; } };
}

test("pages to have ready: the current one, then next, previous and after next, never outside the slides", () => {
  assert.deepStrictEqual(C.wanted(5, 20), [5, 6, 4, 7]);
  assert.deepStrictEqual(C.wanted(1, 20), [1, 2, 3]);
  assert.deepStrictEqual(C.wanted(20, 20), [20, 19]);
  assert.deepStrictEqual(C.wanted(1, 1), [1]);
});

test("a page is drawn to fit the whole screen, keeping its proportions; sharpness is capped", () => {
  const f = C.fit(960, 540, 1280, 720, 1);
  assert.deepStrictEqual([f.cssW, f.cssH, f.pxW, f.pxH], [1280, 720, 1280, 720]);
  const tall = C.fit(540, 960, 1280, 720, 2);
  assert.strictEqual(tall.cssH, 720); assert.strictEqual(tall.cssW, 405); assert.strictEqual(tall.pxH, 1440);
  assert.strictEqual(C.fit(960, 540, 1280, 720, 5).pxW, 2560); // never more than twice
  assert.ok(C.fit(0, 0, 0, 0, 0).pxW >= 1); // no division by nothing
});

test("the cache keeps the pages nearest the current one and forgets the rest; a new size empties it", () => {
  const c = C.createCache(3);
  [1, 2, 3, 4].forEach((p) => c.set("a", p, { p }, 4));
  assert.deepStrictEqual(c.pages(), [2, 3, 4]);
  c.set("b", 9, { p: 9 }, 9);
  assert.deepStrictEqual(c.pages(), [9]);
  assert.strictEqual(c.get(2), null);
});

test("changing slide never paints anything but a finished page; the old slide stays until then", async () => {
  const r = rig(10, { manual: true });
  const first = r.show.show(1); await settle(); r.gates[1](); await first;
  assert.deepStrictEqual(r.log.painted, ["1@1280"]);
  const next = r.show.show(5); await settle();
  assert.deepStrictEqual(r.log.painted, ["1@1280"], "nothing is painted while page 5 is still being drawn");
  r.gates[5](); await next;
  assert.deepStrictEqual(r.log.painted, ["1@1280", "5@1280"]);
});

test("the next, previous and after-next pages are drawn in advance, so the next change is immediate", async () => {
  const r = rig(10);
  await r.show.show(3); await settle();
  assert.deepStrictEqual(r.show.cached(), [2, 3, 4, 5]);
  const before = r.log.drawn.length;
  await r.show.show(4); // already drawn: painted without drawing again
  assert.strictEqual(r.log.painted[r.log.painted.length - 1], "4@1280");
  assert.ok(r.log.drawn.indexOf("4@1280") >= 0 && r.log.drawn.filter((d) => d === "4@1280").length === 1);
  await settle(); assert.ok(r.show.cached().indexOf(6) >= 0 && r.log.drawn.length > before, "page 6 is now drawn in advance");
});

test("the last request wins: pages skipped over quickly are not painted", async () => {
  const r = rig(30, { manual: true });
  const a = r.show.show(1); await settle(); r.gates[1](); await a;
  const p2 = r.show.show(2), p3 = r.show.show(3), p4 = r.show.show(4); await settle();
  r.gates[4](); await p4; r.gates[3] && r.gates[3](); r.gates[2] && r.gates[2](); await Promise.all([p2, p3]); await settle();
  assert.deepStrictEqual(r.log.painted.filter((x) => !x.startsWith("1@")), ["4@1280"]);
  assert.strictEqual(r.show.current(), 4);
});

test("a screen size change drops the pages drawn at the old size and redraws the current one before replacing it", async () => {
  const r = rig(10, { manual: true });
  const a = r.show.show(2); await settle(); r.gates[2](); await a;
  r.resize(1000, 600);
  const b = r.show.resize(); await settle();
  assert.deepStrictEqual(r.log.painted, ["2@1280"], "the old slide stays until the new size is drawn");
  r.gates[2](); await b;
  assert.deepStrictEqual(r.log.painted, ["2@1280", "2@1000"]);
  assert.ok(r.show.cached().every((p) => p === 2 || r.log.drawn.indexOf(p + "@1000") >= 0), "nothing at the old size is kept");
});

test("a failed draw is reported so the presentation can use the built-in viewer instead", async () => {
  const bad = SS.create({ pages: 3, size: () => ({ w: 10, h: 10, dpr: 1 }), draw: () => Promise.reject(new Error("broken")), paint() { assert.fail("painted"); }, shown() {} });
  await assert.rejects(bad.show(1), /broken/);
});
