// Stable pseudonyms for student IDs. The same ID always gets the same pseudonym for a given secret salt, and two different
// IDs never share one (the student ID is the unique key). The salt stays on this computer, so only the lecturer can map back.
"use strict";
const crypto = require("crypto");

function createPseudonyms(salt) {
  const byId = new Map(), byName = new Map();
  function make(id, len) { return "S-" + crypto.createHmac("sha256", salt).update(String(id)).digest("hex").slice(0, len).toUpperCase(); }
  function of(id) {
    const key = String(id).trim();
    if (!key) return "";
    if (byId.has(key)) return byId.get(key);
    let len = 6, name = make(key, len);
    while (byName.has(name) && byName.get(name) !== key) name = make(key, ++len); // a clash is vanishingly rare; widen until unique
    byId.set(key, name); byName.set(name, key);
    return name;
  }
  return { of, back: (name) => byName.get(String(name).trim().toUpperCase()) || null, known: () => byId.size };
}

module.exports = { createPseudonyms };
