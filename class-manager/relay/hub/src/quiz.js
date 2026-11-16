/* Live quizzes on the relay, so phones can join and answer while the lecturer's computer is off.
   The relay holds only what a phone may see: the quiz's status and its question text (never the answers or the key), who has joined, and the answers
   phones send. It admits an answer by the same checks as desktop/rules/quiz-submit.js (the quiz is running, this is the open question, the question is
   not closed, the student joined) and keeps it as an event; CM collects the events and records them through those same rules, which stay the authority.
   test/quiz.test.js runs both on the same cases. One responsibility: the open quiz and its events. Routing is in worker.mjs. */
import { allow } from "./limits.js";
import { LIMITS } from "./db.js";
import { reply, fail, ipOf, readJson } from "./http.js";

const GRACE_MS = 15000, LETTERS = ["A", "B", "C", "D", "E"];
const clean = (v, max) => String(v == null ? "" : v).trim().slice(0, max);

// CM, signed. body: { code, status, questions: [{stem, opts}], present: [ids] }. Opens the quiz, or replaces its state while it runs.
export async function put(course, body, db, now) {
  const code = clean(body.code, 30).toUpperCase(), status = body.status && typeof body.status === "object" ? body.status : null;
  if (!code || !status || !Array.isArray(body.questions)) return fail(400, "bad quiz");
  const qs = JSON.stringify(body.questions), st = JSON.stringify(status), present = JSON.stringify(Array.isArray(body.present) ? body.present.map(String).slice(0, LIMITS.rosterMax) : []);
  if (qs.length > 65536 || st.length > 8192) return fail(413, "too large");
  await db.prepare("INSERT INTO live_quiz(course, code, status, questions, present, at) VALUES(?, ?, ?, ?, ?, ?) ON CONFLICT(course) DO UPDATE SET code = excluded.code, status = excluded.status, questions = excluded.questions, present = excluded.present, at = excluded.at")
    .bind(course, code, st, qs, present, now).run();
  return reply({ ok: true, code });
}
// CM, signed: stop taking answers and forget the question text; the events stay until CM collects them.
export async function close(course, db) { await db.prepare("DELETE FROM live_quiz WHERE course = ?").bind(course).run(); return reply({ ok: true }); }
export async function events(course, body, db) {
  const rows = (await db.prepare("SELECT id, kind, sid, body, at FROM quiz_event WHERE course = ? AND id > ? ORDER BY id LIMIT ?").bind(course, Number(body.after) || 0, LIMITS.eventsPull + 1).all()).results || [];
  return reply({ ok: true, events: rows.slice(0, LIMITS.eventsPull), more: rows.length > LIMITS.eventsPull });
}
export async function ackEvents(course, body, db) {
  const r = await db.prepare("DELETE FROM quiz_event WHERE course = ? AND id <= ?").bind(course, Number(body.upto) || 0).run();
  return reply({ ok: true, removed: (r.meta && r.meta.changes) || 0 });
}

const joined = async (db, course, sid, present) => present.indexOf(sid) >= 0 || !!(await db.prepare("SELECT 1 AS x FROM quiz_event WHERE course = ? AND kind = 'join' AND sid = ?").bind(course, sid).first());
const event = (db, course, kind, sid, p, now) => db.prepare("INSERT INTO quiz_event(course, kind, sid, body, at) VALUES(?, ?, ?, ?, ?)").bind(course, kind, sid, JSON.stringify(p), now).run();

// A phone, unsigned: body { course, params } where params is what the page sends the class server (action status or questions, or kind join, progress, answer, submit).
export async function call(req, db, now) {
  const r = await readJson(req, 4096); if (r.error) return r.error; const course = clean(r.body.course, 30), p = r.body.params && typeof r.body.params === "object" ? r.body.params : {};
  if (!(await allow(db, "quiz:ip:" + ipOf(req) + ":" + course, 60, 120, now))) return fail(429, "slow down");
  if (!(await allow(db, "quiz:" + course, 60, 6000, now))) return fail(429, "this class is busy, try again");
  const q = await db.prepare("SELECT * FROM live_quiz WHERE course = ?").bind(course).first();
  const code = clean(p.code, 30).toUpperCase(), nowMs = now * 1000;
  if (p.action === "status" || p.action === "questions") {
    if (!q || q.code !== code) return reply(p.action === "questions" ? { questions: [] } : { timed: false, known: false, state: "" });
    if (p.action === "questions") return reply({ questions: JSON.parse(q.questions) });
    const s = JSON.parse(q.status); s.known = true; s.serverNow = nowMs;
    if (s.state === "running" && s.timed && s.endTime) s.remainingMs = Math.max(0, s.endTime - nowMs);
    return reply(s);
  }
  const name = clean(p.name, 40), id = clean(p.id, 20).replace(/\D/g, ""), done = (outcome) => reply({ ok: outcome === "ok", outcome });
  if (!["join", "progress", "answer", "submit"].includes(p.kind || "submit")) return fail(400, "not on the relay");
  const kind0 = p.kind || "submit";
  if (!q || q.code !== code) return done(kind0 === "answer" ? "bad answer" : kind0 === "submit" ? (!name || !id || !code ? "missing" : "bad code") : "ok"); // as the rules answer a code no quiz uses
  const s = JSON.parse(q.status), present = JSON.parse(q.present), kind = p.kind || "submit";
  const room = (await db.prepare("SELECT COUNT(*) AS n FROM quiz_event WHERE course = ?").bind(course).first()).n; if (room >= LIMITS.eventsMax) return fail(429, "too many waiting");
  if (kind === "join" || kind === "progress") {
    if (!name || !id) return done("ok");
    if (!s.allowLate && (s.state === "running" || s.state === "paused") && !(await joined(db, course, id, present))) return done("late");
    await event(db, course, kind, id, { kind, name, id, code }, now); return done("ok");
  }
  if (kind === "answer") {
    const qn = Number(p.q), al = clean(p.answer, 4).toUpperCase();
    if (!name || !id || LETTERS.indexOf(al) < 0 || !(qn >= 1 && qn <= (Number(s.totalQ) || 5))) return done("bad answer");
    if (!s.paced) return done("not paced");
    if (s.state !== "running") return done("not open");
    if (Number(s.currentQ) !== qn) return done("wrong question");
    if (Number(s.qDeadline) && nowMs > Number(s.qDeadline) + GRACE_MS) return done("question closed");
    if (!s.allowLate && !(await joined(db, course, id, present))) return done("not joined");
    let cf = clean(p.conf, 4).toUpperCase().charAt(0); if ("HML".indexOf(cf) < 0) cf = "";
    await event(db, course, "answer", id, { kind: "answer", name, id, code, q: qn, answer: al, conf: cf, round: Number(s.round) || 0, vote: Number(s.vote) || 0 }, now); return done("ok");
  }
  // a whole quiz at once (a timed quiz)
  if (!name || !id || !code) return done("missing");
  if (s.paced) return done("use answers");
  const left = Number(s.endTime) + GRACE_MS - nowMs;
  if (["draft", "ready", "lobby"].includes(s.state)) return done("not started");
  if (s.state === "paused") return done("paused");
  if (s.state === "released") return done("quiz closed");
  if (s.state === "ended" && left < 0) return done("quiz closed");
  if (!s.allowLate && !(await joined(db, course, id, present))) return done("not joined");
  const body = { kind: "submit", name, id, code }; for (let i = 1; i <= 5; i++) body["q" + i] = clean(p["q" + i], 2);
  await event(db, course, "submit", id, body, now); return done("ok");
}
