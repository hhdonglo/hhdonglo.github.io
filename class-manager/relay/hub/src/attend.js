/* Live attendance on the relay, so phones can check in while the lecturer's computer is off.
   The same rules as desktop/rules/attendance.js (QR token that changes every 30 s, personal access code, one mark per ID per day, one device per ID per session,
   one phone per student, the location check), kept in step by test/attend.test.js, which runs both on the same cases.
   CM opens a session with the class list and a hash of each access code (the relay never holds a raw code); phones call checkIn; CM later collects the events.
   One responsibility: the open session and its events. Routing is in worker.mjs. */
import { sha256Hex, hmacHex } from "./crypto.js";
import { allow, peek, bump } from "./limits.js";
import { LIMITS } from "./db.js";
import { reply, fail, ipOf, readJson } from "./http.js";

const SLOT = 30, GRACE = 1, MAX_FAILS = 6, ACC_CAP = 150, PENDING = "waiting for approval: ";
const normId = (s) => String(s == null ? "" : s).trim().replace(/\.0+$/, "").replace(/\D/g, "").replace(/^0+(?=\d)/, "");
const normCode = (s) => { const t = String(s || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8); return t.length === 8 ? t.slice(0, 4) + "-" + t.slice(4) : ""; };
const dayOf = (label) => String(label).split(" #")[0];
export const codeHash = (course, id, code) => sha256Hex(course + "|" + id + "|" + normCode(code)); // CM uses the same line to make what it sends

async function linkFor(secret, slot) { return (await hmacHex(secret, "qr:" + slot)).slice(0, 8); } // first four bytes, as the script and rules/attendance.js
async function linkOk(secret, tok, now) { const s = Math.floor(now / SLOT); for (let d = 0; d <= GRACE; d++) if ((await linkFor(secret, s - d)) === tok) return true; return false; }
function metres(la1, lo1, la2, lo2) { const R = 6371000, r = Math.PI / 180, a = Math.sin((la2 - la1) * r / 2) ** 2 + Math.cos(la1 * r) * Math.cos(la2 * r) * Math.sin((lo2 - lo1) * r / 2) ** 2; return Math.round(2 * R * Math.asin(Math.min(1, Math.sqrt(a)))); }
function geo(s, p) {
  if (s.mode === "off" || s.lat == null || s.lon == null) return { state: "off", dist: 0 };
  const la = Number(p.lat), lo = Number(p.lon), acc = Math.max(0, Math.min(Number(p.acc) || 0, ACC_CAP));
  if (p.lat === undefined || p.lat === "" || isNaN(la) || isNaN(lo) || Math.abs(la) > 90 || Math.abs(lo) > 180) return { state: "none", dist: 0 };
  const d = metres(s.lat, s.lon, la, lo); return { state: d - acc <= (s.radius || 500) ? "ok" : "far", dist: d };
}
const geoText = (g) => (g.state === "off" ? "" : g.state === "none" ? "no location" : g.state + " " + g.dist + " m");
const event = (db, course, label, kind, sid, dev, note, now) => db.prepare("INSERT INTO live_event(course, label, kind, sid, dev, note, at) VALUES(?, ?, ?, ?, ?, ?, ?)").bind(course, label, kind, sid, dev, note, now).run();

