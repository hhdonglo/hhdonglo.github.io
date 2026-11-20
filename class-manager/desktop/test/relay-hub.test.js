/* CM's side of the relay hub against the real hub Worker (relay/hub/) with a fake D1: it registers by itself, a phone leaves a sealed item,
   CM collects it once, records it once, and the hub forgets it. No network, no Cloudflare. */
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { seal } = require("../../assets/relay-seal");
const outbox = require("../../assets/outbox");
const { createHub, courseIdOf } = require("../relay/hub");
const { relayAddress } = require("../relay/address");
const { classroom } = require("./classroom");

let hubWorker, FakeD1, setup;
test.before(async () => {
  hubWorker = await import("../../relay/hub/worker.mjs"); FakeD1 = (await import("../../relay/hub/test/fake-d1.js")).fakeD1; setup = (await import("../../relay/hub/src/db.js")).setup;
});
async function hubEnv() { const DB = FakeD1(); await setup(DB); return { DB, RELAY_SECRET: "test-secret-0123456789", POW_BITS: "8" }; }
const fetchTo = (env, clock) => async (url, init) => {
  const u = new URL(url); const r = await hubWorker.handle(new Request("https://hub.test" + u.pathname, init), env, clock ? clock() : Math.floor(Date.now() / 1000));
  return { ok: r.status < 400, status: r.status, json: () => r.json() };
};

test("CM registers the course by itself and phones need only the course id", async () => {
  const env = await hubEnv(), c = classroom({ students: 2 });
  const hub = createHub({ backend: c.backend, address: "https://hub.test", fetch: fetchTo(env), log: () => {} });
  assert.equal(hub.publicConfig(), null, "nothing before the first registration");
  const r = await hub.register(); assert.equal(r.ok, true);
  const pc = hub.publicConfig(); assert.equal(pc.hub, true); assert.equal(pc.course, r.course); assert.ok(pc.key);
  assert.equal((await hub.register()).course, r.course, "registering again changes nothing");
  assert.equal(await (async () => (await hubWorker.handle(new Request("https://hub.test/v1/course/" + r.course), env, Math.floor(Date.now() / 1000))).status)(), 200);
  c.backend.close();
});

test("a phone's sealed practice result is collected once, recorded once, and forgotten by the hub", async () => {
  const env = await hubEnv(), c = classroom({ students: 2 }), b = c.backend, id = c.students[0].id;
  const hub = createHub({ backend: b, address: "https://hub.test", fetch: fetchTo(env), log: () => {} });
  await hub.register(); const pc = hub.publicConfig();
  const ob = outbox({ storage: { getItem: () => null, setItem: () => {} }, fetch: fetchTo(env), config: { scriptUrl: "http://cm-is-off/exec", relay: pc }, seal, setTimeout: () => {} });
  void ob;
  const item = { ckey: "ck-1", params: { kind: "attempt", id, quiz: "Practice 1", attempt: "1", score: "4", total: "5" } };
  const sealed = await seal(pc.key, JSON.stringify(item));
  const drop = await fetchTo(env)("https://hub.test/v1/drop", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ course: pc.course, sealed }) });
  assert.equal(drop.ok, true);
  const first = await hub.pull(); assert.equal(first.ok, true); assert.equal(first.received, 1);
  const rows = b.rawRows("Attempts").slice(1).filter((r) => String(r[1]) === id); assert.equal(rows.length, 1, "recorded");
  const again = await hub.pull(); assert.equal(again.received, 0, "the hub forgot it after CM acknowledged");
  // the same item arriving twice (a retry) is still recorded once
  await fetchTo(env)("https://hub.test/v1/drop", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ course: pc.course, sealed }) });
  await hub.pull(); assert.equal(b.rawRows("Attempts").slice(1).filter((r) => String(r[1]) === id).length, 1, "one record, not two");
  b.close();
});

