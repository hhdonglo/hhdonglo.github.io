/* Who is asking. One responsibility: check that a request really comes from the course's CM.
   CM signs  METHOD \n PATH \n TIME \n NONCE \n SHA256(body)  with the course key (ECDSA P-256). The relay checks the signature against the public key
   it stored at registration, that the time is close to now, and that the nonce was not used before (so a copied request cannot be replayed). */
import { sha256Hex, verifySignature } from "./crypto.js";
import { LIMITS } from "./db.js";

export async function authCourse(req, body, db, now) {
  const id = req.headers.get("X-CM-Course") || "", t = Number(req.headers.get("X-CM-Time")), nonce = (req.headers.get("X-CM-Nonce") || "").slice(0, 40), sig = req.headers.get("X-CM-Sig") || "";
  if (!id || !nonce || !sig || !(t > 0)) return { ok: false, status: 401, why: "not signed" };
  if (Math.abs(now - t) > LIMITS.skewSeconds) return { ok: false, status: 401, why: "clock" };
  const row = await db.prepare("SELECT id, pub FROM course WHERE id = ?").bind(id).first();
  if (!row) return { ok: false, status: 404, why: "unknown course" };
  const path = new URL(req.url).pathname;
  const msg = [req.method, path, String(t), nonce, await sha256Hex(body)].join("\n");
  if (!(await verifySignature(JSON.parse(row.pub), msg, sig))) return { ok: false, status: 403, why: "bad signature" };
  const ins = await db.prepare("INSERT OR IGNORE INTO nonce(course, n, at) VALUES(?, ?, ?)").bind(id, nonce, now).run();
  if (!ins.meta || !ins.meta.changes) return { ok: false, status: 409, why: "repeated" };
  await db.prepare("UPDATE course SET last_seen = ? WHERE id = ?").bind(now, id).run();
  return { ok: true, course: id };
}
