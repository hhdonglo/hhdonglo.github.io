/* Switch on lecturer control works for a week-shaped join code even when that week has no question bank yet. */
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { classroom } = require("./classroom");

test("init on a week-shaped code without a bank switches control on", () => {
  const c = classroom({ students: 2 });
  const code = "262750"; // week 50, not in the course's quiz list
  const r = c.host("control", { code, act: "init" });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(c.host("host", { code }).controlled, true);
  assert.equal(c.host("control", { code: "NOPE", act: "init" }).ok, false, "a code that is not a week is still refused");
});
