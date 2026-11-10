/* Credentials and sessions (apps_script/src/05-auth.gs): run with `npm test` in class-manager/desktop.
   Keys and codes are accepted by POST only; they are exchanged for sessions that expire and that end when the key or the
   code changes; access codes can expire; failed sign-ins are limited per ID and across the class. */
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const { classroom } = require("./classroom");

test("a key or code in a web address (GET) is refused", () => {
  const c = classroom({ students: 2 });
  const s = c.students[0];
  assert.equal(c.get({ action: "hostcheck", hostkey: c.key }).ok, false);
  assert.match(JSON.stringify(c.get({ action: "class_stats", hostkey: c.key })), /host key not accepted/);
  assert.notEqual(c.get({ action: "my_results", id: s.id, code: c.codes[s.id] }).ok, true);
  assert.notEqual(c.get({ action: "chat", id: s.id, code: c.codes[s.id] }).ok, true);
  // Public reads by GET still work, for pages that only read.
  assert.equal(c.get({ action: "portal_status" }).portal, 1);
  assert.equal(c.get({ action: "calendar" }).ok, true);
  // The same requests by POST are accepted.
  assert.equal(c.call({ action: "hostcheck", hostkey: c.key }).ok, true);
  assert.equal(c.call({ action: "my_results", id: s.id, code: c.codes[s.id] }).ok, true);
});

test("the host key is exchanged for a session; the session works, and ends when the key changes", () => {
  const c = classroom({ students: 1 });
  const r = c.call({ action: "hostcheck", hostkey: c.key });
  assert.equal(r.ok, true);
  const hs = r._session;
  assert.match(hs, /^s1\.h\.host\.[0-9a-z]+\.[0-9a-f]{40}$/);
  assert.ok(!hs.includes(c.key), "the session does not contain the key");
  assert.equal(c.call({ action: "class_stats", hostkey: hs }).ok, true);
  assert.equal(c.call({ action: "class_stats", hostkey: hs })._session, undefined, "a session is not renewed by itself");
  // A changed signature, subject or expiry is refused.
  const parts = hs.split(".");
  assert.equal(c.call({ action: "hostcheck", hostkey: parts.slice(0, 4).join(".") + "." + "0".repeat(40) }).ok, false);
  assert.equal(c.call({ action: "hostcheck", hostkey: [parts[0], parts[1], parts[2], (parseInt(parts[3], 36) + 1e9).toString(36), parts[4]].join(".") }).ok, false);
  assert.equal(c.call({ action: "hostcheck", hostkey: [parts[0], "s", parts[2], parts[3], parts[4]].join(".") }).ok, false);
  // Changing the host key ends every session made with the old one.
  const nk = "a-new-host-key-123";
  assert.equal(c.call({ action: "setkey", hostkey: hs, newkey: nk }).ok, true);
  assert.equal(c.call({ action: "hostcheck", hostkey: hs }).ok, false);
  assert.equal(c.call({ action: "hostcheck", hostkey: nk }).ok, true);
});

test("sign everyone out ends lecturer and student sessions", () => {
  const c = classroom({ students: 1 });
  const s = c.students[0];
  const hs = c.call({ action: "hostcheck", hostkey: c.key })._session;
  const ss = c.call({ action: "my_results", id: s.id, code: c.codes[s.id] })._session;
  assert.equal(c.call({ action: "my_results", id: s.id, code: ss }).ok, true);
  assert.equal(c.call({ action: "sessions_end", hostkey: hs }).ok, true);
  assert.equal(c.call({ action: "hostcheck", hostkey: hs }).ok, false);
  assert.notEqual(c.call({ action: "my_results", id: s.id, code: ss }).ok, true);
  assert.equal(c.call({ action: "hostcheck", hostkey: c.key }).ok, true, "the key itself still works");
});

