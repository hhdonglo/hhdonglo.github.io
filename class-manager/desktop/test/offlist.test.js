/* IDs not on the class list: no row in Master or Scores, a review list, and rows already there set aside on request and restorable. */
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { classroom } = require("./classroom");
const O = require("../offlist");

const HEAD = ["Timestamp", "First Name", "ID", "Join Code", "Q1", "Q2", "Q3", "Q4", "Q5", "Score", "Round", "Questions", "Answers", "Week"];
const ids = (b, tab) => (b.rawRows(tab) || []).map((r) => String(r[0]));

test("a result for an ID not on the class list never becomes a row in Master or Scores", () => {
  const c = classroom({ students: 3 }), b = c.backend;
  b.setRows("Form Responses 1", [HEAD, [new Date(), "On", "20000001", "ABC1", 1, 1, 1, 1, 1, 5, 0, 5, "", 1], [new Date(), "Off", "22244230", "ABC1", 1, 1, 1, 1, 1, 5, 0, 5, "", 1]]);
  b.buildFromRoster(); b.rebuildMarks();
  assert.ok(ids(b, "Master").includes("20000001"));
  ["Master", "Scores"].forEach((t) => assert.ok(!ids(b, t).includes("22244230"), t));
  b.close();
});

test("rows already there for IDs not on the list are found, set aside only on request, and restored", () => {
  const c = classroom({ students: 3 }), b = c.backend;
  b.buildFromRoster();
  b.setRows("Master", b.rawRows("Master").concat([["22244230", "", ""], ["22521330", "Ghost", "", "3 / 5"]]));
  const s = O.scan(b);
  assert.equal(s.rows.length, 2); assert.equal(s.blank, 1); assert.equal(s.withRecords, 1);
  assert.equal(O.setAside(b, ["22244230"]).ok, true);
  assert.ok(!ids(b, "Master").includes("22244230")); assert.ok(ids(b, "Master").includes("22521330"));
  assert.equal(O.restore(b).ok, true);
  assert.ok(ids(b, "Master").includes("22244230"));
  assert.equal(O.setAside(b, ["20000001"]).ok, false, "a roster student is never set aside");
  b.close();
});

test("flagged IDs are listed once per file with the file name", () => {
  const c = classroom({ students: 1 }), b = c.backend;
  assert.equal(O.flag(b, [{ id: "22244230" }, { id: "22521330", why: "x" }], "a.xlsx"), 2);
  assert.equal(O.flag(b, [{ id: "22244230" }], "a.xlsx"), 0);
  assert.equal(O.flag(b, [{ id: "22244230" }], "b.xlsx"), 1);
  assert.equal(O.flagged(b).length, 3); b.close();
});
