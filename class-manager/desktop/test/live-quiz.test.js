/* A live quiz on the relay: phones join and answer through the hub while CM is "off", the hub admits answers by the same checks as the rules, and CM records
   what it collects through the quiz rules. CM runs against the real hub Worker (relay/hub/) with a fake D1. */
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { createHub } = require("../relay/hub");
const { createLiveQuiz } = require("../relay/live-quiz");
const { classroom } = require("./classroom");

let hubWorker, FakeD1, setup;
test.before(async () => {
  hubWorker = await import("../../relay/hub/worker.mjs"); FakeD1 = (await import("../../relay/hub/test/fake-d1.js")).fakeD1; setup = (await import("../../relay/hub/src/db.js")).setup;
});
const CODE = "26271";
let ip = 0;
async function rig() {
  const DB = FakeD1(); await setup(DB); const env = { DB, RELAY_SECRET: "test-secret-0123456789", POW_BITS: "8" }, clock = { t: Math.floor(Date.now() / 1000) };
  const fetchTo = async (url, init) => { const u = new URL(url); const r = await hubWorker.handle(new Request("https://hub.test" + u.pathname, init), env, clock.t); return { ok: r.status < 400, status: r.status, json: () => r.json() }; };
  const cm = classroom({ students: 4, engine: "js" }), twin = classroom({ students: 4, engine: "js" }); // the twin answers what the rules say, for comparison
  const hub = createHub({ backend: cm.backend, address: "https://hub.test", fetch: fetchTo, log: () => {} });
  const lq = createLiveQuiz({ hub, backend: cm.backend, address: () => "https://hub.test", pages: "https://pages.test/", log: (m) => { throw new Error(m); }, setInterval: () => 0, clearInterval: () => {} });
  const ctl = async (p) => { const r = cm.host("control", Object.assign({ code: CODE }, p)); const text = lq.after({ action: "control", code: CODE }, JSON.stringify(r)); await lq.idle(); twin.editWorkbook((b) => { const book = JSON.parse(cm.backend.exportText()); b.sheets = book.sheets; b.props = book.props; }); return JSON.parse(text); };
  const phone = async (params) => { const r = await hubWorker.handle(new Request("https://hub.test/v1/quiz/call", { method: "POST", headers: { "CF-Connecting-IP": "7.7.7." + (++ip % 250) }, body: JSON.stringify({ course: hub.publicConfig().course, params }) }), env, clock.t); return r.json(); };
  return { cm, twin, hub, lq, ctl, phone, env, clock };
}
const students = (R) => R.cm.students;

test("phones join, see the question and answer through the relay, and CM records it all once", async () => {
  const R = await rig();
  try {
    await R.hub.register();
    let r = await R.ctl({ act: "init" }); assert.equal(r.ok, true);
    await R.ctl({ act: "set", field: "q_seconds", value: "0" });
    assert.deepEqual(await R.phone({ action: "status", code: CODE }), { timed: false, known: false, state: "" }, "nothing is on the relay before the lobby");
    const start = await R.ctl({ act: "start" }); assert.equal(start.relay.course, R.hub.publicConfig().course, "the lecturer's page is told where phones go");
    const st = await R.phone({ action: "status", code: CODE }); assert.equal(st.known, true); assert.equal(st.state, "running"); assert.equal(st.currentQ, 1);
    const qs = await R.phone({ action: "questions", code: CODE }); assert.equal(qs.questions.length, 5); assert.ok(qs.questions[0].stem && !JSON.stringify(qs).includes("answer"), "question text only, never the key");
    // every outcome the relay gives is the one the rules give
    const cases = [{ kind: "join", name: "S1", id: students(R)[0].id, code: CODE }, { kind: "join", name: "S2", id: students(R)[1].id, code: CODE }, { kind: "answer", name: "S1", id: students(R)[0].id, code: CODE, q: "1", answer: "B" },
      { kind: "answer", name: "S2", id: students(R)[1].id, code: CODE, q: "1", answer: "Z" }, { kind: "answer", name: "S2", id: students(R)[1].id, code: CODE, q: "3", answer: "A" }, { kind: "answer", name: "S3", id: students(R)[2].id, code: CODE, q: "1", answer: "A" },
      { kind: "answer", name: "", id: students(R)[1].id, code: CODE, q: "1", answer: "A" }, { kind: "answer", name: "S2", id: students(R)[1].id, code: "99999", q: "1", answer: "A" }, { kind: "answer", name: "S2", id: students(R)[1].id, code: CODE, q: "1", answer: "c", conf: "h" }];
    for (const p of cases) { const mine = await R.phone(p), rules = R.twin.call(p); assert.equal(mine.outcome, typeof rules === "string" ? rules : rules.outcome, JSON.stringify(p)); }
    // the lecturer moves on: an answer to the old question is refused, to the new one is accepted
    await R.ctl({ act: "next" });
    assert.equal((await R.phone({ kind: "answer", name: "S1", id: students(R)[0].id, code: CODE, q: "1", answer: "A" })).outcome, "wrong question");
    assert.equal((await R.phone({ kind: "answer", name: "S1", id: students(R)[0].id, code: CODE, q: "2", answer: "D" })).outcome, "ok");
    // CM collects: the answers are recorded through the rules, once
    assert.ok((await R.lq.collect(), true)); await R.lq.idle();
    const answers = R.cm.backend.rawRows("Answers").slice(1).filter((x) => x[0] !== "" && x[0] != null);
    assert.deepEqual(answers.map((x) => [String(x[1]), x[4], x[5]]).sort(), [[students(R)[0].id, 1, "B"], [students(R)[0].id, 2, "D"], [students(R)[1].id, 1, "C"], [students(R)[2].id, 1, "A"]].map((x) => [x[0], x[1], x[2]]).sort());
    await R.lq.collect(); await R.lq.idle(); assert.equal(R.cm.backend.rawRows("Answers").slice(1).filter((x) => x[0] !== "" && x[0] != null).length, 4, "collecting again records nothing twice");
    // the quiz is released: the relay forgets it
    await R.ctl({ act: "end" }); await R.ctl({ act: "release" });
    assert.equal((await R.phone({ action: "questions", code: CODE })).questions.length, 0);
    assert.equal((await R.phone({ kind: "answer", name: "S1", id: students(R)[0].id, code: CODE, q: "2", answer: "A" })).outcome, "bad answer");
  } finally { R.cm.backend.close(); R.twin.backend.close(); }
});

test("without a joined student the relay refuses late answers like the rules, and a closed question is refused after its grace", async () => {
  const R = await rig();
  try {
    await R.hub.register(); await R.ctl({ act: "init" }); await R.ctl({ act: "set", field: "allow_late", value: "no" }); await R.ctl({ act: "set", field: "q_seconds", value: "30" }); await R.ctl({ act: "start" });
    const a = { kind: "answer", name: "S1", id: students(R)[0].id, code: CODE, q: "1", answer: "A" };
    assert.equal((await R.phone(a)).outcome, R.twin.call(a).outcome || R.twin.call(a), "not joined, as the rules say");
    assert.equal((await R.phone({ kind: "join", name: "S1", id: students(R)[0].id, code: CODE })).outcome, "ok");
    assert.equal((await R.phone(a)).outcome, "ok");
    R.clock.t += 60; // past the question's deadline and the grace
    assert.equal((await R.phone(a)).outcome, "question closed");
  } finally { R.cm.backend.close(); R.twin.backend.close(); }
});
