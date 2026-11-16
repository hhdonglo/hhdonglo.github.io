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
const { quizHooks } = require("../rules/router");
const { fromBackend } = require("../rules/store");

const EVERY_MS = 5000, RUNNING = ["lobby", "running", "paused", "ended"];

function createLiveQuiz(opts) {
  const hub = opts.hub, backend = opts.backend, pages = opts.pages, log = opts.log || (() => {}), setTimer = opts.setInterval || setInterval, clearTimer = opts.clearInterval || clearInterval;
  let code = "", timer = null, busy = Promise.resolve();
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
    if (!r.events || !r.events.length) return 0;
    const o = quizHooks(st, env());
    r.events.forEach((e) => {
      try {
        const b = JSON.parse(e.body);
        // An answer the relay admitted is recorded as of the question and round it was for, even when the lecturer has moved on since (the rules would call it "wrong question").
        if (b.kind === "answer") R.addAnswer(st, [new Date(e.at * 1000), b.id, b.name, b.code, b.q, b.answer, b.round || 0, b.conf || "", b.vote || 0]);
        else QS.handle(st, b, o);
      } catch (err) { log("live quiz: an event could not be recorded (" + err.message + ")"); }
    });
    const top = r.events[r.events.length - 1].id; st.setProp("live_quiz_after", String(top)); backend.flush();
    await hub.post("/v1/quiz/ack", { upto: top }); return r.events.length;
  }
  const sync = (c) => chain(async () => {
    const snap = snapshot(store(), c);
    if (snap && RUNNING.indexOf(snap.state) >= 0) {
      const reg = await hub.register(); if (!reg.ok) throw new Error(reg.why || "no relay");
      await hub.post("/v1/quiz/put", snap.body); code = c;
      if (!timer) { timer = setTimer(() => { if (code) { collect().then(() => sync(code)).catch(() => {}); } }, EVERY_MS); if (timer.unref) timer.unref(); }
    } else if (code === c) { await collect(); await hub.post("/v1/quiz/close", {}); stopTimer(); } // released, reset or deleted: take the last answers, then close
  });
  function stopTimer() { code = ""; if (timer) { clearTimer(timer); timer = null; } }

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
  return { after, sync, collect: () => chain(collect), close: () => chain(async () => { if (code) { await collect(); await hub.post("/v1/quiz/close", {}); } stopTimer(); }), isOpen: () => !!code, idle: () => busy };
}

module.exports = { createLiveQuiz, EVERY_MS };