// CM, signed. body: { label, secret, mode: "off"|"enforce", lat?, lon?, radius?, roster: { id: codeHash }, phones: { id: deviceHash } }
export async function open(course, body, db, now) {
  const roster = body.roster && typeof body.roster === "object" ? body.roster : null, ids = roster ? Object.keys(roster) : [];
  if (!roster || !ids.length || ids.length > LIMITS.rosterMax) return fail(400, "bad class list");
  const label = String(body.label || "").slice(0, 40), secret = String(body.secret || "");
  if (!label || secret.length < 16 || secret.length > 200 || !["off", "enforce"].includes(body.mode)) return fail(400, "bad session");
  const phones = body.phones && typeof body.phones === "object" ? body.phones : {};
  const lat = body.lat == null ? null : Number(body.lat), lon = body.lon == null ? null : Number(body.lon);
  if (body.mode === "enforce" && (lat == null || lon == null || isNaN(lat) || isNaN(lon))) return fail(400, "location needed");
  const cur = await db.prepare("SELECT status FROM live_session WHERE course = ?").bind(course).first();
  if (cur && cur.status === "Open") return fail(409, "a session is already open: close it first");
  await db.prepare("INSERT INTO live_session(course, label, secret, mode, lat, lon, radius, status, roster, phones, at) VALUES(?, ?, ?, ?, ?, ?, ?, 'Open', ?, ?, ?) ON CONFLICT(course) DO UPDATE SET label = excluded.label, secret = excluded.secret, mode = excluded.mode, lat = excluded.lat, lon = excluded.lon, radius = excluded.radius, status = 'Open', roster = excluded.roster, phones = excluded.phones, at = excluded.at")
    .bind(course, label, secret, body.mode, lat, lon, Math.max(50, Math.min(Number(body.radius) || 500, 5000)), JSON.stringify(roster), JSON.stringify(phones), now).run();
  await db.prepare("DELETE FROM live_code WHERE course = ?").bind(course).run();
  const codes = body.codes && typeof body.codes === "object" ? body.codes : {}; let shown = 0; // codes to show to students who sign in, only for IDs on this class list, only while the session is open
  for (const id of Object.keys(codes)) { const c = normCode(codes[id]); if (c && Object.prototype.hasOwnProperty.call(roster, id)) { await db.prepare("INSERT INTO live_code(course, sid, code, at) VALUES(?, ?, ?, ?)").bind(course, id, c, now).run(); shown++; } }
  return reply({ ok: true, label, students: ids.length, codes: shown });
}

// CM, signed: stop the session and forget the class list and the secret; the events stay until CM collects them.
export async function close(course, db, now) {
  const s = await db.prepare("SELECT status FROM live_session WHERE course = ?").bind(course).first();
  if (!s || s.status !== "Open") return fail(409, "no session is open");
  await db.prepare("DELETE FROM live_code WHERE course = ?").bind(course).run();
  await db.prepare("UPDATE live_session SET status = 'Closed', secret = '', roster = '{}', phones = '{}', at = ? WHERE course = ?").bind(now, course).run();
  return reply({ ok: true });
}

// CM, signed: the events since body.after (a number), oldest first, then ack to forget them.
export async function events(course, body, db) {
  const rows = (await db.prepare("SELECT id, label, kind, sid, dev, note, at FROM live_event WHERE course = ? AND id > ? ORDER BY id LIMIT ?").bind(course, Number(body.after) || 0, LIMITS.eventsPull + 1).all()).results || [];
  return reply({ ok: true, events: rows.slice(0, LIMITS.eventsPull), more: rows.length > LIMITS.eventsPull });
}
export async function ackEvents(course, body, db) {
  const r = await db.prepare("DELETE FROM live_event WHERE course = ? AND id <= ?").bind(course, Number(body.upto) || 0).run();
  return reply({ ok: true, removed: (r.meta && r.meta.changes) || 0 });
}

