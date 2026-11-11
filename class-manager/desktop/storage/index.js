/* Registry of storage providers. One small module per provider, all with the same shape:
     { id, name, fields: [{ key, label, secret?, placeholder? }], help: [sentence, ...], create(creds, { fetch, now }) }
   and create() returns { check(), put(path, buf), list(dir) -> [{ name, bytes }], get(path), remove(path) }.
   Paths use "/" and are relative to the provider's root. CM builds its form from `fields` and `help`, so a new
   provider needs no change to the screen: add a file here, add it to PROVIDERS, add a test.
   Google Drive and OneDrive need a browser sign-in with the lecturer's own client ID; they are the next providers
   to add (see the plan) and will join this list. MEGA is reached through its desktop app's synced folder. */
"use strict";
const PROVIDERS = [require("./webdav"), require("./github"), require("./dropbox"), require("./s3")];
const byId = (id) => PROVIDERS.find((p) => p.id === id) || null;
// The part of a provider the screen needs, without its code.
const describe = () => PROVIDERS.map((p) => ({ id: p.id, name: p.name, fields: p.fields, help: p.help }));
// Keeps only the fields a provider declares, as trimmed text, so nothing else is stored.
function cleanCreds(p, creds) {
  const out = {};
  for (const f of p.fields) { const v = String((creds && creds[f.key]) == null ? "" : creds[f.key]).trim().slice(0, 4000); if (v) out[f.key] = v; }
  return out;
}
module.exports = { PROVIDERS, byId, describe, cleanCreds };
