/* Unlisted IDs: the holding area for students who sign in with an ID that is not on the class list.
   One responsibility: keep who they are and what they did, apart from everything else, until the lecturer decides.
   Nothing here touches the class list, Master, Scores, the attendance grid, Presence, Answers, Item_Log or any analytics.
   - Unlisted_IDs: one row per ID (the ID is the unique key, in one form: ids.js). Status waiting, set aside or discarded; an ID that is added leaves the list.
   - Unlisted_Records: what each ID did (attendance for a session, quiz join, quiz answer, quiz whole-quiz submission), at most once per thing.
   Adding to the class list and moving records in is rules/unlisted-move.js; the lecturer's screen calls it through unlisted-ipc.js.
   A repeat sign-in never makes a second row or a second record; an unlisted ID is never added here. Store interface: rules/store.js. */
"use strict";
const { normalizeId } = require("../ids");
const AC = require("./access-codes");

const IDS = "Unlisted_IDs", RECS = "Unlisted_Records";
const IDS_HEAD = ["Student ID", "Name", "First seen", "Last seen", "Sign-ins", "Status", "Decided"];
const REC_HEAD = ["Time", "Student ID", "Kind", "Session or quiz", "Detail"];
const WAITING = "waiting", ASIDE = "set aside", GONE = "discarded";
const MAX_IDS = 300, MAX_RECORDS = 6000; // a flood of made-up IDs cannot grow the holding area without limit
const KINDS = ["attendance", "quiz join", "quiz answer", "quiz submit"];

const body = (store, tab) => { const r = store.rows(tab); return r && r.length > 1 ? r.slice(1) : []; };
const iso = (v) => (v instanceof Date ? v.toISOString() : String(v == null ? "" : v));
const detailOf = (s) => { try { return JSON.parse(s) || {}; } catch (e) { return {}; } };
const text = (v, max) => String(v == null ? "" : v).replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max);

// True when there is a class list and this ID is not on it. With no class list nobody is unlisted (a course that has not set one up yet).
function isUnlisted(store, rawId) {
  const id = normalizeId(rawId), roster = AC.rosterRows(store);
  return !!id && roster.length > 0 && !roster.some((r) => r[0] === id);
}

// The key that says two records are the same thing done again: the later answer replaces an earlier one, anything else keeps the first.
function keyOf(kind, ref, d) {
  if (kind === "quiz answer") return [kind, ref, d.q, d.round || 0, d.vote || 0].join("|");
  if (kind === "quiz submit") return [kind, ref, d.round || 0].join("|");
  return [kind, ref].join("|");
}

// x: { id, name?, kind, ref, detail?, when? }. Returns { ok, status, first, kept } or { ok:false, why }.
function note(store, x) {
  const id = normalizeId(x.id), kind = String(x.kind || "");
  if (id.length < 4 || id.length > 12) return { ok: false, why: "bad id" };
  if (KINDS.indexOf(kind) < 0) return { ok: false, why: "unknown record" };
  if (!isUnlisted(store, id)) return { ok: false, why: "on list" };
  const ids = (store.rows(IDS) || [IDS_HEAD.slice()]).map((r) => r.slice()), now = iso(x.when || store.now());
  let at = ids.findIndex((r, i) => i > 0 && normalizeId(r[0]) === id);
  const first = at < 0;
  if (first) {
    if (ids.length - 1 >= MAX_IDS) return { ok: false, why: "too many" };
    ids.push([id, "", now, now, 0, WAITING, ""]); at = ids.length - 1;
  }
  const row = ids[at], status = String(row[5] || WAITING);
  const nm = text(x.name, 40); if (nm && !String(row[1] || "").trim()) row[1] = nm;
  row[3] = now;
  let kept = false;
  if (status !== GONE) { // a discarded ID is counted but its records are not kept
    const detail = Object.assign({}, x.detail || {}), ref = text(x.ref, 80), key = keyOf(kind, ref, detail), recs = store.rows(RECS) || [REC_HEAD.slice()];
    const w = recs.findIndex((r, i) => i > 0 && normalizeId(r[1]) === id && keyOf(String(r[2]), String(r[3]), detailOf(r[4])) === key);
    const rec = [now, id, kind, ref, JSON.stringify(detail)];
    if (w > 0) { if (kind === "quiz answer" || x.replace) { const next = recs.map((r) => r.slice()); next[w] = [recs[w][0], id, kind, ref, rec[4]]; store.setRows(RECS, next); kept = true; } }
    else if (recs.length - 1 < MAX_RECORDS) { recs.push(rec); store.setRows(RECS, recs); kept = true; row[4] = (Number(row[4]) || 0) + 1; }
  }
  store.setRows(IDS, ids);
  return { ok: true, status, first, kept };
}

