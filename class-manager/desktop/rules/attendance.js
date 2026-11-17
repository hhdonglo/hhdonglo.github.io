/* Attendance: sessions, the rotating QR token, check-in, review, submit. A port of apps_script/src/20-attendance.gs with the same answers
   (test/attendance-parity.test.js runs both on the same workbook). One responsibility: attendance rules over the store interface (store.js).
   Left to the caller and passed in `opts`: random (UUID-like secrets), verifyCode(aid, given) for the student's personal access code,
   fails (a counter object with get(key), add(key); the script keeps it in a short cache), log(outcome, label, id). */
"use strict";
const crypto = require("crypto");
const { normalizeId } = require("../ids");
const { append } = require("./store");
const AC = require("./access-codes");
const U = require("./unlisted");

const CTL = "Attendance_Control", LOG = "Attendance_Log", GRID = "Attendance", FLAGS = "Attendance_Flags", PHONES = "Attendance_Phones", NOTLIST = "Not_On_List";
const CTL_HEAD = ["Code", "Label", "Status", "Opened", "Closed", "Secret", "Lat", "Lon", "Radius m"];
const LOG_HEAD = ["Timestamp", "Session", "Student ID", "On roster", "Device", "Location"];
const FLAG_HEAD = ["Timestamp", "Session", "Student ID", "Device", "Reason"];
const K = { SLOT_SEC: 30, GRACE: 1, DEVICE_IDS: 1, MAX_FAILS: 6, GEO_MODE: "off", RADIUS: 500, ACC_CAP: 150, PENDING: "waiting for approval: " };

const body = (store, tab) => { const r = store.rows(tab); return r && r.length > 1 ? r.slice(1) : []; };
const pad = (n) => String(n).padStart(2, "0");
const dayKey = (d) => pad(d.getDate()) + "/" + pad(d.getMonth() + 1) + "/" + d.getFullYear();
const column = (label) => { const m = /^(.*) #(\d+)$/.exec(String(label || "").trim()); return m ? (Number(m[2]) > 1 ? m[1] + " #" + m[2] : m[1]) : String(label || "").trim(); };
const slotOf = (t) => Math.floor(t / (K.SLOT_SEC * 1000));
const hex = (buf, n) => buf.subarray(0, n).toString("hex");
const linkFor = (secret, slot) => hex(crypto.createHmac("sha256", String(secret)).update("qr:" + slot).digest(), 4);
const linkOk = (ses, tok, now, grace) => { if (!ses || !ses.secret || !tok) return false; const s = slotOf(now); for (let d = 0; d <= (grace == null ? K.GRACE : grace); d++) if (linkFor(ses.secret, s - d) === tok) return true; return false; };
const secondsLeft = (now) => { const s = slotOf(now); return Math.max(1, Math.ceil(((s + 1) * K.SLOT_SEC * 1000 - now) / 1000)); };
function metres(la1, lo1, la2, lo2) {
  const R = 6371000, r = Math.PI / 180, dLa = (la2 - la1) * r, dLo = (lo2 - lo1) * r;
  const a = Math.sin(dLa / 2) ** 2 + Math.cos(la1 * r) * Math.cos(la2 * r) * Math.sin(dLo / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.min(1, Math.sqrt(a))));
}
function geo(ses, p, mode) {
  if (mode === "off" || ses.lat == null || ses.lon == null || isNaN(ses.lat) || isNaN(ses.lon)) return { state: "off", dist: 0 };
  const la = Number(p.lat), lo = Number(p.lon), acc = Math.max(0, Math.min(Number(p.acc) || 0, K.ACC_CAP));
  if (p.lat === undefined || p.lat === "" || isNaN(la) || isNaN(lo) || Math.abs(la) > 90 || Math.abs(lo) > 180) return { state: "none", dist: 0 };
  const d = metres(ses.lat, ses.lon, la, lo);
  return { state: d - acc <= (ses.radius || K.RADIUS) ? "ok" : "far", dist: d };
}
const geoText = (g) => (g.state === "off" ? "" : g.state === "none" ? "no location" : g.state + " " + g.dist + " m");

