/* Live attendance on the relay gives the same answers as desktop/rules/attendance.js on the same cases (so phones behave the same with the laptop off). */
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { webcrypto as wc, createHmac } from "node:crypto";
import { newEnv, call, newCourseKeys, registerCourse, signed, NOW } from "./helpers.js";
import { courseIdOf } from "../src/crypto.js";
import { codeHash } from "../src/attend.js";
import { fakeD1 } from "./fake-d1.js";

const require = createRequire(import.meta.url);
const AT = require("../../../desktop/rules/attendance.js"), UL = require("../../../desktop/rules/attendance-unlock.js");

const SECRET = "a-session-secret-of-some-length-0123456789";
const STUDENTS = [["20000001", "AAAA-2222"], ["20000002", "BBBB-3333"], ["20000003", "CCCC-4444"]];
const token = (now, back) => createHmac("sha256", SECRET).update("qr:" + (Math.floor(now / 30) - (back || 0))).digest().subarray(0, 4).toString("hex");
const dev = (n) => "device" + n + "abcdefghijklmnopqrstuvwxyz";

async function bothSides(mode) {
  const now = Math.floor(Date.now() / 1000), env = await newEnv(), keys = await newCourseKeys();
  const reg = await registerCourse(env, keys, now); const course = reg.body.course; assert.equal(await courseIdOf(keys.pub), course);
  const roster = {}; for (const [id] of STUDENTS) roster[id] = "";
  const op = await signed(env, keys, course, "/v1/live/open", { label: AT.dayKey(new Date()) + " #1", secret: SECRET, mode, lat: 51.5, lon: -0.12, radius: 200, roster, phones: {} }, now);
  assert.equal(op.status, 200, JSON.stringify(op.body));
  // the rules side: the same class on an in-memory store
  const tabs = { Roster: [["Student ID", "Name"]].concat(STUDENTS.map(([id]) => [id, "S" + id])), Access_Codes: [["Student ID", "Access code", "Issued"]].concat(STUDENTS.map(([id, c]) => [id, c, new Date().toISOString()])), Attendance_Control: [["Code", "Label", "Status", "Opened", "Closed", "Secret", "Lat", "Lon", "Radius m"], ["1234", AT.dayKey(new Date()) + " #1", "Open", "", "", SECRET, 51.5, -0.12, 200]] }, props = {};
  const store = { rows: (t) => tabs[t] || null, setRows: (t, r) => { tabs[t] = r; }, prop: (k) => props[k], setProp: (k, v) => { props[k] = v; }, now: () => new Date(now * 1000) };
  const fails = {}; const o = { random: () => wc.randomUUID(), geoMode: mode, grace: 1, fails: { get: (k) => fails[k] || 0, add: (k) => { fails[k] = (fails[k] || 0) + 1; } }, };
  const phone = async (p) => {
    const q = Object.assign({ t: token(now), code: "", lat: "", lon: "" }, p);
    const relay = (await call(env, "POST", "/v1/attend", { body: JSON.stringify(Object.assign({ course }, q)), headers: { "CF-Connecting-IP": "9.9.9." + Math.floor(Math.random() * 200) } }, now)).body;
    const rules = AT.checkIn(store, q, o);
    return { relay, rules };
  };
  const unlock = async (id) => { const k = UL.issue(store, { id }, { bytes: (n) => Buffer.alloc(n, 7) }); const r = await signed(env, keys, course, "/v1/live/unlock", { id, hash: await codeHash(course, id, k.code) }, now); assert.equal(r.status, 200, JSON.stringify(r.body)); return k.code; }; // the lecturer issues a code: CM keeps it, the relay gets its hash
  return { phone, unlock, env, keys, course, now };
}
const pick = (r) => ({ ok: r.ok, why: r.why, id: r.id, onList: r.onList, already: r.already, pending: r.pending });

