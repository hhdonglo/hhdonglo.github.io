/* A student is shown their own access code at sign-in: through CM's own server (the js engine), and through the relay with CM off (CM sends the codes only for the open session). */
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("crypto");
const { createHub } = require("../relay/hub");
const L = require("../relay/live-attend");
const AT = require("../rules/attendance");
const { fromBackend } = require("../rules/store");
const { classroom } = require("./classroom");
const governance = require("../governance");
const { guardFor } = require("../attendance-guard");

const dev = (n) => "device" + n + "abcdefghijklmnopqrstuvwxyz";
const tokenOf = (store) => AT.linkFor(AT.openSession(store).secret, Math.floor(Date.now() / 30000));

test("CM's own server shows the code to the first phone only, and the lecturer can switch it off", () => {
  const c = classroom({ students: 2, engine: "js" }), store = () => fromBackend(c.backend), [a, b] = c.students;
  assert.equal(c.host("attend_open", { nogeo: "1" }).ok, true);
  const t = tokenOf(store()), claim = (s, d, extra) => c.call(Object.assign({ action: "claim_code", id: s.id, dev: dev(d), t }, extra));
  const r = claim(a, 1); assert.equal(r.ok, true); assert.equal(r.code, c.codes[a.id]);
  assert.equal(claim(a, 2).code, undefined); assert.equal(claim(a, 2).pending, true, "a second phone is held");
  assert.equal(claim(b, 1).code, undefined, "a phone registered to someone else is not shown another code");
  const off = claim({ id: "55555555" }, 5); assert.equal(off.ok, true); assert.equal(off.onList, false); assert.equal(off.code, undefined, "an ID off the class list is told so and shown no code");
  assert.equal(claim(a, 1, { t: "00000000" }).why, "old link");
  assert.equal(c.call({ action: "attend", id: a.id, dev: dev(1), t, code: r.code }).ok, true, "the code shown signs the student in");
  assert.ok(c.host("attend_review", {}).items.some((i) => i.pending && i.ids.includes(a.id)), "the lecturer sees the held request");
  c.host("attend_phone_reset", { id: a.id }); assert.equal(claim(a, 2).code, c.codes[a.id], "after the lecturer forgets the phone, the student can try again");
  store().setProp("code_claim", "0"); assert.equal(claim(b, 9).ok, false);
  c.backend.close();
});

test("a closed term and an off-network phone are refused like a check-in", () => {
  assert.ok(governance.closedRefusal({ action: "claim_code" }, true));
  assert.equal(guardFor({ remote: false, action: "claim_code", remoteAddress: "8.8.8.8" }).refuse.why, "not on network");
});

test("CM sends the codes to the relay for the open session only, and phones are shown them with CM off", async () => {
  const hubWorker = await import("../../relay/hub/worker.mjs"), { fakeD1 } = await import("../../relay/hub/test/fake-d1.js"), { setup } = await import("../../relay/hub/src/db.js");
  const DB = fakeD1(); await setup(DB); const env = { DB, RELAY_SECRET: "test-secret-0123456789", POW_BITS: "8" };
  const fetchTo = async (url, init) => { const u = new URL(url); const r = await hubWorker.handle(new Request("https://hub.test" + u.pathname, init), env, Math.floor(Date.now() / 1000)); return { ok: r.status < 400, status: r.status, json: () => r.json() }; };
  const c = classroom({ students: 2, engine: "js" }), store = fromBackend(c.backend), [a] = c.students;
  const hub = createHub({ backend: c.backend, address: "https://hub.test", fetch: fetchTo, log: () => {} }), course = (await hub.register()).course;
  assert.equal(AT.open(store, { nogeo: "1" }, { random: () => crypto.randomUUID(), geoMode: "off" }).ok, true);
  const op = await L.openOnRelay(hub, store, course, "off"); assert.equal(op.codes, 2);
  const phone = async (d) => (await (await fetchTo("https://hub.test/v1/claim", { method: "POST", headers: { "CF-Connecting-IP": "7.7.7." + d }, body: JSON.stringify({ course, id: a.id, dev: dev(d), t: tokenOf(store) }) })).json());
  assert.equal((await phone(1)).code, c.codes[a.id]); assert.equal((await phone(2)).pending, true);
  assert.equal((await L.collect(hub, store)).applied.binds, 1, "CM records the registered phone");
  assert.equal((await L.collect(hub, store)).applied.pending, 0, "already collected once");
  await L.closeOnRelay(hub);
  assert.equal((await DB.prepare("SELECT COUNT(*) AS n FROM live_code").first()).n, 0);
  store.setProp("code_claim", "0"); AT.close(store); AT.submit(store);
  assert.equal(AT.open(store, { nogeo: "1" }, { random: () => crypto.randomUUID(), geoMode: "off" }).ok, true);
  assert.equal((await L.openOnRelay(hub, store, course, "off")).codes, 0, "switched off: no code leaves this computer");
  c.backend.close();
});
