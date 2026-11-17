/* Showing a student their own access code at sign-in: the relay gives the same answers as desktop/rules/code-claim.js on the same cases,
   shows a code only to the first phone, holds everyone else for the lecturer, and forgets every code when the session closes. */
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { webcrypto as wc, createHmac } from "node:crypto";
import { newEnv, call, newCourseKeys, registerCourse, signed } from "./helpers.js";
import { codeHash } from "../src/attend.js";

const require = createRequire(import.meta.url);
const AT = require("../../../desktop/rules/attendance.js"), AC = require("../../../desktop/rules/access-codes.js"), CC = require("../../../desktop/rules/code-claim.js");

const SECRET = "a-session-secret-of-some-length-0123456789";
const STUDENTS = [["20000001", "AAAA-2222"], ["20000002", "BBBB-3333"], ["20000003", "CCCC-4444"]];
const token = (now, back) => createHmac("sha256", SECRET).update("qr:" + (Math.floor(now / 30) - (back || 0))).digest().subarray(0, 4).toString("hex");
const dev = (n) => "device" + n + "abcdefghijklmnopqrstuvwxyz";

async function bothSides(mode, withCodes) {
  const now = Math.floor(Date.now() / 1000), env = await newEnv(), keys = await newCourseKeys();
  const course = (await registerCourse(env, keys, now)).body.course;
  const roster = {}, codes = {}; for (const [id, code] of STUDENTS) { roster[id] = await codeHash(course, id, code); codes[id] = code; }
  const op = await signed(env, keys, course, "/v1/live/open", { label: "16/11/2026 #1", secret: SECRET, mode, lat: 51.5, lon: -0.12, radius: 200, roster, phones: {}, codes: withCodes === false ? {} : Object.assign({ 99999999: "ZZZZ-9999" }, codes) }, now);
  assert.equal(op.status, 200, JSON.stringify(op.body)); if (withCodes !== false) assert.equal(op.body.codes, 3, "a code for an ID not on the list is not kept");
  const tabs = { Roster: [["Student ID", "Name"]].concat(STUDENTS.map(([id]) => [id, "S" + id])), Access_Codes: [["Student ID", "Access code", "Issued"]].concat(STUDENTS.map(([id, c]) => [id, c, new Date().toISOString()])), Attendance_Control: [["Code", "Label", "Status", "Opened", "Closed", "Secret", "Lat", "Lon", "Radius m"], ["1234", "16/11/2026 #1", "Open", "", "", SECRET, 51.5, -0.12, 200]] }, props = {};
  const store = { rows: (t) => tabs[t] || null, setRows: (t, r) => { tabs[t] = r; }, prop: (k) => props[k], setProp: (k, v) => { props[k] = v; }, now: () => new Date(now * 1000) };
  const fails = {}, o = { random: () => wc.randomUUID(), geoMode: mode, grace: 1, fails: { get: (k) => fails[k] || 0, add: (k) => { fails[k] = (fails[k] || 0) + 1; } }, verifyCode: (id, g, mine) => ({ ok: AC.normCode(g) === mine.code }) };
  let ip = 0;
  const phone = async (p) => {
    const q = Object.assign({ t: token(now), lat: "", lon: "" }, p);
    const relay = (await call(env, "POST", "/v1/claim", { body: JSON.stringify(Object.assign({ course }, q)), headers: { "CF-Connecting-IP": "9.9.9." + (ip++ % 200) } }, now)).body;
    return { relay, rules: CC.claim(store, q, o) };
  };
  const checkIn = (p) => call(env, "POST", "/v1/attend", { body: JSON.stringify(Object.assign({ course, t: token(now) }, p)), headers: { "CF-Connecting-IP": "6.6.6." + (ip++ % 200) } }, now).then((r) => r.body);
  return { phone, checkIn, env, keys, course, now, store };
}
const pick = (r) => ({ ok: r.ok, why: r.why, id: r.id, pending: r.pending, code: r.code, onList: r.onList });

