/* Unlisted IDs on the relay (laptop off): a phone with an ID off the class list is told so and signs in, CM holds the sign-in apart when it collects,
   and a quiz phone gets the same warning from the relay. The relay never gets the roster of names, only IDs. */
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("crypto");
const { createHub } = require("../relay/hub");
const L = require("../relay/live-attend");
const { createLiveQuiz } = require("../relay/live-quiz");
const AT = require("../rules/attendance");
const U = require("../rules/unlisted");
const { fromBackend } = require("../rules/store");
const { classroom } = require("./classroom");

let hubWorker, FakeD1, setup;
test.before(async () => { hubWorker = await import("../../relay/hub/worker.mjs"); FakeD1 = (await import("../../relay/hub/test/fake-d1.js")).fakeD1; setup = (await import("../../relay/hub/src/db.js")).setup; });
const OFF = "55555555", CODE = "26271";
const fetchTo = (env) => async (url, init) => { const u = new URL(url); const r = await hubWorker.handle(new Request("https://hub.test" + u.pathname, init), env, Math.floor(Date.now() / 1000)); return { ok: r.status < 400, status: r.status, json: () => r.json() }; };

test("attendance on the relay: an unlisted phone is told, signs in, and CM holds it apart on collecting", async () => {
  const DB = FakeD1(); await setup(DB); const env = { DB, RELAY_SECRET: "test-secret-0123456789", POW_BITS: "8" };
  const c = classroom({ students: 3 }), store = fromBackend(c.backend), [a] = c.students;
  const hub = createHub({ backend: c.backend, address: "https://hub.test", fetch: fetchTo(env), log: () => {} });
  const course = (await hub.register()).course;
  assert.equal(AT.open(store, { nogeo: "1" }, { random: () => crypto.randomUUID(), geoMode: "off" }).ok, true);
  assert.equal((await L.openOnRelay(hub, store, course, "off")).ok, true);
  const ses = AT.openSession(store), tok = AT.linkFor(ses.secret, Math.floor(Date.now() / 30000));
  const post = async (path, p, d) => (await (await fetchTo(env)("https://hub.test" + path, { method: "POST", headers: { "CF-Connecting-IP": "7.7.7." + d }, body: JSON.stringify(Object.assign({ course, dev: "phone" + d + "abcdefghijklmnopqrstuvwxyz", t: tok }, p)) })).json());
  const cl = await post("/v1/claim", { id: OFF }, 1); assert.deepEqual([cl.ok, cl.onList, cl.code], [true, false, undefined], "no code, the warning");
  const ci = await post("/v1/attend", { id: OFF, code: "" }, 1); assert.equal(ci.ok, true); assert.equal(ci.onList, false);
  assert.equal((await post("/v1/attend", { id: OFF, code: "" }, 1)).already, true);
  assert.equal((await post("/v1/attend", { id: a.id, code: c.codes[a.id] }, 2)).onList, true);
  const got = await L.collect(hub, store); assert.equal(got.applied.added, 2);
  assert.deepEqual(U.list(store).items.map((x) => [x.id, x.status, x.attendance.length]), [[OFF, "waiting", 1]]);
  assert.equal((await L.collect(hub, store)).applied.added, 0); assert.equal(U.recordsOf(store, OFF).length, 1, "collecting again holds nothing twice");
  AT.close(store); AT.submit(store);
  assert.equal(c.backend.rawRows("Attendance").slice(1).length, 3, "the grid has the class list only");
  c.backend.close();
});

test("a student added to the class list while their phone was signing in counts as listed", async () => {
  const c = classroom({ students: 2 }), store = fromBackend(c.backend);
  assert.equal(AT.open(store, { nogeo: "1" }, { random: () => crypto.randomUUID(), geoMode: "off" }).ok, true);
  const ses = AT.openSession(store);
  c.backend.rosterSync([[OFF, "Zed"]], false);
  const r = L.applyEvents(store, [{ kind: "ok", label: ses.label, sid: OFF, dev: "d", note: "No|", at: 1800000000 }]);
  assert.equal(r.added, 1); assert.equal(c.backend.rawRows("Attendance_Log").slice(1)[0][3], "Yes"); assert.equal(U.list(store).items.length, 0);
  c.backend.close();
});

test("a quiz on the relay: the phone with an unlisted ID gets the warning, CM holds its answers apart", async () => {
  const DB = FakeD1(); await setup(DB); const env = { DB, RELAY_SECRET: "test-secret-0123456789", POW_BITS: "8" }, clock = { t: Math.floor(Date.now() / 1000) };
  const fetchAt = async (url, init) => { const u = new URL(url); const r = await hubWorker.handle(new Request("https://hub.test" + u.pathname, init), env, clock.t); return { ok: r.status < 400, status: r.status, json: () => r.json() }; };
  const cm = classroom({ students: 4, engine: "js" });
  const hub = createHub({ backend: cm.backend, address: "https://hub.test", fetch: fetchAt, log: () => {} });
  const lq = createLiveQuiz({ hub, backend: cm.backend, address: () => "https://hub.test", pages: "https://pages.test/", log: (m) => { throw new Error(m); }, setInterval: () => 0, clearInterval: () => {} });
  const ctl = async (p) => { const r = cm.host("control", Object.assign({ code: CODE }, p)); lq.after({ action: "control", code: CODE }, JSON.stringify(r)); await lq.idle(); return r; };
  let ip = 0;
  const phone = async (params) => (await (await hubWorker.handle(new Request("https://hub.test/v1/quiz/call", { method: "POST", headers: { "CF-Connecting-IP": "8.8.8." + (++ip % 250) }, body: JSON.stringify({ course: hub.publicConfig().course, params }) }), env, clock.t)).json());
  try {
    await hub.register(); await ctl({ act: "init" }); await ctl({ act: "set", field: "q_seconds", value: "0" }); await ctl({ act: "start" });
    const j = await phone({ kind: "join", name: "Zed", id: OFF, code: CODE }); assert.deepEqual([j.ok, j.onList], [true, false]);
    assert.equal((await phone({ kind: "join", name: "S1", id: cm.students[0].id, code: CODE })).onList, undefined, "a listed student has no warning");
    assert.equal((await phone({ kind: "answer", name: "Zed", id: OFF, code: CODE, q: "1", answer: "B" })).onList, false);
    assert.equal((await phone({ kind: "answer", name: "S1", id: cm.students[0].id, code: CODE, q: "1", answer: "C" })).onList, undefined);
    await lq.collect(); await lq.idle();
    const live = cm.backend.rawRows("Answers").slice(1).filter((x) => x[0] !== "" && x[0] != null);
    assert.deepEqual(live.map((x) => String(x[1])), [cm.students[0].id], "only the listed student's answer is a live answer");
    assert.equal(U.recordsOf(fromBackend(cm.backend), OFF).filter((r) => r.kind === "quiz answer").length, 1, "the unlisted answer is held");
  } finally { cm.backend.close(); }
});
