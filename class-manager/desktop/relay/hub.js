/* CM's side of the relay hub (relay/hub/): registers the course by itself, signs every request, collects what phones left, and pushes live state.
   One responsibility: talk to the hub. It needs no account and no setup by the lecturer: the hub address is built into CM (relay/address.js).
   The course key (ECDSA P-256) and the sealing key live sealed in the course database (backend.secret), never in settings.json or an export.
   It has the same outside shape as relay/client.js (the older mailbox), so main.js can use either. */
"use strict";
const crypto = require("crypto");
const { generateKeys, open } = require("./crypto");
const receipts = require("../receipts");

const ALLOWED = { attempt: true, report: true }; // kinds of item accepted from phones through the hub (the same as the mailbox)
const EVERY_MS = 3 * 60 * 1000;

const b64u = (buf) => Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const sha256 = (text) => crypto.createHash("sha256").update(text).digest();
function leadingZeroBits(buf) { let n = 0; for (const b of buf) { if (b === 0) { n += 8; continue; } n += Math.clz32(b) - 24; break; } return n; }
// The proof of work the hub asks of a new course: find a number whose hash with the challenge and the course id has enough zero bits.
function solve(challenge, id, bits) { for (let i = 0; i < 1e8; i++) if (leadingZeroBits(sha256(challenge + ":" + id + ":" + i)) >= bits) return String(i); throw new Error("no solution found"); }

function courseIdOf(jwk) { return "c" + sha256(jwk.x + "." + jwk.y).toString("hex").slice(0, 20); }
function newCourseKey() {
  const { privateKey, publicKey } = crypto.generateKeyPairSync("ec", { namedCurve: "P-256" });
  const pub = publicKey.export({ format: "jwk" });
  return { priv: JSON.stringify(privateKey.export({ format: "jwk" })), pub: { kty: pub.kty, crv: pub.crv, x: pub.x, y: pub.y } };
}
// The message the hub checks (relay/hub/src/auth.js): METHOD, PATH, TIME, NONCE, SHA256(body) on separate lines. WebCrypto expects r and s side by side.
function sign(privJwk, method, path, time, nonce, body) {
  const key = crypto.createPrivateKey({ key: JSON.parse(privJwk), format: "jwk" });
  const msg = [method, path, String(time), nonce, sha256(body).toString("hex")].join("\n");
  return b64u(crypto.sign("sha256", Buffer.from(msg), { key, dsaEncoding: "ieee-p1363" }));
}

