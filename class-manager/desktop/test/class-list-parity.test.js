/* rules/class-list.js gives the same answers and the same tabs as the Apps Script (sync, tidy, edit, notes). */
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { classroom } = require("./classroom");
const CL = require("../rules/class-list");
const { fromBackend } = require("../rules/store");

const grid = (c, tab) => (c.backend.rawRows(tab) || []).map((r) => { const w = r.map((x) => (x instanceof Date ? "<date>" : String(x == null ? "" : x))); while (w.length && w[w.length - 1] === "") w.pop(); return w; }).filter((r) => r.length); // the sheet shim leaves blank rows after a replace
function pair(n, setup) {
  const script = classroom({ students: n }), mod = classroom({ students: n });
  if (setup) [script, mod].forEach((c) => c.editWorkbook(setup));
  const run = (f, p) => CL[f](fromBackend(mod.backend), p);
  return { script, mod, run, close: () => { script.backend.close(); mod.backend.close(); } };
}
const sheet = (b, name) => b.sheets.find((x) => x.name === name);
const norm = (r) => JSON.parse(JSON.stringify(r, (k, v) => (k === "_session" ? undefined : v)));
const same = (a, b) => assert.deepEqual(norm(a), norm(b));

test("sync: dry run, apply, names filled, replace", () => {
  const P = pair(3, (b) => { sheet(b, "Roster").rows[1][1] = ""; });
  const id0 = P.script.students[0].id, rows = JSON.stringify([[id0, "New Name"], ["30000001", "Added One"], ["12", "too short"], "30000002"]);
  const call = (p) => P.script.call(Object.assign({ kind: "roster_sync", hostkey: P.script.key }, p));
  for (const p of [{ rows, mode: "dry" }, { rows, mode: "apply" }, { rows, mode: "apply" }]) {
    const s = call(p), m = P.run("sync", p); same(m, s);
  }
  same(grid(P.mod, "Roster"), grid(P.script, "Roster"));
  const rep = { rows: JSON.stringify([[id0, ""], ["30000001", ""]]), mode: "apply", replace: "yes" };
  same(P.run("sync", rep), call(rep)); same(grid(P.mod, "Roster"), grid(P.script, "Roster"));
  same(P.run("sync", { rows: "[]" }), call({ rows: "[]" })); same(P.run("sync", { rows: "{" }), call({ rows: "{" }));
  P.close();
});

test("edit: add, remove, check and refusals", () => {
  const P = pair(2), id = P.script.students[0].id, host = (p) => P.script.host("roster_edit", p);
  for (const p of [{ op: "check", id }, { op: "add", id: "40000001", name: "  A  Name " }, { op: "add", id: "40000001" }, { op: "remove", id }, { op: "remove", id }, { op: "check", id }, { op: "add", id: "12" }, { op: "nope", id }])
    same(P.run("edit", p), host(p));
  same(grid(P.mod, "Roster"), grid(P.script, "Roster"));
  P.close();
});

test("tidy removes unmarked rows of IDs not on the list and keeps marked ones", () => {
  const setup = (b) => {
    const att = sheet(b, "Attendance") || (b.sheets.push({ name: "Attendance", id: 99, rows: [] }), sheet(b, "Attendance"));
    att.rows = [["Student ID", "Wk 1"], ["50000001", 0], ["50000002", 1], ["20000001", 1]];
    const sc = sheet(b, "Scores") || (b.sheets.push({ name: "Scores", id: 98, rows: [] }), sheet(b, "Scores"));
    sc.rows = [["t"], ["t"], ["t"], ["50000003", "n", "x", "y", "", ""], ["50000004", "n", "x", "y", "", 5]];
  };
  const P = pair(2, setup);
  for (const p of [{ mode: "dry" }, { mode: "apply" }, { mode: "apply" }]) same(P.run("tidy", p), P.script.host("roster_tidy", p));
  for (const t of ["Attendance", "Scores"]) same(grid(P.mod, t), grid(P.script, t));
  P.close();
});

test("notes: the ID must be on the list", () => {
  const P = pair(2), id = P.script.students[0].id;
  same(CL.noteAdd(fromBackend(P.mod.backend), id, " hello "), P.script.host("student_note", { id, text: " hello " }));
  same(CL.noteAdd(fromBackend(P.mod.backend), "99999999", "x"), P.script.host("student_note", { id: "99999999", text: "x" }));
  same(CL.noteAdd(fromBackend(P.mod.backend), id, ""), P.script.host("student_note", { id, text: "" }));
  same(grid(P.mod, "Student_Notes").map((r) => r.slice(1)), grid(P.script, "Student_Notes").map((r) => r.slice(1)));
  P.close();
});
