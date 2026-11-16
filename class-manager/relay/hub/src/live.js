/* Live state of a running class: small named values CM sets (for example the open question or the attendance session) and phones read.
   One responsibility: set and close. Reading is in registry.js (publicCourse). The rules that use this state are ported in later stages. */
import { LIMITS, deleteCourse } from "./db.js";
import { reply, fail } from "./http.js";

// body.set: { key: text }, body.remove: [keys]. Keys are short names; a course holds a few small values.
export async function setState(course, body, db, now) {
  const set = body.set && typeof body.set === "object" ? body.set : {}, remove = Array.isArray(body.remove) ? body.remove : [];
  const keys = Object.keys(set);
  for (const k of keys) { if (!/^[\w.-]{1,40}$/.test(k) || typeof set[k] !== "string" || set[k].length > LIMITS.stateBytes) return fail(400, "bad state"); }
  const have = (await db.prepare("SELECT COUNT(*) AS n FROM state WHERE course = ?").bind(course).first()).n;
  if (have + keys.length > LIMITS.stateKeys + remove.length) return fail(429, "too many values");
  for (const k of remove) await db.prepare("DELETE FROM state WHERE course = ? AND k = ?").bind(course, String(k).slice(0, 40)).run();
  for (const k of keys) await db.prepare("INSERT INTO state(course, k, v, at) VALUES(?, ?, ?, ?) ON CONFLICT(course, k) DO UPDATE SET v = excluded.v, at = excluded.at").bind(course, k, set[k], now).run();
  return reply({ ok: true, set: keys.length, removed: remove.length });
}

// The lecturer closes the course: everything for it is forgotten at once.
export async function closeCourse(course, db) { await deleteCourse(db, course); return reply({ ok: true, closed: true }); }
