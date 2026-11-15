/* Removing single entries from any tab: set aside, never deleted, put back in place; a stale table is refused. */
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { classroom } = require("./classroom");
const RE = require("../remove-entry");
const RS = require("../remove-student");

function withLog() {
  const c = classroom({ students: 3 }); const b = c.backend;
  b.setRows("Notes_Demo", [["When", "ID", "Text"], ["t1", "20000001", "a"], ["t2", "20000002", "b"], ["t3", "20000001", "c"]]);
  return { c, b };
}

test("an entry is set aside, then put back in its place", () => {
  const { c, b } = withLog();
  const shown = b.tab("Notes_Demo");
  const r = RE.remove(b, "Notes_Demo", [{ index: 2, cells: shown[2] }]);
  assert.equal(r.ok, true); assert.equal(r.count, 1);
  assert.deepEqual(b.rawRows("Notes_Demo").map((x) => x[2]), ["Text", "a", "c"]);
  assert.equal(RE.removed(b).length, 1);
  assert.equal(RE.restore(b, r.batch).ok, true);
  assert.deepEqual(b.rawRows("Notes_Demo").map((x) => x[2]), ["Text", "a", "b", "c"], "same position");
  assert.equal(RE.removed(b).length, 0); b.close();
});

test("several entries in one go, one undo", () => {
  const { b } = withLog(); const s = b.tab("Notes_Demo");
  const r = RE.remove(b, "Notes_Demo", [{ index: 1, cells: s[1] }, { index: 3, cells: s[3] }]);
  assert.equal(r.count, 2); assert.deepEqual(b.rawRows("Notes_Demo").map((x) => x[2]), ["Text", "b"]);
  RE.restore(b, r.batch); assert.deepEqual(b.rawRows("Notes_Demo").map((x) => x[2]), ["Text", "a", "b", "c"]); b.close();
});

test("a table that changed, the header, or a removed-list tab is refused", () => {
  const { b } = withLog(); const s = b.tab("Notes_Demo");
  assert.equal(RE.remove(b, "Notes_Demo", [{ index: 2, cells: ["x", "y", "z"] }]).ok, false);
  assert.equal(RE.remove(b, "Notes_Demo", [{ index: 0, cells: s[0] }]).ok, false);
  assert.equal(RE.remove(b, "Removed_Entries", [{ index: 1, cells: [] }]).ok, false);
  assert.equal(RE.remove(b, "Nope", [{ index: 1, cells: [] }]).ok, false);
  assert.equal(b.rawRows("Notes_Demo").length, 4, "nothing was removed"); b.close();
});

test("removing a whole student and an entry are separate, and both can be undone", () => {
  const { c, b } = withLog();
  RS.remove(b, "20000001");
  assert.equal(b.rawRows("Roster").some((r) => String(r[0]) === "20000001"), false);
  assert.equal(b.rawRows("Notes_Demo").length, 4, "the student's log lines stay");
  RS.restore(b, "20000001"); assert.equal(b.rawRows("Roster").some((r) => String(r[0]) === "20000001"), true); b.close();
});
