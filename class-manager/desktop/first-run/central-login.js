// the one password for CM (Hope, 2026-11-16): chosen once, opens CM, and is the same for every course. Stored as a salted slow hash in CM's own
// data folder, never in a course. A recovery code (shown once) can set a new password. Courses receive the same password through main.js (first-run/README.md).
"use strict";
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const MIN = 10, MAX = 100, N = 16384, FAILS = 8, LOCK_MS = 60 * 1000;

const hash = (pw, salt) => crypto.scryptSync(String(pw), Buffer.from(salt, "hex"), 32, { N }).toString("hex");
const same = (a, b) => { const x = Buffer.from(a, "hex"), y = Buffer.from(b, "hex"); return x.length === y.length && crypto.timingSafeEqual(x, y); };
const recoveryNorm = (t) => String(t || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
function newRecovery() { const A = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789", b = crypto.randomBytes(20); let s = ""; for (let i = 0; i < 20; i++) s += A[b[i] % 32]; return s.replace(/(.{5})(?=.)/g, "$1-"); }

function problem(pw) {
  pw = String(pw == null ? "" : pw);
  if (pw.length < MIN) return "Use at least " + MIN + " characters.";
  if (pw.length > MAX) return "Use at most " + MAX + " characters.";
  if (pw !== pw.trim()) return "The password cannot start or end with a space.";
  if (/^(.)\1+$/.test(pw)) return "Choose a password that is not one repeated character.";
  return "";
}

function createCentralLogin({ file, now }) {
  now = now || Date.now;
  let fails = 0, lockedUntil = 0;
  const read = () => { try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch (e) { return null; } };
  const write = (o) => { fs.mkdirSync(path.dirname(file), { recursive: true }); const t = file + ".tmp"; fs.writeFileSync(t, JSON.stringify(o), { mode: 0o600 }); fs.renameSync(t, file); };

  const status = () => { const o = read(); return { ok: true, chosen: !!o, minLength: MIN, maxLength: MAX, stamp: o ? o.stamp : "" }; };

  function save(pw) {
    const salt = crypto.randomBytes(16).toString("hex"), rsalt = crypto.randomBytes(16).toString("hex"), code = newRecovery();
    write({ v: 1, salt, hash: hash(pw, salt), rsalt, rhash: hash(recoveryNorm(code), rsalt), stamp: crypto.randomBytes(8).toString("hex"), changed: new Date(now()).toISOString() });
    fails = 0; lockedUntil = 0;
    return { ok: true, recovery: code };
  }
  // The first password, or a change by the person at this computer who has signed in.
  const set = (pw) => { const why = problem(pw); return why ? { ok: false, why } : save(pw); };

  function gate() { if (now() < lockedUntil) return { ok: false, why: "Too many wrong attempts. Try again in a minute." }; return null; }
  function miss() { fails++; if (fails >= FAILS) { lockedUntil = now() + LOCK_MS; fails = 0; } return { ok: false, why: "That was not accepted." }; }
  function check(pw) { const o = read(); if (!o) return { ok: false, why: "No password has been chosen yet." }; const g = gate(); if (g) return g; if (!same(hash(pw, o.salt), o.hash)) return miss(); fails = 0; return { ok: true }; }
  function recover(code, newPw) {
    const o = read(); if (!o) return { ok: false, why: "No password has been chosen yet." }; const g = gate(); if (g) return g;
    if (!same(hash(recoveryNorm(code), o.rsalt), o.rhash)) return miss();
    return set(newPw);
  }
  return { status, set, check, recover, problem };
}

module.exports = { createCentralLogin, problem, MIN };
