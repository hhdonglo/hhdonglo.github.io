/* Small cryptographic helpers for the relay (WebCrypto only, so the same code runs in a Worker and in Node).
   One responsibility: hashes, base64url, verifying a course signature, the self-certifying course id, and the proof-of-work check. */
const enc = new TextEncoder();

export const b64u = {
  from(bytes) { let s = ""; bytes = new Uint8Array(bytes); for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]); return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); },
  to(text) { const s = atob(String(text).replace(/-/g, "+").replace(/_/g, "/")); const o = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) o[i] = s.charCodeAt(i); return o; }
};
export const hex = (bytes) => Array.from(new Uint8Array(bytes)).map((b) => b.toString(16).padStart(2, "0")).join("");
export async function sha256(data) { return new Uint8Array(await crypto.subtle.digest("SHA-256", typeof data === "string" ? enc.encode(data) : data)); }
export const sha256Hex = async (data) => hex(await sha256(data));

// The course key is an ECDSA P-256 public key as a JWK ({kty, crv, x, y}). The course id is made from it, so nobody can claim another course's id.
export function cleanKey(jwk) {
  if (!jwk || jwk.kty !== "EC" || jwk.crv !== "P-256" || typeof jwk.x !== "string" || typeof jwk.y !== "string" || jwk.x.length > 64 || jwk.y.length > 64) return null;
  return { kty: "EC", crv: "P-256", x: jwk.x, y: jwk.y };
}
export async function courseIdOf(jwk) { return "c" + (await sha256Hex(jwk.x + "." + jwk.y)).slice(0, 20); }
export async function verifySignature(jwk, message, sigB64u) {
  try {
    const key = await crypto.subtle.importKey("jwk", jwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);
    return await crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, key, b64u.to(sigB64u), enc.encode(message));
  } catch (e) { return false; }
}

export function leadingZeroBits(bytes) {
  let n = 0;
  for (const b of bytes) { if (b === 0) { n += 8; continue; } n += Math.clz32(b) - 24; break; }
  return n;
}
export async function hmacHex(secret, text) {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return hex(await crypto.subtle.sign("HMAC", key, enc.encode(text)));
}
export const same = (a, b) => { a = String(a || ""); b = String(b || ""); if (a.length !== b.length || !a) return false; let x = 0; for (let i = 0; i < a.length; i++) x |= a.charCodeAt(i) ^ b.charCodeAt(i); return x === 0; };
