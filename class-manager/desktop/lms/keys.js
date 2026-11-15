/* The course's signing key for LTI services: an RSA key pair made on this computer. The private key stays in the course folder and is never sent anywhere;
   the public key is shared (as a JWKS) so the LMS can check what CM signs. */
"use strict";
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

function makeKey() {
  const { privateKey, publicKey } = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
  const kid = crypto.createHash("sha256").update(publicKey.export({ type: "spki", format: "der" })).digest("hex").slice(0, 16);
  return { privatePem: privateKey.export({ type: "pkcs8", format: "pem" }), kid };
}

// Reads the key in `dir`, making it the first time.
function loadKey(dir) {
  const f = path.join(dir, "lms-key.json");
  try { const k = JSON.parse(fs.readFileSync(f, "utf8")); if (k.privatePem && k.kid) return k; } catch (e) { /* none yet */ }
  const k = makeKey();
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(f, JSON.stringify(k), { mode: 0o600 });
  return k;
}

function jwks(key) {
  const pub = crypto.createPublicKey(key.privatePem).export({ format: "jwk" });
  return { keys: [Object.assign({}, pub, { kid: key.kid, alg: "RS256", use: "sig" })] };
}

module.exports = { loadKey, jwks, makeKey };
