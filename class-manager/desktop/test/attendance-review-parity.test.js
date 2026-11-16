/* rules/attendance-review.js gives the same answers as the Apps Script on the same workbook (status, review, remove, approve, phone reset). */
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("crypto");
const { classroom } = require("./classroom");
const AT = require("../rules/attendance");
const AC = require("../rules/access-codes");
const R = require("../rules/attendance-review");
const { fromBackend } = require("../rules/store");

const norm = (r) => JSON.parse(JSON.stringify(r, (k, v) => (k === "_session" || k === "code" || k === "time" || k === "link" ? undefined : v)));
const same = (a, b) => assert.deepEqual(norm(a), norm(b));
function setup(n) {
  const script = classroom({ students: n }), mod = classroom({ students: n });
  const book = JSON.parse(script.backend.exportText());
  mod.editWorkbook((b) => { const s = book.sheets.find((x) => x.name === "Access_Codes"); b.sheets.find((x) => x.name === "Access_Codes").rows = s.rows; });
  script.host("attend_open", { nogeo: "1" });
  const o = { random: () => crypto.randomUUID(), fails: { get: () => 0, add: () => {} }, verifyCode: (id, g, mine, st) => ({ ok: AC.normCode(g) === mine.code && !AC.expired(st, mine) }) };
  const book2 = JSON.parse(script.backend.exportText());
  mod.editWorkbook((b) => { const s = book2.sheets.find((x) => x.name === "Attendance_Control"); const t = b.sheets.find((x) => x.name === "Attendance_Control"); if (t) t.rows = s.rows; else b.sheets.push(s); });
  const st = () => fromBackend(mod.backend);
  return { script, mod, o, st, M: (f, p) => R[f](st(), p, o) };
}
const mk = (P, s, d) => { const ses = AT.sessions(P.st())[0]; return { action: "attend", id: s.id, dev: "dev" + d + "abcdefghijklmnopqrstuvwxyz", t: AT.linkFor(ses.secret, Math.floor(Date.now() / 30000)), code: P.script.codes[s.id] }; };

test("status, review, remove and approve agree through a session", () => {
  const P = setup(3); const [a, b, c] = P.script.students;
  [[a, 1], [b, 2]].forEach(([s, d]) => { const p = mk(P, s, d); assert.equal(P.script.call(p).ok, true); assert.equal(AT.checkIn(P.st(), p, P.o).ok, true); });
  const p2 = mk(P, c, 2); P.script.call(p2); AT.checkIn(P.st(), p2, P.o); // a borrowed phone: held for approval
  same(P.M("status"), P.script.host("attend_status"));
  const lbl = P.script.host("attend_status").session.label;
  same(P.M("review", { label: lbl }), P.script.host("attend_review", { label: lbl }));
  same(P.M("approve", { id: c.id, label: lbl }), P.script.host("attend_approve", { id: c.id, label: lbl }));
  same(P.M("approve", { id: c.id, label: lbl }), P.script.host("attend_approve", { id: c.id, label: lbl }));
  same(P.M("approve", { id: "99999999", label: lbl }), P.script.host("attend_approve", { id: "99999999", label: lbl }));
  same(P.M("remove", { id: a.id, label: lbl }), P.script.host("attend_remove", { id: a.id, label: lbl }));
  same(P.M("remove", { id: a.id, label: "nope" }), P.script.host("attend_remove", { id: a.id, label: "nope" }));
  same(P.M("status"), P.script.host("attend_status"));
  same(P.M("review", { label: lbl }), P.script.host("attend_review", { label: lbl }));
  P.script.backend.close(); P.mod.backend.close();
});

test("phone reset and a submitted session refuse the same way", () => {
  const P = setup(2); const [a] = P.script.students;
  const p = mk(P, a, 1); P.script.call(p); AT.checkIn(P.st(), p, P.o);
  same(P.M("phoneReset", a.id), P.script.host("attend_phone_reset", { id: a.id }));
  same(P.M("phoneReset", a.id), P.script.host("attend_phone_reset", { id: a.id }));
  P.script.host("attend_close"); AT.close(P.st());
  P.script.host("attend_submit"); AT.submit(P.st());
  const lbl = P.script.host("attend_status").session.label;
  same(P.M("remove", { id: a.id, label: lbl }), P.script.host("attend_remove", { id: a.id, label: lbl }));
  same(P.M("approve", { id: a.id, label: lbl }), P.script.host("attend_approve", { id: a.id, label: lbl }));
  same(P.M("status"), P.script.host("attend_status"));
  P.script.backend.close(); P.mod.backend.close();
});
