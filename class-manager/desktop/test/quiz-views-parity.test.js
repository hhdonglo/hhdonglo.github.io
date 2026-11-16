/* rules/quiz-views.js shows the quiz pages what the Apps Script shows them, at every stage of a quiz. */
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const { classroom } = require("./classroom");
const V = require("../rules/quiz-views");
const A = require("../rules/auth");
const { fromBackend } = require("../rules/store");

const WEB = path.resolve(__dirname, "..", ".."), PACK = path.join(WEB, "course-packs", "phys143", "files");
const site = (p) => { const a = path.join(PACK, p); return JSON.parse(fs.readFileSync(fs.existsSync(a) ? a : path.join(WEB, p), "utf8")); };
const CODE = "26271";
const TIMES = ["serverNow", "endTime", "qDeadline", "remainingMs", "_session", "version"];
const norm = (r) => JSON.parse(JSON.stringify(r, (k, v) => (TIMES.indexOf(k) >= 0 ? undefined : v)));

function scenario(then) {
  const script = classroom({ students: 3 }), mod = classroom({ students: 3 });
  script.backend.setProp("draw_salt", ":abcd1234"); script.host("hostcheck");
  const rcs = {}, ans = (s, q, a) => script.call({ kind: "answer", name: s.name, id: s.id, code: CODE, q, answer: a });
  script.host("control", { code: CODE, act: "init" }); script.host("control", { code: CODE, act: "set", field: "q_seconds", value: "0" });
  script.host("control", { code: CODE, act: "start" });
  script.students.forEach((s) => { rcs[s.id] = script.call({ kind: "join", name: s.name, id: s.id, code: CODE, want: "receipt" }).receipt; });
  const ctl = (p) => script.host("control", Object.assign({ code: CODE }, p));
  const sync = () => {
    const book = JSON.parse(script.backend.exportText());
    mod.editWorkbook((b) => { b.sheets = book.sheets; b.props = book.props; });
    return fromBackend(mod.backend);
  };
  const o = { site, random: () => "x", counters: A.memoryCounters(() => new Date()) };
  const same = (label, a, b) => assert.deepEqual(norm(b), norm(a), label);
  try { then({ script, mod, ctl, ans, sync, o, same, rcs }); } finally { script.backend.close(); mod.backend.close(); }
}

function compareAll(c, label) {
  const store = c.sync(), S = c.script, o = c.o;
  c.same(label + " status", S.call({ action: "status", code: CODE }), V.status(store, CODE, o));
  c.same(label + " status unknown", S.call({ action: "status", code: "NOPE" }), V.status(store, "NOPE", o));
  c.same(label + " questions", S.call({ action: "questions", code: CODE }), V.questions(store, CODE, o));
  c.same(label + " ranking", S.call({ action: "ranking", code: CODE, id: "20000001" }), V.rankingView(store, CODE, { id: "20000001" }, o));
  c.same(label + " review", S.call({ action: "review", code: CODE, id: "20000001", rc: c.rcs["20000001"] }), V.review(store, CODE, "20000001", o));
  c.same(label + " review public", S.call({ action: "review", code: CODE }), V.review(store, CODE, "", o));
  c.same(label + " host", S.host("host", { code: CODE }), V.hostView(store, CODE, o));
  c.same(label + " display", S.call({ action: "display", code: CODE }), V.display(store, CODE, o));
  if (label === "running q1") c.same(label + " portal", S.call({ action: "portal_status" }), V.portalStatus(store, "v")); // the script keeps this one for five seconds
  ["20000001", "20000003"].forEach((id) => {
    c.same(label + " result " + id, S.call({ action: "result", code: CODE, id, rc: c.rcs[id] }), V.result(store, CODE, { id, rc: c.rcs[id] }, o));
    c.same(label + " result no receipt " + id, S.call({ action: "result", code: CODE, id }), V.result(store, CODE, { id }, o));
  });
}

test("every page view matches while a paced quiz runs, ends, is reviewed and is released", () => scenario((c) => {
  compareAll(c, "running q1");
  c.script.students.forEach((s, i) => c.ans(s, 1, "ABC"[i]));
  compareAll(c, "answered q1"); c.ctl({ act: "revote" }); c.ans(c.script.students[0], 1, "D"); compareAll(c, "second vote");
  for (let q = 2; q <= 5; q++) { c.ctl({ act: "next" }); c.script.students.slice(0, 2).forEach((s, i) => c.ans(s, q, "ABCDE"[(q + i) % 5])); }
  c.ctl({ act: "next" }); compareAll(c, "ended"); c.ctl({ act: "review" }); compareAll(c, "review 1"); c.ctl({ act: "reviewnext" }); compareAll(c, "review 2");
  c.ctl({ act: "release" }); compareAll(c, "released");
  c.ctl({ act: "set", field: "show_leaderboard", value: "never" }); compareAll(c, "board hidden");
}));

test("My results gives the same answers and refusals", () => scenario((c) => {
  c.script.students.forEach((st, i) => c.ans(st, 1, "ABC"[i]));
  c.ctl({ act: "end" }); c.ctl({ act: "release" });
  c.same("portal after release", c.script.call({ action: "portal_status" }), V.portalStatus(c.sync(), "v"));
  const store = c.sync(), id = "20000001", req = { post: true, session: "" };
  const sres = c.script.call({ action: "my_results", id, code: "" }), mres = V.portalResults(store, { id, code: "" }, req, c.o);
  assert.equal(mres.ok, sres.ok); assert.equal(mres.why, sres.why);
  const s2 = c.script.call({ action: "my_results", id: "1", code: "x" }), m2 = V.portalResults(store, { id: "1", code: "x" }, req, c.o);
  assert.equal(m2.why, s2.why);
  c.script.host("access_codes", { op: "generate" });
  const code = JSON.parse(c.script.backend.exportText()).sheets.find((x) => x.name === "Access_Codes").rows.find((r) => String(r[0]) === id)[1];
  const store2 = c.sync(), good = c.script.call({ action: "my_results", id, code }), mine = V.portalResults(store2, { id, code }, req, c.o);
  assert.equal(good.ok, true); const keep = (r) => ({ ok: r.ok, attendance: r.attendance, quizzes: r.quizzes }); assert.deepEqual(keep(mine), keep(good));
  assert.ok(good.quizzes.length > 0, "the released quiz is listed");
  assert.equal(V.portalResults(store, { id, code: "" }, { post: false, session: "" }, c.o).ok, false);
}));
