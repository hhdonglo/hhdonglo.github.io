/* The student table: one row per student, with the ID as an enforced unique key.
   One responsibility: keep that table equal to the class list (the Roster tab) and answer questions about it.
   The ID and name are sealed like every other record; the unique key is a keyed fingerprint of the ID (vault.fingerprint),
   so the database itself refuses a second row for the same ID without the IDs being readable in the file.
   An ID that appears twice in the Roster is kept once (the first row) and reported by issues(). */
"use strict";
const crypto = require("crypto");

const clean = (v) => String(v == null ? "" : v).trim();

function createStudents(store, vault) {
  const fp = (id) => (vault ? vault.fingerprint(id) : crypto.createHash("sha256").update(String(id), "utf8").digest("hex"));
  const q = {
    insert: store.raw.prepare("INSERT INTO student(key, data, position) VALUES(?, ?, ?)"),
    clear: store.raw.prepare("DELETE FROM student"),
    all: store.raw.prepare("SELECT data FROM student ORDER BY position"),
    one: store.raw.prepare("SELECT data FROM student WHERE key = ?"),
    count: store.raw.prepare("SELECT COUNT(*) n FROM student")
  };
  let duplicates = [];

  // rosterRows: the Roster tab, header first. Rebuilds the table in one transaction.
  function sync(rosterRows) {
    const seen = new Set(), dup = [], rows = [];
    (rosterRows || []).slice(1).forEach((r) => {
      const id = clean(r && r[0]); if (!id) return;
      if (seen.has(id)) { dup.push(id); return; }
      seen.add(id); rows.push({ id, name: clean(r[1]) });
    });
    store.transaction(() => { q.clear.run(); rows.forEach((s, i) => q.insert.run(fp(s.id), store.codec.pack(s), i)); });
    duplicates = [...new Set(dup)];
    return { students: rows.length, duplicates };
  }
  const unpack = (r) => (r ? store.codec.unpack(r.data) : null);
  return {
    sync,
    list: () => q.all.all().map(unpack),
    get: (id) => unpack(q.one.get(fp(clean(id)))),
    has: (id) => !!q.one.get(fp(clean(id))),
    count: () => q.count.get().n,
    issues: () => ({ duplicateIds: duplicates.slice() })
  };
}

module.exports = { createStudents };
