/* A class runs on the relay while CM is off: CM opens the session, phones check in against the hub Worker (fake D1), then CM collects and records it. */
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("crypto");
const { createHub } = require("../relay/hub");
const L = require("../relay/live-attend");
const AT = require("../rules/attendance");
const { fromBackend } = require("../rules/store");
const { classroom } = require("./classroom");

let hubWorker, FakeD1, setup;
test.before(async () => { hubWorker = await import("../../relay/hub/worker.mjs"); FakeD1 = (await import("../../relay/hub/test/fake-d1.js")).fakeD1; setup = (await import("../../relay/hub/src/db.js")).setup; });
const fetchTo = (env) => async (url, init) => { const u = new URL(url); const r = await hubWorker.handle(new Request("https://hub.test" + u.pathname, init), env, Math.floor(Date.now() / 1000)); return { ok: r.status < 400, status: r.status, json: () => r.json() }; };

test("CM opens, phones check in with CM off, CM collects once and records the same tabs", async () => {
  const DB = FakeD1(); await setup(DB); const env = { DB, RELAY_SECRET: "test-secret-0123456789", POW_BITS: "8" };
  const c = classroom({ students: 3 }), store = fromBackend(c.backend), [a, b] = c.students;
  const hub = createHub({ backend: c.backend, address: "https://hub.test", fetch: fetchTo(env), log: () => {} });
  const course = (await hub.register()).course;
  const o = { random: () => crypto.randomUUID(), geoMode: "off" };
  assert.equal(AT.open(store, { nogeo: "1" }, o).ok, true);
  const op = await L.openOnRelay(hub, store, course, "off"); assert.equal(op.ok, true); assert.equal(op.students, 3);
  const ses = AT.openSession(store), tok = AT.linkFor(ses.secret, Math.floor(Date.now() / 30000));
  const phone = async (s, d) => (await (await fetchTo(env)("https://hub.test/v1/attend", { method: "POST", headers: { "CF-Connecting-IP": "7.7.7." + d }, body: JSON.stringify({ course, id: s.id, dev: "phone" + d + "abcdefghijklmnopqrstuvwxyz", t: tok, code: c.codes[s.id] }) })).json());
  assert.equal((await phone(a, 1)).ok, true); assert.equal((await phone(b, 2)).ok, true); assert.equal((await phone(a, 1)).already, true);
  const got = await L.collect(hub, store); assert.equal(got.applied.added, 2); assert.equal(got.applied.binds, 2);
  assert.deepEqual(Object.keys(AT.present(store, ses.label)).sort(), [a.id, b.id].sort());
  assert.equal((await L.collect(hub, store)).applied.added, 0, "recorded once");
  assert.equal(Object.keys(AT.phones(store).byId).length, 2, "each phone is registered for the term");
  const closed = await L.closeOnRelay(hub); assert.equal(closed.ok, true);
  assert.equal(AT.close(store).ok, true); assert.deepEqual(AT.submit(store).submitted.length, 1);
  c.backend.close();
});
