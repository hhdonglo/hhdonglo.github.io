/* Duplicate ID notices: what the lecturer is shown when two rows turned out to be the same student.
   One responsibility: keep the notices in the course database (sealed, one per course and ID) and answer open/resolve.
   A notice has: id, tab, entries (each source row as it was), names, namesDiffer, status "open" or "resolved". Nothing here changes records. */
"use strict";
const crypto = require("crypto");

function createNotices(store, vault) {
  const fp = (k) => (vault ? vault.fingerprint(k) : crypto.createHash("sha256").update(String(k), "utf8").digest("hex"));
  const q = {
    get: store.raw.prepare("SELECT data, status FROM id_notice WHERE key = ?"),
    put: store.raw.prepare("INSERT INTO id_notice(key, data, status, at) VALUES(?, ?, ?, ?) ON CONFLICT(key) DO UPDATE SET data = excluded.data, status = excluded.status, at = excluded.at"),
    open: store.raw.prepare("SELECT data FROM id_notice WHERE status = 'open' ORDER BY at DESC")
  };
  const keyOf = (n) => fp(n.tab + "|" + n.id);
  // Records one merge. The same ID and tab again adds the new rows to the same notice; a resolved notice opens again only if a name that was not seen before arrives.
  function record(n) {
    const old = q.get.get(keyOf(n));
    if (old) {
      const prev = store.codec.unpack(old.data), seen = new Set(prev.names || []);
      const fresh = (n.names || []).filter((x) => !seen.has(x));
      const merged = Object.assign({}, prev, { entries: prev.entries.concat(n.entries).slice(-20), names: [...new Set((prev.names || []).concat(n.names || []))], conflicts: (prev.conflicts || 0) + (n.conflicts || 0) });
      merged.namesDiffer = merged.names.length > 1;
      const status = old.status === "resolved" && !fresh.length ? "resolved" : "open";
      q.put.run(keyOf(n), store.codec.pack(Object.assign(merged, { status })), status, Date.now());
      return;
    }
    q.put.run(keyOf(n), store.codec.pack(Object.assign({}, n, { status: "open" })), "open", Date.now());
  }
  const list = () => q.open.all().map((r) => store.codec.unpack(r.data));
  function resolve(tab, id, chosenName) {
    const row = q.get.get(fp(tab + "|" + id)); if (!row) return false;
    const n = store.codec.unpack(row.data); n.status = "resolved"; n.chosen = chosenName == null ? "" : String(chosenName);
    q.put.run(fp(tab + "|" + id), store.codec.pack(n), "resolved", Date.now()); return true;
  }
  return { record, list, resolve, count: () => list().length };
}

module.exports = { createNotices };
