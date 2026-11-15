/* The Apps Script's cheap speed fixes keep their behaviour: batch name filling, one-row code reset, memoised spreadsheet, tail-first Log lookup. */
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { classroom } = require("./classroom");

const roster = (c) => c.backend.rawRows("Roster").slice(1).map((r) => [String(r[0]), String(r[1] || "")]).filter((r) => r[0]); // blank trailing rows are what clearContent leaves

test("roster sync fills blank names in one pass and never overwrites a name", () => {
  const c = classroom({ students: 0 }); const b = c.backend;
  b.rosterSync([["20000001", ""], ["20000002", "Kojo"], ["20000003", ""]], true); b.flush();
  const r = c.host("roster_sync", {}); void r;
  const dry = JSON.parse(JSON.stringify(b.rosterSync([["20000001", "Ama"], ["20000002", "Other"], ["20000003", "Esi"], ["20000004", "New"]], false)));
  assert.ok(dry, "applies");
  assert.deepEqual(roster(c), [["20000001", "Ama"], ["20000002", "Kojo"], ["20000003", "Esi"], ["20000004", "New"]]);
  b.close();
});

test("with replace, names go to the right rows even though rows above them were removed", () => {
  const c = classroom({ students: 0 }); const b = c.backend;
  b.rosterSync([["20000001", "Gone"], ["20000002", ""], ["20000003", ""]], true); b.flush();
  b.rosterSync([["20000002", "Yaw"], ["20000003", "Esi"]], true); b.flush();
  assert.deepEqual(roster(c), [["20000002", "Yaw"], ["20000003", "Esi"]]);
  b.close();
});

test("dry run numbers are unchanged", () => {
  const c = classroom({ students: 2 }); const b = c.backend;
  const o = JSON.parse(JSON.stringify(b.rosterSync([["20000001", "A"], ["20000009", "Z"], ["12", "short"]], false)));
  assert.equal(o.ok, true); assert.equal(o.mode, "apply");
  b.close();
});

test("reset changes one row in place, keeps one row per ID and a fresh code", () => {
  const c = classroom({ students: 3 }); const b = c.backend;
  const before = c.host("access_codes", { op: "list" }).rows; const id = c.students[1].id;
  const old = before.find((x) => x.id === id).code;
  const r = c.host("access_codes", { op: "reset", id: "0" + id + ".0" });
  assert.equal(r.ok, true); const now = r.rows.find((x) => x.id === id).code;
  assert.notEqual(now, old);
  const rows = b.rawRows("Access_Codes").slice(1);
  assert.equal(rows.filter((x) => String(x[0]) === id).length, 1);
  assert.deepEqual(rows.map((x) => String(x[0])), c.students.map((s) => s.id), "same order, the row stayed where it was");
  assert.equal(c.host("access_codes", { op: "reset", id: "99999999" }).ok, false);
  b.close();
});

test("a duplicated code row is collapsed to one by reset", () => {
  const c = classroom({ students: 2 }); const id = c.students[0].id;
  c.editWorkbook((book) => { const s = book.sheets.find((x) => x.name === "Access_Codes"); s.rows.push([id, "OLD-DUPE", new Date().toISOString()]); });
  const r = c.host("access_codes", { op: "reset", id });
  assert.equal(r.ok, true);
  assert.equal(c.backend.rawRows("Access_Codes").slice(1).filter((x) => String(x[0]) === id).length, 1);
  c.backend.close();
});

test("lastOutcome_ finds a newest line near the end and an old one far back", () => {
  const c = classroom({ students: 1 }); const b = c.backend;
  const rows = [["Time", "Outcome", "First Name", "ID", "Join Code"]];
  rows.push(["t", "OLD", "n", "20000001", "ABC"]);
  for (let i = 0; i < 1300; i++) rows.push(["t", "x" + i, "n", "3000" + (i % 50), "ZZZ"]);
  rows.push(["t", "NEW", "n", "20000002", "ABC"]);
  b.setRows("Log", rows);
  const q = (id) => c.get({ action: "result", code: "ABC", id });
  assert.equal(q("20000001").outcome, "OLD", "an old line far back is still found");
  assert.equal(q("20000002").outcome, "NEW", "the newest line is found");
  assert.equal(q("20000003").outcome, "", "no line, no outcome");
  b.close();
});
