/* The relay's tables (Cloudflare D1, which is SQLite). One responsibility: the schema, and the cleanup that forgets old data.
   Nothing here knows about requests. Every table is per course so a course can only ever touch its own rows. */
export const SCHEMA = [
  "CREATE TABLE IF NOT EXISTS course (id TEXT PRIMARY KEY, pub TEXT NOT NULL, enc TEXT NOT NULL, created INTEGER NOT NULL, last_seen INTEGER NOT NULL)",
  "CREATE TABLE IF NOT EXISTS item (id INTEGER PRIMARY KEY AUTOINCREMENT, course TEXT NOT NULL, at INTEGER NOT NULL, body TEXT NOT NULL)",
  "CREATE INDEX IF NOT EXISTS item_course ON item(course, id)",
  "CREATE TABLE IF NOT EXISTS state (course TEXT NOT NULL, k TEXT NOT NULL, v TEXT NOT NULL, at INTEGER NOT NULL, PRIMARY KEY (course, k))",
  "CREATE TABLE IF NOT EXISTS nonce (course TEXT NOT NULL, n TEXT NOT NULL, at INTEGER NOT NULL, PRIMARY KEY (course, n))",
  "CREATE TABLE IF NOT EXISTS hit (k TEXT NOT NULL, win INTEGER NOT NULL, n INTEGER NOT NULL, at INTEGER NOT NULL, PRIMARY KEY (k, win))",
  // Live attendance (src/attend.js): one open session per course with its class list as one small record, and the events phones cause.
  "CREATE TABLE IF NOT EXISTS live_session (course TEXT PRIMARY KEY, label TEXT NOT NULL, secret TEXT NOT NULL, mode TEXT NOT NULL, lat REAL, lon REAL, radius INTEGER NOT NULL, status TEXT NOT NULL, roster TEXT NOT NULL, phones TEXT NOT NULL, at INTEGER NOT NULL)",
  "CREATE TABLE IF NOT EXISTS live_event (id INTEGER PRIMARY KEY AUTOINCREMENT, course TEXT NOT NULL, label TEXT NOT NULL, kind TEXT NOT NULL, sid TEXT NOT NULL, dev TEXT NOT NULL, note TEXT NOT NULL, at INTEGER NOT NULL)",
  "CREATE INDEX IF NOT EXISTS live_event_course ON live_event(course, id)",
  "CREATE UNIQUE INDEX IF NOT EXISTS live_event_one_id ON live_event(course, label, sid) WHERE kind = 'ok'",
  "CREATE UNIQUE INDEX IF NOT EXISTS live_event_one_dev ON live_event(course, label, dev) WHERE kind = 'ok' AND dev <> ''",
  "CREATE TABLE IF NOT EXISTS live_phone (course TEXT NOT NULL, sid TEXT NOT NULL, dev TEXT NOT NULL, PRIMARY KEY (course, sid))",
  // Access codes shown to students who sign in to the open session (src/attend.js, claim): kept only while the session is open, removed when it closes.
  "CREATE TABLE IF NOT EXISTS live_code (course TEXT NOT NULL, sid TEXT NOT NULL, code TEXT NOT NULL, at INTEGER NOT NULL, PRIMARY KEY (course, sid))",
  // Live quizzes (src/quiz.js): the open quiz's status and question text (no answers) and the joins and answers phones send.
  "CREATE TABLE IF NOT EXISTS live_quiz (course TEXT PRIMARY KEY, code TEXT NOT NULL, status TEXT NOT NULL, questions TEXT NOT NULL, present TEXT NOT NULL, at INTEGER NOT NULL)",
  "CREATE TABLE IF NOT EXISTS quiz_event (id INTEGER PRIMARY KEY AUTOINCREMENT, course TEXT NOT NULL, kind TEXT NOT NULL, sid TEXT NOT NULL, body TEXT NOT NULL, at INTEGER NOT NULL)",
  "CREATE INDEX IF NOT EXISTS quiz_event_course ON quiz_event(course, id)"
];

export const LIMITS = {
  itemBytes: 16384, itemsPerCourse: 2000, stateBytes: 8192, stateKeys: 32, pullMax: 100,
  courses: 5000,                       // all courses together: a safety ceiling, not a target
  keepItemDays: 14, rosterMax: 1500, eventsMax: 6000, eventsPull: 500, unusedCourseDays: 60, nonceSeconds: 600, skewSeconds: 300
};

export async function setup(db) { for (const sql of SCHEMA) await db.prepare(sql).run(); }

// The scheduled cleanup: the forgetting rules in one place. Returns what it removed (for the log and the tests).
export async function cleanup(db, now) {
  const day = 86400, out = {};
  const run = async (name, sql, ...args) => { const r = await db.prepare(sql).bind(...args).run(); out[name] = (r.meta && r.meta.changes) || 0; };
  await run("items", "DELETE FROM item WHERE at < ?", now - LIMITS.keepItemDays * day);
  await run("nonces", "DELETE FROM nonce WHERE at < ?", now - LIMITS.nonceSeconds * 2);
  await run("hits", "DELETE FROM hit WHERE at < ?", now - 2 * day);
  const old = now - LIMITS.unusedCourseDays * day;
  await run("courseItems", "DELETE FROM item WHERE course IN (SELECT id FROM course WHERE last_seen < ?)", old);
  await run("liveEvents", "DELETE FROM live_event WHERE at < ?", now - LIMITS.keepItemDays * day);
  await run("quizEvents", "DELETE FROM quiz_event WHERE at < ?", now - LIMITS.keepItemDays * day);
  await run("quizStale", "DELETE FROM live_quiz WHERE at < ?", now - day);
  await run("liveCodes", "DELETE FROM live_code WHERE course NOT IN (SELECT course FROM live_session WHERE status = 'Open') OR at < ?", now - day);
  await run("liveClosed", "DELETE FROM live_session WHERE status <> 'Open' AND at < ?", now - LIMITS.keepItemDays * day);
  await run("courseState", "DELETE FROM state WHERE course IN (SELECT id FROM course WHERE last_seen < ?)", old);
  await run("courseNonces", "DELETE FROM nonce WHERE course IN (SELECT id FROM course WHERE last_seen < ?)", old);
  await run("courses", "DELETE FROM course WHERE last_seen < ?", old);
  return out;
}

export async function deleteCourse(db, id) {
  for (const t of ["item", "state", "nonce", "live_session", "live_event", "live_phone", "live_code", "live_quiz", "quiz_event"]) await db.prepare("DELETE FROM " + t + " WHERE course = ?").bind(id).run();
  await db.prepare("DELETE FROM course WHERE id = ?").bind(id).run();
}
