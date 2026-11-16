/* rules/auth.js signs in the same way as the Apps Script: its sessions are accepted by the script and the script's by it; passwords and recovery codes
   made by one are checked by the other; the lockouts agree. */
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("crypto");
const { classroom } = require("./classroom");
const A = require("../rules/auth");
const AT = require("../rules/attendance");
const { fromBackend } = require("../rules/store");

const norm = (r) => JSON.parse(JSON.stringify(r, (k, v) => (k === "_session" || (k === "recovery" && typeof v === "string") ? undefined : v)));
function pair(n) {
  const script = classroom({ students: n }), mod = classroom({ students: n });
  script.host("hostcheck"); // makes the script's session secret
  const book = JSON.parse(script.backend.exportText());
  mod.editWorkbook((b) => { ["Key", "Access_Codes"].forEach((nm) => { b.sheets.find((x) => x.name === nm).rows = book.sheets.find((x) => x.name === nm).rows; }); });
  const store = () => fromBackend(mod.backend); store().setProp("sess_secret", script.backend.prop("sess_secret"));
  const o = { random: () => crypto.randomUUID(), counters: A.memoryCounters(() => new Date()) };
  return { script, mod, store, o, close: () => { script.backend.close(); mod.backend.close(); } };
}

test("the host key: right and wrong, sessions both ways, lockout after ten wrong", () => {
  const P = pair(2), key = P.script.key;
  const req = { post: true, session: "" };
  assert.equal(A.hostOk(P.store(), { hostkey: key }, req, P.o), true); assert.match(req.session, /^s1\.h\.host\./);
  const sRes = P.script.call({ action: "hostcheck", hostkey: key }); assert.equal(sRes.ok, true);
  assert.equal(A.hostOk(P.store(), { hostkey: sRes._session }, { post: true, session: "" }, P.o), true, "the script's session is accepted here");
  assert.equal(P.script.call({ action: "hostcheck", hostkey: req.session }).ok, true, "this session is accepted by the script");
  assert.equal(A.hostOk(P.store(), { hostkey: key }, { post: false, session: "" }, P.o), false, "a key in a web address is refused");
  for (let i = 0; i < 10; i++) { assert.equal(A.hostOk(P.store(), { hostkey: "wrong" + i }, { post: true, session: "" }, P.o), false); assert.equal(P.script.call({ action: "hostcheck", hostkey: "wrong" + i }).ok, false); }
  assert.equal(A.hostOk(P.store(), { hostkey: key }, { post: true, session: "" }, P.o), false, "locked");
  assert.equal(P.script.call({ action: "hostcheck", hostkey: key }).ok, false, "the script is locked too");
  P.close();
});

test("password: status, set, refusals, recovery, and hashes the other side accepts", () => {
  const P = pair(2), key = P.script.key, S = P.store(), req = { post: true, session: "" };
  assert.deepEqual(A.passwordStatus(S), norm(P.script.call({ action: "password_status" })));
  for (const nk of ["short", "   padded password  ", "aaaaaaaaaaaa", key]) {
    const s = norm(P.script.call({ action: "setkey", hostkey: key, newkey: nk })), m = norm(A.setHostKey(S, { hostkey: key, newkey: nk }, req, P.o));
    assert.deepEqual(m, s, JSON.stringify(nk));
  }
  const ns = P.script.call({ action: "setkey", hostkey: key, newkey: "a good long password" }); assert.equal(ns.ok, true); assert.match(ns.recovery, /^[A-Z0-9]{5}(-[A-Z0-9]{5}){3}$/);
  // the script's stored hash and recovery hash are understood here
  const book = JSON.parse(P.script.backend.exportText());
  P.mod.editWorkbook((b) => { b.sheets.find((x) => x.name === "Key").rows = book.sheets.find((x) => x.name === "Key").rows; });
  const S2 = fromBackend(P.mod.backend); S2.setProp("pw_recovery", P.script.backend.prop("pw_recovery"));
  assert.match(A.hostStored(S2), /^pw1:4000:/); assert.equal(A.pwCheck(A.hostStored(S2), "a good long password"), true); assert.equal(A.pwCheck(A.hostStored(S2), "wrong"), false);
  assert.equal(A.hostOk(S2, { hostkey: "a good long password" }, { post: true, session: "" }, P.o), true);
  assert.deepEqual(A.passwordStatus(S2), norm(P.script.call({ action: "password_status" })));
  const rec = A.recoverHostKey(S2, { recovery: ns.recovery.toLowerCase(), newkey: "another long password" }, P.o); assert.equal(rec.ok, true);
  assert.deepEqual(norm(A.recoverHostKey(S2, { recovery: "WRONG", newkey: "x" }, P.o)), { ok: false, why: "That recovery code was not accepted." });
  assert.equal(P.script.call({ action: "password_recover", recovery: "WRONG", newkey: "another long password" }).why, "That recovery code was not accepted.");
  // what this side stores, the script accepts
  const book2 = (() => { const t = { sheets: [{ name: "Key", rows: S2.rows("Key") }] }; return t; })();
  P.script.editWorkbook((b) => { b.sheets.find((x) => x.name === "Key").rows = book2.sheets[0].rows; });
  assert.equal(P.script.call({ action: "hostcheck", hostkey: "another long password" }).ok, true, "a password set here is accepted by the script");
  P.close();
});

