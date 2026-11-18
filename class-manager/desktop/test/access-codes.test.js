/* Personal access codes: a student makes their own 5-letter code, the lecturer never sees it and can only reset it. */
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { classroom } = require("./classroom");
const AC = require("../rules/access-codes");
const { fromBackend } = require("../rules/store");

function fresh(n) {
  const c = classroom({ students: n, engine: "js" });
  c.editWorkbook((b) => { const s = b.sheets.find((x) => x.name === "Access_Codes"); if (s) s.rows = [s.rows[0]]; }); // nobody has a code yet
  return { c, st: () => fromBackend(c.backend), id: c.students[0].id, close: () => c.backend.close() };
}

test("nobody has a code until the student makes one, and the list never shows a code", () => {
  const P = fresh(3), r = AC.run(P.st(), { op: "list" });
  assert.equal(r.missing, 3); assert.ok(r.rows.every((x) => x.has === false && x.code === undefined));
  assert.equal(AC.run(P.st(), { op: "generate" }).made, 0, "the lecturer cannot make codes for everyone");
  P.close();
});

test("a student makes a 5-letter code once; a second try, a bad code and an unknown ID are refused", () => {
  const P = fresh(2);
  assert.equal(AC.setup(P.st(), P.id, "ab2k9").ok, true);
  assert.equal(AC.codesMap(P.st())[P.id].code, "AB2K9");
  assert.equal(AC.setup(P.st(), P.id, "ZZ3ZZ").why, "code exists", "only the lecturer's reset lets a student change it");
  assert.equal(AC.setup(P.st(), P.c.students[1].id, "abc").why, "bad code");
  assert.equal(AC.setup(P.st(), P.c.students[1].id, "AAAAA").why, "bad code", "one repeated character is refused");
  assert.equal(AC.setup(P.st(), "99999999", "ab2k9").why, "not recognised");
  assert.equal(AC.run(P.st(), { op: "list" }).missing, 1);
  P.close();
});

test("reset clears the code so the student can make a new one; an unknown ID is refused", () => {
  const P = fresh(2); AC.setup(P.st(), P.id, "AB2K9");
  assert.equal(AC.run(P.st(), { op: "reset", id: "99999999" }).ok, false);
  assert.equal(AC.run(P.st(), { op: "reset", id: P.id }).ok, true);
  assert.equal(AC.codesMap(P.st())[P.id], undefined);
  assert.equal(AC.setup(P.st(), P.id, "ZZ3ZK").ok, true);
  P.close();
});

test("an expired code is cleared by renew, and the student makes a new one", () => {
  const P = fresh(2); AC.setup(P.st(), P.id, "AB2K9"); AC.run(P.st(), { op: "expiry", days: 5 });
  P.c.editWorkbook((b) => { b.sheets.find((x) => x.name === "Access_Codes").rows[1][2] = new Date(Date.now() - 30 * 86400000).toISOString(); });
  assert.equal(AC.run(P.st(), { op: "list" }).expired, 1);
  assert.equal(AC.run(P.st(), { op: "renew" }).made, 1);
  assert.equal(AC.run(P.st(), { op: "list" }).expired, 0); assert.equal(AC.run(P.st(), { op: "list" }).missing, 2);
  P.close();
});

test("through the router: sign-in says 'no access code' first, the student makes a code and is signed in, a wrong code is refused", () => {
  const P = fresh(2), call = (x) => P.c.call(x);
  assert.equal(call({ action: "my_results", id: P.id, code: "AB2K9" }).why, "no access code");
  const s = call({ action: "code_setup", id: P.id, code: "ab2k9" }); assert.equal(s.ok, true); assert.ok(s._session, "a session to keep");
  assert.equal(call({ action: "code_setup", id: P.id, code: "ZZ3ZK" }).why, "code exists");
  assert.equal(call({ action: "my_results", id: P.id, code: "AB2K9" }).ok, true);
  assert.equal(call({ action: "my_results", id: P.id, code: "WRONG" }).ok, false);
  assert.equal(call({ action: "my_results", id: P.id, code: s._session }).ok, true);
  P.c.host("access_codes", { op: "reset", id: P.id });
  assert.equal(call({ action: "my_results", id: P.id, code: s._session }).ok, false, "a reset ends the sessions that code made");
  P.close();
});
