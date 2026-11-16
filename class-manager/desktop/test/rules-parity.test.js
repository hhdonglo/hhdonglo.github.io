/* The rules/ modules give the same answers as the Apps Script on the same workbook. Codes are random, so they are compared by shape. */
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { classroom } = require("./classroom");
const AC = require("../rules/access-codes");
const { fromBackend } = require("../rules/store");

const FORMAT = /^[A-Z0-9]{4}-[A-Z0-9]{4}$/;
const shape = (r) => JSON.parse(JSON.stringify(r, (k, v) => (k === "_session" ? undefined : k === "code" && v ? (FORMAT.test(v) ? "<code>" : "BAD:" + v) : v)));
const body = (b) => b.rawRows("Access_Codes").slice(1).map((r) => [String(r[0]), FORMAT.test(String(r[1])) ? "<code>" : "BAD", r[2] instanceof Date || !isNaN(new Date(r[2]).getTime())]);
function pair(n, setup) {
  const a = classroom({ students: n }), b = classroom({ students: n });
  // the same class on both; the script's own codes from the helper are removed so both start with none
  [a, b].forEach((c) => c.editWorkbook((book) => { const s = book.sheets.find((x) => x.name === "Access_Codes"); if (s) s.rows = [s.rows[0]]; if (setup) setup(book); }));
  return { script: a, mod: b, store: fromBackend(b.backend), run: (p) => AC.run(fromBackend(b.backend), p) };
}
const both = (P, p) => ({ s: shape(P.script.host("access_codes", p)), m: shape(P.run(p)) });

test("list and generate give the same answer, and one code per student", () => {
  const P = pair(4);
  assert.deepEqual(both(P, { op: "list" }).m, both(P, { op: "list" }).s);
  const g = both(P, { op: "generate" }); assert.deepEqual(g.m, g.s); assert.equal(g.m.made, 4);
  assert.deepEqual(body(P.mod.backend), body(P.script.backend));
  const again = both(P, { op: "generate" }); assert.deepEqual(again.m, again.s); assert.equal(again.m.made, 0, "nothing new the second time");
  P.script.backend.close(); P.mod.backend.close();
});

test("expiry then renew gives the same counts", () => {
  const P = pair(3); both(P, { op: "generate" });
  const e = both(P, { op: "expiry", days: 5 }); assert.deepEqual(e.m, e.s); assert.equal(e.m.days, 5);
  const old = new Date(Date.now() - 30 * 86400000);
  [P.script, P.mod].forEach((c) => c.editWorkbook((book) => { const s = book.sheets.find((x) => x.name === "Access_Codes"); s.rows[1][2] = old.toISOString(); }));
  P.store = fromBackend(P.mod.backend); P.run = (p) => AC.run(P.store, p);
  const l = both(P, { op: "list" }); assert.deepEqual(l.m, l.s); assert.equal(l.m.expired, 1);
  const r = both(P, { op: "renew" }); assert.deepEqual(r.m, r.s); assert.equal(r.m.made, 1);
  assert.equal(both(P, { op: "list" }).m.expired, 0);
  P.script.backend.close(); P.mod.backend.close();
});

test("reset: one row stays where it was, unknown ID refused, a duplicated row collapses to one", () => {
  const P = pair(3); both(P, { op: "generate" }); const id = P.script.students[1].id;
  const r = both(P, { op: "reset", id: "0" + id + ".0" }); assert.deepEqual(r.m, r.s);
  assert.deepEqual(P.mod.backend.rawRows("Access_Codes").slice(1).map((x) => String(x[0])), P.script.students.map((s) => s.id));
  assert.deepEqual(both(P, { op: "reset", id: "99999999" }).m, both(P, { op: "reset", id: "99999999" }).s);
  [P.script, P.mod].forEach((c) => c.editWorkbook((book) => { book.sheets.find((x) => x.name === "Access_Codes").rows.push([id, "AAAA-BBBB", new Date().toISOString()]); }));
  P.store = fromBackend(P.mod.backend); P.run = (p) => AC.run(P.store, p);
  const d = both(P, { op: "reset", id }); assert.deepEqual(d.m, d.s);
  assert.deepEqual(body(P.mod.backend), body(P.script.backend));
  assert.equal(P.mod.backend.rawRows("Access_Codes").slice(1).filter((x) => String(x[0]) === id).length, 1);
  P.script.backend.close(); P.mod.backend.close();
});

test("a code is easy to read: no 0, O, 1, I or L", () => {
  for (let i = 0; i < 200; i++) assert.ok(!/[01OIL]/.test(AC.newCode().replace("-", "")));
  assert.equal(AC.normCode("abcd 2345"), "ABCD-2345"); assert.equal(AC.normCode("abc"), "");
});
