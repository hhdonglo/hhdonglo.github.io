/* Abuse controls that need no human: counters per time window, and the proof of work a new course must solve.
   One responsibility: say yes or no. The numbers live in LIMITS (db.js) and RATES below, in one place. */
import { sha256, leadingZeroBits, hmacHex, same } from "./crypto.js";

export const RATES = {
  registerPerIpHour: 5, registerPerDay: 300,   // new courses
  dropPerCoursePerMin: 120, dropPerIpPerMin: 30, // phones sending
  readPerIpPerMin: 60,                           // phones reading a course
  powBits: 18                                    // about a second of work for CM, costly in bulk
};

// Counts one hit in the current window of windowSec seconds; returns true while the count is within max.
export async function allow(db, key, windowSec, max, now) {
  const win = Math.floor(now / windowSec);
  const row = await db.prepare("INSERT INTO hit(k, win, n, at) VALUES(?, ?, 1, ?) ON CONFLICT(k, win) DO UPDATE SET n = n + 1 RETURNING n").bind(key + "@" + windowSec, win, now).first();
  return !!row && row.n <= max;
}

// Proof of work. The challenge is stateless: time, a random part, and a signature only the relay can make.
export async function makeChallenge(secret, now) {
  const body = now + "." + Math.random().toString(36).slice(2, 12);
  return body + "." + (await hmacHex(secret, body));
}
export async function checkWork(secret, challenge, pubId, nonce, now, bits) {
  const parts = String(challenge || "").split(".");
  if (parts.length !== 3) return false;
  const t = Number(parts[0]); if (!(t > 0) || now - t > 600 || t - now > 60) return false;
  if (!same(parts[2], await hmacHex(secret, parts[0] + "." + parts[1]))) return false;
  const h = await sha256(challenge + ":" + pubId + ":" + String(nonce || "").slice(0, 40));
  return leadingZeroBits(h) >= bits;
}

// Failed attempts: count without adding (peek), add one (bump). Used for the check-in slow-down after repeated wrong answers.
export async function peek(db, key, windowSec, now) {
  const row = await db.prepare("SELECT n FROM hit WHERE k = ? AND win = ?").bind(key + "@" + windowSec, Math.floor(now / windowSec)).first();
  return row ? row.n : 0;
}
export const bump = (db, key, windowSec, now) => allow(db, key, windowSec, 1e9, now);