test("a student's session opens only their own record, and ends when their code is replaced", () => {
  const c = classroom({ students: 2 });
  const [a, b] = c.students;
  const r = c.call({ action: "my_results", id: a.id, code: c.codes[a.id] });
  assert.equal(r.ok, true);
  const ss = r._session;
  assert.match(ss, /^s1\.s\.\d+\./);
  assert.ok(!ss.includes(c.codes[a.id].replace("-", "")), "the session does not contain the code");
  assert.equal(c.call({ action: "my_results", id: a.id, code: ss }).ok, true);
  assert.notEqual(c.call({ action: "my_results", id: b.id, code: ss }).ok, true, "A's session is not B's");
  assert.equal(c.call({ action: "chat", id: a.id, code: ss }).ok, true, "the same session signs in to messages");
  assert.equal(c.call({ action: "group_work", id: a.id, access: ss }).ok, true, "and to group work");
  assert.equal(c.host("access_codes", { op: "reset", id: a.id }).ok, true);
  assert.notEqual(c.call({ action: "my_results", id: a.id, code: ss }).ok, true, "a replaced code ends the session");
});

test("access codes expire after the number of days the lecturer sets, and can be renewed", () => {
  const c = classroom({ students: 2 });
  const [a] = c.students;
  assert.equal(c.host("access_codes", { op: "expiry", days: "30" }).days, 30);
  assert.equal(c.call({ action: "my_results", id: a.id, code: c.codes[a.id] }).ok, true, "a new code is valid");
  // Age the codes by 40 days, as if they were issued at the start of term.
  c.backend.flush();
  const file = path.join(c.dir, "workbook.json");
  const book = JSON.parse(fs.readFileSync(file, "utf8"));
  const tab = book.sheets.find((s) => s.name === "Access_Codes");
  tab.rows.slice(1).forEach((row) => { row[2] = { $d: new Date(Date.now() - 40 * 86400000).toISOString() }; });
  fs.writeFileSync(file, JSON.stringify(book));
  c.reopen();
  const r = c.call({ action: "my_results", id: a.id, code: c.codes[a.id] });
  assert.equal(r.why, "code expired");
  const list = c.host("access_codes", { op: "list" });
  assert.equal(list.expired, 2);
  const ren = c.host("access_codes", { op: "renew" });
  assert.equal(ren.made, 2); assert.equal(ren.expired, 0);
  const fresh = ren.rows.find((x) => x.id === a.id).code;
  assert.notEqual(fresh, c.codes[a.id]);
  assert.equal(c.call({ action: "my_results", id: a.id, code: fresh }).ok, true);
  assert.equal(c.host("access_codes", { op: "expiry", days: "0" }).days, 0, "0 turns expiry off");
});

test("many failed sign-ins across the class pause new sign-ins, but signed-in students carry on", () => {
  const c = classroom({ students: 1 });
  const s = c.students[0];
  const ss = c.call({ action: "my_results", id: s.id, code: c.codes[s.id] })._session;
  for (let i = 0; i < 200; i++) c.call({ action: "my_results", id: String(30000000 + i), code: "ABCD-EFGH" });
  assert.equal(c.call({ action: "my_results", id: s.id, code: c.codes[s.id] }).why, "slow down");
  assert.equal(c.call({ action: "my_results", id: s.id, code: ss }).ok, true);
});

test("a live quiz result needs the receipt of the phone that took part", () => {
  const c = classroom({ students: 2 });
  const [a, b] = c.students;
  const ra = c.post({ kind: "join", name: a.name, id: a.id, code: "26271", want: "receipt" });
  assert.equal(ra.ok, true); assert.match(ra.receipt, /^[0-9a-f]{24}$/);
  assert.equal(c.post({ kind: "join", name: a.name, id: a.id, code: "26271" }), "ok", "older pages still get plain text");
  assert.equal(c.call({ action: "result", code: "26271", id: b.id, rc: ra.receipt }).receipt, false);
});
