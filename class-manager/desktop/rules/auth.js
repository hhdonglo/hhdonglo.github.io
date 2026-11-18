/* Sign-in: sessions, the lecturer's host key and password with its recovery code, student sign-in with the personal access code, and quiz receipts.
   A port of apps_script/src/05-auth.gs and 06-password.gs with the same answers and the same stored forms (a pw1 hash in Key!J2, the property
   sess_secret), so a workbook made by the script signs in here and the other way round (test/auth-parity.test.js).
   The request context `req` ({ post, session }) is passed in; counters (failed tries) come from opts.counters (get, put with a lifetime in seconds). */
"use strict";
const crypto = require("crypto");
const { normalizeId } = require("../ids");
const { logLine } = require("./store");
const AC = require("./access-codes");
const SA = require("./signin-attempts");

const K = { HOST_HOURS: 8, STUDENT_DAYS: 14, SIGNIN_GLOBAL_MAX: 200, ATT_MAX_FAILS: 6, PW_ROUNDS: 4000, HOST_MAX_FAILS: 10, RECOVERY_MAX_FAILS: 5, PW_MIN: 10, PW_MAX: 100 };
const KEY_TAB = "Key";
const hmac = (key, text) => crypto.createHmac("sha256", String(key)).update(String(text)).digest();
const hex = (buf) => Buffer.from(buf).toString("hex");
const uuid = (o) => ((o && o.random) || (() => crypto.randomUUID()))();

// A small failure counter with a lifetime, for tests and for CM (the script keeps these in its cache).
function memoryCounters(now) {
  const m = new Map();
  return { get: (k) => { const e = m.get(k); return e && e.until > now().getTime() ? e.n : 0; }, put: (k, n, ttl) => m.set(k, { n: Number(n), until: now().getTime() + ttl * 1000 }), remove: (k) => m.delete(k) };
}

// ---- Sessions ----
function secret(store, o) { let s = store.prop("sess_secret"); if (!s) { s = uuid(o) + uuid(o); store.setProp("sess_secret", s); } return s; }
const sign = (store, o, role, subj, exp, bind) => hex(hmac(secret(store, o), role + "|" + subj + "|" + exp + "|" + bind)).slice(0, 40);
function sessMake(store, o, role, subj, bind, ms) { const exp = (store.now().getTime() + ms).toString(36); return "s1." + role + "." + subj + "." + exp + "." + sign(store, o, role, subj, exp, bind); }
const isSession = (s) => /^s1\./.test(String(s || ""));
function sessRead(store, tok) {
  const m = /^s1\.([hs])\.([0-9A-Za-z]{1,20})\.([0-9a-z]{1,12})\.([0-9a-f]{40})$/.exec(String(tok || "").trim());
  if (!m) return null;
  if (parseInt(m[3], 36) < store.now().getTime()) return { expired: true };
  return { role: m[1], subj: m[2], exp: m[3], sig: m[4] };
}
const sessValid = (store, o, t, bind) => !!(t && !t.expired && bind && sign(store, o, t.role, t.subj, t.exp, bind) === t.sig);
function signOutEveryone(store, o) { store.setProp("sess_secret", uuid(o) + uuid(o)); logLine(store, "sessions ended", "all"); return { ok: true }; }

// ---- The lecturer ----
const hostStored = (store) => { const r = store.rows(KEY_TAB); return r && r[1] ? String(r[1][9] == null ? "" : r[1][9]).trim() : ""; };
function setHostStored(store, value) { const r = (store.rows(KEY_TAB) || []).map((x) => x.slice()); while (r.length < 2) r.push([]); while (r[1].length < 10) r[1].push(""); r[1][9] = value; store.setRows(KEY_TAB, r); }

function hostOk(store, p, req, o) {
  const hk = hostStored(store); if (!hk || !req.post) return false;
  const given = String(p.hostkey || "").trim();
  if (isSession(given)) { const t = sessRead(store, given); return !!(t && t.role === "h" && t.subj === "host" && sessValid(store, o, t, hk)); }
  const fails = Number(o.counters.get("hostfails") || 0);
  if (fails >= K.HOST_MAX_FAILS) return false;
  const ok = pwCheck(hk, given);
  if (!ok) o.counters.put("hostfails", String(fails + 1), 600); else req.session = sessMake(store, o, "h", "host", hk, K.HOST_HOURS * 3600000);
  return ok;
}