function sessions(store) {
  return body(store, CTL).map((r, i) => ({ row: i + 1, code: String(r[0]).trim().toUpperCase(), label: String(r[1]), status: String(r[2]).trim(), secret: String(r[5] || ""), lat: r[6] === "" || r[6] == null ? null : Number(r[6]), lon: r[7] === "" || r[7] == null ? null : Number(r[7]), radius: Number(r[8]) || 0 }));
}
const openSession = (store) => sessions(store).filter((s) => s.status === "Open").pop() || null;
const setStatus = (store, s, status, closedAt) => { const rows = store.rows(CTL); rows[s.row][2] = status; if (closedAt) rows[s.row][4] = closedAt; store.setRows(CTL, rows); };
const roster = (store) => AC.rosterRows(store);
const rosterSet = (store) => { const o = {}; roster(store).forEach((r) => { o[r[0]] = 1; }); return o; };
const present = (store, label) => { const o = {}; body(store, LOG).forEach((r) => { if (String(r[1]) === label) o[normalizeId(r[2])] = true; }); return o; };
const flag = (store, label, id, dev, why) => { try { append(store, FLAGS, FLAG_HEAD, [store.now(), label, id, String(dev || "").slice(0, 8), why]); } catch (e) { /* flags never stop a check-in */ } };
const pendingHas = (store, label, id) => body(store, FLAGS).some((r) => String(r[1]) === label && normalizeId(r[2]) === id && String(r[4]).indexOf(K.PENDING) === 0);

function phones(store) { const o = { byId: {}, byDev: {} }; body(store, PHONES).forEach((r) => { const id = normalizeId(r[0]), d = String(r[1] || ""); if (id && d) { o.byId[id] = d; o.byDev[d] = id; } }); return o; }
function phoneCheck(store, id, dev) { const ph = phones(store), owner = ph.byDev[dev]; if (owner && owner !== id) return { refuse: true, owner }; if (!ph.byId[id]) return { bind: true }; return ph.byId[id] === dev ? {} : { changed: true }; }
function devHash(store, dev, random) {
  let salt = store.prop("att_salt");
  if (!salt) { salt = random().replace(/-/g, "") + random().replace(/-/g, ""); store.setProp("att_salt", salt); }
  return hex(crypto.createHmac("sha256", salt).update(String(dev)).digest(), 8);
}

function open(store, p, o) {
  const rows = sessions(store); const cur = rows.filter((r) => r.status === "Open").pop();
  if (cur) return { ok: false, why: "a session is already open: close it first", session: { code: cur.code, label: cur.label } };
  if (!roster(store).length) return { ok: false, why: "the Roster tab is empty: run roster_sync.sh to add the Student IDs first" };
  AC.run(store, { op: "generate" }, {}); // every listed student has an access code before the first phone asks: a class list saved from the Class Roster page has none until now
  const used = (c) => rows.some((r) => r.code === c) || (o.codeUsed ? o.codeUsed(c) : false);
  let code = String(p.acode || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12);
  if (code && (code.length < 3 || used(code))) return { ok: false, why: "that code is too short or was used before" };
  for (let t = 0; !code && t < 200; t++) { const c = String(1000 + Math.floor(Math.random() * 9000)); if (!used(c)) code = c; }
  for (let t = 0; !code && t < 200; t++) { const c = String(10000 + Math.floor(Math.random() * 90000)); if (!used(c)) code = c; }
  if (!code) return { ok: false, why: "could not find a free code" };
  const base = dayKey(store.now()); let n = 1; rows.forEach((r) => { if (r.label.indexOf(base + " #") === 0) n++; });
  const label = base + " #" + n, secret = o.random().replace(/-/g, "") + o.random().replace(/-/g, "");
  const hla = p.lat === undefined || p.lat === "" ? NaN : Number(p.lat), hlo = Number(p.lon);
  const hasGeo = !isNaN(hla) && !isNaN(hlo) && Math.abs(hla) <= 90 && Math.abs(hlo) <= 180;
  if ((o.geoMode || K.GEO_MODE) === "enforce" && !hasGeo && String(p.nogeo || "") !== "1") return { ok: false, why: "location needed", needLocation: true };
  const rad = Math.max(50, Math.min(Number(p.radius) || K.RADIUS, 5000)), now = store.now().getTime();
  append(store, CTL, CTL_HEAD, [code, label, "Open", store.now().toISOString(), "", secret, hasGeo ? hla : "", hasGeo ? hlo : "", hasGeo ? rad : ""]);
  return { ok: true, session: { link: linkFor(secret, slotOf(now)), secondsLeft: secondsLeft(now), label: column(label), status: "Open", present: 0, notOnList: 0, geo: hasGeo && (o.geoMode || K.GEO_MODE) !== "off" ? (o.geoMode || K.GEO_MODE) : "off", radius: hasGeo ? rad : 0 } };
}

