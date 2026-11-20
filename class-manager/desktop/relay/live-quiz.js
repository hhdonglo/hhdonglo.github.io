/* Keeps a live quiz on the relay in step with the lecturer's quiz controls, so phones can join and answer while this computer is off.
   One responsibility: watch the answers CM gives to control and host, hand the quiz's status and question text to the relay while it runs, collect the
   joins and answers phones left, and record them through the quiz rules (rules/quiz-submit.js), which stay the authority. A relay problem never
   changes what the lecturer sees from the local server. The relay's own checks: relay/hub/src/quiz.js. */
"use strict";
const C = require("../rules/quiz-control");
const R = require("../rules/quiz-results");
const QS = require("../rules/quiz-submit");
const V = require("../rules/quiz-views");
const A = require("../rules/auth");
const AC = require("../rules/access-codes");
const { sinkFor } = require("../rules/unlisted-quiz");
const { quizHooks } = require("../rules/router");
const { fromBackend } = require("../rules/store");

const EVERY_MS = 5000, RUNNING = ["lobby", "running", "paused", "ended"];

function createLiveQuiz(opts) {
  const hub = opts.hub, backend = opts.backend, pages = opts.pages, log = opts.log || (() => {}), setTimer = opts.setInterval || setInterval, clearTimer = opts.clearInterval || clearInterval;
  let code = "", timer = null, settled = false, retiring = false, busy = Promise.resolve(), listedKey = "";
  const store = () => fromBackend(backend), counters = A.memoryCounters(() => new Date());
  const env = () => ({ site: backend.site, random: () => require("crypto").randomUUID(), counters });
  const usable = () => !!(hub && typeof hub.post === "function" && opts.address());
  const chain = (fn) => { busy = busy.then(fn).catch((e) => log("live quiz: " + e.message)); return busy; };

  // What phones may see: the status and the question text (never the answers), and who has joined.
  function snapshot(st, c) {
    const o = env(), ctl = C.ctl(st, c); if (!ctl) return null;
    const present = (st.rows("Presence") || []).slice(1).filter((r) => String(r[3]).trim().toUpperCase() === c).map((r) => String(r[1]).trim());
    return { state: C.eff(ctl), body: { code: c, status: V.status(st, c, o), questions: V.questions(st, c, o).questions || [], present } };
  }
  async function collect() {
    const st = store(), after = Number(st.prop("live_quiz_after")) || 0, r = await hub.post("/v1/quiz/events", { after });
    if (r.ok === false) throw new Error(r.why || "Could not collect relay quiz events.");
    if (!r.events || !r.events.length) return 0;
    const o = quizHooks(st, env());
    r.events.forEach((e) => {
      try {
        const b = JSON.parse(e.body);
        // An answer the relay admitted is recorded as of the question and round it was for, even when the lecturer has moved on since (the rules would call it "wrong question").
        const S = sinkFor(st, b.id);
        if (b.kind === "answer") { S.addAnswer([new Date(e.at * 1000), b.id, b.name, b.code, b.q, b.answer, b.round || 0, b.conf || "", b.vote || 0]); if (!S.hasPresence(String(b.code).toUpperCase(), b.id)) S.presence(String(b.code).toUpperCase(), b.id, b.name, "inprogress"); } // an ID off the class list goes to the holding area, not the live tabs; an answer is participation
        else if ((b.kind === "join" || b.kind === "progress") && b.id && b.name) S.presence(String(b.code).toUpperCase(), b.id, b.name, b.kind === "progress" ? "inprogress" : "joined"); // the relay already admitted this join, even if CM collects it after the quiz started
        else QS.handle(st, b, o);
      } catch (err) { log("live quiz: an event could not be recorded (" + err.message + ")"); }
    });
    const top = r.events[r.events.length - 1].id; st.setProp("live_quiz_after", String(top)); backend.flush();
    await hub.post("/v1/quiz/ack", { upto: top }); return r.events.length;
  }
  const sync = (c) => chain(async () => {
    if (retiring) return;
    const snap = snapshot(store(), c);
    if (snap && RUNNING.indexOf(snap.state) >= 0) {
      const reg = await hub.register(); if (!reg.ok) throw new Error(reg.why || "no relay");
      const listed = AC.rosterRows(store()).map((r) => r[0]), key = c + "|" + listed.length + "|" + listed.join(",").length + "|" + require("crypto").createHash("sha1").update(listed.join(",")).digest("hex");
      const body = key === listedKey ? snap.body : Object.assign({ listed }, snap.body); // the class list goes to the relay when it changes, so a phone with another ID is warned at once
      const put = await hub.post("/v1/quiz/put", body); code = c; if (put && put.ok !== false) listedKey = key;
      if (snap.state === "ended") await settle(c); else settled = false; // Stop: take what phones sent, then hold the results; nothing the relay holds is left out
      if (!timer) { timer = setTimer(() => { if (code && !retiring) { collect().then(() => sync(code)).catch(() => {}); } }, EVERY_MS); if (timer.unref) timer.unref(); }
    } else if (code === c) { await collect(); await hub.post("/v1/quiz/close", {}); stopTimer(); } // released, reset or deleted: take the last answers, then close
  });
  // After Stop: the relay no longer accepts answers (its status is "ended"); collect what it holds, then compile the held results again (finalize replaces, never doubles).
  async function settle(c) { const n = await collect(); if (n || !settled) { quizHooks(store(), env()).finalize(c); backend.flush(); } settled = true; } // again only when new answers arrived
  function stopTimer() { settled = false; code = ""; listedKey = ""; if (timer) { clearTimer(timer); timer = null; } }

  // The answer text CM is about to send for this request, with the relay fields added; the relay work happens after.
  function after(params, text) {
    if (!usable()) return text;
    const action = params && params.action; if (action !== "control" && action !== "host" && action !== "display") return text;
    let out; try { out = JSON.parse(text); } catch (e) { return text; }
    if (!out || typeof out !== "object" || out.ok === false) return text;
    const c = String(params.code || "").trim().toUpperCase(); if (!c) return text;
    let on = code === c;
    if (action === "control") { sync(c); const snap = snapshot(store(), c); on = !!snap && RUNNING.indexOf(snap.state) >= 0; } // the relay work follows; the page is told at once
    if (on) { const pc = hub.publicConfig(); if (pc) { out.relay = { url: pc.url, course: pc.course, pages }; return JSON.stringify(out); } }
    return text;
  }
  async function closeForModules() {
    retiring = true;
    try {
      await busy;
      if (!hub.configured()) return;
      const result = await hub.post("/v1/quiz/close", {});
      if (!result.ok) throw new Error(result.why || "Could not close relay quizzes.");
      while (await collect()) { /* drain earlier answers before disabling */ }
      stopTimer();
    } finally {
      retiring = false;
    }
  }

  return { after, sync, closeForModules, collect: () => chain(collect), close: () => chain(async () => { if (code) { await collect(); await hub.post("/v1/quiz/close", {}); } stopTimer(); }), isOpen: () => !!code, idle: () => busy };
}

module.exports = { createLiveQuiz, EVERY_MS };
