/* A second launch of CM quits and shows the first; the first one just keeps going. */
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { ensureSingle } = require("../single-instance");

function fakeApp(lock) { const a = { quit: 0, handlers: {}, requestSingleInstanceLock: () => lock, quitNow() {}, on(ev, f) { a.handlers[ev] = f; } }; a.quit = () => { a.quitCalled = true; }; return a; }

test("the first launch carries on and shows its window when a second launch happens", () => {
  const app = fakeApp(true), calls = [], w = { isMinimized: () => true, restore: () => calls.push("restore"), show: () => calls.push("show"), focus: () => calls.push("focus") };
  assert.equal(ensureSingle(app, () => w), true);
  assert.ok(!app.quitCalled);
  app.handlers["second-instance"]();
  assert.deepEqual(calls, ["restore", "show", "focus"]);
});

test("a second launch quits without registering anything", () => {
  const app = fakeApp(false);
  assert.equal(ensureSingle(app, () => null), false);
  assert.equal(app.quitCalled, true);
  assert.equal(app.handlers["second-instance"], undefined);
});

test("a second launch with no window yet does nothing", () => {
  const app = fakeApp(true); ensureSingle(app, () => null);
  assert.doesNotThrow(() => app.handlers["second-instance"]());
});