test("a disabled Practice module leaves queued attempts available for re-enable", async () => {
  const env = await hubEnv(), c = classroom({ students: 1, engine: "js" }), b = c.backend;
  try {
    const fetch = fetchTo(env), hub = createHub({ backend: b, address: "https://hub.test", fetch });
    await hub.register();
    const pc = hub.publicConfig(), enabled = b.enabledModules();
    const sealed = await seal(pc.key, JSON.stringify({ ckey: "practice-disabled",
      params: { kind: "attempt", id: c.students[0].id, quiz: "Lecture 1", score: "4", total: "5" } }));
    const dropped = await fetch("https://hub.test/v1/drop", { method: "POST", body: JSON.stringify({ course: pc.course, sealed }) });
    assert.equal(dropped.ok, true);
    b.saveModules(enabled.filter(id => id !== "practice"));
    assert.equal((await hub.pull()).received, 0);
    assert.ok((b.rawRows("Attempts") || []).length <= 1);
    b.saveModules(enabled);
    assert.equal((await hub.pull()).received, 1);
    assert.equal(b.rawRows("Attempts").length, 2);
    assert.equal((await hub.pull()).received, 0);
  } finally { b.close(); }
});

test("items of a kind that is not accepted are dropped, not recorded", async () => {
  const env = await hubEnv(), c = classroom({ students: 1 }), hub = createHub({ backend: c.backend, address: "https://hub.test", fetch: fetchTo(env), log: () => {} });
  await hub.register(); const pc = hub.publicConfig();
  const sealed = await seal(pc.key, JSON.stringify({ ckey: "x", params: { kind: "answer", id: c.students[0].id } }));
  await fetchTo(env)("https://hub.test/v1/drop", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ course: pc.course, sealed }) });
  assert.equal((await hub.pull()).received, 0); c.backend.close();
});

test("live state is pushed and phones read it; closing forgets the course", async () => {
  const env = await hubEnv(), c = classroom({ students: 1 }), hub = createHub({ backend: c.backend, address: "https://hub.test", fetch: fetchTo(env), log: () => {} });
  const { course } = await hub.register();
  await hub.pushState({ att: "open" });
  const page = await (await hubWorker.handle(new Request("https://hub.test/v1/course/" + course), env, Math.floor(Date.now() / 1000))).json();
  assert.deepEqual(page.state, { att: "open" });
  await hub.closeCourse(); assert.equal(hub.configured(), false);
  assert.equal((await hubWorker.handle(new Request("https://hub.test/v1/course/" + course), env, Math.floor(Date.now() / 1000))).status, 404);
  c.backend.close();
});

test("a restored course (keys kept, id lost) is recognised, a hub that is down is reported, and no address means no relay", async () => {
  const env = await hubEnv(), c = classroom({ students: 1 }), hub = createHub({ backend: c.backend, address: "https://hub.test", fetch: fetchTo(env), log: () => {} });
  const { course } = await hub.register(); c.backend.setSecret("hub.course", ""); // as after restoring from a backup that kept the keys
  assert.equal((await hub.register()).course, course);
  const down = createHub({ backend: c.backend, address: "https://hub.test", fetch: async () => { throw new TypeError("offline"); }, log: () => {} });
  const r = await down.pull(); assert.equal(r.ok, false); assert.match(r.why, /offline/);
  assert.equal(createHub({ backend: c.backend, address: "", log: () => {} }).publicConfig(), null);
  assert.equal(relayAddress({ CM_RELAY_URL: "" }, "/nonexistent"), ""); assert.equal(relayAddress({ CM_RELAY_URL: "https://cm-relay.example.workers.dev/" }), "https://cm-relay.example.workers.dev");
  assert.equal(relayAddress({ CM_RELAY_URL: "http://insecure" }, "/nonexistent"), "", "only https");
  c.backend.close();
});

test("the course id CM computes equals the one the hub computes", async () => {
  const { courseIdOf: hubId } = await import("../../relay/hub/src/crypto.js");
  const jwk = { x: "abc", y: "def" }; assert.equal(courseIdOf(jwk), await hubId(jwk));
});
