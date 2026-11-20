/* CM's side of the mailbox: collect what phones left there while CM was off or out of reach, and record it as if it had arrived directly.
   One responsibility: pull, open, apply once, acknowledge. Keys and tokens live sealed in the course database (backend.secret), never in settings.json.
   Only attempts and reports are accepted this way. Check-in and live quizzes need the room and never pass through the mailbox. */
"use strict";
const { generateKeys, open } = require("./crypto");
const receipts = require("../receipts");

const ALLOWED = { attempt: true, report: true };
const EVERY_MS = 3 * 60 * 1000;

function createRelay(opts) {
  const backend = opts.backend, doFetch = opts.fetch || fetch, log = opts.log || (() => {}), courseId = opts.courseId;
  let timer = null, last = { at: 0, ok: null, received: 0, why: "" };
  const cfg = () => ({ url: backend.secret("relay.url"), pull: backend.secret("relay.pull"), drop: backend.secret("relay.drop"), pub: backend.secret("relay.public"), priv: backend.secret("relay.private") });
  const configured = () => { const c = cfg(); return !!(c.url && c.pull && c.priv); };

  // Saves the mailbox address and tokens the lecturer was given (relay/README.md); makes the course's keys once.
  function setup(o) {
    const url = String(o.url || "").trim().replace(/\/$/, "");
    if (!/^https:\/\/[\w.-]+(\/[\w./-]*)?$/.test(url)) return { ok: false, why: "The mailbox address must start with https://" };
    if (String(o.pull || "").length < 16 || String(o.drop || "").length < 8) return { ok: false, why: "The two codes are missing or too short." };
    backend.setSecret("relay.url", url); backend.setSecret("relay.pull", String(o.pull).trim()); backend.setSecret("relay.drop", String(o.drop).trim());
    if (!backend.secret("relay.private")) { const k = generateKeys(); backend.setSecret("relay.public", k.publicKey); backend.setSecret("relay.private", k.privateKey); }
    backend.flush(); return { ok: true };
  }
  function clear() { ["url", "pull", "drop"].forEach((k) => backend.setSecret("relay." + k, "")); backend.flush(); return { ok: true }; }
  // What goes into config.js for the phones: the address, the drop code and the public key. None of it can read anything.
  function publicConfig() { const c = cfg(); return c.url && c.drop && c.pub ? { url: c.url, drop: c.drop, key: c.pub, course: courseId } : null; }

  async function post(path, body) {
    const c = cfg();
    const r = await doFetch(c.url + path, { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + c.pull }, body: JSON.stringify(body) });
    if (!r.ok) throw new Error("the mailbox answered " + r.status);
    return r.json();
  }
  async function pull() {
    if (!configured()) return { ok: false, why: "not set up" };
    const c = cfg(); let got = 0; const done = [];
    try {
      for (let round = 0; round < 10; round++) {
        const res = await post("/pull", { course: courseId });
        const ids = [];
        for (const it of res.items || []) {
          ids.push(it.id);
          try {
            const msg = JSON.parse(open(c.priv, it.sealed));
            if (!msg || !msg.params || !ALLOWED[msg.params.kind]) { log("mailbox: item of a kind that is not accepted was dropped"); continue; }
            const params = Object.assign({}, msg.params, { ckey: String(msg.ckey || it.id).replace(/[^\w.-]/g, "_") });
            if (backend.moduleRefusal?.(params, true)) { ids.pop(); continue; }
            receipts.once(backend, params, () => backend.doPost(params, new URLSearchParams(params).toString()));
            got++;
          } catch (e) { log("mailbox: an item could not be opened and was dropped (" + e.message + ")"); }
        }
        if (ids.length) await post("/ack", { ids }); // removed from the mailbox only after it is recorded here
        done.push(...ids);
        if (!res.more || !ids.length) break;
      }
      if (got) backend.flush();
      last = { at: Date.now(), ok: true, received: got, why: "" };
    } catch (e) { last = { at: Date.now(), ok: false, received: got, why: e.message }; }
    return Object.assign({ ok: last.ok }, last);
  }
  function start() { if (timer) return; timer = setInterval(() => { pull().catch(() => {}); }, EVERY_MS); if (timer.unref) timer.unref(); }
  function stop() { if (timer) clearInterval(timer); timer = null; }
  return { setup, clear, publicConfig, pull, start, stop, configured, status: () => Object.assign({ configured: configured() }, last) };
}

module.exports = { createRelay, ALLOWED };
