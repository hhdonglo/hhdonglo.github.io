/* Course synchronisation: local and online at the same time.
   Per item the lecturer chooses "This computer only" (the default) or "Keep in step with the cloud". An item kept in
   step is always stored here too: every change is saved on this computer at once and sent to the linked place a few
   seconds later, and what other computers saved there is merged in every two minutes and when the course opens.
   Without a connection CM carries on from the local copy and catches up when the connection returns.
   Items, each chosen on its own (for example notes in the cloud, attendance on this computer only): notes (lecturer
   notes) and materials (course files), both ways, readable files; classList and attendance (encrypted
   records, merged three-way; sync/records.js). Switching an item off or on loses nothing: the local copy and the
   copy in the place both stay.
   This module only schedules and reports; the rules are in records.js, materials.js and merge.js. No Electron. */
"use strict";
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { packJson, unpackJson } = require("../vault");
const { createRecordsSync } = require("./records");
const materials = require("./materials");

const SEND_AFTER_MS = 15000, EVERY_MS = 120000;

// opts: dir (course data folder), contentDir, notesDir, linked (linked-folder.js), backend ({rawRows,setRows}), vault (encode/decode for the baseline),
// deviceName, log, now, timers (for tests: { setTimeout, setInterval, clearTimeout, clearInterval })
function createCourseSync(opts) {
  const log = opts.log || (() => {});
  const T = opts.timers || { setTimeout, setInterval, clearTimeout, clearInterval };
  const stateFile = path.join(opts.dir, "sync-state.bin"), deviceFile = path.join(opts.dir, "sync-device.json");
  let last = null, busy = null, again = false, timer = null, tick = null, pass = "";

  function deviceId() {
    try { const d = JSON.parse(fs.readFileSync(deviceFile, "utf8")); if (/^[\w-]{6,40}$/.test(d.id)) return d.id; } catch (e) { /* first run */ }
    const id = crypto.randomBytes(6).toString("hex");
    fs.mkdirSync(opts.dir, { recursive: true }); fs.writeFileSync(deviceFile, JSON.stringify({ id }));
    return id;
  }
  const readState = () => { try { return JSON.parse(opts.vault.decode(fs.readFileSync(stateFile))); } catch (e) { return {}; } };
  const writeState = (o) => { fs.mkdirSync(opts.dir, { recursive: true }); const t = stateFile + ".tmp"; fs.writeFileSync(t, opts.vault.encode(JSON.stringify(o))); fs.renameSync(t, stateFile); };

  function records(place, p) {
    const st = readState();
    return createRecordsSync({ readRows: opts.backend.rawRows, setRows: opts.backend.setRows, place, deviceId: deviceId(), deviceName: opts.deviceName, now: opts.now,
      pack: (o) => packJson(o, p), unpack: (b) => unpackJson(b, p), readBase: () => st.records || null, writeBase: (b) => writeState(Object.assign(readState(), { records: b })) });
  }

  // One round: pull materials and notes, merge records, push what changed here. Never throws: the result says what happened.
  async function runOnce(userPass) {
    const items = opts.linked.items();
    if (!opts.linked.linked()) return { ok: true, skipped: true };
    if (Object.values(items).every((v) => v !== "sync")) return { ok: true, skipped: true };
    const p = opts.linked.passphrase(userPass || pass);
    const out = { at: (opts.now ? opts.now() : Date.now()), ok: true };
    try {
      const place = opts.linked.raw();
      if (items.classList === "sync" || items.attendance === "sync") {
        if (p.length < 10) return { ok: false, at: out.at, why: "Enter the passphrase to synchronise the class list and attendance." };
        out.records = await records(place, p).run(items);
      }
      const folders = [["materials", "materials", opts.contentDir], ["notes", "notes", opts.notesDir]].filter((x) => items[x[0]] === "sync");
      if (folders.length) {
        const st = readState(); st.mat = st.mat || {}; out.pulled = {}; out.sent = {};
        for (const [item, remote, local] of folders) { out.pulled[item] = await materials.pull(place, remote, local, st.mat); out.sent[item] = await materials.push(place, remote, local, st.mat); }
        writeState(Object.assign(readState(), { mat: st.mat }));
      }
    } catch (e) { out.ok = false; out.why = "Not synchronised (" + e.message + "). This computer carries on and will try again."; log(out.why); }
    last = out; return out;
  }
  // Serialised: a request that arrives during a round makes one more round follow it.
  function syncNow(userPass) {
    if (userPass) pass = String(userPass);
    if (busy) { again = true; return busy; }
    busy = runOnce(userPass).finally(() => { busy = null; if (again) { again = false; syncNow(); } });
    return busy;
  }
  // Called after every local change: sent shortly after, not on every keystroke.
  function changed() { const it = opts.linked.linked() ? opts.linked.items() : {}; if ((it.classList !== "sync" && it.attendance !== "sync") || timer) return; timer = T.setTimeout(() => { timer = null; syncNow(); }, SEND_AFTER_MS); if (timer.unref) timer.unref(); }
  function start() { if (!tick) { tick = T.setInterval(() => syncNow(), EVERY_MS); if (tick.unref) tick.unref(); } syncNow(); }
  function stop() { if (tick) T.clearInterval(tick); if (timer) T.clearTimeout(timer); tick = timer = null; }

  async function state() {
    const items = opts.linked.linked() ? opts.linked.items() : { notes: "local", materials: "local", classList: "local", attendance: "local" };
    let devices = []; try { if (opts.linked.linked() && (items.classList === "sync" || items.attendance === "sync")) { const p = opts.linked.passphrase(pass); if (p.length >= 10) devices = await records(opts.linked.raw(), p).devices(); } } catch (e) { /* offline */ }
    return { linked: opts.linked.linked(), items, last, devices, device: opts.linked.linked() ? deviceId() : "" };
  }
  function setItems(o) { const r = opts.linked.setItems(o); if (Object.values(r).some((v) => v === "sync")) syncNow(); return r; }
  return { syncNow, changed, start, stop, state, setItems, deviceId };
}
module.exports = { createCourseSync, SEND_AFTER_MS, EVERY_MS };
