/* Personal access codes: one code per student ID, expiry, renewal and reset. A port of accessCodes_ (apps_script/src/00-core.gs) and its helpers,
   with the same answers. The ID is the unique key: one row per ID, normalised (ids.js). */
"use strict";
const crypto = require("crypto");
const { normalizeId } = require("../ids");
const { append } = require("./store");

const TAB = "Access_Codes", HEAD = ["Student ID", "Access code", "Issued"];
const ALPHA = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no 0, O, 1, I or L: easy to read from a printed slip

const normCode = (s) => { const t = String(s || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8); return t.length === 8 ? t.slice(0, 4) + "-" + t.slice(4) : ""; };
const cleanName = (s) => " " + String(s == null ? "" : s).replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80); // the script's own odd leading space is kept
function newCode(random) {
  const b = (random || ((n) => crypto.randomBytes(n)))(8); let s = "";
  for (let i = 0; i < 8; i++) s += ALPHA.charAt(b[i] % ALPHA.length);
  return s.slice(0, 4) + "-" + s.slice(4);
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

// op: list (default), generate, expiry (p.days), renew, reset (p.id). Returns what the script returns.
function run(store, p, opts) {
  p = p || {}; const random = opts && opts.random, log = (opts && opts.log) || (() => {});
  const op = String(p.op || "list").toLowerCase();
  let rows = store.rows(TAB); if (!rows) { rows = [HEAD.slice()]; store.setRows(TAB, rows); } else if (!rows.length) { rows = [HEAD.slice()]; store.setRows(TAB, rows); }
  const map = codesMap(store), roster = rosterRows(store), now = store.now(); let made = 0;
  if (op === "generate") {
    const add = [];
    roster.forEach((r) => { const id = normalizeId(r[0]); if (id && !map[id]) { map[id] = { code: newCode(random), issued: now }; add.push([id, map[id].code, now]); made++; } });
    if (add.length) store.setRows(TAB, rows.concat(add));
    if (made) log("access codes created", String(made), "", "");
  } else if (op === "expiry") {
    const dd = Math.max(0, Math.min(3650, Math.round(Number(p.days) || 0)));
    store.setProp("code_days", String(dd)); log("access codes expiry", dd + " days", "", "");
  } else if (op === "renew") {
    const keep = rows.slice(1).map((r) => { const id0 = normalizeId(r[0]); if (expired(store, map[id0])) { map[id0] = { code: newCode(random), issued: now }; made++; return [id0, map[id0].code, now]; } return r; });
    if (made) { store.setRows(TAB, [rows[0]].concat(keep)); log("access codes renewed", String(made), "", ""); }
  } else if (op === "reset") {
    const rid = normalizeId(p.id);
    if (!rid || !roster.some((r) => r[0] === rid)) return { ok: false, why: "not on list" };
    map[rid] = { code: newCode(random), issued: now };
    const at = []; rows.slice(1).forEach((r, i) => { if (normalizeId(r[0]) === rid) at.push(i + 1); });
    const next = rows.map((r) => r.slice());
    if (at.length === 1) { next[at[0]][1] = map[rid].code; next[at[0]][2] = now; }
    else { const kept = [next[0]].concat(next.slice(1).filter((r) => normalizeId(r[0]) !== rid)); kept.push([rid, map[rid].code, now]); next.length = 0; kept.forEach((r) => next.push(r)); }
    store.setRows(TAB, next); log("access code replaced", "", rid, ""); made = 1;
  }
  const list = roster.map((r) => { const id = normalizeId(r[0]); return { id, name: cleanName(r[1]), code: map[id] ? map[id].code : "", expired: expired(store, map[id]) }; }).filter((x) => x.id);
  return { ok: true, made, rows: list, missing: list.filter((x) => !x.code).length, days: days(store), expired: list.filter((x) => x.expired).length };
}

module.exports = { run, codesMap, normCode, newCode, expired, TAB, ALPHA };