// A phone, unsigned: body { course, id, dev, t, code, lat?, lon?, acc? }. Answers like desktop/rules/attendance.js checkIn.
export async function checkIn(req, db, now) {
  const r = await readJson(req, 2048); if (r.error) return r.error; const p = r.body, course = String(p.course || "").slice(0, 30);
  if (!(await allow(db, "att:ip:" + ipOf(req) + ":" + course, 60, 30, now))) return fail(429, "slow down");
  if (!(await allow(db, "att:" + course, 60, 600, now))) return fail(429, "this class is busy, try again");
  const s = await db.prepare("SELECT * FROM live_session WHERE course = ? AND status = 'Open'").bind(course).first();
  if (!s) return reply({ ok: false, why: "closed" });
  const sid = normId(p.id); let dev = String(p.dev || "").replace(/[^A-Za-z0-9]/g, "").slice(0, 40);
  if (sid.length < 4 || sid.length > 12) return reply({ ok: false, why: "bad id" });
  if (dev.length < 16) return reply({ ok: false, why: "update page" });
  dev = (await sha256Hex(course + ":" + dev)).slice(0, 16); // only a salted hash of the phone's token is ever kept
  const fk = (k) => ["att:f:" + k, 600], failed = async (k) => (await peek(db, fk(k)[0], 600, now)) >= MAX_FAILS, bad = (k) => bump(db, fk(k)[0], 600, now);
  if ((await failed("d" + dev)) || (await failed("i" + sid))) return reply({ ok: false, why: "slow down" });
  if (!(await linkOk(s.secret, String(p.t || "").replace(/[^0-9a-f]/g, "").slice(0, 8), now))) { await bad("d" + dev); await bad("i" + sid); return reply({ ok: false, why: "old link" }); }
  const roster = JSON.parse(s.roster), onl = Object.prototype.hasOwnProperty.call(roster, sid), day = dayOf(s.label);
  if (onl) {
    if (!roster[sid]) return reply({ ok: false, why: "no access code" });
    if ((await codeHash(course, sid, p.code)) !== roster[sid] || !normCode(p.code)) { await bad("d" + dev); await bad("i" + sid); await event(db, course, s.label, "flag", sid, dev, "wrong access code (refused)", now); return reply({ ok: false, why: "not recognised" }); }
  }
  if (await db.prepare("SELECT 1 AS x FROM live_event WHERE course = ? AND kind = 'ok' AND sid = ? AND label LIKE ?").bind(course, sid, day + " #%").first()) return reply({ ok: true, id: sid, onList: onl, already: true });
  const g = geo(s, p); let bind = false;
  if (onl) {
    const mine = await db.prepare("SELECT dev FROM live_phone WHERE course = ? AND sid = ?").bind(course, sid).first(), seed = JSON.parse(s.phones);
    const owner = (await db.prepare("SELECT sid FROM live_phone WHERE course = ? AND dev = ?").bind(course, dev).first() || {}).sid || Object.keys(seed).find((k) => seed[k] === dev);
    const bound = mine ? mine.dev : seed[sid], refuse = owner && owner !== sid, changed = !refuse && bound && bound !== dev;
    if (refuse || changed) {
      if (s.mode === "enforce" && (g.state === "far" || g.state === "none")) return reply({ ok: false, why: g.state === "far" ? "too far" : "no location" });
      if (!(await db.prepare("SELECT 1 AS x FROM live_event WHERE course = ? AND label = ? AND sid = ? AND kind = 'pending'").bind(course, s.label, sid).first())) await event(db, course, s.label, "pending", sid, dev, PENDING + (refuse ? "used the phone registered to " + owner : "used a phone other than the one registered"), now);
      return reply({ ok: true, id: sid, onList: true, pending: true });
    }
    bind = !bound;
  }
  if (g.state === "far" || g.state === "none") {
    await event(db, course, s.label, "flag", sid, dev, "location: " + geoText(g) + (s.mode === "enforce" ? " (refused)" : " (accepted)"), now);
    if (s.mode === "enforce") return reply({ ok: false, why: g.state === "far" ? "too far" : "no location" });
  }
  try { await db.prepare("INSERT INTO live_event(course, label, kind, sid, dev, note, at) VALUES(?, ?, 'ok', ?, ?, ?, ?)").bind(course, s.label, sid, dev, (onl ? "Yes" : "No") + "|" + geoText(g), now).run(); }
  catch (e) { // a unique index refused it: the same ID again (a race) or a device that already checked in someone
    const again = await db.prepare("SELECT 1 AS x FROM live_event WHERE course = ? AND label = ? AND sid = ? AND kind = 'ok'").bind(course, s.label, sid).first();
    if (again) return reply({ ok: true, id: sid, onList: onl, already: true });
    await event(db, course, s.label, "flag", sid, dev, "device already used", now); return reply({ ok: false, why: "device used" });
  }
  if (bind) { await db.prepare("INSERT OR IGNORE INTO live_phone(course, sid, dev) VALUES(?, ?, ?)").bind(course, sid, dev).run(); await event(db, course, s.label, "bind", sid, dev, "", now); } // CM keeps the registration for the term
  return reply({ ok: true, id: sid, onList: onl });
}

