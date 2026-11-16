/* Reading an ID cell of a class list: never guess (app/id-review.js), and the class list save uses it. */
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const { read } = require("../app/id-review");

test("IDs Excel has changed only in form are read; anything uncertain is listed, not guessed", () => {
  for (const v of ["22583439", " 22583439 ", "22583439.0", "022583439", 22583439]) assert.deepEqual(read(v), { status: "ok", id: "22583439" }, String(v));
  for (const v of ["2.2583439E7", "22583439.5", "123", "1234567890123", "A22583439"]) { const r = read(v); assert.equal(r.status, "ambiguous", v); assert.equal(r.id, ""); assert.ok(r.why); }
  for (const v of ["", "   ", "Student ID", null, undefined]) assert.equal(read(v).status, "blank");
});

test("22583439.0 is no longer turned into 225834390 on the way in", () => {
  const main = fs.readFileSync(path.join(__dirname, "..", "main.js"), "utf8");
  const start = main.indexOf('on("cm:classRows"');
  assert.ok(main.slice(start, start + 600).includes("idReview.read"));
  const setup = fs.readFileSync(path.join(__dirname, "..", "app", "setup.html"), "utf8");
  assert.ok(!/String\(r\[id\]\|\|""\)\.replace\(\/\\D\/g/.test(setup), "the setup screen no longer strips non-digits blindly");
  assert.ok(setup.includes('id="cl-amb"') && setup.includes("id-review.js"));
});
