"use strict";
// The lecture view and presentation mode rules (app/lecture-view/state.js): where a lecture stands, which slides can be presented,
// keys, page movement, the timer and the page address. Plain functions, no screen.
const test = require("node:test");
const assert = require("node:assert");
const S = require("../app/lecture-view/state");

const P = { target: 12, held: 3, schedule: { due: { number: 5 }, next: { number: 4 }, missed: [{ number: 4 }, { number: 5 }] } };

test("a lecture is held, due and not yet held, due now, next or not yet due; no target gives no status", () => {
  assert.strictEqual(S.lectureState(2, P).key, "held");
  assert.strictEqual(S.lectureState(3, P).key, "held");
  assert.strictEqual(S.lectureState(4, P).label, "Due and not yet held");
  assert.strictEqual(S.lectureState(9, P).key, "later");
  assert.strictEqual(S.lectureState(5, { target: 12, held: 4, schedule: { due: { number: 5 }, next: { number: 5 }, missed: [] } }).key, "due");
  assert.strictEqual(S.lectureState(4, { target: 12, held: 3, schedule: { due: null, next: { number: 4 }, missed: [] } }).key, "next");
  assert.strictEqual(S.lectureState(1, null), null);
  assert.strictEqual(S.lectureState(1, { target: 0, held: 0 }), null);
  assert.strictEqual(S.lectureState(13, P), null);
  assert.strictEqual(S.lectureState(0, P), null);
});

test("only PDF slides can be presented; Word slides and no slides are told apart", () => {
  assert.strictEqual(S.slidesKind({ rel: "a/Lecture1.PDF" }), "pdf");
  assert.strictEqual(S.slidesKind({ rel: "a/lecture1.docx" }), "other");
  assert.strictEqual(S.slidesKind(null), "none");
});

test("keys: arrows, space and page keys move; Esc exits; letters work in either case; others do nothing", () => {
  assert.strictEqual(S.keyAction("ArrowRight"), "next"); assert.strictEqual(S.keyAction(" "), "next");
  assert.strictEqual(S.keyAction("ArrowLeft"), "prev"); assert.strictEqual(S.keyAction("PageUp"), "prev");
  assert.strictEqual(S.keyAction("Escape"), "exit"); assert.strictEqual(S.keyAction("B"), "blank");
  assert.strictEqual(S.keyAction("t"), "theme"); assert.strictEqual(S.keyAction("x"), null);
});

test("the page never leaves 1 to the last page", () => {
  assert.strictEqual(S.movePage(1, "prev", 10), 1);
  assert.strictEqual(S.movePage(10, "next", 10), 10);
  assert.strictEqual(S.movePage(4, "next", 10), 5);
  assert.strictEqual(S.movePage(4, "first", 10), 1);
  assert.strictEqual(S.movePage(4, "last", 10), 10);
  assert.strictEqual(S.movePage(1, "next", 1), 1);
  assert.strictEqual(S.clampPage(0, 5), 1); assert.strictEqual(S.clampPage(99, 5), 5); assert.strictEqual(S.clampPage(3, null), 1);
});

test("the timer reads mm:ss, and h:mm:ss from one hour", () => {
  assert.strictEqual(S.clock(0), "00:00"); assert.strictEqual(S.clock(65000), "01:05");
  assert.strictEqual(S.clock(3600000), "1:00:00"); assert.strictEqual(S.clock(-5), "00:00");
});

test("a page address replaces any earlier page and hides the viewer's toolbar", () => {
  const u = S.pageUrl("/lecture_1/slides.pdf#page=2", 7);
  assert.strictEqual(u.split("#").length, 2); assert.match(u, /^\/lecture_1\/slides\.pdf#page=7&toolbar=0/);
});
