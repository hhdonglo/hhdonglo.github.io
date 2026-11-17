/* A tool opened from CM has one window: asking again brings it to the front, and each course keeps its own. */
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { createWindowRegistry, keyOf } = require("../window-registry");

function fakeWindow(url) {
  const w = { url, calls: [], min: false, dead: false, handlers: {},
    isDestroyed() { return this.dead; }, isMinimized() { return this.min; },
    restore() { this.min = false; this.calls.push("restore"); }, show() { this.calls.push("show"); }, focus() { this.calls.push("focus"); },
    once(ev, f) { this.handlers[ev] = f; }, webContents: { getURL() { return w.url; } } };
  return w;
}
const U = (course, page) => "http://127.0.0.1:8080/c/" + course + "/" + page;

test("the key ignores the query and the # part", () => {
  assert.equal(keyOf(U("a", "quiz-host.html?code=1#x")), "/c/a/quiz-host.html");
});

test("a second request focuses the open window and opens nothing", () => {
  const r = createWindowRegistry(), w = fakeWindow(U("a", "attendance.html"));
  r.track(w.url, w);
  assert.equal(r.focusExisting(U("a", "attendance.html")), true);
  assert.deepEqual(w.calls, ["show", "focus"]);
});

test("a minimised window is restored first", () => {
  const r = createWindowRegistry(), w = fakeWindow(U("a", "quiz-display.html")); w.min = true;
  r.track(w.url, w);
  r.focusExisting(U("a", "quiz-display.html"));
  assert.deepEqual(w.calls, ["restore", "show", "focus"]);
});

test("another course or another tool is a different window", () => {
  const r = createWindowRegistry(), w = fakeWindow(U("a", "attendance.html"));
  r.track(w.url, w);
  assert.equal(r.focusExisting(U("b", "attendance.html")), false);
  assert.equal(r.focusExisting(U("a", "quiz-host.html")), false);
  assert.deepEqual(w.calls, []);
});

test("a closed or destroyed window is forgotten and may be opened again", () => {
  const r = createWindowRegistry(), w = fakeWindow(U("a", "attendance.html"));
  r.track(w.url, w); w.handlers.closed();
  assert.equal(r.focusExisting(w.url), false);
  const v = fakeWindow(U("a", "codes.html")); r.track(v.url, v); v.dead = true;
  assert.equal(r.focusExisting(v.url), false);
});

test("a window that moved to another page is found by the page it shows now", () => {
  const w = fakeWindow(U("a", "home.html")), r = createWindowRegistry(() => [w]);
  assert.equal(r.focusExisting(U("a", "home.html")), true);
  w.url = U("a", "setup.html");
  assert.equal(r.focusExisting(U("a", "home.html")), false);
  assert.equal(r.focusExisting(U("a", "setup.html")), true);
});