// Everything held for one ID, for the review screen and for moving: [{ time, kind, ref, detail }].
function recordsOf(store, rawId) {
  const id = normalizeId(rawId);
  return body(store, RECS).filter((r) => normalizeId(r[1]) === id).map((r) => ({ time: iso(r[0]), kind: String(r[2]), ref: String(r[3]), detail: detailOf(r[4]) }));
}
const statusOf = (store, rawId) => { const id = normalizeId(rawId), r = body(store, IDS).find((x) => normalizeId(x[0]) === id); return r ? String(r[5] || WAITING) : ""; };

// The review list: one entry per ID with a plain summary of what it did. An added ID leaves the list (its records have moved).
function list(store) {
  const out = body(store, IDS).map((r) => {
    const id = normalizeId(r[0]), recs = recordsOf(store, id), quizzes = {};
    recs.filter((x) => x.kind.indexOf("quiz") === 0).forEach((x) => { const q = quizzes[x.ref] || (quizzes[x.ref] = { code: x.ref, joined: false, answers: 0, submitted: false }); if (x.kind === "quiz join") q.joined = true; else if (x.kind === "quiz answer") q.answers++; else q.submitted = true; });
    return { id, name: String(r[1] || ""), first: iso(r[2]), last: iso(r[3]), signIns: Number(r[4]) || 0, status: String(r[5] || WAITING), decided: iso(r[6]), attendance: recs.filter((x) => x.kind === "attendance").map((x) => x.ref), quizzes: Object.keys(quizzes).map((k) => quizzes[k]) };
  });
  const by = (s) => out.filter((x) => x.status === s).length;
  return { ok: true, items: out, waiting: by(WAITING), setAside: by(ASIDE), discarded: by(GONE) };
}
const waitingCount = (store) => body(store, IDS).filter((r) => String(r[5] || WAITING) === WAITING).length;

function setStatus(store, ids, status, when) {
  const want = new Set((ids || []).map(normalizeId).filter(Boolean)), rows = (store.rows(IDS) || []).map((r) => r.slice()); let n = 0;
  rows.forEach((r, i) => { if (i > 0 && want.has(normalizeId(r[0])) && true) { r[5] = status; r[6] = iso(when || store.now()); n++; } });
  if (n) store.setRows(IDS, rows);
  return n;
}
function dropRecords(store, ids) {
  const want = new Set((ids || []).map(normalizeId).filter(Boolean)), recs = store.rows(RECS); if (!recs) return 0;
  const keep = recs.filter((r, i) => i === 0 || !want.has(normalizeId(r[1])));
  if (keep.length !== recs.length) store.setRows(RECS, keep);
  return recs.length - keep.length;
}

// Reject: "aside" keeps the records (hidden, restorable); "discard" deletes them. The ID row stays so a repeat sign-in is not listed again.
function reject(store, ids, mode) {
  const discard = String(mode) === "discard", n = setStatus(store, ids, discard ? GONE : ASIDE);
  if (!n) return { ok: false, why: "None of those IDs is waiting for a decision." };
  const dropped = discard ? dropRecords(store, ids) : 0;
  return { ok: true, rejected: n, records: dropped, mode: discard ? "discard" : "aside" };
}
function restore(store, ids) { // set-aside IDs come back to the waiting list; discarded ones have no records left but can be listed again
  const n = setStatus(store, ids, WAITING, ""); return n ? { ok: true, restored: n } : { ok: false, why: "None of those IDs was set aside." };
}
// Used after the records have moved into the course: the ID leaves the review list for good.
function markAdded(store, ids) {
  const want = new Set((ids || []).map(normalizeId).filter(Boolean)), rows = store.rows(IDS); if (!rows) return 0;
  const keep = rows.filter((r, i) => i === 0 || !want.has(normalizeId(r[0])));
  store.setRows(IDS, keep); dropRecords(store, ids); return rows.length - keep.length;
}

module.exports = { isUnlisted, note, recordsOf, statusOf, list, waitingCount, reject, restore, markAdded, IDS, RECS, KINDS, MAX_IDS, MAX_RECORDS, WAITING, ASIDE, GONE };