function close(store) {
  const cur = openSession(store); if (!cur) return { ok: false, why: "no attendance session is open" };
  const pres = present(store, cur.label), r = roster(store), col = column(cur.label);
  setStatus(store, cur, "Closed", store.now().toISOString());
  const by = {}; let flagged = 0;
  body(store, LOG).forEach((x) => { const d = String(x[4] || ""); if (String(x[1]) === cur.label && d) (by[d] = by[d] || []).push(normalizeId(x[2])); });
  Object.keys(by).forEach((d) => { if (by[d].length > K.DEVICE_IDS) { flagged++; flag(store, cur.label, by[d].join(", "), d, "one device, " + by[d].length + " IDs (check in the log)"); } });
  const on = {}; let n = 0; r.forEach((x) => { on[x[0]] = 1; if (pres[x[0]]) n++; });
  return { ok: true, held: true, session: { code: cur.code, label: col, status: "Closed", present: n, absent: r.length - n, notOnList: Object.keys(pres).filter((id) => !on[id]).length, flagged, column: col } };
}

function checkIn(store, p, o) {
  const ses = openSession(store); if (!ses) return { ok: false, why: "closed" };
  const now = store.now().getTime(), fails = o.fails, mode = o.geoMode || K.GEO_MODE;
  const aid = normalizeId(p.id); let dev = String(p.dev || "").replace(/[^A-Za-z0-9]/g, "").slice(0, 40);
  if (aid.length < 4 || aid.length > 12) return { ok: false, why: "bad id" };
  if (dev.length < 16) return { ok: false, why: "update page" };
  dev = devHash(store, dev, o.random);
  if (fails.get("d" + dev) >= K.MAX_FAILS || fails.get("i" + aid) >= K.MAX_FAILS) return { ok: false, why: "slow down" };
  if (!linkOk(ses, String(p.t || "").replace(/[^0-9a-f]/g, "").slice(0, 8), now, o.grace)) { fails.add("d" + dev); fails.add("i" + aid); return { ok: false, why: "old link" }; }
  const onl = !!rosterSet(store)[aid], day = dayKey(store.now());
  if (onl) {
    const mine = AC.codesMap(store)[aid]; if (!mine) return { ok: false, why: "no access code" };
    const v = o.verifyCode(aid, String(p.code || "").trim(), mine, store);
    if (!v.ok) { fails.add("d" + dev); fails.add("i" + aid); flag(store, ses.label, aid, dev, "wrong access code (refused)"); return { ok: false, why: v.expired ? "session expired" : "not recognised" }; }
  }
  if (body(store, LOG).some((r) => String(r[1]).indexOf(day + " #") === 0 && normalizeId(r[2]) === aid)) return { ok: true, id: aid, onList: onl, already: true };
  let phone = null;
  if (onl) {
    phone = phoneCheck(store, aid, dev);
    if (phone.refuse || phone.changed) {
      const g0 = geo(ses, p, mode);
      if ((g0.state === "far" || g0.state === "none") && mode === "enforce") return { ok: false, why: g0.state === "far" ? "too far" : "no location" };
      if (!pendingHas(store, ses.label, aid)) flag(store, ses.label, aid, dev, K.PENDING + (phone.refuse ? "used the phone registered to " + phone.owner : "used a phone other than the one registered"));
      return { ok: true, id: aid, onList: true, pending: true };
    }
  }
  const g = geo(ses, p, mode);
  if (g.state === "far" || g.state === "none") {
    flag(store, ses.label, aid, dev, "location: " + geoText(g) + (mode === "enforce" ? " (refused)" : " (accepted)"));
    if (mode === "enforce") return { ok: false, why: g.state === "far" ? "too far" : "no location" };
  }
  const others = {}; body(store, LOG).forEach((r) => { if (String(r[1]) === ses.label && String(r[4]) === dev) others[normalizeId(r[2])] = true; });
  if (Object.keys(others).length >= K.DEVICE_IDS) { flag(store, ses.label, aid, dev, "device already used for " + Object.keys(others).join(", ")); return { ok: false, why: "device used" }; }
  if (!onl) { // not on the class list: the check-in is held for the lecturer to review (rules/unlisted.js); the roster, the grid and every total never count it
    const held = U.note(store, { id: aid, kind: "attendance", ref: ses.label });
    if (!held.ok) { flag(store, ses.label, aid, dev, "not on the class list (" + held.why + ")"); return { ok: false, why: "not on list" }; }
  }
  append(store, LOG, LOG_HEAD, [store.now(), ses.label, aid, onl ? "Yes" : "No", dev, geoText(g)]);
  if (phone && phone.bind) { try { append(store, PHONES, ["Student ID", "Device", "Registered"], [aid, dev, store.now()]); } catch (e) { /* already recorded */ } }
  return { ok: true, id: aid, onList: onl };
}

