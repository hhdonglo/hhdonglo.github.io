/* The lecturer's one-time unlock code for a second ID on the same phone.
   When a phone that already checked in one ID is used for another, the check-in is refused and the student's page asks for a code (rules/attendance.js).
   Only the lecturer can make that code, here, for that ID and that session, and read it to the student, so nobody can check in for a friend.
   One responsibility: asking, issuing and checking those codes over the store interface. The relay holds only a hash of each code (relay/hub/src/attend.js). */
"use strict";
const crypto = require("crypto");
const { normalizeId } = require("../ids");
const { append } = require("./store");
const AC = require("./access-codes");
const A = require("./attendance");

const TAB = "Attendance_Unlock", HEAD = ["Session", "Student ID", "Code", "Issued", "Used"];
const ASKED = "second ID on this phone: needs a code from the lecturer";
const norm = (s) => { const t = String(s || "").toUpperCase().replace(/[^A-Z0-9]/g, ""); return t.length === 5 ? t : ""; };
const body = (store) => { const r = store.rows(TAB); return r && r.length > 1 ? r.slice(1) : []; };

// Has this ID already asked (so the flags list shows it once)?
const asked = (store, label, id) => A.body(store, A.FLAGS).some((r) => String(r[1]) === label && normalizeId(r[2]) === id && String(r[4]) === ASKED);
const ask = (store, label, id, dev) => { if (!asked(store, label, id)) A.flag(store, label, id, dev, ASKED); };

// The code the lecturer issued for this ID in this session and the student has not used yet, or "".
function current(store, label, id) {
  const hit = body(store).filter((r) => String(r[0]) === label && normalizeId(r[1]) === id && !r[4]).pop();
  return hit ? norm(hit[2]) : "";
}

// Lecturer: make (or remake) the code for an ID on the class list, in the open session.
function issue(store, p, o) {
  const ses = A.openSession(store); if (!ses) return { ok: false, why: "no attendance session is open" };
  const id = normalizeId(p.id); if (!id || !A.rosterSet(store)[id]) return { ok: false, why: "that ID is not on the class list" };
  const code = AC.newCode(o && o.bytes);
  let rows = store.rows(TAB); if (!rows || !rows.length) rows = [HEAD.slice()];
  const keep = rows.slice(1).filter((r) => !(String(r[0]) === ses.label && normalizeId(r[1]) === id && !r[4]));
  store.setRows(TAB, [rows[0]].concat(keep, [[ses.label, id, code, store.now(), ""]]));
  A.flag(store, ses.label, id, "", "unlock code issued by the lecturer");
  return { ok: true, id, code, label: ses.label };
}

// Phone side: true once, when the code is the one issued for this ID in this session; the code is used up.
function use(store, label, id, given) {
  const c = norm(given); if (!c) return false;
  const rows = store.rows(TAB) || []; let at = -1;
  rows.forEach((r, i) => { if (i && String(r[0]) === label && normalizeId(r[1]) === id && !r[4] && norm(r[2]) === c) at = i; });
  if (at < 0) return false;
  rows[at][4] = store.now(); store.setRows(TAB, rows); return true;
}

// IDs that asked and have neither checked in nor been given a code yet (the count the status panel shows).
function waiting(store, label, present) {
  const out = {};
  A.body(store, A.FLAGS).forEach((r) => { const i = normalizeId(r[2]); if (String(r[1]) === label && String(r[4]) === ASKED && !present[i] && !current(store, label, i)) out[i] = 1; });
  return Object.keys(out);
}

// What the lecturer's list needs for one flag row.
const decorate = (store, label, id) => ({ code: current(store, label, id) });

module.exports = { issue, use, ask, asked, current, waiting, decorate, ASKED, TAB, norm };