test("the same answers as the rules, location off", async () => {
  const S = await bothSides("off"), same = async (p, expect) => { const r = await S.phone(p); assert.deepEqual(pick(r.relay), pick(r.rules)); if (expect) assert.equal(r.relay.why || (r.relay.already ? "already" : r.relay.pending ? "pending" : "ok"), expect); return r.relay; };
  await same({ id: "20000001", dev: dev(1) }, "ok");
  await same({ id: "20000001", dev: dev(1), code: "AAAA-2222" }, "already");
  await same({ id: "20000003", dev: dev(1) }, "code required"); // the same phone again with a different ID: the access code is asked, and only now
  await same({ id: "20000003", dev: dev(1), code: "wrong" }, "not recognised");
  await same({ id: "20000003", dev: dev(1), code: "CCCC4" }, "not recognised"); // nothing issued yet
  const k = await S.unlock("20000003");
  await same({ id: "20000003", dev: dev(1), code: "ZZZZZ" }, "not recognised");
  await same({ id: "20000003", dev: dev(1), code: k }, "ok"); // the lecturer's code lets the second ID through, once
  await same({ id: "20000002", dev: dev(2), code: "wrong" }, "ok"); // a first sign-in from a new phone needs no code, and a wrong one typed anyway is ignored
  await same({ id: "20000002", dev: dev(2), t: token(S.now, 5), code: "BBBB-3333" }, "old link");
  await same({ id: "20000002", dev: dev(2), t: token(S.now, 1), code: "BBBB-3333" }, "already"); // the one before is forgiven
  await same({ id: "20000002", dev: dev(7), code: "BBBB-3333" }, "already");
  await same({ id: "99999999", dev: dev(3) }, "ok"); // not on the list: counted as not on the list
  await same({ id: "12", dev: dev(4) }, "bad id");
  await same({ id: "20000003", dev: "short" }, "update page");
  const ev = (await signed(S.env, S.keys, S.course, "/v1/live/events", { after: 0 }, S.now)).body;
  assert.deepEqual(ev.events.filter((e) => e.kind === "ok").map((e) => e.sid), ["20000001", "20000003", "20000002", "99999999"]);
  assert.ok(ev.events.some((e) => e.kind === "flag" && e.note.startsWith("second ID on this phone")), "the request is logged for the lecturer");
  assert.equal(ev.events.find((e) => e.kind === "ok" && e.sid === "20000003").dev, "", "an unlocked check-in keeps no phone hash");
  assert.ok(!JSON.stringify(ev).includes(k), "no raw code ever reaches the relay's records");
});

test("location enforced: far and missing are refused like the rules", async () => {
  const S = await bothSides("enforce"), same = async (p, expect) => { const r = await S.phone(p); assert.deepEqual(pick(r.relay), pick(r.rules)); assert.equal(r.relay.why || "ok", expect); };
  await same({ id: "20000001", dev: dev(1), code: "AAAA-2222", lat: 51.6, lon: -0.12 }, "too far");
  await same({ id: "20000001", dev: dev(1), code: "AAAA-2222" }, "no location");
  await same({ id: "20000001", dev: dev(1), code: "AAAA-2222", lat: 51.5005, lon: -0.12 }, "ok");
});

test("six wrong codes slow a phone down, close forgets the class list, signed routes need a signature", async () => {
  const S = await bothSides("off");
  await S.phone({ id: "20000001", dev: dev(5) }); // dev(5) is now registered to someone else, so a code is asked for 20000002
  for (let i = 0; i < 6; i++) await call(S.env, "POST", "/v1/attend", { body: JSON.stringify({ course: S.course, id: "20000002", dev: dev(5), t: token(S.now), code: "no" }), headers: { "CF-Connecting-IP": "8.8.8." + i } }, S.now);
  const r = await call(S.env, "POST", "/v1/attend", { body: JSON.stringify({ course: S.course, id: "20000002", dev: dev(5), t: token(S.now), code: "BBBB-3333" }), headers: { "CF-Connecting-IP": "8.8.8.9" } }, S.now);
  assert.equal(r.body.why, "slow down");
  assert.equal((await signed(S.env, S.keys, S.course, "/v1/live/open", { label: "x", secret: SECRET, mode: "off", roster: { 20000001: "h" } }, S.now)).status, 409, "one session at a time");
  const c = await signed(S.env, S.keys, S.course, "/v1/live/close", {}, S.now); assert.equal(c.body.ok, true);
  const row = await S.env.DB.prepare("SELECT secret, roster FROM live_session WHERE course = ?").bind(S.course).first();
  assert.equal(row.secret, ""); assert.equal(row.roster, "{}");
  assert.equal((await call(S.env, "POST", "/v1/attend", { body: JSON.stringify({ course: S.course, id: "20000001", dev: dev(1), t: token(S.now) }) }, S.now)).body.why, "closed");
  assert.equal((await call(S.env, "POST", "/v1/live/open", { body: "{}" }, S.now)).status, 401);
  const ack = await signed(S.env, S.keys, S.course, "/v1/live/ack", { upto: 1000 }, S.now); assert.equal(ack.body.ok, true);
});

test("refused check-ins are kept as events for CM's Sign-in problems list, with a reason and never a code", async () => {
  const S = await bothSides("off");
  await S.phone({ id: "20000001", dev: dev(1) });
  await S.phone({ id: "20000003", dev: dev(1) }); // second ID on that phone: asks for the lecturer's code
  await S.phone({ id: "20000003", dev: dev(1), code: "SECRET-CODE" }); // wrong code
  await S.phone({ id: "20000002", dev: dev(2), t: "00000000" }); // old QR
  await S.phone({ id: "12", dev: dev(3) }); // wrong length
  const ev = (await signed(S.env, S.keys, S.course, "/v1/live/events", { after: 0 }, S.now)).body.events.filter((e) => e.kind === "refused");
  assert.deepEqual(ev.map((e) => [e.sid, e.note]), [["20000003", "second_id"], ["20000003", "wrong_unlock"], ["20000002", "old_qr"], ["12", "bad_id"]]);
  assert.ok(!JSON.stringify(ev).includes("SECRET"));
});
