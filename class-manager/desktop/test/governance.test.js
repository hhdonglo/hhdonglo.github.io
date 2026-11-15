"use strict";
const test = require("node:test"), assert = require("node:assert");
const g = require("../governance"), x = require("../extras");
function fake(tabs) { const t = JSON.parse(JSON.stringify(tabs)); return { rawRows: (n) => t[n] ? t[n].map((r) => r.slice()) : null, setRows: (n, r) => { t[n] = r.map((a) => a.slice()); }, tabs: () => Object.keys(t).map((name) => ({ name, rows: t[name].length })), _t: t }; }
const book = () => fake({
  Roster: [["Student ID", "Name", "Group"], ["10001", "Ama", "A"], ["10002", "Kofi", "B"]],
  Attendance: [["Student ID", "Name", "W1"], ["10001", "Ama", "x"], ["10002", "Kofi", ""]],
  Attempts: [["Timestamp", "Student ID", "Quiz"], ["t", "10001", "q1"], ["t", "10002", "q1"]],
  Notes: [["When", "ID", "Note"], ["t", "10001", "late"]],
  Other: [["a", "b"], ["10001", "no id column"]]
});
test("export collects rows by ID column and audits", () => {
  const b = book(), r = g.studentExport(b, "10001");
  assert.ok(r.ok); assert.deepEqual(Object.keys(r.tabs).sort(), ["Attempts", "Attendance", "Notes", "Roster"]);
  assert.equal(g.auditList(b)[0].action, "export");
  assert.equal(g.studentExport(b, "99999").ok, false);
});
test("erase needs the ID typed, removes every row, keeps others, logs without content", () => {
  const b = book();
  assert.equal(g.studentErase(b, "10001", "").ok, false);
  assert.equal(b._t.Roster.length, 3);
  const r = g.studentErase(b, "10001", "10001");
  assert.ok(r.ok); assert.equal(r.rows, 4);
  assert.equal(b._t.Roster.length, 2); assert.equal(b._t.Attempts.length, 2); assert.equal(b._t.Notes.length, 1);
  assert.equal(b._t.Other.length, 2);
  assert.equal(g.auditList(b)[0].action, "erase");
  assert.equal(g.studentExport(b, "10001").ok, false);
});
test("term close refuses student writes only", () => {
  const b = book();
  assert.equal(g.termClosed(b), false); g.setTerm(b, true); assert.ok(g.termClosed(b));
  assert.equal(g.closedRefusal({ action: "attend" }, true).why, "closed");
  assert.equal(g.closedRefusal({ kind: "attempt" }, true).why, "closed");
  assert.equal(g.closedRefusal({ action: "attend", hostkey: "k" }, true), null);
  assert.equal(g.closedRefusal({ action: "my_results" }, true), null);
  assert.equal(g.closedRefusal({ action: "attend" }, false), null);
  g.setTerm(b, false); assert.equal(g.termClosed(b), false);
  assert.deepEqual(g.auditList(b).map((a) => a.action), ["term reopened", "term closed"]);
});
test("roles", () => { assert.ok(g.can("lecturer", "erase")); assert.ok(!g.can("assistant", "erase")); assert.ok(!g.can("assistant", "export")); });
test("cohorts and interventions", () => {
  const b = book(); assert.deepEqual(x.cohorts(b), { 10001: "A", 10002: "B" });
  assert.equal(x.addIntervention(b, { ids: [], kind: "Check-in" }, 2).ok, false);
  const r = x.addIntervention(b, { ids: ["10001", "10002"], kind: "Check-in", note: "n" }, 2);
  assert.ok(r.ok); const l = x.interventions(b); assert.equal(l.length, 1); assert.deepEqual(l[0].ids, ["10001", "10002"]); assert.equal(l[0].afterQuiz, 2);
});
