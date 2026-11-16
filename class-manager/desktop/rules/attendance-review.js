/* Attendance, the lecturer's side after the check-ins: the status panel, the review list, remove, approve, forget a phone.
   A port of attStatus_, attReview_, attRemove_, attApprove_, attPhoneReset_ (apps_script/src/20-attendance.gs). Same answers; see test/attendance-review-parity.test.js. */
"use strict";
const { normalizeId } = require("../ids");
const { append } = require("./store");
const AC = require("./access-codes");
const A = require("./attendance");

const names = (store) => { const o = {}; A.roster(store).forEach((r) => { o[r[0]] = r[1] || ""; }); return o; };
const findByColumn = (store, label) => A.sessions(store).filter((s) => A.column(s.label) === String(label || "")).pop() || null;
const splitIds = (s) => String(s || "").split(/[\s,]+/).map((x) => x.replace(/^'/, "").trim()).filter(String);
const iso = (v) => (v instanceof Date ? v.toISOString() : String(v));

function status(store, o) {
  const rows = A.sessions(store), mode = (o && o.geoMode) || A.K.GEO_MODE;
  let cur = rows.filter((r) => r.status === "Open").pop() || (rows.length ? rows[rows.length - 1] : null);
  const codes = AC.codesMap(store), rosterIds = A.roster(store).map((r) => r[0]);
  if (!cur) return { ok: true, session: null, noCode: rosterIds.filter((id) => !codes[id]).length };
  const pres = A.present(store, cur.label), on0 = A.rosterSet(store); let on = 0, off = 0;
  Object.keys(pres).forEach((id) => { if (on0[id]) on++; else off++; });
  const waiting = {};
  A.body(store, A.FLAGS).forEach((r) => { const i = normalizeId(r[2]); if (String(r[1]) === cur.label && String(r[4]).indexOf(A.K.PENDING) === 0 && !pres[i]) waiting[i] = 1; });
  const live = cur.status === "Open" && cur.secret, now = store.now().getTime();
  return { ok: true, session: { link: live ? A.linkFor(cur.secret, A.slotOf(now)) : "", secondsLeft: live ? A.secondsLeft(now) : 0, label: A.column(cur.label), status: cur.status, geo: cur.lat != null && mode !== "off" ? mode : "off", radius: cur.lat != null ? (cur.radius || A.K.RADIUS) : 0, present: on, notOnList: off, waiting: Object.keys(waiting).length, noCode: cur.status !== "Open" ? Object.keys(on0).filter((i) => !codes[i]).length : 0, rosterSize: Object.keys(on0).length, pending: rows.filter((r) => r.status === "Closed").length } };
}

function review(store, p) {
  const rows = A.sessions(store); let cur = null;
  if (p.label) cur = findByColumn(store, p.label);
  if (!cur) { cur = rows.filter((r) => r.status === "Open").pop() || null; if (!cur && rows.length) cur = rows[rows.length - 1]; }
  if (!cur) return { ok: true, session: null, items: [] };
  const pres = A.present(store, cur.label), ph = A.phones(store), nm = names(store), items = [];
  A.body(store, A.FLAGS).forEach((r) => {
    if (String(r[1]) !== cur.label) return;
    const ids = splitIds(r[2]).map(normalizeId).filter(String);
    items.push({ time: iso(r[0]), ids, names: ids.map((i) => nm[i] || ""), reason: String(r[4]), pending: String(r[4]).indexOf(A.K.PENDING) === 0, present: ids.filter((i) => pres[i]), phone: ids.filter((i) => ph.byId[i]) });
  });
  return { ok: true, session: { label: A.column(cur.label), status: cur.status }, items, canRemove: cur.status === "Open" || cur.status === "Closed" };
}

function remove(store, p) {
  const id = normalizeId(p.id), cur = findByColumn(store, p.label);
  if (!cur || !id) return { ok: false, why: "session not found" };
  if (cur.status === "Submitted") return { ok: false, why: "this session is already submitted: change the mark in the Attendance tab" };
  const rows = store.rows(A.LOG) || [], keep = rows.filter((x, i) => i === 0 || !(String(x[1]) === cur.label && normalizeId(x[2]) === id)), gone = rows.length - keep.length;
  if (gone) store.setRows(A.LOG, keep);
  if (gone) A.flag(store, cur.label, id, "", "check-in removed by the lecturer");
  return { ok: true, removed: gone };
}

function approve(store, p) {
  const id = normalizeId(p.id), cur = findByColumn(store, p.label);
  if (!cur || !id) return { ok: false, why: "session not found" };
  if (cur.status === "Submitted") return { ok: false, why: "this session is already submitted: change the mark in the Attendance tab" };
  if (!A.rosterSet(store)[id]) return { ok: false, why: "that ID is not on the class list" };
  if (A.present(store, cur.label)[id]) return { ok: true, added: 0 };
  append(store, A.LOG, ["Timestamp", "Session", "Student ID", "On roster", "Device", "Location"], [store.now(), cur.label, id, "Yes", "", "approved by the lecturer"]);
  A.flag(store, cur.label, id, "", p.manual ? "added by the lecturer" : "approved by the lecturer");
  return { ok: true, added: 1 };
}

function phoneReset(store, id) {
  const rows = store.rows(A.PHONES); if (!rows) return { ok: true, removed: 0 };
  const body = rows.slice(1), keep = body.filter((r) => normalizeId(r[0]) !== id);
  if (keep.length !== body.length) store.setRows(A.PHONES, [rows[0]].concat(keep));
  return { ok: true, removed: body.length - keep.length };
}

module.exports = { status, review, remove, approve, phoneReset };
