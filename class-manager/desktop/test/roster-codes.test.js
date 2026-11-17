/* A student who is on the class list is never told "not on the class list, or has no access code yet" just because the lecturer never opened the Access codes page:
   opening attendance issues a code to every listed student who has none. */
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("crypto");
const AT = require("../rules/attendance");
const AC = require("../rules/access-codes");
const { fromBackend } = require("../rules/store");
const { classroom } = require("./classroom");

const dev = (n) => "device" + n + "abcdefghijklmnopqrstuvwxyz";
const tokenOf = (store) => AT.linkFor(AT.openSession(store).secret, Math.floor(Date.now() / 30000));

test("a listed student with no code yet is shown one when attendance opens", () => {
  const c = classroom({ students: 3, engine: "js" }), store = () => fromBackend(c.backend);
  const fresh = classroom({ students: 0, engine: "js" });
  fresh.backend.rosterSync(c.students.map((s) => [s.id, s.name]), true); // a class list saved from the roster page: no codes were ever generated
  const st = () => fromBackend(fresh.backend);
  assert.deepEqual(AC.codesMap(st()), {}, "starting point: nobody has a code");
  assert.equal(fresh.host("attend_open", { nogeo: "1" }).ok, true);
  assert.equal(Object.keys(AC.codesMap(st())).length, 3, "opening attendance issued a code to each listed student");
  const t = tokenOf(st()), a = c.students[0];
  const r = fresh.call({ action: "claim_code", id: a.id, dev: dev(1), t });
  assert.equal(r.ok, true, "the listed ID is shown its code, not 'not recognised'"); assert.ok(r.code);
  assert.equal(fresh.call({ action: "attend", id: a.id, dev: dev(1), t, code: r.code }).ok, true);
  fresh.backend.close(); c.backend.close(); void store;
});

test("opening attendance keeps the codes students already have", () => {
  const c = classroom({ students: 2, engine: "js" }), st = () => fromBackend(c.backend);
  const before = AC.codesMap(st()); assert.equal(Object.keys(before).length, 2);
  assert.equal(c.host("attend_open", { nogeo: "1" }).ok, true);
  const after = AC.codesMap(st()); Object.keys(before).forEach((id) => assert.equal(after[id].code, before[id].code));
  c.backend.close();
});

test("a student added to the class list after the codes were made is issued a code at the next opening", () => {
  const c = classroom({ students: 2, engine: "js" }), st = () => fromBackend(c.backend);
  c.backend.rosterSync([["20000001", "A"], ["20000002", "B"], ["20000099", "New"]], true);
  assert.equal(AC.codesMap(st())["20000099"], undefined);
  assert.equal(c.host("attend_open", { nogeo: "1" }).ok, true);
  assert.ok(AC.codesMap(st())["20000099"]);
  void crypto; c.backend.close();
});
