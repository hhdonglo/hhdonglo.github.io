/* Signs and checks RS256 tokens (JWT) with Node's own crypto, so no outside library is needed. */
"use strict";
const crypto = require("crypto");

const b64 = (b) => Buffer.from(b).toString("base64url");
const fromB64 = (s) => Buffer.from(s, "base64url");

function sign(claims, key) {
  const head = b64(JSON.stringify({ alg: "RS256", typ: "JWT", kid: key.kid }));
  const body = b64(JSON.stringify(claims));
  const sig = crypto.sign("RSA-SHA256", Buffer.from(head + "." + body), key.privatePem);
  return head + "." + body + "." + b64(sig);
}

// publicKey: a KeyObject or PEM. Returns the claims, or null when the signature is wrong or the token has expired.
function verify(token, publicKey, now) {
  const p = String(token || "").split(".");
  if (p.length !== 3) return null;
  let claims; try { claims = JSON.parse(fromB64(p[1]).toString("utf8")); } catch (e) { return null; }
  const ok = crypto.verify("RSA-SHA256", Buffer.from(p[0] + "." + p[1]), publicKey, fromB64(p[2]));
  if (!ok) return null;
  if (claims.exp && claims.exp < (now || Date.now() / 1000)) return null;
  return claims;
}

module.exports = { sign, verify };