// A phone, unsigned: body { course, id, dev, t, lat?, lon?, acc? }. Shows the student their own access code; the same rules as desktop/rules/code-claim.js (see its header).
const HELD = PENDING + "asked for the access code from a phone other than the one registered";
export async function claim(req, db, now) {
  const r = await readJson(req, 2048); if (r.error) return r.error; const p = r.body, course = String(p.course || "").slice(0, 30);
  if (!(await allow(db, "att:ip:" + ipOf(req) + ":" + course, 60, 30, now))) return fail(429, "slow down");
  if (!(await allow(db, "att:" + course, 60, 600, now))) return fail(429, "this class is busy, try again");
  const s = await db.prepare("SELECT * FROM live_session WHERE course = ? AND status = 'Open'").bind(course).first();
  if (!s) return reply({ ok: false, why: "closed" });
  const sid = normId(p.id); let dev = String(p.dev || "").replace(/[^A-Za-z0-9]/g, "").slice(0, 40);
  if (sid.length < 4 || sid.length > 12) return reply({ ok: false, why: "bad id" });
  if (dev.length < 16) return reply({ ok: false, why: "update page" });
  dev = (await sha256Hex(course + ":" + dev)).slice(0, 16);
  const failed = async (k) => (await peek(db, "att:f:" + k, 600, now)) >= MAX_FAILS, bad = (k) => bump(db, "att:f:" + k, 600, now);
  if ((await failed("d" + dev)) || (await failed("i" + sid))) return reply({ ok: false, why: "slow down" });
  if (!(await linkOk(s.secret, String(p.t || "").replace(/[^0-9a-f]/g, "").slice(0, 8), now))) { await bad("d" + dev); await bad("i" + sid); return reply({ ok: false, why: "old link" }); }
  const g = geo(s, p);
  if (s.mode === "enforce" && (g.state === "far" || g.state === "none")) return reply({ ok: false, why: g.state === "far" ? "too far" : "no location" });
  const roster = JSON.parse(s.roster), row = Object.prototype.hasOwnProperty.call(roster, sid) ? await db.prepare("SELECT code FROM live_code WHERE course = ? AND sid = ?").bind(course, sid).first() : null;
  if (!row) { await bad("d" + dev); await bad("i" + sid); return reply({ ok: false, why: "not recognised" }); }
  const mine = await db.prepare("SELECT dev FROM live_phone WHERE course = ? AND sid = ?").bind(course, sid).first(), seed = JSON.parse(s.phones);
  const owner = (await db.prepare("SELECT sid FROM live_phone WHERE course = ? AND dev = ?").bind(course, dev).first() || {}).sid || Object.keys(seed).find((k) => seed[k] === dev);
  const bound = mine ? mine.dev : seed[sid];
  if ((owner && owner !== sid) || (bound && bound !== dev)) {
    await bad("d" + dev);
    if (!(await db.prepare("SELECT 1 AS x FROM live_event WHERE course = ? AND label = ? AND sid = ? AND kind = 'pending'").bind(course, s.label, sid).first())) await event(db, course, s.label, "pending", sid, dev, HELD, now);
    return reply({ ok: true, id: sid, pending: true });
  }
  if (!bound) {
    const ins = await db.prepare("INSERT OR IGNORE INTO live_phone(course, sid, dev) VALUES(?, ?, ?)").bind(course, sid, dev).run();
    if (!(ins.meta && ins.meta.changes)) return reply({ ok: true, id: sid, pending: true }); // another phone registered this ID a moment ago
    await event(db, course, s.label, "bind", sid, dev, "", now);
    await event(db, course, s.label, "flag", sid, dev, "access code shown on this phone, now registered to this ID", now);
  }
  return reply({ ok: true, id: sid, code: row.code });
}
