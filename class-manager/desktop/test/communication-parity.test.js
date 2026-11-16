/* rules/chat.js, rules/announcements.js and rules/calendar.js give the pages what the Apps Script gives them: messages, announcements and the calendar. */
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { classroom } = require("./classroom");
const CH = require("../rules/chat");
const AN = require("../rules/announcements");
const CA = require("../rules/calendar");
const A = require("../rules/auth");
const { fromBackend } = require("../rules/store");

const WEB = path.resolve(__dirname, "..", ".."), PACK = path.join(WEB, "course-packs", "phys143", "files");
const site = (p) => { const a = path.join(PACK, p); return JSON.parse(fs.readFileSync(fs.existsSync(a) ? a : path.join(WEB, p), "utf8")); };
const tab = (c, name) => { const b = JSON.parse(c.backend.exportText()).sheets.find((s) => s.name === name); return b ? b.rows : []; };
const T = (v) => ((typeof v === "string" && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d/.test(v)) || (v && typeof v === "object" && v.$d) || (typeof v === "number" && v > 1e12) ? "T" : typeof v === "string" && /^[MGEAS][0-9a-f-]{8,}$/i.test(v) && /\d/.test(v) ? "ID" : v);
const strip = (rows) => rows.map((r) => { const x = r.map(T); while (x.length && (x[x.length - 1] === "" || x[x.length - 1] == null)) x.pop(); return x; }).filter((r) => r.length > 0);
const SKIP = ["created", "updated", "_session", "version", "generated", "v", "t", "last", "at"];
const norm = (r) => JSON.parse(JSON.stringify(r, (k, v) => (SKIP.indexOf(k) >= 0 ? undefined : typeof v === "string" ? v.replace(/^M\d{13}[0-9a-f-]{4}$/, "M").replace(/^[GEAS][0-9a-f]{8,10}$/i, "ID").replace(/(^|[:|])[GEAS][0-9a-f]{8,10}(?=$|,)/gi, "$1ID") : v)));

function scenario(n, then) {
  const script = classroom({ students: n }), mod = classroom({ students: n });
  script.host("hostcheck");
  const sync = () => { const book = JSON.parse(script.backend.exportText()); mod.editWorkbook((b) => { b.sheets = book.sheets; b.props = book.props; }); return fromBackend(mod.backend); };
  const o = { site, random: () => crypto.randomUUID(), counters: A.memoryCounters(() => new Date()) };
  const code = (id) => script.codes[id] || tab(script, "Access_Codes").find((r) => String(r[0]) === id)[1];
  try { then({ script, mod, sync, o, code }); } finally { script.backend.close(); mod.backend.close(); }
}
const bodyOf = (c, n) => { const r = strip(tab(c, n)); return r.length > 1 ? r : []; }; // the script makes an empty tab when it only reads
const tabs = (mod, script, names, label) => names.forEach((n) => assert.deepEqual(bodyOf(mod, n), bodyOf(script, n), n + " " + label));

