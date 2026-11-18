/* A second ID on a phone that already checked in someone else needs a one-time code that only the lecturer can issue.
   The first check-in on a phone needs no code at all (the personal access code is not used for attendance). */
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const AT = require("../rules/attendance");
const { fromBackend } = require("../rules/store");
const { classroom } = require("./classroom");

const dev = (n) => "device" + n + "abcdefghijklmnopqrstuvwxyz";
function setup() {
  const c = classroom({ students: 3, engine: "js" }), [a, b, d] = c.students;
  assert.equal(c.host("attend_open", { nogeo: "1" }).ok, true);
  const t = AT.linkFor(AT.openSession(fromBackend(c.backend)).secret, Math.floor(Date.now() / 30000));
  return { c, a, b, d, go: (s, n, code) => c.call({ action: "attend", id: s.id, dev: dev(n), t, code: code || "" }) };
}

test("no code on a first sign-in; a second ID on the same phone is refused and asks for the lecturer's code", () => {
  const { c, a, b, d, go } = setup();
  assert.equal(go(a, 1).ok, true); assert.equal(go(b, 2).ok, true);
  const r = go(d, 1); assert.deepEqual([r.ok, r.why], [false, "code required"]);
  assert.equal(go(d, 1, "ABCDE").why, "not recognised", "a code nobody issued is refused");
  const rv = c.host("attend_review", {}); const ask = rv.items.find((i) => i.unlock);
  assert.ok(ask && ask.ids[0] === d.id && ask.code === "", "the lecturer's list shows the request, with no code yet");
  assert.equal(c.host("attend_status", {}).session.waiting, 1);
  assert.equal(go(a, 1).already, true, "the phone's own student is never asked");
  c.backend.close();
});

test("the lecturer issues a code for that ID; entering it checks the student in once", () => {
  const { c, a, d, go } = setup(); go(a, 1); go(d, 1);
  const k = c.host("attend_unlock", { id: d.id }); assert.equal(k.ok, true); assert.match(k.code, /^[A-Z2-9]{5}$/);
  assert.equal(c.host("attend_review", {}).items.find((i) => i.unlock).code, k.code);
  const other = c.students[1]; assert.equal(go(other, 1, k.code).why, "not recognised", "the code is for that ID only");
  const ok = go(d, 1, k.code.toLowerCase()); assert.deepEqual([ok.ok, ok.onList, ok.pending], [true, true, undefined], "the right code goes straight through");
  const log = c.backend.rawRows("Attendance_Log").slice(1); assert.ok(log.some((r) => String(r[2]) === d.id));
  assert.equal(go(d, 1, k.code).already, true);
  assert.equal(AT.phones(fromBackend(c.backend)).byId[d.id], undefined, "the phone stays registered to its first student");
  const again = c.host("attend_unlock", { id: "99999999" }); assert.equal(again.ok, false);
  c.backend.close();
});

test("a code is used up: after a removed check-in the student must ask again; a wrong code counts as a failure", () => {
  const { c, a, d, go } = setup(); go(a, 1); go(d, 1);
  const k = c.host("attend_unlock", { id: d.id }); assert.equal(go(d, 1, k.code).ok, true);
  const lbl = c.host("attend_status", {}).session.label; c.host("attend_remove", { id: d.id, label: lbl });
  assert.equal(go(d, 1, k.code).why, "not recognised", "the same code cannot be used twice");
  const f = (n) => { for (let i = 0; i < n; i++) go(d, 1, "ZZZZZ"); return go(d, 1, "ZZZZZ").why; };
  assert.equal(f(8), "slow down", "repeated wrong codes are locked out for a while");
  c.backend.close();
});
