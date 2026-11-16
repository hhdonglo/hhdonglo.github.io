/* The lecturer opens attendance in CM: the relay session opens too, the attendance page is told where phones go, check-ins made on the relay while CM is idle
   are recorded, and closing collects the rest and closes the relay session. A relay problem leaves the local answer unchanged. */
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { createHub } = require("../relay/hub");
const { createLiveSession } = require("../relay/live-session");
const AT = require("../rules/attendance");
const { fromBackend } = require("../rules/store");
const { classroom } = require("./classroom");

let hubWorker, FakeD1, setup;
test.before(async () => { hubWorker = await import("../../relay/hub/worker.mjs"); FakeD1 = (await import("../../relay/hub/test/fake-d1.js")).fakeD1; setup = (await import("../../relay/hub/src/db.js")).setup; });
const fetchTo = (env) => async (url, init) => { const u = new URL(url); const r = await hubWorker.handle(new Request("https://hub.test" + u.pathname, init), env, Math.floor(Date.now() / 1000)); return { ok: r.status < 400, status: r.status, json: () => r.json() }; };

test("open, phones check in on the relay, close records everything", async () => {
  const DB = FakeD1(); await setup(DB); const env = { DB, RELAY_SECRET: "test-secret-0123456789", POW_BITS: "8" };
  const c = classroom({ students: 2 }), [a] = c.students;
  const hub = createHub({ backend: c.backend, address: "https://hub.test", fetch: fetchTo(env), log: () => {} });
  const live = createLiveSession({ hub, backend: c.backend, address: () => "https://hub.test", pages: "https://pages.test/class-manager/", setInterval: () => 0, clearInterval: () => {} });
  const send = (action, extra) => { const params = Object.assign({ action, hostkey: c.key }, extra); const text = JSON.stringify(c.call(params)); return JSON.parse(live.after(params, text)); };
  const opened = send("attend_open", { nogeo: "1" }); assert.equal(opened.ok, true); assert.equal(opened.relay, undefined, "the relay session is not open yet when the answer is sent");
  await live.idle(); assert.equal(live.isOpen(), true);
  const st = send("attend_status"); assert.equal(st.relay.url, "https://hub.test"); assert.equal(st.relay.pages, "https://pages.test/class-manager/"); assert.ok(st.relay.course);
  const ses = AT.openSession(fromBackend(c.backend)), tok = AT.linkFor(ses.secret, Math.floor(Date.now() / 30000));
  const r = await (await fetchTo(env)("https://hub.test/v1/attend", { method: "POST", body: JSON.stringify({ course: st.relay.course, id: a.id, dev: "phone1abcdefghijklmnopqrstuvwxyz0", t: tok, code: c.codes[a.id] }) })).json();
  assert.equal(r.ok, true);
  await live.collect(); await live.idle(); assert.deepEqual(Object.keys(AT.present(fromBackend(c.backend), ses.label)), [a.id]);
  assert.equal(send("attend_close").ok, true); await live.idle(); assert.equal(live.isOpen(), false);
  assert.equal(send("attend_status").relay, undefined);
  const row = await DB.prepare("SELECT status FROM live_session").first(); assert.equal(row.status, "Closed");
  c.backend.close();
});

test("a relay that cannot be reached leaves the local answer as it was", async () => {
  const c = classroom({ students: 2 }), logs = [];
  const hub = createHub({ backend: c.backend, address: "https://down.test", fetch: async () => { throw new Error("offline"); }, log: () => {} });
  const live = createLiveSession({ hub, backend: c.backend, address: () => "https://down.test", pages: "p/", setInterval: () => 0, clearInterval: () => {}, log: (m) => logs.push(m) });
  const params = { action: "attend_open", hostkey: c.key, nogeo: "1" }, text = JSON.stringify(c.call(params));
  assert.equal(live.after(params, text), text); await live.idle();
  assert.equal(live.isOpen(), false); assert.ok(logs.length >= 1);
  const none = createLiveSession({ hub: null, backend: c.backend, address: () => "", pages: "p/" });
  assert.equal(none.after({ action: "attend_status" }, "{\"ok\":true}"), "{\"ok\":true}");
  c.backend.close();
});
