/* Replies and request reading shared by the handlers. One responsibility: the shape of an answer (JSON, no caching, CORS for phones). */
export const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type, X-CM-Course, X-CM-Time, X-CM-Nonce, X-CM-Sig", "Access-Control-Allow-Methods": "GET, POST, OPTIONS" };
export const reply = (obj, status) => new Response(JSON.stringify(obj), { status: status || 200, headers: Object.assign({ "Content-Type": "application/json", "Cache-Control": "no-store" }, CORS) });
export const fail = (status, why) => reply({ ok: false, why }, status);
export const ipOf = (req) => req.headers.get("CF-Connecting-IP") || req.headers.get("X-Forwarded-For") || "unknown";
export async function readJson(req, max) {
  const text = await req.text();
  if (text.length > max) return { error: fail(413, "too large"), text };
  try { return { text, body: text ? JSON.parse(text) : {} }; } catch (e) { return { error: fail(400, "bad request"), text }; }
}
