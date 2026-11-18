/* Personal access codes. The student makes their own 5-letter code the first time they open their own record (setup below); the lecturer never sees it and can only reset it,
   which lets the student make a new one. One row per ID, normalised (ids.js). Codes made by the older versions (8 characters, printed on slips) still work until reset.
   The code is not asked at attendance check-in: that uses the lecturer's one-time unlock code instead (attendance-unlock.js). */
"use strict";
const crypto = require("crypto");
const { normalizeId } = require("../ids");

const TAB = "Access_Codes", HEAD = ["Student ID", "Access code", "Issued"];
const ALPHA = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no 0, O, 1, I or L: easy to read

// 5 letters or digits (a student's own code); 8 (shown 4-4) is the older printed form and is still accepted.
const normCode = (s) => { const t = String(s || "").toUpperCase().replace(/[^A-Z0-9]/g, ""); return t.length === 5 ? t : t.length === 8 ? t.slice(0, 4) + "-" + t.slice(4) : ""; };
const codeProblem = (s) => { const t = String(s || "").toUpperCase().replace(/[^A-Z0-9]/g, ""); return t.length !== 5 ? "The code must be 5 letters or digits." : /^(.)\1+$/.test(t) ? "The code must not be one repeated character." : ""; };
const cleanName = (s) => " " + String(s == null ? "" : s).replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80); // the script's own odd leading space is kept
function newCode(random) { // five characters the lecturer reads out (attendance-unlock.js)
  const b = (random || ((n) => crypto.randomBytes(n)))(5); let s = "";
  for (let i = 0; i < 5; i++) s += ALPHA.charAt(b[i] % ALPHA.length);
  return s;
}
const days = (store) => Math.max(0, Number(store.prop("code_days")) || 0);
function expired(store, mine) {
  const d = days(store); if (!d || !mine || !mine.issued) return false;
  const t = new Date(mine.issued).getTime();
  return !isNaN(t) && store.now().getTime() - t > d * 86400000;
}
const body = (store) => { const r = store.rows(TAB); return r && r.length > 1 ? r.slice(1) : []; };
function codesMap(store) {
  const out = {};
  body(store).forEach((r) => { const id = normalizeId(r[0]), c = normCode(r[1]); if (id && c) out[id] = { code: c, issued: r[2] }; });
  return out;
}
function rosterRows(store) {
  const v = store.rows("Roster") || [], out = [];
  v.forEach((r) => { const id = normalizeId(r[0]); if (id.length >= 4) out.push([id, String(r[1] || "").trim()]); }); // the header has no digits and is skipped
  return out;
}

// op: list (default; never returns a code), expiry (p.days), renew (clears expired codes so those students make a new one), reset (p.id: clears one code).
function run(store, p, opts) {
  p = p || {}; const log = (opts && opts.log) || (() => {});
  const op = String(p.op || "list").toLowerCase();
  let rows = store.rows(TAB); if (!rows || !rows.length) { rows = [HEAD.slice()]; store.setRows(TAB, rows); }
  const map = codesMap(store), roster = rosterRows(store); let made = 0;
  if (op === "expiry") {
    const dd = Math.max(0, Math.min(3650, Math.round(Number(p.days) || 0)));
    store.setProp("code_days", String(dd)); log("access codes expiry", dd + " days", "", "");
  } else if (op === "renew") {
    const keep = rows.slice(1).filter((r) => { const id0 = normalizeId(r[0]); if (expired(store, map[id0])) { delete map[id0]; made++; return false; } return true; });
    if (made) { store.setRows(TAB, [rows[0]].concat(keep)); log("access codes cleared (expired)", String(made), "", ""); }
  } else if (op === "reset") {
    const rid = normalizeId(p.id);
    if (!rid || !roster.some((r) => r[0] === rid)) return { ok: false, why: "not on list" };
    const keep = rows.slice(1).filter((r) => normalizeId(r[0]) !== rid);
    if (keep.length !== rows.length - 1) { store.setRows(TAB, [rows[0]].concat(keep)); delete map[rid]; made = 1; }
    log("access code reset", "", rid, "");
  }
  const list = roster.map((r) => { const id = normalizeId(r[0]); return { id, name: cleanName(r[1]), has: !!map[id], expired: expired(store, map[id]) }; }).filter((x) => x.id);
  return { ok: true, made, rows: list, missing: list.filter((x) => !x.has).length, days: days(store), expired: list.filter((x) => x.expired).length };
}

// A student makes their own code. Only for an ID on the class list that has no code (or whose code expired); the lecturer's reset is the only way to change one.
function setup(store, id0, code0, opts) {
  const id = normalizeId(id0), log = (opts && opts.log) || (() => {});
  if (id.length < 4 || id.length > 12) return { ok: false, why: "bad id" };
  if (!rosterRows(store).some((r) => r[0] === id)) return { ok: false, why: "not recognised" };
  const why = codeProblem(code0); if (why) return { ok: false, why: "bad code", detail: why };
  let rows = store.rows(TAB); if (!rows || !rows.length) rows = [HEAD.slice()];
  const mine = codesMap(store)[id];
  if (mine && !expired(store, mine)) return { ok: false, why: "code exists" };
  const code = normCode(code0), keep = rows.slice(1).filter((r) => normalizeId(r[0]) !== id);
  store.setRows(TAB, [rows[0]].concat(keep, [[id, code, store.now()]])); log("access code set by the student", "", id, "");
  return { ok: true, id, code };
}

module.exports = { run, setup, codeProblem, codesMap, rosterRows, cleanName, normCode, newCode, expired, TAB, ALPHA };
