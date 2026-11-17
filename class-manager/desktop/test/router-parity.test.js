/* rules/router.js answers every request as the Apps Script does: the whole surface of actions and POST kinds, on the same records. */
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const { classroom } = require("./classroom");
const { createRouter } = require("../rules/router");
const { fromBackend } = require("../rules/store");

const WEB = path.resolve(__dirname, "..", ".."), PACK = path.join(WEB, "course-packs", "phys143", "files");
const site = (p) => { const a = path.join(PACK, p); return JSON.parse(fs.readFileSync(fs.existsSync(a) ? a : path.join(WEB, p), "utf8")); };
const TIMES = ["quizType", "conceptWeeks", "code", "serverNow", "endTime", "qDeadline", "remainingMs", "_session", "generated", "created", "updated", "t", "last", "at", "v", "secondsLeft", "link", "time", "people", "topics", "topicsError"];
const parse = (r) => { try { return JSON.parse(r.text); } catch (e) { return r.text; } };
const norm = (r) => JSON.parse(JSON.stringify(typeof r === "string" ? { text: r } : r, (k, v) => (TIMES.indexOf(k) >= 0 ? undefined : typeof v === "string" ? v.replace(/^M\d{13}[0-9a-f-]{4}$/, "M").replace(/\b[GEASM][0-9a-f]{8,10}\b/g, "ID").replace(/\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d[^"]*/g, "T").replace(/DTSTAMP:\S+|SEQUENCE:\d+/g, "") : v)));

function scenario(then) {
  const script = classroom({ students: 6 }), mod = classroom({ students: 6 });
  script.backend.setProp("draw_salt", ":abcd1234"); script.host("hostcheck");
  const CODE = "26271", ctl = (p) => script.host("control", Object.assign({ code: CODE }, p));
  ctl({ act: "init" }); ctl({ act: "set", field: "q_seconds", value: "0" }); ctl({ act: "start" });
  script.students.forEach((s) => script.call({ kind: "join", name: s.name, id: s.id, code: CODE }));
  script.students.forEach((s, i) => script.call({ kind: "answer", name: s.name, id: s.id, code: CODE, q: 1, answer: "ABC"[i % 3] }));
  script.host("groups", { op: "make", set: "Lab", size: "3" }); script.host("assignments", { op: "save", set: "Lab", title: "Report", due: "2030-01-05", outof: "10" });
  script.students.forEach((s) => script.call({ kind: "attempt", id: s.id, quiz: "Lecture 1 Vectors", attempt: "1", score: "5", total: "10", seconds: "9", wrong: "L1-01", asked: "L1-01,L1-02" }));
  const codeOf = (id) => JSON.parse(script.backend.exportText()).sheets.find((x) => x.name === "Access_Codes").rows.find((r) => String(r[0]) === id)[1];
  let router = null;
  const sync = () => { const book = JSON.parse(script.backend.exportText()); mod.editWorkbook((b) => { b.sheets = book.sheets; b.props = book.props; }); router = createRouter({ store: fromBackend(mod.backend), site, geoMode: () => "off", version: script.get({ action: "version" }).version }); return router; };
  const both = (p, label) => { const r = sync(), a = script.call(p), b = parse(r.post(p)); assert.deepEqual(norm(b), norm(a), label || JSON.stringify(p)); return a; };
  try { then({ script, mod, both, sync, CODE, codeOf, host: (p) => Object.assign({ hostkey: script.key }, p) }); } finally { script.backend.close(); mod.backend.close(); }
}

test("every read action gives the same answer", () => scenario(({ script, both, CODE, codeOf, host }) => {
  const id = "20000001", code = codeOf(id), badKey = { hostkey: "nope" };
  const reads = [{ action: "version" }, { action: "status", code: CODE }, { action: "status", code: "NOPE" }, { action: "portal_status" }, { action: "password_status" }, { action: "nothing" }, {},
    { action: "questions", code: CODE }, { action: "ranking", code: CODE, id }, { action: "review", code: CODE, id }, { action: "display", code: CODE }, { action: "result", code: CODE, id }, { action: "calendar" }, { action: "announcements" },
    { action: "chat", id, code }, { action: "my_results", id, code }, { action: "group_work", id, access: code }, { action: "hostcheck" }, { action: "hostcheck", hostkey: script.key }];
  reads.forEach((p) => both(p));
  const hostReads = [{ action: "host", code: CODE }, { action: "join_base" }, { action: "preclass", week: "1" }, { action: "held_status" }, { action: "attend_status" }, { action: "attend_review" }, { action: "groups", op: "list" }, { action: "assignments", op: "list" },
    { action: "outcomes", op: "list" }, { action: "groups_display" }, { action: "learning_progress" }, { action: "insights" }, { action: "class_stats" }, { action: "student_stats", id }, { action: "access_codes", op: "list" }, { action: "calendar_ics", course: "X" }, { action: "roster_tidy" }];
  hostReads.forEach((p) => both(host(p)));
  hostReads.slice(0, 4).forEach((p) => both(Object.assign({}, p, badKey), "bad key " + p.action)); // few: the script counts wrong keys and then refuses all
}));

test("every change gives the same answer and the same records", () => scenario(({ script, mod, both, CODE, codeOf, host }) => {
  const id = "20000002", code = codeOf(id), tabs = ["Key", "Staged_Quiz", "Form Responses 1", "Master", "Scores", "Totals", "Groups", "Assignments", "Attempts", "Reports", "Calendar", "Announcements", "Messages", "Student_Notes", "Attendance_Log", "Attendance", "Roster"];
  const T = (v) => ((typeof v === "string" && /^\d{4}-\d\d-\d\dT/.test(v)) || (v && typeof v === "object" && v.$d) || (typeof v === "number" && v > 1e12) ? "T" : typeof v === "string" && /^[GEASM][0-9a-f-]{8,}$/i.test(v) && /\d/.test(v) ? "ID" : v);
  const body = (c, n) => { const b = JSON.parse(c.backend.exportText()).sheets.find((s) => s.name === n); const r = (b ? b.rows : []).map((x) => { const y = x.map(T); while (y.length && (y[y.length - 1] === "" || y[y.length - 1] == null)) y.pop(); return y; }).filter((x) => x.length); return r.length > 1 ? r : []; };
  const same = (p, label) => { both(p, label); tabs.forEach((n) => assert.deepEqual(body(mod, n), body(script, n), n + " after " + (label || p.action))); };
  [{ kind: "join", name: "Late", id: "20000003", code: CODE }, { kind: "answer", name: "Student2", id, code: CODE, q: 1, answer: "B" }, { kind: "answer", name: "Student2", id, code: CODE, q: 3, answer: "B" }, { kind: "progress", name: "Student2", id, code: CODE },
    { kind: "attempt", id, quiz: "Mock exam", attempt: "1", score: "7", total: "10", seconds: "5", wrong: "", asked: "L1-01" }, { kind: "attempt", quiz: "x" }, { kind: "report", page: "p", lecture: "1", qid: "L1-01", comment: "typo" }, { kind: "submit", name: "A", id, code: "NOPE" }].forEach((p) => same(p));
  [{ act: "next" }, { act: "revote" }, { act: "end" }, { act: "release" }].forEach((p) => same(host(Object.assign({ action: "control", code: CODE }, p)), "control " + p.act));
  same(host({ action: "control", code: CODE, state: "stopped" }), "legacy state"); same({ action: "control", code: CODE, act: "next", hostkey: "bad" }, "control bad key");
  [{ action: "join_base", base: "3636" }, { action: "join_base", base: "1" }, { action: "set_week", w: "2" }, { action: "set_week", w: "99" }, { action: "access_codes", op: "expiry", days: "30" }, { action: "access_codes", op: "reset", id },
    { action: "student_note", id, text: "a note" }, { action: "roster_edit", op: "name", id, name: "New Name" }, { action: "calendar_edit", op: "save", title: "Exam day", start: "2030-03-01" }, { action: "announcements", op: "save", title: "Hello", text: "t" },
    { action: "groups", op: "lock", set: "Lab", group: "1" }, { action: "assignments", op: "close", id: "NOPE" }, { action: "outcomes", op: "accept", lecture: "1" }].forEach((p) => same(host(p), p.action + " " + (p.op || "")));
  same({ action: "chat", id, code, op: "send", conv: "CLASS", text: "hi" }); same({ action: "chat", id, code, op: "send", conv: "CLASS", text: "hi" }, "chat again");
  same(host({ action: "attend_open", nogeo: "1" }), "attend_open"); same(host({ action: "attend_close" }), "attend_close"); same(host({ action: "held_status" }), "held"); same(host({ action: "attend_submit" }), "attend_submit"); same(host({ action: "attend_discard" }), "attend_discard");
  same(host({ action: "held_discard_quiz" }), "held_discard_quiz"); same(host({ action: "held_release_quiz" }), "held_release_quiz");
  const rs = { kind: "roster_sync", rows: JSON.stringify([["20000001", "Student1"], ["20000099", "Newcomer"]]) };
  same(rs, "roster_sync no key"); same(host(rs), "roster_sync");
  same(host({ action: "sessions_end" }), "sessions_end");
}));