// ---- A student ----
const failsOf = (o, key) => Number(o.counters.get("attf:" + key) || 0);
const failAdd = (o, key) => o.counters.put("attf:" + key, String(failsOf(o, key) + 1), 600);
function studentCheck(store, rawId, given, tag, req, o) {
  const id = normalizeId(rawId); given = String(given || "").trim();
  const typed = !!given && !isSession(given) && !!req.post; // someone typed a code: a refusal here is a sign-in problem the lecturer may need to see (signin-attempts.js)
  const refuse = (why, reason) => { if (typed) SA.note(store, { id: id || rawId, where: "Student sign-in", reason }); return { why }; };
  if (id.length < 4 || id.length > 12) return refuse("bad id", "bad_id");
  if (!req.post) return { why: "not recognised" };
  if (failsOf(o, tag + id) >= K.ATT_MAX_FAILS) return refuse("slow down", "locked");
  const onList = AC.rosterRows(store).some((r) => r[0] === id), mine = onList ? AC.codesMap(store)[id] : null;
  if (isSession(given)) {
    const t = sessRead(store, given);
    if (t && t.expired) return { why: "session expired" };
    if (t && t.role === "s" && t.subj === id && mine && sessValid(store, o, t, mine.code)) return { id };
    failAdd(o, tag + id); return { why: "not recognised" };
  }
  if (Number(o.counters.get("signin_fails") || 0) >= K.SIGNIN_GLOBAL_MAX) return refuse("slow down", "locked");
  const code = AC.normCode(given);
  if (onList && !mine) return refuse("no access code", "no_code"); // nothing made yet: the page offers the student a 5-letter code of their own (action code_setup)
  if (!mine || !code || mine.code !== code) { failAdd(o, tag + id); o.counters.put("signin_fails", String(Number(o.counters.get("signin_fails") || 0) + 1), 600); return refuse("not recognised", onList ? "wrong_code" : "not_on_list"); }
  if (AC.expired(store, mine)) return refuse("code expired", "code_expired");
  req.session = sessMake(store, o, "s", id, mine.code, K.STUDENT_DAYS * 86400000);
  SA.noteOk(store, id, "Student sign-in");
  return { id };
}

// ---- Quiz receipts ----
const quizReceipt = (store, o, code, id) => hex(hmac(secret(store, o), "q|" + String(code).toUpperCase() + "|" + id)).slice(0, 24);
const receiptOk = (store, o, code, id, rc) => !!id && !!rc && quizReceipt(store, o, code, id) === String(rc).trim();

