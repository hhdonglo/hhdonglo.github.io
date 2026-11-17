/* The lecturer's message to the class on student phones: it is in every status answer (waiting room, question, results, relay), a late joiner sees it,
   Clear removes it, and the phone page and the lecturer's page use it (script text, no browser). */
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { createHub } = require("../relay/hub");
const { createLiveQuiz } = require("../relay/live-quiz");
const { classroom, WEB } = require("./classroom");
const Msg = require(path.join(WEB, "assets/lecturer-message.js"));
const Text = require(path.join(WEB, "assets/quiz-host-text.js"));
const CODE = "26271", read = (f) => fs.readFileSync(path.join(WEB, f), "utf8");

test("the message is in the quiz status in every state, for a phone that joins late, and Clear empties it", () => {
  const c = classroom({ students: 3, engine: "js" });
  try {
    const ctl = (p) => c.host("control", Object.assign({ code: CODE }, p)), phone = () => c.call({ action: "status", code: CODE });
    assert.equal(ctl({ act: "init" }).ok, true); ctl({ act: "set", field: "q_seconds", value: "0" });
    assert.equal(ctl({ act: "lobby" }).ok, true);
    assert.equal(ctl({ act: "message", text: "Do your best" }).ok, true);
    assert.equal(phone().message, "Do your best", "waiting room");
    assert.equal(ctl({ act: "start" }).ok, true);
    assert.equal(phone().message, "Do your best", "during a question (a phone that joins now sees it too)");
    assert.equal(ctl({ act: "next" }).ok, true);
    assert.equal(phone().message, "Do your best", "between questions: the message stays");
    ctl({ act: "end" }); assert.equal(phone().message, "Do your best", "after the quiz");
    ctl({ act: "message", text: "Well done" }); assert.equal(phone().message, "Well done", "a new message replaces the old one");
    ctl({ act: "message", text: "" }); assert.equal(phone().message, "", "Clear");
  } finally { c.backend.close(); }
});

test("the message reaches phones through the relay while CM is off, and is cleared there", async () => {
  const hubWorker = await import("../../relay/hub/worker.mjs"), { fakeD1 } = await import("../../relay/hub/test/fake-d1.js"), { setup } = await import("../../relay/hub/src/db.js");
  const DB = fakeD1(); await setup(DB); const env = { DB, RELAY_SECRET: "test-secret-0123456789", POW_BITS: "8" }, t = Math.floor(Date.now() / 1000);
  const fetchTo = async (url, init) => { const u = new URL(url); const r = await hubWorker.handle(new Request("https://hub.test" + u.pathname, init), env, t); return { ok: r.status < 400, status: r.status, json: () => r.json() }; };
  const cm = classroom({ students: 3, engine: "js" });
  try {
    const hub = createHub({ backend: cm.backend, address: "https://hub.test", fetch: fetchTo, log: () => {} });
    const lq = createLiveQuiz({ hub, backend: cm.backend, address: () => "https://hub.test", pages: "https://pages.test/", log: (m) => { throw new Error(m); }, setInterval: () => 0, clearInterval: () => {} });
    const ctl = async (p) => { const r = cm.host("control", Object.assign({ code: CODE }, p)); lq.after({ action: "control", code: CODE }, JSON.stringify(r)); await lq.idle(); return r; };
    const phone = async () => (await hubWorker.handle(new Request("https://hub.test/v1/quiz/call", { method: "POST", headers: { "CF-Connecting-IP": "7.7.7.7" }, body: JSON.stringify({ course: hub.publicConfig().course, params: { action: "status", code: CODE } }) }), env, t)).json();
    await hub.register(); await ctl({ act: "init" }); await ctl({ act: "set", field: "q_seconds", value: "0" }); await ctl({ act: "lobby" });
    await ctl({ act: "message", text: "Do your best" });
    assert.equal((await phone()).message, "Do your best", "waiting room, from the relay");
    await ctl({ act: "start" }); assert.equal((await phone()).message, "Do your best", "running, from the relay");
    await ctl({ act: "message", text: "" }); assert.equal((await phone()).message, "", "Clear reaches the relay");
  } finally { cm.backend.close(); }
});

