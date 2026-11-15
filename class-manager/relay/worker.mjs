/* CM mailbox: a very small Cloudflare Worker that holds sealed submissions until CM collects them.
   It cannot read them (they are encrypted on the phone with CM's public key), holds no names and no course data,
   and forgets everything after 14 days. CM stays the only place where records live. See README.md in this folder.

   Needs: a KV namespace bound as BOX, and two secrets: DROP_TOKEN (phones, public in the course page) and PULL_TOKEN (CM only). */
const KEEP_SECONDS = 14 * 86400, MAX_BYTES = 16384, MAX_ITEMS = 1000, MAX_PULL = 100;
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type, Authorization", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const reply = (obj, status) => new Response(JSON.stringify(obj), { status: status || 200, headers: Object.assign({ "Content-Type": "application/json", "Cache-Control": "no-store" }, CORS) });
const same = (a, b) => { a = String(a || ""); b = String(b || ""); if (a.length !== b.length || !a) return false; let x = 0; for (let i = 0; i < a.length; i++) x |= a.charCodeAt(i) ^ b.charCodeAt(i); return x === 0; };
const course = (c) => String(c || "").replace(/[^\w-]/g, "").slice(0, 40);

async function put(req, env) {
  const text = await req.text();
  if (text.length > MAX_BYTES) return reply({ ok: false, why: "too large" }, 413);
  let b; try { b = JSON.parse(text); } catch (e) { return reply({ ok: false, why: "bad request" }, 400); }
  if (!same(b.drop, env.DROP_TOKEN)) return reply({ ok: false, why: "not allowed" }, 403);
  const c = course(b.course); if (!c || !b.sealed || !b.sealed.k || !b.sealed.iv || !b.sealed.c) return reply({ ok: false, why: "bad request" }, 400);
  const have = await env.BOX.list({ prefix: c + ":", limit: MAX_ITEMS });
  if (have.keys.length >= MAX_ITEMS) return reply({ ok: false, why: "mailbox full" }, 429);
  const id = c + ":" + Date.now().toString().padStart(15, "0") + ":" + Math.random().toString(36).slice(2, 10);
  await env.BOX.put(id, JSON.stringify(b.sealed), { expirationTtl: KEEP_SECONDS });
  return reply({ ok: true });
}
function lecturer(req, env) { const h = req.headers.get("Authorization") || ""; return same(h.replace(/^Bearer /, ""), env.PULL_TOKEN); }
async function pull(req, env) {
  if (!lecturer(req, env)) return reply({ ok: false, why: "not allowed" }, 403);
  const b = await req.json().catch(() => ({}));
  const list = await env.BOX.list({ prefix: course(b.course) + ":", limit: MAX_PULL });
  const items = [];
  for (const k of list.keys) { const v = await env.BOX.get(k.name); if (v) { try { items.push({ id: k.name, sealed: JSON.parse(v) }); } catch (e) { items.push({ id: k.name, sealed: null }); } } }
  return reply({ ok: true, items, more: !list.list_complete });
}
async function ack(req, env) {
  if (!lecturer(req, env)) return reply({ ok: false, why: "not allowed" }, 403);
  const b = await req.json().catch(() => ({}));
  const ids = (Array.isArray(b.ids) ? b.ids : []).slice(0, MAX_PULL).filter((x) => typeof x === "string");
  for (const id of ids) await env.BOX.delete(id);
  return reply({ ok: true, removed: ids.length });
}

const worker = {
  async fetch(req, env) {
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
    const path = new URL(req.url).pathname;
    if (req.method === "GET" && path === "/health") return reply({ ok: true });
    if (req.method !== "POST") return reply({ ok: false, why: "not found" }, 404);
    if (path === "/put") return put(req, env);
    if (path === "/pull") return pull(req, env);
    if (path === "/ack") return ack(req, env);
    return reply({ ok: false, why: "not found" }, 404);
  }
};
export default worker;