// ---- The password: a slow salted hash, the same stored form as the script ("pw1:rounds:salt:hash") ----
function pwHash(secretText, salt, rounds) {
  let u = salt + "|1", acc = null;
  for (let i = 0; i < rounds; i++) { const sig = hmac(secretText, u); acc = acc ? Buffer.from(acc.map((b, j) => (b ^ sig[j]) & 0xff)) : Buffer.from(sig); u = hex(sig); }
  return hex(acc);
}
const pwMake = (secretText, o) => { const salt = uuid(o); return "pw1:" + K.PW_ROUNDS + ":" + salt + ":" + pwHash(secretText, salt, K.PW_ROUNDS); };
function sameText(a, b) { a = String(a); b = String(b); let d = a.length ^ b.length; for (let i = 0; i < Math.min(a.length, b.length); i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; }
function pwCheck(stored, given) {
  stored = String(stored || ""); given = String(given || ""); if (!stored || !given) return false;
  const parts = stored.split(":");
  if (parts[0] === "pw1" && parts.length === 4) return sameText(pwHash(given, parts[2], Number(parts[1])), parts[3]);
  if (parts[0] === "sha256" && parts.length === 3) return sameText(hex(crypto.createHash("sha256").update(parts[1] + ":" + given).digest()), parts[2]); // the older stored form; see hashKey_
  return sameText(stored, given);
}
const pwChosen = (stored) => /^(pw1|sha256):/.test(String(stored || ""));
function pwProblem(pw, current) {
  if (pw !== pw.trim()) return "The password must not start or end with a space.";
  if (pw.length < K.PW_MIN || pw.length > K.PW_MAX) return "The password must be " + K.PW_MIN + " to " + K.PW_MAX + " characters. A few words make a good one.";
  if (/^(.)\1+$/.test(pw)) return "The password must not be one repeated character.";
  if (current && pw === current) return "The new password must differ from the current one.";
  return "";
}
function recoveryNew(o) { const A = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789", h = (uuid(o) + uuid(o)).replace(/-/g, ""); let s = ""; for (let i = 0; i < 20; i++) s += A.charAt(parseInt(h.substr(i * 2, 2), 16) % 32); return s; }
const recoveryShow = (c) => c.replace(/(.{5})(?=.)/g, "$1-");
const recoveryNorm = (t) => String(t || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
function pwStore(store, o, newPw) {
  setHostStored(store, pwMake(newPw, o));
  const code = recoveryNew(o); store.setProp("pw_recovery", pwMake(code, o));
  o.counters.remove("hostfails"); o.counters.remove("recfails");
  return recoveryShow(code);
}
const passwordStatus = (store) => ({ ok: true, chosen: pwChosen(hostStored(store)), recovery: !!(store.prop("pw_recovery") || ""), minLength: K.PW_MIN, maxLength: K.PW_MAX });

function setHostKey(store, p, req, o) {
  const nk = String(p.newkey || ""), cur = String(p.hostkey || "").trim();
  let why = pwProblem(nk, isSession(cur) ? "" : cur);
  if (!why && pwCheck(hostStored(store), nk)) why = "The new password must differ from the current one.";
  if (why) return { ok: false, why };
  const code = pwStore(store, o, nk); req.session = ""; logLine(store, "host password changed");
  return { ok: true, recovery: code };
}
function recoverHostKey(store, p, o) {
  const fails = Number(o.counters.get("recfails") || 0);
  if (fails >= K.RECOVERY_MAX_FAILS) return { ok: false, why: "Too many wrong recovery codes. Try again in an hour, or use the reset in the script editor." };
  const stored = store.prop("pw_recovery") || "", given = recoveryNorm(p.recovery), nk = String(p.newkey || "");
  if (!stored || !given || !pwCheck(stored, given)) { o.counters.put("recfails", String(fails + 1), 3600); logLine(store, "recovery code refused"); return { ok: false, why: "That recovery code was not accepted." }; }
  const why = pwProblem(nk, ""); if (why) return { ok: false, why };
  const code = pwStore(store, o, nk); logLine(store, "host password recovered");
  return { ok: true, recovery: code };
}
function resetHostKey(store, o) {
  const tmp = uuid(o).replace(/-/g, "").slice(0, 16);
  setHostStored(store, tmp); store.setProp("pw_recovery", ""); signOutEveryone(store, o);
  o.counters.remove("hostfails"); o.counters.remove("recfails"); logLine(store, "host password reset", "by the owner");
  return "Temporary key: " + tmp + " . Sign in with it, then choose your own password at once.";
}
function ownerSetPassword(store, pw, o) {
  pw = String(pw || ""); const why = pwProblem(pw, ""); if (why) return { ok: false, why };
  const code = pwStore(store, o, pw); signOutEveryone(store, o); logLine(store, "host password set by the owner");
  return { ok: true, recovery: code };
}

module.exports = { K, failsOf, failAdd, memoryCounters, sessMake, sessRead, sessValid, isSession, signOutEveryone, hostOk, studentCheck, quizReceipt, receiptOk, pwHash, pwMake, pwCheck, pwChosen, pwProblem, passwordStatus, setHostKey, recoverHostKey, resetHostKey, ownerSetPassword, hostStored };
