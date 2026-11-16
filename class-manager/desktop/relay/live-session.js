/* Keeps a class's relay session in step with the lecturer's attendance controls. One responsibility: watch the answers CM gives to attend_open,
   attend_close and attend_status, hand the session to the relay when it opens, collect phone check-ins while it is open, and tell the attendance page
   (an added `relay` field) where phones should go. A relay problem never changes what the lecturer sees from the local server.
   The relay's own rules: relay/hub/src/attend.js; the translation: live-attend.js. */
"use strict";
const AT = require("../rules/attendance");
const { fromBackend } = require("../rules/store");
const L = require("./live-attend");

const EVERY_MS = 15000;

function createLiveSession(opts) {
  const hub = opts.hub, backend = opts.backend, pages = opts.pages, log = opts.log || (() => {}), setTimer = opts.setInterval || setInterval, clearTimer = opts.clearInterval || clearInterval;
  let on = false, timer = null, busy = Promise.resolve();
  const store = () => fromBackend(backend);
  const usable = () => !!(hub && typeof hub.post === "function" && opts.address());
  const chain = (fn) => { busy = busy.then(fn).catch((e) => log("live attendance: " + e.message)); return busy; };

  const collect = () => chain(async () => { if (on) await L.collect(hub, store()); });
  const start = () => chain(async () => {
    const reg = await hub.register(); if (!reg.ok) throw new Error(reg.why || "no relay");
    const ses = AT.openSession(store()); if (!ses) return;
    const r = await L.openOnRelay(hub, store(), reg.course, ses.lat != null ? "enforce" : "off");
    if (r && r.ok) { on = true; if (!timer) { timer = setTimer(collect, EVERY_MS); if (timer.unref) timer.unref(); } }
  });
  const stop = () => chain(async () => {
    if (!on) return;
    try { await L.collect(hub, store()); await L.closeOnRelay(hub); } finally { on = false; if (timer) { clearTimer(timer); timer = null; } }
  });

  // The answer text CM is about to send for this request, with the relay fields added; the relay work happens after.
  function after(params, text) {
    if (!usable()) return text;
    const action = params && params.action; let out;
    try { out = JSON.parse(text); } catch (e) { return text; }
    if (!out || typeof out !== "object") return text;
    if (action === "attend_open" && out.ok) start();
    else if (action === "attend_close" && out.ok) stop();
    if ((action === "attend_status" || action === "attend_open") && on) { const c = hub.publicConfig(); if (c) { out.relay = { url: c.url, course: c.course, pages }; return JSON.stringify(out); } }
    return text;
  }
  const close = () => stop();
  return { after, collect, close, isOpen: () => on, idle: () => busy };
}

module.exports = { createLiveSession, EVERY_MS };
