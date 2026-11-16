/* Sealed items from phones (practice results, reports and, later, check-ins) held until CM collects them.
   One responsibility: drop (phones), pull and ack (CM, signed). The relay cannot read an item: the phone seals it with the course's public key. */
import { allow, RATES } from "./limits.js";
import { LIMITS } from "./db.js";
import { reply, fail, ipOf, readJson } from "./http.js";

export async function drop(req, db, now) {
  const r = await readJson(req, LIMITS.itemBytes); if (r.error) return r.error; const b = r.body;
  const id = String(b.course || "").slice(0, 30), s = b.sealed;
  if (!id || !s || !s.k || !s.iv || !s.c) return fail(400, "bad request");
  if (!(await allow(db, "drop:ip:" + ipOf(req) + ":" + id, 60, RATES.dropPerIpPerMin, now))) return fail(429, "slow down");
  if (!(await allow(db, "drop:" + id, 60, RATES.dropPerCoursePerMin, now))) return fail(429, "this course is busy, try again");
  const c = await db.prepare("SELECT id FROM course WHERE id = ?").bind(id).first(); if (!c) return fail(404, "unknown course");
  const n = await db.prepare("SELECT COUNT(*) AS n FROM item WHERE course = ?").bind(id).first();
  if (n.n >= LIMITS.itemsPerCourse) return fail(429, "mailbox full");
  await db.prepare("INSERT INTO item(course, at, body) VALUES(?, ?, ?)").bind(id, now, JSON.stringify({ k: s.k, iv: s.iv, c: s.c })).run();
  return reply({ ok: true });
}

export async function pull(course, db) {
  const rows = await db.prepare("SELECT id, body FROM item WHERE course = ? ORDER BY id LIMIT ?").bind(course, LIMITS.pullMax + 1).all();
  const list = rows.results || [];
  return reply({ ok: true, items: list.slice(0, LIMITS.pullMax).map((x) => ({ id: x.id, sealed: JSON.parse(x.body) })), more: list.length > LIMITS.pullMax });
}

export async function ack(course, body, db) {
  const ids = (Array.isArray(body.ids) ? body.ids : []).slice(0, LIMITS.pullMax).map(Number).filter((x) => Number.isInteger(x));
  let removed = 0;
  for (const id of ids) { const r = await db.prepare("DELETE FROM item WHERE course = ? AND id = ?").bind(course, id).run(); removed += (r.meta && r.meta.changes) || 0; }
  return reply({ ok: true, removed });
}
