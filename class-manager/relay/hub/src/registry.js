/* Courses: a lecturer's CM registers itself the first time it needs the relay (no account, no invite). One responsibility: registration and the public course page.
   The abuse controls are in limits.js: rate limits per network address and per day, a proof of work, a ceiling on all courses, and an optional list of allowed builds. */
import { cleanKey, courseIdOf } from "./crypto.js";
import { allow, makeChallenge, checkWork, RATES } from "./limits.js";
import { LIMITS } from "./db.js";
import { reply, fail, ipOf, readJson } from "./http.js";

const bitsOf = (env) => Math.max(1, Math.min(28, Number(env.POW_BITS) || RATES.powBits)); // POW_BITS only lowers the work in tests

export async function challenge(req, env, db, now) {
  if (env.REGISTRATION_OPEN === "0") return fail(503, "registration is switched off");
  if (!(await allow(db, "ch:" + ipOf(req), 3600, RATES.registerPerIpHour * 6, now))) return fail(429, "slow down");
  return reply({ ok: true, challenge: await makeChallenge(env.RELAY_SECRET, now), bits: bitsOf(env) });
}

// body: { pub: JWK, enc: base64 RSA public key for sealing, challenge, work: nonce, build? }
export async function register(req, env, db, now) {
  if (env.REGISTRATION_OPEN === "0") return fail(503, "registration is switched off");
  const r = await readJson(req, 4096); if (r.error) return r.error; const b = r.body;
  const pub = cleanKey(b.pub), enc = String(b.enc || ""); if (!pub || !enc || enc.length > 1024) return fail(400, "bad request");
  if (env.BUILD_KEYS) { const ok = String(env.BUILD_KEYS).split(",").map((x) => x.trim()).filter(Boolean); if (!ok.includes(String(b.build || ""))) return fail(403, "this build may not register"); }
  const id = await courseIdOf(pub);
  const have = await db.prepare("SELECT id FROM course WHERE id = ?").bind(id).first();
  if (!have) { // a course that exists may update its sealing key (below) without being counted again
    if (!(await allow(db, "reg:" + ipOf(req), 3600, RATES.registerPerIpHour, now))) return fail(429, "too many new courses from here, try later");
    if (!(await allow(db, "reg:all", 86400, RATES.registerPerDay, now))) return fail(429, "the relay is busy today, try later");
    if (!(await checkWork(env.RELAY_SECRET, b.challenge, id, b.work, now, bitsOf(env)))) return fail(403, "work not accepted");
    const n = await db.prepare("SELECT COUNT(*) AS n FROM course").first();
    if (n.n >= LIMITS.courses) return fail(503, "the relay is full");
    await db.prepare("INSERT INTO course(id, pub, enc, created, last_seen) VALUES(?, ?, ?, ?, ?)").bind(id, JSON.stringify(pub), enc, now, now).run();
    return reply({ ok: true, course: id, created: true });
  }
  return fail(409, "already registered; send signed requests"); // changing the sealing key goes through /v1/state (signed), never an unsigned call
}

// What a phone needs to take part: the sealing key and the current live state. No names, no records.
export async function publicCourse(id, req, db, now) {
  if (!(await allow(db, "read:" + ipOf(req), 60, RATES.readPerIpPerMin, now))) return fail(429, "slow down");
  const row = await db.prepare("SELECT id, enc FROM course WHERE id = ?").bind(String(id).slice(0, 30)).first();
  if (!row) return fail(404, "unknown course");
  const st = await db.prepare("SELECT k, v FROM state WHERE course = ?").bind(row.id).all();
  const state = {}; (st.results || []).forEach((x) => { state[x.k] = x.v; });
  return reply({ ok: true, course: row.id, enc: row.enc, state });
}