test("the same answers as the rules: the first phone is shown the code, any other phone is held", async () => {
  const S = await bothSides("off"), same = async (p, expect) => { const r = await S.phone(p); assert.deepEqual(pick(r.relay), pick(r.rules)); assert.equal(r.relay.why || (r.relay.onList === false ? "unlisted" : r.relay.pending ? "pending" : r.relay.code ? "shown" : "?"), expect); return r.relay; };
  assert.equal((await same({ id: "20000001", dev: dev(1) }, "shown")).code, "AAAA-2222");
  assert.equal((await same({ id: "20000001", dev: dev(1) }, "shown")).code, "AAAA-2222", "the same phone again, for example after clearing the page");
  assert.equal((await same({ id: "20000001", dev: dev(2) }, "pending")).code, undefined, "another phone asking for a registered ID is not shown the code");
  assert.equal((await same({ id: "20000002", dev: dev(1) }, "pending")).code, undefined, "a phone registered to someone else is not shown another code");
  await same({ id: "99999999", dev: dev(3) }, "unlisted"); // off the class list: no code is shown; the phone checks in with a warning to see the lecturer
  await same({ id: "20000003", dev: dev(4), t: token(S.now, 5) }, "old link");
  await same({ id: "12", dev: dev(5) }, "bad id");
  await same({ id: "20000003", dev: "short" }, "update page");
  await same({ id: "20000003", dev: dev(6), t: token(S.now, 1) }, "shown");
  const ev = (await signed(S.env, S.keys, S.course, "/v1/live/events", { after: 0 }, S.now)).body.events;
  assert.deepEqual(ev.filter((e) => e.kind === "bind").map((e) => e.sid), ["20000001", "20000003"], "the phone is registered at the first reveal");
  assert.ok(ev.some((e) => e.kind === "pending" && e.sid === "20000001" && e.note.startsWith("waiting for approval: ")), "the lecturer is told about the second phone");
  assert.ok(!JSON.stringify(ev).includes("AAAA-2222"), "a code never appears in the events");
  // the registered phone can go on to check in with the code it was shown
  const ci = await S.checkIn({ id: "20000001", dev: dev(1), code: "AAAA-2222" }); assert.equal(ci.ok, true); assert.equal(ci.pending, undefined);
});

test("the location is checked before a code is shown, and wrong guesses slow a phone down", async () => {
  const S = await bothSides("enforce"), same = async (p, expect) => { const r = await S.phone(p); assert.deepEqual(pick(r.relay), pick(r.rules)); assert.equal(r.relay.why || "ok", expect); };
  await same({ id: "20000001", dev: dev(1), lat: 51.6, lon: -0.12 }, "too far");
  await same({ id: "20000001", dev: dev(1) }, "no location");
  await same({ id: "20000001", dev: dev(1), lat: 51.5005, lon: -0.12 }, "ok");
  for (let i = 0; i < 6; i++) await S.phone({ id: "20000002", dev: dev(9), t: token(S.now, 5), lat: 51.5005, lon: -0.12 }); // an old QR link counts as a failed try
  await same({ id: "20000002", dev: dev(9), lat: 51.5005, lon: -0.12 }, "slow down");
});

test("no codes are kept unless CM sends them, and every code is forgotten when the session closes", async () => {
  const S = await bothSides("off", false);
  assert.equal((await S.phone({ id: "20000001", dev: dev(1) })).relay.why, "not recognised");
  const T = await bothSides("off");
  assert.equal((await T.phone({ id: "20000001", dev: dev(1) })).relay.code, "AAAA-2222");
  assert.equal((await signed(T.env, T.keys, T.course, "/v1/live/close", {}, T.now)).body.ok, true);
  assert.equal((await T.env.DB.prepare("SELECT COUNT(*) AS n FROM live_code WHERE course = ?").bind(T.course).first()).n, 0);
  assert.equal((await T.phone({ id: "20000001", dev: dev(1) })).relay.why, "closed");
});