test("the phone shows the message from every status answer, on every screen, and removes it when cleared", () => {
  const els = []; const mk = () => { const e = { hidden: true, children: [], get textContent() { return this._t || ""; }, set textContent(v) { this._t = v; if (v === "") { this.children = []; this.lastChild = null; } }, attrs: {}, setAttribute(k, v) { this.attrs[k] = v; }, appendChild(x) { this.children.push(x); this.lastChild = x; }, insertBefore(x) { this.children.unshift(x); } }; els.push(e); return e; };
  const body = mk(), doc = { createElement: mk, head: mk(), querySelector: () => null, body }; Msg.reset();
  assert.equal(Msg.apply({ known: true, message: "" }, doc), "", "nothing to show, nothing built");
  assert.equal(Msg.apply({ state: "lobby", message: "  Do your best " }, doc), "Do your best");
  const box = body.children[0]; assert.equal(box.hidden, false); assert.equal(box.attrs.role, "alert");
  assert.equal(Msg.apply(null, doc), "Do your best", "a failed request changes nothing");
  assert.equal(Msg.apply({ known: false }, doc), "Do your best", "an unknown quiz changes nothing");
  assert.equal(Msg.apply({ message: "Well done" }, doc), "Well done"); assert.equal(box.children[1].textContent, "Well done");
  assert.equal(Msg.apply({ message: "" }, doc), ""); assert.equal(box.hidden, true, "Clear hides it");
  assert.equal(Msg.textOf({ message: 5 }), "", "only text is shown");
});

test("quiz.html loads the module and routes every status answer through it; the old in-question banner no longer owns the message", () => {
  const q = read("quiz.html");
  assert.match(q, /<script src="assets\/lecturer-message\.js"><\/script>/);
  assert.match(q, /\^action=status&\/\.test\(params\)[^\n]*LecturerMessage\.apply\(d\)/);
  assert.doesNotMatch(q, /Message from your lecturer: "\+d\.message/);
  assert.match(q, /st\.watch=setInterval\(watchStatus,4000/, "the results screen checks the message every few seconds");
  assert.doesNotMatch(Msg.apply.toString() + read("assets/lecturer-message.js"), /\bapp\b|&amp;/i);
});

test("the lecturer's screen says plainly what happened, with the real count, and has readable options", () => {
  assert.equal(Text.actLine("message", { ok: true }, 0, true), "Message sent to 0 students. Students who join later will see it.");
  assert.equal(Text.actLine("message", { ok: true }, 1, true), "Message sent to 1 student. Students who join later will see it too.");
  assert.equal(Text.actLine("message", { ok: true }, 12, true), "Message sent to 12 students. Students who join later will see it too.");
  assert.equal(Text.actLine("message", { ok: true }, 12, false), "Message cleared. It is removed from the students' phones.");
  assert.equal(Text.actLine("start", { ok: true }), "Quiz started."); assert.equal(Text.actLine("zzz", { ok: true }), "Done.");
  assert.equal(Text.actLine("message", { ok: false, why: "no such code" }), "Not done: no such code.");
  assert.equal(Text.whenLabel("OnRelease"), "When released"); assert.equal(Text.whenLabel("Immediate"), "Immediately");
  assert.deepEqual(Text.weekOptions({}, 0), [["1", "No question banks yet"]], "never a blank Week list");
  assert.deepEqual(Text.weekOptions({ 1: "Vectors" }, 6), [["1", "Week 1: Vectors"], ["6", "Week 6: no questions yet"]]);
  assert.deepEqual(Text.countOptions(0, 0), ["5"]); assert.deepEqual(Text.countOptions(7, 5), ["5", "6", "7"]);
  const h = read("quiz-host.html");
  assert.doesNotMatch(h, /<option>(OnRelease|Immediate)<\/option>/); assert.match(h, /QuizHostText\.actLine\(/); assert.doesNotMatch(h, /"Done: "\+a/);
});
