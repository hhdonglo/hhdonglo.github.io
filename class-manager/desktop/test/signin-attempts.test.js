/* Sign-in problems: refused sign-ins are listed per ID with counts, times and reasons; no code is ever stored; the relay's refusals arrive the same way. */
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { classroom } = require("./classroom");
const SA = require("../rules/signin-attempts");
const L = require("../relay/live-attend");
const { fromBackend } = require("../rules/store");

const room = () => classroom({ students: 3, engine: "js" });
const dev = (n) => "phone" + n + "abcdefghijklmnopqrstuvwxyz";

test("wrong access codes are listed with the ID, the count and the reason, and the code is not kept", () => {
  const c = room(), [a, b] = c.students;
  for (let i = 0; i < 3; i++) c.call({ action: "my_results", id: a.id, code: "WRONG" + i });
  c.call({ action: "my_results", id: "99999999", code: "ZZZZZ" }); // not on the class list
  const l = SA.list(fromBackend(c.backend));
  const mine = l.items.find((x) => x.id === a.id), off = l.items.find((x) => x.id === "99999999");
  assert.equal(mine.attempts, 3); assert.equal(mine.name, a.name); assert.deepEqual(mine.reasons, ["wrong_code"]);
  assert.equal(off.onList, false); assert.deepEqual(off.reasons, ["not_on_list"]);
  assert.equal(l.stuck, 2);
  assert.ok(!JSON.stringify(c.backend.rawRows(SA.TAB)).match(/WRONG|ZZZZZ/), "no code is written");
  assert.equal(l.items.find((x) => x.id === b.id), undefined, "students who did not try are not listed");
});

test("signing in afterwards marks the ID as through, and a dismissal removes it", () => {
  const c = room(), a = c.students[0];
  c.call({ action: "my_results", id: a.id, code: "WRONG" });
  assert.equal(SA.list(fromBackend(c.backend)).stuck, 1);
  c.call({ action: "my_results", id: a.id, code: c.codes[a.id] });
  const l = SA.list(fromBackend(c.backend));
  assert.equal(l.stuck, 0); assert.equal(l.items[0].signedIn, true); assert.equal(l.items[0].attempts, 1);
  assert.deepEqual(SA.dismiss(fromBackend(c.backend), a.id), { ok: true });
  assert.equal(SA.list(fromBackend(c.backend)).items.length, 0);
});

test("a refused check-in is listed with its reason", () => {
  const c = room(), a = c.students[0];
  c.host("attend_open", { nogeo: "1" });
  c.call({ action: "attend", id: a.id, dev: dev(1), t: "deadbeef" });
  c.call({ action: "attend", id: "12", dev: dev(2), t: "deadbeef" });
  const l = SA.list(fromBackend(c.backend));
  assert.deepEqual(l.items.find((x) => x.id === a.id).reasons, ["old_qr"]);
  assert.deepEqual(l.items.find((x) => x.id === "12").reasons, ["bad_id"]);
});

test("refusals collected from the relay are recorded once, with the phone's own time", () => {
  const c = room(), store = fromBackend(c.backend), a = c.students[0], at = Math.floor(Date.now() / 1000) - 60;
  const ev = [{ id: 1, kind: "refused", label: "x #1", sid: a.id, dev: "abcd1234", note: "second_id", at }, { id: 2, kind: "refused", label: "x #1", sid: a.id, dev: "abcd1234", note: "wrong_unlock", at: at + 5 }, { id: 3, kind: "refused", label: "x #1", sid: a.id, dev: "", note: "nonsense", at }];
  const r = L.applyEvents(store, ev);
  assert.equal(r.refused, 2, "an unknown reason is not recorded");
  const mine = SA.list(store).items[0];
  assert.equal(mine.attempts, 2); assert.deepEqual(mine.reasons, ["second_id", "wrong_unlock"]); assert.equal(mine.where[0], "Attendance (phone)");
});

test("every reason has words and the list is old-line safe", () => {
  assert.ok(Object.values(SA.FROM_ATTEND).every((k) => SA.REASONS[k]));
  const c = room(); assert.deepEqual(SA.list(fromBackend(c.backend)), { ok: true, items: [], stuck: 0 });
});
