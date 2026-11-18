/* Sign-in problems: which student ID tried to sign in and was refused, how many times, when, and why, so the lecturer can help.
   One line per refused attempt in the Signin_Attempts tab: time, ID, where, reason, short phone mark. An access code or unlock code is never written here.
   A later success for the same ID is recorded too ("ok"), so the list shows who got in after all. Lines older than 14 days are dropped, and at most 1500 are kept.
   Phones using the hosted relay report refusals as events (relay/hub/src/attend.js); CM records them here when it collects them (relay/live-attend.js). */
"use strict";
const { normalizeId } = require("../ids");
const { append } = require("./store");
const AC = require("./access-codes");

const TAB = "Signin_Attempts", HEAD = ["Timestamp", "Student ID", "Where", "Reason", "Phone"];
const KEEP_DAYS = 14, KEEP_ROWS = 1500;

// Plain words for each reason. The keys are what the rules and the relay report.
const REASONS = {
  not_on_list: "Not on the class list",
  wrong_code: "Wrong access code",
  no_code: "Has not made an access code yet",
  code_expired: "Access code has expired",
  second_id: "Second ID on a phone that already checked in someone else (needs your unlock code)",
  wrong_unlock: "Wrong unlock code",
  old_qr: "QR code out of date (scanned too long ago)",
  too_far: "Too far from the room",
  no_location: "Location not shared",
  locked: "Locked out after too many tries",
  bad_id: "ID has the wrong length",
  old_page: "Old page, needs a refresh",
  closed: "No attendance session was open",
  ok: "Signed in"
};
// What attendance (desktop rules and relay) answers when it refuses, as a reason key.
const FROM_ATTEND = { "bad id": "bad_id", "update page": "old_page", "slow down": "locked", "old link": "old_qr", "code required": "second_id", "not recognised": "wrong_unlock", "too far": "too_far", "no location": "no_location", "not on list": "not_on_list", "closed": "closed" };

const body = (store) => { const r = store.rows(TAB); return r && r.length > 1 ? r.slice(1) : []; };
const cleanId = (s) => { const n = normalizeId(s); return (n || String(s == null ? "" : s).replace(/\D/g, "")).slice(0, 12); };

function save(store, rows) { store.setRows(TAB, [HEAD.slice()].concat(rows)); }
function prune(store, rows) {
  const cut = store.now().getTime() - KEEP_DAYS * 86400000;
  const keep = rows.filter((r) => { const t = new Date(r[0]).getTime(); return isNaN(t) || t >= cut; });
  return keep.length > KEEP_ROWS ? keep.slice(keep.length - KEEP_ROWS) : keep;
}

// A refused attempt. at: optional Date (the relay's own time). Never throws: recording must not stop a sign-in.
function note(store, e) {
  try {
    const id = cleanId(e.id), why = REASONS[e.reason] && e.reason !== "ok" ? e.reason : "";
    if (!id || !why) return false;
    const row = [e.at || store.now(), id, String(e.where || "Sign-in").slice(0, 40), why, String(e.dev || "").slice(0, 8)];
    const all = body(store);
    if (all.length >= KEEP_ROWS || all.length % 50 === 49) save(store, prune(store, all.concat([row]))); else append(store, TAB, HEAD, row);
    return true;
  } catch (err) { return false; }
}

// This ID got in. Recorded only when it has earlier refusals that are not already followed by a success, so a normal class adds nothing.
function noteOk(store, id0, where, at) {
  try {
    const id = cleanId(id0); if (!id) return false;
    const mine = body(store).filter((r) => normalizeId(r[1]) === id);
    if (!mine.length || mine[mine.length - 1][3] === "ok") return false;
    append(store, TAB, HEAD, [at || store.now(), id, String(where || "Sign-in").slice(0, 40), "ok", ""]); return true;
  } catch (err) { return false; }
}

// The list the lecturer sees: one entry per ID, the ones still stuck first, then the most recent. No codes anywhere.
function list(store) {
  const names = {}; AC.rosterRows(store).forEach((r) => { names[r[0]] = r[1]; });
  const by = {};
  body(store).forEach((r) => {
    const id = normalizeId(r[1]) || String(r[1]); const e = by[id] || (by[id] = { id, name: names[id] || "", attempts: 0, first: r[0], last: r[0], reasons: [], where: [], recent: [], signedIn: false });
    const why = String(r[3]);
    if (why === "ok") { e.signedIn = true; e.signedInAt = r[0]; return; }
    e.signedIn = false; e.attempts++; e.last = r[0]; e.lastReason = why;
    if (e.reasons.indexOf(why) < 0) e.reasons.push(why);
    if (e.where.indexOf(String(r[2])) < 0) e.where.push(String(r[2]));
    e.recent.push({ at: r[0], reason: why }); if (e.recent.length > 8) e.recent.shift();
  });
  const items = Object.keys(by).map((k) => by[k]).filter((e) => e.attempts > 0).map((e) => Object.assign(e, { onList: Object.prototype.hasOwnProperty.call(names, e.id), reasonText: e.reasons.map((x) => REASONS[x]) , lastText: REASONS[e.lastReason] }));
  items.sort((a, b) => (a.signedIn - b.signedIn) || (new Date(b.last).getTime() - new Date(a.last).getTime()));
  return { ok: true, items, stuck: items.filter((e) => !e.signedIn).length };
}

// The lecturer dismisses an ID (helped, or not a real student): its lines are removed.
function dismiss(store, id0) {
  const id = cleanId(id0); if (!id) return { ok: false, why: "That ID is not valid." };
  const rows = body(store), keep = rows.filter((r) => (normalizeId(r[1]) || String(r[1])) !== id);
  if (keep.length !== rows.length) save(store, keep);
  return { ok: true };
}

module.exports = { note, noteOk, list, dismiss, REASONS, FROM_ATTEND, TAB };
