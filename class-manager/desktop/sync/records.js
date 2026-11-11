/* Course records in step between computers: the class list and the attendance grid.
   Each computer writes only its own encrypted file in the linked place (records-<device>.cmsync, passphrase-encrypted,
   see vault.packJson) and reads every other computer's. Nobody overwrites anybody else's file, so two computers that
   sync at the same moment cannot lose each other's changes. Merging uses the data as it was at this computer's last
   sync (the baseline, kept encrypted in the course folder), so edits and removals travel, not only additions
   (merge.js). Class list conflicts keep this computer's row; attendance conflicts keep "present".
   Snapshots of computers that have not synced for 60 days are ignored, so an abandoned computer cannot bring back
   what was removed since.
   Nothing is sent or changed for an item that is not set to "sync". Works offline: a failed sync leaves the local
   records as they are and the next one catches up. */
"use strict";
const { merge3, presentWins, keepLocal } = require("./merge");

const STALE_MS = 60 * 864e5;
const SEP = "\u0001";
const FILE_RE = /^records-([\w-]{6,40})\.cmsync$/;

// rows <-> keyed maps
function rosterMap(rows) { const o = {}; (rows || []).slice(1).forEach((r) => { const id = String(r[0] == null ? "" : r[0]).trim(); if (id) o[id] = JSON.stringify(r.slice(1).map((x) => (x == null ? "" : x))); }); return o; }
function rosterRows(map, header) { return [header && header.length ? header : ["Student ID", ""]].concat(Object.keys(map).sort().map((id) => [id].concat(JSON.parse(map[id])))); }
function attMap(rows) {
  const o = {}, cols = [];
  if (!rows || !rows.length) return { map: o, cols };
  rows[0].slice(1).forEach((c) => cols.push(String(c)));
  rows.slice(1).forEach((r) => {
    const id = String(r[0] == null ? "" : r[0]).trim(); if (!id) return;
    o[id + SEP] = ""; // the student is in the grid, even with no marks yet
    cols.forEach((c, j) => { const v = r[j + 1]; if (v !== "" && v != null) o[id + SEP + c] = String(v); });
  });
  return { map: o, cols };
}
function attRows(map, cols) {
  const ids = Object.keys(map).filter((k) => k.endsWith(SEP)).map((k) => k.slice(0, -1)).sort();
  return [["Student ID"].concat(cols)].concat(ids.map((id) => [id].concat(cols.map((c) => { const v = map[id + SEP + c]; return v === undefined ? "" : isNaN(Number(v)) ? v : Number(v); }))));
}
const union = (a, b) => a.concat(b.filter((x) => a.indexOf(x) < 0));
// What the other computer says, for merging. A key it lacks counts as removed ONLY if that computer had known the key
// (it is in its "known" list, which only grows). A computer that never saw a key has no opinion on it, so the key
// is not removed by a computer that simply has not synchronised yet.
function seenBy(snapData, snapKnown, cur) {
  const known = new Set(snapKnown || Object.keys(snapData || {})), eff = Object.assign({}, snapData);
  for (const k of Object.keys(cur)) if (!(k in eff) && !known.has(k)) eff[k] = cur[k];
  return eff;
}

// opts: readRows(tab), setRows(tab, rows); place: { rawList, rawGet, rawPut } ; readBase()/writeBase(obj); deviceId, deviceName;
// pack(obj), unpack(buf) (encryption with the passphrase); now().
function createRecordsSync(opts) {
  const now = opts.now || (() => Date.now());
  const mine = "records-" + opts.deviceId + ".cmsync";

  function local(items) {
    const s = { at: now(), device: opts.deviceId, name: opts.deviceName || "", items: [] };
    if (items.classList) { s.items.push("classList"); s.classList = rosterMap(opts.readRows("Roster")); }
    if (items.attendance) { s.items.push("attendance"); const a = attMap(opts.readRows("Attendance")); s.attendance = a.map; s.attCols = a.cols; }
    return s;
  }
  // Reads every other computer's snapshot. A file that cannot be opened is reported, never fatal.
  async function others() {
    const out = [], problems = [];
    let names = []; try { names = (await opts.place.rawList("")).filter((e) => !e.dir && FILE_RE.test(e.name) && e.name !== mine); } catch (e) { throw new Error("Could not read the linked storage: " + e.message); }
    for (const e of names) {
      try {
        const s = opts.unpack(await opts.place.rawGet(e.name));
        if (now() - s.at > STALE_MS) { problems.push(e.name + ": not synchronised for 60 days, ignored"); continue; }
        out.push(s);
      } catch (err) { problems.push(e.name + ": " + err.message); }
    }
    return { snaps: out, problems };
  }

  // One synchronisation: read the others, merge, apply here, publish this computer's result.
  async function run(items) {
    const want = { classList: items.classList === "sync", attendance: items.attendance === "sync" };
    if (!want.classList && !want.attendance) return { ok: true, skipped: true, conflicts: 0, devices: 0, changed: {} };
    const base = opts.readBase() || {};
    const { snaps, problems } = await others();
    let conflicts = 0, changed = {};
    const mine0 = local(want);
    const result = { at: now(), device: opts.deviceId, name: opts.deviceName || "", items: mine0.items };

    if (want.classList) {
      let cur = mine0.classList; const before = JSON.stringify(cur);
      for (const s of snaps) if (s.classList) { const m = merge3(base.classList || {}, cur, seenBy(s.classList, s.knownClassList, cur), keepLocal); cur = m.data; conflicts += m.conflicts; }
      if (JSON.stringify(cur) !== before) { const rows = opts.readRows("Roster"); opts.setRows("Roster", rosterRows(cur, rows && rows[0])); changed.classList = true; }
      result.classList = cur; result.knownClassList = union(base.knownClassList || Object.keys(base.classList || {}), Object.keys(cur));
    }
    if (want.attendance) {
      let cur = mine0.attendance, cols = mine0.attCols; const before = JSON.stringify([cur, cols]);
      for (const s of snaps) if (s.attendance) {
        const m = merge3(base.attendance || {}, cur, seenBy(s.attendance, s.knownAttendance, cur), presentWins); cur = m.data; conflicts += m.conflicts; cols = union(cols, s.attCols || []);
      }
      if (JSON.stringify([cur, cols]) !== before) { opts.setRows("Attendance", attRows(cur, cols)); changed.attendance = true; }
      result.attendance = cur; result.attCols = cols; result.knownAttendance = union(base.knownAttendance || Object.keys(base.attendance || {}), Object.keys(cur));
    }
    await opts.place.rawPut(mine, opts.pack(result)); // published only after the merge was applied here
    opts.writeBase({ classList: result.classList, attendance: result.attendance, knownClassList: result.knownClassList, knownAttendance: result.knownAttendance, at: result.at });
    return { ok: true, conflicts, devices: snaps.length, changed, problems };
  }
  // Which other computers have published, for the screen.
  async function devices() {
    try { const o = await others(); return o.snaps.map((s) => ({ name: s.name || s.device, at: s.at, items: s.items })); } catch (e) { return []; }
  }
  return { run, devices };
}
module.exports = { createRecordsSync, rosterMap, rosterRows, attMap, attRows, STALE_MS };
