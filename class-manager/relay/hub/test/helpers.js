/* What CM's side will do, in a small form for the tests: make a course key, solve the proof of work, sign requests. */
import { webcrypto as crypto } from "node:crypto";
import { b64u, sha256, sha256Hex, leadingZeroBits, courseIdOf } from "../src/crypto.js";
import { handle } from "../worker.mjs";
import { fakeD1 } from "./fake-d1.js";
import { setup } from "../src/db.js";

export async function newEnv(extra) { const DB = fakeD1(); await setup(DB); return Object.assign({ DB, RELAY_SECRET: "test-secret-0123456789", POW_BITS: "8" }, extra || {}); }
export const call = (env, method, path, opts, now) => {
  opts = opts || {};
  const req = new Request("https://relay.test" + path, { method, headers: opts.headers || {}, body: method === "GET" ? undefined : opts.body });
  return handle(req, env, now || 1800000000).then(async (r) => ({ status: r.status, body: await r.json() }));
};
export async function newCourseKeys() {
  const kp = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  const pub = await crypto.subtle.exportKey("jwk", kp.publicKey);
  return { priv: kp.privateKey, pub: { kty: pub.kty, crv: pub.crv, x: pub.x, y: pub.y } };
}
export async function solve(challenge, id, bits) { if (!challenge || !bits) return "0"; for (let i = 0; i < 5e6; i++) { if (leadingZeroBits(await sha256(challenge + ":" + id + ":" + i)) >= bits) return String(i); } return "0"; }
export async function registerCourse(env, keys, now, extra) {
  const ch = (await call(env, "GET", "/v1/challenge", { headers: { "CF-Connecting-IP": (extra && extra.ip) || "1.1.1.1" } }, now)).body;
  const id = await courseIdOf(keys.pub);
  const work = await solve(ch.challenge, id, ch.bits);
  return call(env, "POST", "/v1/register", { headers: { "CF-Connecting-IP": (extra && extra.ip) || "1.1.1.1" }, body: JSON.stringify(Object.assign({ pub: keys.pub, enc: "RSA-PUBLIC-KEY", challenge: ch.challenge, work }, extra && extra.body)) }, now);
}
let seq = 0;
export async function signed(env, keys, id, path, body, now, over) {
  const text = JSON.stringify(body || {}), t = (over && over.time) || now, nonce = (over && over.nonce) || "n" + (++seq) + Math.random().toString(36).slice(2, 8);
  const msg = ["POST", path, String(t), nonce, await sha256Hex(text)].join("\n");
  const sig = b64u.from(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, keys.priv, new TextEncoder().encode(msg)));
  return call(env, "POST", path, { headers: { "X-CM-Course": id, "X-CM-Time": String(t), "X-CM-Nonce": nonce, "X-CM-Sig": sig }, body: text }, now);
}
export const NOW = 1800000000;
