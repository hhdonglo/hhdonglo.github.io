/* Phone outbox, mailbox sealing, the mailbox Worker, and CM collecting from it. No network: fetch is replaced by the Worker itself. */
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const outbox = require("../../assets/outbox");
const { seal } = require("../../assets/relay-seal");
const rc = require("../relay/crypto");
const { createRelay } = require("../relay/client");
const receipts = require("../receipts");
const { classroom } = require("./classroom");

const fakeStorage = () => { const m = {}; return { getItem: (k) => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); } }; };
const fakeKv = () => {
  const m = new Map();
  return {
    put: async (k, v) => { m.set(k, v); }, get: async (k) => (m.has(k) ? m.get(k) : null), delete: async (k) => { m.delete(k); },
    list: async ({ prefix, limit }) => { const keys = [...m.keys()].filter((k) => k.startsWith(prefix)).sort().slice(0, limit).map((name) => ({ name })); return { keys, list_complete: keys.length === [...m.keys()].filter((k) => k.startsWith(prefix)).length }; },
    size: () => m.size
  };
};
let worker;
const env = { BOX: fakeKv(), DROP_TOKEN: "drop-code-1234", PULL_TOKEN: "pull-code-0123456789" };
const toWorker = async (url, init) => worker.fetch(new Request(url, init), env);
test.before(async () => { worker = (await import("../../relay/worker.mjs")).default; });

test("a submission sealed on the phone is opened only by CM's private key", async () => {
  const keys = rc.generateKeys(), other = rc.generateKeys();
  const s = await seal(keys.publicKey, "attempt for 20001111");
  assert.ok(!JSON.stringify(s).includes("20001111"));
  assert.equal(rc.open(keys.privateKey, s), "attempt for 20001111");
  assert.throws(() => rc.open(other.privateKey, s));
  s.c = s.c.slice(0, -4) + "AAAA"; assert.throws(() => rc.open(keys.privateKey, s), "a changed message is refused");
});

test("the Worker takes sealed items with the student code, hands them only to CM, and removes what CM confirms", async () => {
  const sealed = { k: "a", iv: "b", c: "c" };
  const put = (b) => toWorker("https://box/put", { method: "POST", body: JSON.stringify(b) });
  assert.equal((await put({ course: "phys-143", drop: "wrong", sealed })).status, 403);
  assert.equal((await put({ course: "phys-143", drop: env.DROP_TOKEN, sealed })).status, 200);
  assert.equal((await put({ course: "phys-143", drop: env.DROP_TOKEN, sealed: { k: "x".repeat(20000), iv: "b", c: "c" } })).status, 413);
  const pull = (tok) => toWorker("https://box/pull", { method: "POST", headers: { Authorization: "Bearer " + tok }, body: JSON.stringify({ course: "phys-143" }) });
  assert.equal((await pull("nope")).status, 403);
  assert.equal((await pull(env.DROP_TOKEN)).status, 403, "the student code cannot read the mailbox");
  const got = await (await pull(env.PULL_TOKEN)).json();
  assert.equal(got.items.length, 1);
  const ack = await toWorker("https://box/ack", { method: "POST", headers: { Authorization: "Bearer " + env.PULL_TOKEN }, body: JSON.stringify({ ids: [got.items[0].id] }) });
  assert.equal((await ack.json()).removed, 1);
  assert.equal(env.BOX.size(), 0);
});

test("the outbox keeps a result until CM accepts it, and says what happened", async () => {
  let up = false; const sent = [];
  const fetch = async (url, init) => { if (!up) throw new TypeError("offline"); sent.push(init.body.get("ckey")); return { ok: true, text: async () => '{"ok":true}' }; };
  const timers = []; const states = [];
  const ob = outbox({ storage: fakeStorage(), fetch, config: { scriptUrl: "http://cm/exec" }, setTimeout: (f) => timers.push(f) });
  ob.send("attempt", { id: "20001111", quiz: "Q" }, (s) => states.push(s));
  await ob.flush();
  assert.equal(ob.pending(), 1, "still saved on the phone");
  assert.equal(states[0], "saved");
  up = true; await ob.flush();
  assert.equal(ob.pending(), 0); assert.equal(states.at(-1), "received"); assert.equal(sent.length, 1);
});