function createHub(opts) {
  const backend = opts.backend, doFetch = opts.fetch || fetch, log = opts.log || (() => {}), now = opts.now || (() => Math.floor(Date.now() / 1000));
  const address = () => String(typeof opts.address === "function" ? opts.address() : opts.address || "").replace(/\/$/, "");
  let timer = null, busy = null, last = { at: 0, ok: null, received: 0, why: "" };
  const course = () => backend.secret("hub.course") || "";
  const configured = () => !!(address() && course());

  async function call(method, path, body, headers) {
    const r = await doFetch(address() + path, { method, headers: Object.assign({ "Content-Type": "application/json" }, headers || {}), body: body === undefined ? undefined : body });
    let j = {}; try { j = await r.json(); } catch (e) { /* not JSON */ }
    if (!r.ok) { const e = new Error("the relay answered " + r.status + (j.why ? " (" + j.why + ")" : "")); e.status = r.status; e.why = j.why; throw e; }
    return j;
  }
  // The first time: make the keys, solve the work, register. Safe to repeat: a course that is already registered is recognised.
  async function register() {
    if (!address()) return { ok: false, why: "no relay address in this build" };
    if (course()) return { ok: true, course: course() };
    if (!backend.secret("hub.sign")) { const k = newCourseKey(); backend.setSecret("hub.sign", k.priv); backend.setSecret("hub.pub", JSON.stringify(k.pub)); }
    if (!backend.secret("relay.private")) { const k = generateKeys(); backend.setSecret("relay.public", k.publicKey); backend.setSecret("relay.private", k.privateKey); }
    const pub = JSON.parse(backend.secret("hub.pub")), id = courseIdOf(pub);
    try {
      const ch = await call("GET", "/v1/challenge");
      const work = solve(ch.challenge, id, ch.bits);
      const r = await call("POST", "/v1/register", JSON.stringify({ pub, enc: backend.secret("relay.public"), challenge: ch.challenge, work, build: opts.build || undefined }));
      backend.setSecret("hub.course", r.course);
    } catch (e) {
      if (e.status === 409) backend.setSecret("hub.course", id); // registered before (for example after a restore): signed requests will prove it
      else throw e;
    }
    backend.flush(); return { ok: true, course: course() };
  }
  let seq = 0;
  async function signed(path, bodyObj) {
    const body = JSON.stringify(bodyObj || {}), t = now(), nonce = Date.now().toString(36) + (++seq) + crypto.randomBytes(4).toString("hex");
    const sig = sign(backend.secret("hub.sign"), "POST", path, t, nonce, body);
    return call("POST", path, body, { "X-CM-Course": course(), "X-CM-Time": String(t), "X-CM-Nonce": nonce, "X-CM-Sig": sig });
  }

  async function pull() {
    if (busy) return busy;
    busy = (async () => {
      let got = 0;
      try {
        await register();
        const priv = backend.secret("relay.private");
        for (let round = 0; round < 10; round++) {
          const res = await signed("/v1/pull", {}), ids = [];
          for (const it of res.items || []) {
            ids.push(it.id);
            try {
              const msg = JSON.parse(open(priv, it.sealed));
              if (!msg || !msg.params || !ALLOWED[msg.params.kind]) { log("relay: an item of a kind that is not accepted was dropped"); continue; }
              const params = Object.assign({}, msg.params, { ckey: String(msg.ckey || "hub-" + it.id).replace(/[^\w.-]/g, "_") });
              receipts.once(backend, params, () => backend.doPost(params, new URLSearchParams(params).toString())); // recorded once, even if the same item arrives again
              got++;
            } catch (e) { log("relay: an item could not be opened and was dropped (" + e.message + ")"); }
          }
          if (ids.length) await signed("/v1/ack", { ids }); // removed from the relay only after it is recorded here
          if (!res.more || !ids.length) break;
        }
        if (got) backend.flush();
        last = { at: Date.now(), ok: true, received: got, why: "" };
      } catch (e) { last = { at: Date.now(), ok: false, received: got, why: e.message }; }
      return Object.assign({ ok: last.ok }, last);
    })().finally(() => { busy = null; });
    return busy;
  }
  // Live state the phones read (the open question, the attendance session): small named text values.
  async function post(path, body) { await register(); return signed(path, body || {}); } // any signed route, for the live rules (relay/live-attend.js)
  async function pushState(set, remove) { await register(); return signed("/v1/state", { set: set || {}, remove: remove || [] }); }
  // The lecturer closes the course on the relay: everything held there for it is forgotten at once.
  async function closeCourse() { await register(); const r = await signed("/v1/close", {}); ["course", "sign", "pub"].forEach((k) => backend.setSecret("hub." + k, "")); backend.flush(); return r; }

  // What goes into config.js for phones: the address, the course id and the sealing key. None of it can read anything.
  function publicConfig() { const pub = backend.secret("relay.public"); return configured() && pub ? { hub: true, url: address(), course: course(), key: pub } : null; }
  function start() { if (timer) return; register().then(() => pull()).catch((e) => { last = { at: Date.now(), ok: false, received: 0, why: e.message }; }); timer = setInterval(() => { pull().catch(() => {}); }, EVERY_MS); if (timer.unref) timer.unref(); }
  function stop() { if (timer) clearInterval(timer); timer = null; }
  return { register, pull, post, pushState, closeCourse, publicConfig, start, stop, configured, setup: () => ({ ok: false, why: "The relay needs no setup." }), clear: () => ({ ok: true }), status: () => Object.assign({ configured: configured(), hub: true }, last) };
}

module.exports = { createHub, courseIdOf, sign, solve, ALLOWED };