test("a student: the access code gives a session, the script's session is accepted, a wrong code is counted", () => {
  const P = pair(2), [a, b] = P.script.students, S = P.store();
  const req = { post: true, session: "" };
  assert.deepEqual(A.studentCheck(S, a.id, P.script.codes[a.id], "r", req, P.o), { id: a.id }); assert.match(req.session, /^s1\.s\./);
  assert.deepEqual(A.studentCheck(S, a.id, req.session, "r", { post: true, session: "" }, P.o), { id: a.id });
  assert.deepEqual(A.studentCheck(S, b.id, req.session, "r", { post: true, session: "" }, P.o), { why: "not recognised" }, "a session belongs to its student");
  assert.deepEqual(A.studentCheck(S, a.id, P.script.codes[a.id], "r", { post: false, session: "" }, P.o), { why: "not recognised" });
  assert.deepEqual(A.studentCheck(S, "12", "x", "r", req, P.o), { why: "bad id" });
  // the script makes a session at check-in; this side accepts it
  AT.open(S, { nogeo: "1" }, { random: P.o.random }); P.script.host("attend_open", { nogeo: "1" });
  const book = JSON.parse(P.script.backend.exportText());
  P.mod.editWorkbook((x) => { x.sheets.find((s) => s.name === "Attendance_Control").rows = book.sheets.find((s) => s.name === "Attendance_Control").rows; });
  const ses = AT.sessions(fromBackend(P.mod.backend))[0], tok = AT.linkFor(ses.secret, Math.floor(Date.now() / 30000));
  const ck = P.script.call({ action: "attend", id: a.id, dev: "devicetokenabcdefghij12345", t: tok, code: P.script.codes[a.id] }); assert.equal(ck.ok, true); assert.match(ck._session, /^s1\.s\./);
  assert.deepEqual(A.studentCheck(fromBackend(P.mod.backend), a.id, ck._session, "r", { post: true, session: "" }, P.o), { id: a.id });
  for (let i = 0; i < 6; i++) A.studentCheck(S, b.id, "WRNG-0000", "c", req, P.o);
  assert.deepEqual(A.studentCheck(S, b.id, P.script.codes[b.id], "c", req, P.o), { why: "slow down" });
  P.close();
});

test("sessions end for everyone, and a quiz receipt is the same on both sides", () => {
  const P = pair(1), S = P.store(), req = { post: true, session: "" }, id = P.script.students[0].id;
  assert.equal(A.hostOk(S, { hostkey: P.script.key }, req, P.o), true); const old = req.session;
  assert.deepEqual(A.signOutEveryone(S, P.o), { ok: true });
  assert.equal(A.hostOk(S, { hostkey: old }, { post: true, session: "" }, P.o), false);
  assert.equal(A.resetHostKey(S, P.o).startsWith("Temporary key: "), true);
  const P2 = pair(1), S2 = P2.store(); const rc = A.quizReceipt(S2, P2.o, "abc12", id);
  assert.equal(A.receiptOk(S2, P2.o, "ABC12", id, rc), true); assert.equal(A.receiptOk(S2, P2.o, "ABC12", id, "no"), false);
  P.close(); P2.close();
});
