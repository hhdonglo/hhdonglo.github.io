/* The rules/ modules give the same answers as the Apps Script on the same workbook. Only the shape of a code is checked here; the access-code rules themselves are in test/access-codes.test.js (the script still makes codes for everyone). */
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const AC = require("../rules/access-codes");

test("a code is easy to read: no 0, O, 1, I or L", () => {
  for (let i = 0; i < 200; i++) { const c = AC.newCode(); assert.equal(c.length, 5); assert.ok(!/[01OIL]/.test(c)); }
  assert.equal(AC.normCode("ab c-d2"), "ABCD2"); assert.equal(AC.normCode("abcd 2345"), "ABCD-2345", "the older printed form still works"); assert.equal(AC.normCode("abc"), "");
});
