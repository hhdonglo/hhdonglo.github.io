/* Showing a student their own access code when they sign in to class, so nothing has to be printed or emailed.
   The student scans the room's QR code (proof of being in the room for 30 seconds), enters only the ID, and this phone is shown the code once.
   One responsibility: the rules for that reveal over the store interface. The relay has the same rules (relay/hub/src/attend.js, claim), kept in step by relay/hub/test/claim.test.js.
   The code is shown only when ALL hold: an attendance session is open; the QR token is current; the ID is on the class list and has a code;
   the phone is not registered to a different ID and the ID is not registered to a different phone (the first phone to ask is registered, the same one-phone-per-student rule as check-in).
   Anyone else asking for that ID is not shown the code: the request is held for the lecturer (the same "waiting for approval" list as a borrowed phone), who can forget the registered phone to let the student try again.
   Off the class list and "no code yet" give the same answer as a wrong code, so nobody can probe which IDs exist. */
"use strict";
const { normalizeId } = require("../ids");
const { append } = require("./store");
const AC = require("./access-codes");
const A = require("./attendance");

const ON = (store) => String(store.prop("code_claim") || "1") !== "0"; // the lecturer can switch the reveal off (property code_claim = "0")
const HELD = A.K.PENDING + "asked for the access code from a phone other than the one registered";

function claim(store, p, o) {
  const ses = A.openSession(store); if (!ses) return { ok: false, why: "closed" };
  if (!ON(store)) return { ok: false, why: "no access code" };
  const now = store.now().getTime(), fails = o.fails, mode = o.geoMode || A.K.GEO_MODE;
  const aid = normalizeId(p.id); let dev = String(p.dev || "").replace(/[^A-Za-z0-9]/g, "").slice(0, 40);
  if (aid.length < 4 || aid.length > 12) return { ok: false, why: "bad id" };
  if (dev.length < 16) return { ok: false, why: "update page" };
  dev = A.devHash(store, dev, o.random);
  if (fails.get("d" + dev) >= A.K.MAX_FAILS || fails.get("i" + aid) >= A.K.MAX_FAILS) return { ok: false, why: "slow down" };
  if (!A.linkOk(ses, String(p.t || "").replace(/[^0-9a-f]/g, "").slice(0, 8), now, o.grace)) { fails.add("d" + dev); fails.add("i" + aid); return { ok: false, why: "old link" }; }
  const g = A.geo(ses, p, mode);
  if (mode === "enforce" && (g.state === "far" || g.state === "none")) return { ok: false, why: g.state === "far" ? "too far" : "no location" };
  const mine = A.rosterSet(store)[aid] ? AC.codesMap(store)[aid] : null;
  if (!mine) { fails.add("d" + dev); fails.add("i" + aid); return { ok: false, why: "not recognised" }; }
  if (AC.expired(store, mine)) return { ok: false, why: "code expired" };
  const ph = A.phoneCheck(store, aid, dev);
  if (ph.refuse || ph.changed) {
    fails.add("d" + dev);
    if (!A.pendingHas(store, ses.label, aid)) A.flag(store, ses.label, aid, dev, HELD);
    return { ok: true, id: aid, pending: true };
  }
  if (ph.bind) { append(store, A.PHONES, ["Student ID", "Device", "Registered"], [aid, dev, store.now()]); A.flag(store, ses.label, aid, dev, "access code shown on this phone, now registered to this ID"); }
  return { ok: true, id: aid, code: mine.code };
}

module.exports = { claim, HELD };