function submit(store) {
  const list = sessions(store).filter((s) => s.status === "Closed"); if (!list.length) return { ok: false, why: "no closed session is waiting to be submitted" };
  const r = roster(store), done = [];
  list.forEach((cur) => {
    const pres = present(store, cur.label), col = column(cur.label);
    let g = store.rows(GRID); if (!g || !g.length) g = [["Student ID"]];
    let head = g[0].map((h) => String(h).trim()), ci = head.indexOf(col);
    if (ci < 1) { ci = Math.max(1, head.length); head[ci] = col; g[0] = head; }
    const have = {}; g.slice(1).forEach((row, i) => { have[normalizeId(row[0])] = i + 1; });
    r.forEach((x) => { if (!have[x[0]]) { have[x[0]] = 1; g.push([x[0]]); } });
    g = g.map((row, i) => { const w = row.slice(); while (w.length < Math.max(head.length, ci + 1)) w.push(""); if (i > 0) w[ci] = pres[normalizeId(row[0])] ? 1 : 0; return w; });
    store.setRows(GRID, g);
    const on = {}; r.forEach((x) => { on[x[0]] = 1; });
    const off = Object.keys(pres).filter((id) => !on[id]);
    if (off.length) {
      const seen = {}; body(store, NOTLIST).forEach((x) => { seen[String(x[1]) + "|" + normalizeId(x[2])] = true; });
      off.filter((id) => !seen[col + "|" + id]).forEach((id) => append(store, NOTLIST, ["Timestamp", "Session", "Student ID"], [store.now(), col, id]));
    }
    setStatus(store, cur, "Submitted"); done.push(col);
  });
  return { ok: true, submitted: done };
}

function discard(store) {
  const list = sessions(store).filter((s) => s.status === "Closed"); if (!list.length) return { ok: false, why: "no closed session is waiting" };
  const labels = {}; list.forEach((s) => { labels[s.label] = true; });
  const rows = store.rows(LOG) || [LOG_HEAD], keep = rows.filter((x, i) => i === 0 || !labels[String(x[1])]), gone = rows.length - keep.length;
  store.setRows(LOG, keep); list.forEach((s) => setStatus(store, s, "Discarded"));
  return { ok: true, discarded: list.length, checkins: gone };
}

module.exports = { dayKey, devHash, phoneCheck, geo, geoText, pendingHas, openSession, present, flag, phones, roster, rosterSet, secondsLeft, slotOf, body, open, close, checkIn, submit, discard, sessions, linkFor, linkOk, column, metres, K, CTL, LOG, GRID, FLAGS, PHONES };
