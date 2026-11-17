/* rules/attendance.js gives the same answers as the Apps Script on the same workbook. Secrets and codes are random, so the module's classroom
   is given the script's session secret and access codes before check-ins are compared. */
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("crypto");
const { classroom } = require("./classroom");
const AT = require("../rules/attendance");
const AC = require("../rules/access-codes");
const { fromBackend } = require("../rules/store");

const norm = (r) => JSON.parse(JSON.stringify(r, (k, v) => (k === "_session" || k === "code" ? undefined : v)));
const same = (a, b) => assert.deepEqual(norm(a), norm(b));
function pair(n) {
  const script = classroom({ students: n }), mod = classroom({ students: n });
  const copy = (names) => { const book = JSON.parse(script.backend.exportText()); mod.editWorkbook((b) => names.forEach((nm) => { const s = book.sheets.find((x) => x.name === nm); const t = b.sheets.find((x) => x.name === nm); if (s && t) t.rows = s.rows; else if (s) b.sheets.push(s); })); };
  copy(["Access_Codes"]);
  const opts = (fails) => ({ random: () => crypto.randomUUID(), fails, verifyCode: (id, given, mine, store) => ({ ok: AC.normCode(given) === mine.code && !AC.expired(store, mine) }) });
  const counts = {}; const fails = { get: (k) => counts[k] || 0, add: (k) => { counts[k] = (counts[k] || 0) + 1; } };
  const o = opts(fails);
  const setMode = (m) => { o.geoMode = m; script.backend.setGeoMode(m); };
  return { script, mod, copy, o, setMode, store: () => fromBackend(mod.backend), M: (f, p) => AT[f](fromBackend(mod.backend), p, o) };
}
const tab = (c, name) => (c.backend.rawRows(name) || []).slice(1);
const keep = (rows, cols) => rows.map((r) => cols.map((i) => String(r[i])));
const GEO = { lat: 51.5, lon: -0.12 };

test("open, check in, close, submit give the same answers and the same tabs", () => {
  const P = pair(3); const [a, b, c] = P.script.students;
  const so = P.script.host("attend_open", { nogeo: "1" }), mo = P.M("open", { nogeo: "1" });
  assert.equal(so.ok, true); assert.equal(mo.ok, true); assert.equal(mo.session.label, so.session.label);
  P.copy(["Attendance_Control"]);
  const ses = AT.sessions(P.store())[0]; const t = AT.linkFor(ses.secret, Math.floor(Date.now() / 30000));
  const dev = (n) => "device" + n + "abcdefghijklmnopqrstuvwxyz";
  const ci = (s, d, extra) => { const p = Object.assign({ action: "attend", id: s.id, dev: dev(d), t, code: P.script.codes[s.id] }, extra); return { s: P.script.call(p), m: P.M("checkIn", p) }; };
  for (const [s, d] of [[a, 1], [b, 2]]) { const r = ci(s, d); same(r.m, r.s); assert.equal(r.m.ok, true); }
  let r = ci(a, 1); same(r.m, r.s); assert.equal(r.m.already, true, "one mark per ID per day");
  r = ci(c, 2, { code: "" }); same(r.m, r.s); assert.equal(r.m.why, "code required", "a second ID on a registered phone is asked for the access code");
  r = ci(c, 2, { code: "AAAA-BBBB" }); same(r.m, r.s); assert.equal(r.m.why, "not recognised");
  r = ci(c, 2); same(r.m, r.s); assert.equal(r.m.pending, true, "a phone registered to another student is held for the lecturer");
  const bad = { action: "attend", id: c.id, dev: dev(3), t: "00000000", code: P.script.codes[c.id] };
  same(P.M("checkIn", bad), P.script.call(bad));
  same(keep(tab(P.mod, "Attendance_Log"), [1, 2, 3]), keep(tab(P.script, "Attendance_Log"), [1, 2, 3]));
  same(keep(tab(P.mod, "Attendance_Flags"), [1, 4]).sort(), keep(tab(P.script, "Attendance_Flags"), [1, 4]).sort());
  const sc = P.script.host("attend_close"), mc = P.M("close", {}); same(mc, sc);
  const ss = P.script.host("attend_submit"), ms = P.M("submit"); same(ms, ss);
  const grid = (x) => (x.backend.rawRows("Attendance") || []).map((r) => r.map(String));
  same(grid(P.mod), grid(P.script));
  P.script.backend.close(); P.mod.backend.close();
});

test("a second session the same day, discard, and refusals when closed or already open", () => {
  const P = pair(2);
  same(P.M("close", {}), P.script.host("attend_close"));
  const so = P.script.host("attend_open", { nogeo: "1" }), mo = P.M("open", { nogeo: "1" }); assert.equal(mo.session.label, so.session.label);
  const again = P.M("open", { nogeo: "1" }), againS = P.script.host("attend_open", { nogeo: "1" });
  assert.equal(again.why, againS.why); assert.equal(again.ok, false);
  same(P.M("close", {}), P.script.host("attend_close"));
  const so2 = P.script.host("attend_open", { nogeo: "1" }), mo2 = P.M("open", { nogeo: "1" }); assert.equal(mo2.session.label, so2.session.label);
  assert.match(mo2.session.label, /#2$/);
  same(P.M("close", {}), P.script.host("attend_close"));
  same(P.M("discard"), P.script.host("attend_discard"));
  same(P.M("discard"), P.script.host("attend_discard"));
  P.script.backend.close(); P.mod.backend.close();
});

test("location: far, near and missing agree in enforce mode", () => {
  const P = pair(3); const [a, b, c] = P.script.students; P.setMode("enforce");
  P.script.host("attend_open", Object.assign({ radius: 200 }, GEO)); P.M("open", Object.assign({ radius: 200 }, GEO));
  P.copy(["Attendance_Control"]);
  const ses = AT.sessions(P.store())[0], t = AT.linkFor(ses.secret, Math.floor(Date.now() / 30000));
  const run = (s, d, loc) => { const p = Object.assign({ action: "attend", id: s.id, dev: "geo" + d + "abcdefghijklmnopqrstuvwxyz", t, code: P.script.codes[s.id] }, loc); const r = { s: P.script.call(p), m: P.M("checkIn", p) }; same(r.m, r.s); return r.m; };
  assert.equal(run(a, 1, { lat: 51.5005, lon: -0.12 }).ok, true);
  assert.equal(run(b, 2, { lat: 51.6, lon: -0.12 }).why, "too far");
  assert.equal(run(c, 3, {}).why, "no location");
  assert.equal(AT.metres(51.5, -0.12, 51.5, -0.12), 0);
  P.script.backend.close(); P.mod.backend.close();
});