test("with a mailbox, a result CM cannot take is left there, encrypted, and CM collects it once", async () => {
  const keys = rc.generateKeys();
  const c = classroom({ students: 1 }); const stu = c.students[0];
  const cfg = { scriptUrl: "http://cm/exec", relay: { url: "https://box", key: keys.publicKey, drop: env.DROP_TOKEN, course: "phys-143" } };
  const fetch = async (url, init) => { if (url.startsWith("https://box")) return toWorker(url, init); throw new TypeError("CM is off"); };
  const ob = outbox({ storage: fakeStorage(), fetch, config: cfg, seal, setTimeout: () => {} });
  const states = [];
  ob.send("attempt", { id: stu.id, quiz: "Lecture 1 practice", attempt: "1", score: "7", total: "10" }, (s) => states.push(s));
  await ob.flush(); await ob.flush();
  assert.equal(states.at(-1), "held"); assert.equal(ob.pending(), 0);
  assert.equal(env.BOX.size(), 1, "one sealed item is waiting");

  // CM comes back: it collects, records, and the mailbox is empty. Collecting twice records nothing twice.
  const backend = c.backend;
  backend.setSecret("relay.url", "https://box"); backend.setSecret("relay.pull", env.PULL_TOKEN); backend.setSecret("relay.drop", env.DROP_TOKEN);
  backend.setSecret("relay.public", keys.publicKey); backend.setSecret("relay.private", keys.privateKey);
  const relay = createRelay({ backend, courseId: "phys-143", fetch: toWorker, log: () => {} });
  const before = (backend.tab("Attempts") || []).length;
  const r1 = await relay.pull();
  assert.equal(r1.ok, true); assert.equal(r1.received, 1);
  const after = (backend.tab("Attempts") || []).length;
  assert.ok(after > before, "the attempt is recorded");
  assert.equal(env.BOX.size(), 0, "removed from the mailbox after it was recorded");
  const r2 = await relay.pull(); assert.equal(r2.received, 0); assert.equal((backend.tab("Attempts") || []).length, after);
});

test("the same request sent twice is carried out once", () => {
  const c = classroom({ students: 1 }); const stu = c.students[0];
  const p = { kind: "attempt", id: stu.id, quiz: "L2", attempt: "1", score: "5", total: "10", ckey: "abc.def" };
  const run = () => c.backend.doPost(p, new URLSearchParams(p).toString());
  const a = receipts.once(c.backend, p, run);
  const after = (c.backend.tab("Attempts") || []).length;
  const b = receipts.once(c.backend, p, run);
  assert.equal((c.backend.tab("Attempts") || []).length, after, "the repeat added nothing");
  assert.equal(a.text, b.text);
});

test("the mailbox refuses kinds that need the room", async () => {
  const keys = rc.generateKeys(); const c = classroom({ students: 1 });
  const s = await seal(keys.publicKey, JSON.stringify({ ckey: "z1", params: { kind: "join", id: c.students[0].id, name: "X", code: "1" } }));
  const e2 = { BOX: fakeKv(), DROP_TOKEN: "drop-code-1234", PULL_TOKEN: "pull-code-0123456789" };
  const f = (u, i) => worker.fetch(new Request(u, i), e2);
  await f("https://box/put", { method: "POST", body: JSON.stringify({ course: "c", drop: e2.DROP_TOKEN, sealed: s }) });
  ["url", "pull", "drop", "public", "private"].forEach((k, i) => c.backend.setSecret("relay." + k, [ "https://box", e2.PULL_TOKEN, e2.DROP_TOKEN, keys.publicKey, keys.privateKey ][i]));
  const r = await createRelay({ backend: c.backend, courseId: "c", fetch: f, log: () => {} }).pull();
  assert.equal(r.received, 0); assert.equal(e2.BOX.size(), 0, "dropped, not kept");
});