test("chat: students and the lecturer send, read, make groups and moderate the same way", () => scenario(6, ({ script, mod, sync, o, code }) => {
  const stu = (id) => ({ id, code: code(id) }), HOST = (p) => Object.assign({ hostkey: script.key }, p);
  const step = (who, p, label) => {
    const params = Object.assign({}, who === "host" ? { hostkey: script.key } : stu(who), p), store = sync();
    const a = script.call(Object.assign({ action: "chat" }, params)), b = CH.chat(store, params, { post: true, session: "" }, o);
    assert.deepEqual(norm(b), norm(a), label || JSON.stringify(p)); tabs(mod, script, ["Messages", "Chat_Groups", "Chat_Read"], label || JSON.stringify(p)); return a;
  };
  step("20000001", {}, "sync"); step("20000001", { op: "send", conv: "CLASS", text: "hello class" }); step("host", { op: "send", conv: "CLASS", text: "welcome" }); step("host", { op: "send", conv: "DM:20000002", text: "private" });
  step("20000002", { op: "sync", conv: "DM:20000002" }); step("20000002", { op: "read", conv: "DM:20000002" }); step("20000002", { op: "send", conv: "DM:20000002", text: "thanks" });
  step("20000001", { op: "send", conv: "CLASS", text: "" }); step("20000001", { op: "send", conv: "S:nope", text: "x" }); step("20000001", { op: "send", conv: "P:20000001:20000002", text: "x" });
  step("20000001", { op: "group_make", name: "Study", ids: "20000002,20000003" }); step("20000001", { op: "group_make", name: "", ids: "" }); step("20000001", { op: "group_make", name: "Bad", ids: "99999999" });
  const gid = script.call({ action: "chat", id: "20000001", code: code("20000001") }).conversations.find((c) => c.kind === "student group").id;
  step("20000001", { op: "send", conv: gid, text: "in the group" }); step("20000003", { op: "sync", conv: gid }); step("20000004", { op: "send", conv: gid, text: "not a member" });
  step("20000001", { op: "group_add", group: gid, ids: "20000004" }); step("20000003", { op: "group_add", group: gid, ids: "20000005" }); step("20000001", { op: "group_remove", group: gid, other: "20000004" }); step("20000002", { op: "group_leave", group: gid });
  step("host", { op: "settings", dm: "yes", rules: "Be kind", mode: "on" }); step("20000001", { op: "dm_start", other: "20000002" }); step("20000001", { op: "send", conv: "P:20000001:20000002", text: "hi mate" }); step("20000002", { op: "sync", conv: "P:20000001:20000002" });
  step("20000001", { op: "dm_start", other: "20000001" }); step("20000001", { op: "dm_start", other: "123" });
  const msgs = script.host("chat", { conv: "CLASS" }).messages; step("host", { op: "remove", msg: msgs[0].id, conv: "CLASS" }); step("20000003", { op: "sync", conv: "CLASS" }); step("host", { op: "restore", msg: msgs[0].id, conv: "CLASS" });
  step("host", { op: "mute", other: "20000003" }); step("20000003", { op: "send", conv: "CLASS", text: "muted" }); step("host", { op: "unmute", other: "20000003" });
  step("host", { op: "settings", mode: "announce" }); step("20000003", { op: "send", conv: "CLASS", text: "no" }); step("host", { op: "settings", mode: "off" }); step("20000003", { op: "send", conv: "CLASS", text: "no" }); step("20000003", { op: "sync" });
  step("host", { op: "settings", mode: "on" }); step("host", { op: "export" }); step("host", { op: "group_delete", group: gid }); step("host", { op: "sync" });
  for (let i = 0; i < 9; i++) step("20000005", { op: "send", conv: "CLASS", text: "burst " + i }, "burst " + i); // the ninth is refused in both
  const bad = CH.chat(sync(), { id: "20000001", code: "WRONG" }, { post: true, session: "" }, o); assert.equal(bad.ok, false);
  const badHost = CH.chat(sync(), { hostkey: "nope" }, { post: true, session: "" }, o); assert.equal(badHost.why, "host key not accepted");
  assert.ok(HOST);
}));

