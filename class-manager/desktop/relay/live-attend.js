/* CM's side of live attendance on the relay: hand the open session to the relay so phones can check in while this computer is off,
   then collect what the phones did and record it with the same tabs the rules use (Attendance_Log, Attendance_Flags, Attendance_Phones).
   One responsibility: translate between the rules store and the relay's /v1/live routes. The relay's own rules are relay/hub/src/attend.js. */
"use strict";
const crypto = require("crypto");
const AT = require("../rules/attendance");
const AC = require("../rules/access-codes");
const U = require("../rules/unlisted");
const { append } = require("../rules/store");

const hashCode = (course, id, code) => crypto.createHash("sha256").update(course + "|" + id + "|" + AC.normCode(code)).digest("hex"); // the relay holds only this, never the code

// Opens the current Open session on the relay. The session must already be open in the rules (AT.open); geo is the mode its check-ins use.
async function openOnRelay(hub, store, course, geo) {
  const ses = AT.openSession(store); if (!ses) return { ok: false, why: "no attendance session is open" };
  const codes = AC.codesMap(store), roster = {};
  AT.roster(store).forEach(([id]) => { roster[id] = codes[id] ? hashCode(course, id, codes[id].code) : ""; });
  const phones = AT.phones(store).byId; // phones the relay registered earlier (its own hash); one registered through CM's own page has a different hash, so it is held for review once
  const show = String(store.prop("code_claim") || "1") !== "0", shown = {}; // codes go to the relay only for this open session, only so that students can be shown their own on sign-in; they are deleted when the session closes
  if (show) Object.keys(roster).forEach((id) => { if (codes[id]) shown[id] = codes[id].code; });
  return hub.post("/v1/live/open", { codes: shown, label: ses.label, secret: ses.secret, mode: geo === "enforce" ? "enforce" : "off", lat: ses.lat, lon: ses.lon, radius: ses.radius || 500, roster, phones });
}

// Records the relay's events once each: a check-in is added to the log unless that ID is already there; flags and held check-ins go to the flags tab.
function applyEvents(store, events) {
  const out = { added: 0, flags: 0, pending: 0, binds: 0 };
  events.forEach((e) => {
    const at = new Date(e.at * 1000);
    if (e.kind === "ok") {
      if (AT.present(store, e.label)[e.sid]) return;
      const [onl0, loc] = String(e.note).split("|");
      const stillOff = onl0 === "No" && U.isUnlisted(store, e.sid), onl = onl0 === "No" && !stillOff ? "Yes" : onl0; // added to the class list while the phone was signing in: it counts
      if (stillOff) U.note(store, { id: e.sid, kind: "attendance", ref: e.label, when: at }); // held for review, like a check-in made on this computer
      append(store, AT.LOG, ["Timestamp", "Session", "Student ID", "On roster", "Device", "Location"], [at, e.label, e.sid, onl, e.dev, loc || ""]); out.added++;
    } else if (e.kind === "bind") {
      if (!AT.phones(store).byId[e.sid]) { append(store, AT.PHONES, ["Student ID", "Device", "Registered"], [e.sid, e.dev, at]); out.binds++; }
    } else if (e.kind === "flag" || e.kind === "pending") { AT.flag(store, e.label, e.sid, e.dev, e.note); if (e.kind === "pending") out.pending++; else out.flags++; }
  });
  return out;
}
// Collects everything since the last time, records it, and tells the relay to forget it. Returns { ok, applied }.
async function collect(hub, store) {
  const after = Number(store.prop("live_after")) || 0;
  const r = await hub.post("/v1/live/events", { after });
  if (!r.events.length) return { ok: true, applied: { added: 0, flags: 0, pending: 0, binds: 0 } };
  const applied = applyEvents(store, r.events), top = r.events[r.events.length - 1].id;
  store.setProp("live_after", String(top));
  await hub.post("/v1/live/ack", { upto: top });
  return { ok: true, applied, more: !!r.more };
}

async function closeOnRelay(hub) { return hub.post("/v1/live/close", {}); }

module.exports = { openOnRelay, collect, closeOnRelay, applyEvents, hashCode };
