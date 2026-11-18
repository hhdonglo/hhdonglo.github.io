// The Unlisted IDs review screen's calls: list, add to the class list, reject (set aside or discard), restore.
// Adding is a lecturer's decision made on the Class Roster page, one ID or many at once, so the roster rule holds: no student enters the class list
// except by the lecturer's own action there (roster-shots/README.md). The holding area itself is rules/unlisted.js; moving records is rules/unlisted-move.js.
"use strict";
const crypto = require("crypto");
const U = require("./rules/unlisted");
const MV = require("./rules/unlisted-move");
const AC = require("./rules/access-codes");
const A = require("./rules/auth");
const { quizHooks } = require("./rules/router");
const { fromBackend } = require("./rules/store");
const { normalizeId } = require("./ids");

const MAX_PER_CALL = 300;
const storeOf = (c) => fromBackend(c.backend);
const idsOf = (list) => (Array.isArray(list) ? list : []).slice(0, MAX_PER_CALL).map((x) => normalizeId(x && typeof x === "object" ? x.id : x)).filter((x) => x.length >= 4 && x.length <= 12);

function register({ on }) {
  on("cm:unlistedList", (c) => U.list(storeOf(c)));
  on("cm:unlistedCount", (c) => ({ ok: true, waiting: U.waitingCount(storeOf(c)) }));

  // picks: [{ id, name }]. Each must be waiting or set aside. Backup first; then the class list, a row everywhere, a code, and the held records.
  on("cm:unlistedAdd", (c, e, picks) => {
    const st = storeOf(c), held = new Set(U.list(st).items.filter((x) => x.status !== U.GONE).map((x) => x.id)), seen = new Set();
    const chosen = (Array.isArray(picks) ? picks : []).slice(0, MAX_PER_CALL).map((p) => ({ id: normalizeId(p && p.id), name: String((p && p.name) || "").replace(/\s+/g, " ").trim().slice(0, 80) }))
      .filter((p) => p.id && held.has(p.id) && !seen.has(p.id) && seen.add(p.id));
    if (!chosen.length) return { ok: false, why: "None of those IDs is waiting for a decision." };
    c.backend.flush();
    const backup = c.backups && c.backups.make("before adding unlisted students");
    if (backup && backup.ok === false) return { ok: false, why: "A backup could not be made first, so nothing was added: " + backup.why };
    const done = c.backend.rosterSync(chosen.map((p) => [p.id, p.name]), false);
    if (!done || done.ok === false) return { ok: false, why: (done && done.why) || "The class list could not be saved." };
    c.backend.buildFromRoster(); // a row for each new student in Attendance, Master and Scores
    const env = { site: c.backend.site, random: () => crypto.randomUUID(), counters: A.memoryCounters(() => new Date()) };
    const moved = MV.move(storeOf(c), chosen, quizHooks(storeOf(c), env));
    c.backend.flush(); c.backend.rebuildMarks();
    return { ok: true, added: chosen.length, moved, backup: backup && backup.name ? backup.name : "" };
  });

  on("cm:unlistedReject", (c, e, ids, mode) => { const r = U.reject(storeOf(c), idsOf(ids), mode); if (r.ok) c.backend.flush(); return r; });
  on("cm:unlistedRestore", (c, e, ids) => { const r = U.restore(storeOf(c), idsOf(ids)); if (r.ok) c.backend.flush(); return r; });
}

module.exports = { register };