test("calendar: save, series, delete, the public and host views, and the iCalendar feed match", () => scenario(2, ({ script, mod, sync, o }) => {
  // The script's POST route treats a "kind" parameter as a quiz attempt, so an event's kind cannot be sent to it that way; the kinds are
  // checked by copying the module's calendar into the script's workbook and comparing every view.
  const req = { post: true, session: "" }, ev = (p, label) => {
    const store = sync(), a = script.host("calendar_edit", p), b = CA.act(store, Object.assign({ hostkey: script.key }, p), req, o);
    assert.deepEqual(norm(b), norm(a), label || JSON.stringify(p)); tabs(mod, script, ["Calendar"], label || JSON.stringify(p)); return a;
  };
  ev({ op: "save", title: "" }); ev({ op: "save", title: "Lecture 1", start: "2030-02-04T10:00", end: "2030-02-04T11:00", location: "Room 1", agenda: "Vectors", week: "1" });
  ev({ op: "save", title: "Whole day", start: "2030-03-01", allday: "yes", visibility: "lecturer" }); ev({ op: "save", title: "Bad", start: "2030-02-04T10:00", end: "2030-02-03T10:00" }); ev({ op: "save", id: "NOPE", title: "x", start: "2030-02-04" });
  ev({ op: "series", title: "Tutorial {n}", start: "2030-02-05T14:00", end: "2030-02-05T15:00", count: "3", every: "7", week: "1", titles: "First\n\nThird" });
  const id = script.host("calendar", {}).events.find((x) => x.title === "Lecture 1").id;
  ev({ op: "save", id, title: "Lecture 1 moved", start: "2030-02-04T12:00" }); ev({ op: "delete", id: "NOPE" });
  const kinds = sync(); // kinds and deadlines: made by the module, then given to the script
  CA.act(kinds, { hostkey: script.key, op: "save", title: "Final exam", kind: "exam", start: "2030-05-01T09:00" }, req, o);
  CA.act(kinds, { hostkey: script.key, op: "save", title: "Report due", kind: "deadline", start: "2030-04-01T17:00" }, req, o);
  CA.act(kinds, { hostkey: script.key, op: "save", title: "Quiz week 2", kind: "quiz", start: "2030-02-12T10:00", link: "quiz", week: "2", agenda: "a, b; c\nline" }, req, o);
  const rowsNow = JSON.parse(mod.backend.exportText()).sheets.find((s) => s.name === "Calendar").rows;
  script.editWorkbook((b) => { b.sheets.find((s) => s.name === "Calendar").rows = rowsNow; });
  const store = sync(), host = { hostkey: script.key };
  assert.deepEqual(norm(CA.calendar(store, {}, req, o)), norm(script.call({ action: "calendar" })));
  assert.deepEqual(norm(CA.calendar(store, host, req, o)), norm(script.host("calendar", {})));
  const text = (r) => (typeof r === "string" ? r : r.text || ""), clean = (x) => x.replace(/DTSTAMP:\S+/g, "DTSTAMP:");
  assert.equal(clean(CA.ics(store, { course: "PHYS 143" }, req, o)), clean(text(script.call({ action: "calendar_ics", course: "PHYS 143" }))));
  assert.equal(clean(CA.ics(store, Object.assign({ course: "PHYS 143" }, host), req, o)), clean(text(script.host("calendar_ics", { course: "PHYS 143" }))));
  assert.match(CA.ics(store, host, req, o), /BEGIN:VALARM/);
  ev({ op: "delete_series", id: script.host("calendar", {}).events.find((x) => /^Tutorial/.test(x.title)).id }); ev({ op: "delete", id });
}));

test("announcements: save, schedule, audience, read marks and delete match", () => scenario(4, ({ script, mod, sync, o, code }) => {
  const req = { post: true, session: "" }, host = (p) => Object.assign({ hostkey: script.key }, p);
  const same = (params, label) => { const store = sync(), a = script.call(Object.assign({ action: "announcements" }, params)), b = AN.announcements(store, params, req, o); assert.deepEqual(norm(b), norm(a), label || JSON.stringify(params)); tabs(mod, script, ["Announcements", "Chat_Read"], label || JSON.stringify(params)); return a; };
  same({}); same(host({ op: "save", title: "" })); same(host({ op: "save", title: "Bad link", link: "javascript:x" }));
  same(host({ op: "save", title: "Welcome", text: "Hello", audience: "all", pinned: "yes" })); same(host({ op: "save", title: "Class only", text: "Signed in", audience: "class" }));
  same(host({ op: "save", title: "Later", text: "future", audience: "all", from: "2099-01-01T09:00" })); same(host({ op: "save", title: "Group", text: "g", audience: "L:Lab|1" })); same(host({ op: "save", title: "Odd", audience: "<script>" }));
  same({}); same({ id: "20000001", code: code("20000001") }); same({ id: "20000001", code: code("20000001"), read: "yes" }); same({ id: "20000001", code: "WRONG" }); same(host({}));
  const id = script.host("announcements", {}).announcements[0].id;
  same(host({ op: "save", ann: id, title: "Welcome edited", text: "Hello again", audience: "all" })); same(host({ op: "delete", ann: id })); same(host({}));
}));
