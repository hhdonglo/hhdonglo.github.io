/* Sealing for the mailbox: the phone encrypts a submission so that only this CM can read it.
   Hybrid scheme: a fresh AES-256-GCM key encrypts the submission; the key is wrapped with the course's RSA public key (OAEP, SHA-256).
   This file is CM's side (make the keys, open a sealed submission). The phone's side is assets/relay-seal.js. */
"use strict";
const crypto = require("crypto");

function generateKeys() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
  return { publicKey: publicKey.export({ type: "spki", format: "der" }).toString("base64"), privateKey: privateKey.export({ type: "pkcs8", format: "der" }).toString("base64") };
}

// sealed: {k, iv, c} in base64 (c holds the ciphertext followed by the 16-byte tag, as WebCrypto writes it).
function open(privateKeyB64, sealed) {
  const priv = crypto.createPrivateKey({ key: Buffer.from(privateKeyB64, "base64"), format: "der", type: "pkcs8" });
  const key = crypto.privateDecrypt({ key: priv, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash: "sha256" }, Buffer.from(sealed.k, "base64"));
  const all = Buffer.from(sealed.c, "base64");
  const d = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(sealed.iv, "base64"));
  d.setAuthTag(all.subarray(all.length - 16));
  return Buffer.concat([d.update(all.subarray(0, all.length - 16)), d.final()]).toString("utf8");
}

module.exports = { generateKeys, open };
