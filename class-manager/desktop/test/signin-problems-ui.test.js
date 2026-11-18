/* The Sign-in problems card: wording, times, and that no code can appear. */
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const UI = require("../app/signin-problems.js");
const SA = require("../rules/signin-attempts");

test("every reason the rules can give has the same words on the screen", () => {
  Object.keys(SA.REASONS).filter((k) => k !== "ok").forEach((k) => assert.equal(UI.REASONS[k], SA.REASONS[k], k));
});
test("a row shows ID, name, tries, times and reasons, and escapes text", () => {
  const now = new Date(2026, 10, 18, 12, 0).getTime();
  const h = UI.html([{ id: "20000001", name: "<i>A</i>", attempts: 3, first: new Date(2026, 10, 18, 11, 5).toISOString(), last: new Date(2026, 10, 18, 11, 40).toISOString(), reasons: ["wrong_code", "second_id"], onList: true, signedIn: false }], now);
  assert.match(h, /20000001/); assert.match(h, /3 tries/); assert.match(h, /last 11:40/); assert.match(h, /first 11:05/); assert.match(h, /Wrong access code; Second ID/); assert.ok(!h.includes("<i>A</i>"));
  assert.equal(UI.html([]), "");
});
test("the card and the menu count are in the Attendance screen", () => {
  const home = fs.readFileSync(path.join(__dirname, "../app/home.html"), "utf8");
  assert.match(home, /id="signin-problems"/); assert.match(home, /id="signin-n"/); assert.match(home, /src="signin-problems\.js"/);
});
