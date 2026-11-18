/* Back to Class Tools in the Attendance and Quiz windows: the main window comes to the front and the tool window closes; no second main window, no reload. */
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const { backToTools } = require("../back-to-tools");

const win = (url) => { const w = { url, calls: [], dead: false, min: false, isDestroyed: () => w.dead, isMinimized: () => w.min,
  restore() { w.min = false; w.calls.push("restore"); }, show() { w.calls.push("show"); }, focus() { w.calls.push("focus"); }, close() { w.dead = true; w.calls.push("close"); }, webContents: { getURL: () => w.url } }; return w; };

test("the main window is raised and the tool window closes; the main window is not touched otherwise", () => {
  const main = win("http://h/c/a/app/home.html#class"), tool = win("http://h/c/a/attendance.html");
  const r = backToTools({ from: tool, main: () => main, all: () => [main, tool], reopen: () => { throw new Error("no second window"); } });
  assert.equal(r.ok, true); assert.equal(r.closed, true); assert.equal(r.target, main);
  assert.deepEqual(main.calls, ["show", "focus"], "no reload, no navigation");
  assert.deepEqual(tool.calls, ["close"]);
});

test("a minimised main window is restored first", () => {
  const main = win("http://h/c/a/app/home.html"), quiz = win("http://h/c/a/quiz-host.html?code=1"); main.min = true;
  backToTools({ from: quiz, main: () => main, all: () => [main, quiz] });
  assert.deepEqual(main.calls, ["restore", "show", "focus"]);
});

test("if the main window is gone, another Class Tools window is used; a new one only as the last resort", () => {
  let tool = win("http://h/c/a/attendance.html"); const other = win("http://h/c/a/app/home.html#class"), dead = win("x"); dead.dead = true;
  assert.equal(backToTools({ from: tool, main: () => dead, all: () => [other, tool], reopen: () => { throw new Error("no"); } }).target, other);
  const fresh = win("http://h/c/a/app/home.html"); let n = 0;
  tool = win("http://h/c/a/quiz-host.html"); const r = backToTools({ from: tool, main: () => null, all: () => [tool], reopen: () => { n++; return fresh; } });
  assert.equal(n, 1); assert.equal(r.target, fresh);
});

test("asked from the main window itself nothing is closed", () => {
  const main = win("http://h/c/a/app/home.html");
  const r = backToTools({ from: main, main: () => main, all: () => [main], reopen: () => win("n") });
  assert.equal(r.closed, false); assert.ok(!main.calls.includes("close"));
});

test("both tool pages use the link and CM exposes it", () => {
  const root = path.join(__dirname, "..", "..");
  ["attendance.html", "quiz-host.html"].forEach((p) => { const t = fs.readFileSync(path.join(root, p), "utf8"); assert.match(t, /<a href="app\/home\.html#class" data-back-tools>/, p); assert.match(t, /assets\/back-to-tools\.js/, p); });
  assert.match(fs.readFileSync(path.join(__dirname, "..", "preload.js"), "utf8"), /backToTools: call\("cm:backToTools"\)/);
  assert.match(fs.readFileSync(path.join(__dirname, "..", "main.js"), "utf8"), /on\("cm:backToTools"/);
});
