/* The access code is not compulsory. It is asked only when a phone that is already registered to one ID is used again for a different ID. */
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const AT = require("../rules/attendance");
const { fromBackend } = require("../rules/store");
const { classroom } = require("./classroom");

const dev = (n) => "device" + n + "abcdefghijklmnopqrstuvwxyz";

test("first sign-in from a phone needs no code; a second ID on the same phone needs that ID's code", () => {
  const c = classroom({ students: 3, engine: "js" }), [a, b, d] = c.students;
  assert.equal(c.host("attend_open", { nogeo: "1" }).ok, true);
  const t = AT.linkFor(AT.openSession(fromBackend(c.backend)).secret, Math.floor(Date.now() / 30000));
  const go = (s, n, code) => c.call({ action: "attend", id: s.id, dev: dev(n), t, code: code || "" });
  assert.equal(go(a, 1).ok, true, "no code on the first sign-in");
  assert.equal(go(b, 2).ok, true, "a different student on a different phone: no code either");
  const none = go(d, 1); assert.equal(none.ok, false); assert.equal(none.why, "code required", "same phone, different ID: the code is asked");
  assert.equal(go(d, 1, "AAAA-AAAA").why, "not recognised", "a wrong code is refused");
  assert.equal(go(d, 1, c.codes[a.id]).why, "not recognised", "another student's code does not work");
  const held = go(d, 1, c.codes[d.id]); assert.equal(held.pending, true, "the right code is accepted, and the sign-in waits for the lecturer");
  assert.ok(c.host("attend_review", {}).items.some((i) => i.pending && i.ids.includes(d.id)));
  assert.equal(go(a, 1).already, true, "the owner of the phone is never asked");
  c.backend.close();
});

test("an ID not on the class list is never asked for a code", () => {
  const c = classroom({ students: 1, engine: "js" });
  assert.equal(c.host("attend_open", { nogeo: "1" }).ok, true);
  const t = AT.linkFor(AT.openSession(fromBackend(c.backend)).secret, Math.floor(Date.now() / 30000));
  const r = c.call({ action: "attend", id: "55555555", dev: dev(5), t }); assert.equal(r.ok, true); assert.equal(r.onList, false);
  c.backend.close();
});
