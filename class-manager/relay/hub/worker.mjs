/* CM relay: the one hosted Worker that lets phones take part when the lecturer's computer is off. Entry point only: it routes to src/.
   Needs: a D1 database bound as DB, and the secret RELAY_SECRET (made by deploy.mjs). Optional: REGISTRATION_OPEN="0" (kill switch), BUILD_KEYS.
   Courses register themselves; nothing is created by hand per lecturer. See README.md in this folder. */
import { CORS, reply, fail, readJson } from "./src/http.js";
import { setup, cleanup } from "./src/db.js";
import { authCourse } from "./src/auth.js";
import { challenge, register, publicCourse } from "./src/registry.js";
import { drop, pull, ack } from "./src/mailbox.js";
import { setState, closeCourse } from "./src/live.js";
import * as attend from "./src/attend.js";

export async function handle(req, env, now) {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  const path = new URL(req.url).pathname, db = env.DB;
  if (req.method === "GET" && path === "/health") return reply({ ok: true, version: 1 });
  if (!env.RELAY_SECRET || !db) return fail(500, "not set up");
  if (req.method === "GET" && path === "/v1/challenge") return challenge(req, env, db, now);
  const m = /^\/v1\/course\/([\w-]{1,30})$/.exec(path);
  if (req.method === "GET" && m) return publicCourse(m[1], req, db, now);
  if (req.method !== "POST") return fail(404, "not found");
  if (path === "/v1/register") return register(req, env, db, now);
  if (path === "/v1/drop") return drop(req, db, now);
  if (path === "/v1/attend") return attend.checkIn(req, db, now); // a phone checking in
  if (["/v1/pull", "/v1/ack", "/v1/state", "/v1/close", "/v1/live/open", "/v1/live/close", "/v1/live/events", "/v1/live/ack"].includes(path)) { // only the course's own CM, signed
    const r = await readJson(req, path === "/v1/live/open" ? 262144 : 65536); if (r.error) return r.error;
    const who = await authCourse(req, r.text, db, now); if (!who.ok) return fail(who.status, who.why);
    if (path === "/v1/pull") return pull(who.course, db);
    if (path === "/v1/ack") return ack(who.course, r.body, db);
    if (path === "/v1/state") return setState(who.course, r.body, db, now);
    if (path === "/v1/live/open") return attend.open(who.course, r.body, db, now);
    if (path === "/v1/live/close") return attend.close(who.course, db, now);
    if (path === "/v1/live/events") return attend.events(who.course, r.body, db);
    if (path === "/v1/live/ack") return attend.ackEvents(who.course, r.body, db);
    return closeCourse(who.course, db);
  }
  return fail(404, "not found");
}

export default {
  async fetch(req, env) { return handle(req, env, Math.floor(Date.now() / 1000)); },
  async scheduled(event, env) { const now = Math.floor(Date.now() / 1000); await setup(env.DB); await cleanup(env.DB, now); }
};
