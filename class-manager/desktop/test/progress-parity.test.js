/* rules/progress.js gives Learning Progress, the student profile and the My results extras as the Apps Script does. */
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { classroom } = require("./classroom");
const P = require("../rules/progress");
const V = require("../rules/quiz-views");
const A = require("../rules/auth");
const { fromBackend } = require("../rules/store");

const WEB = path.resolve(__dirname, "..", ".."), PACK = path.join(WEB, "course-packs", "phys143", "files");
const site = (p) => { const a = path.join(PACK, p); return JSON.parse(fs.readFileSync(fs.existsSync(a) ? a : path.join(WEB, p), "utf8")); };
const tab = (c, name) => { const b = JSON.parse(c.backend.exportText()).sheets.find((s) => s.name === name); return b ? b.rows : []; };
const norm = (r) => JSON.parse(JSON.stringify(r, (k, v) => (k === "_session" || k === "version" || k === "generated" ? undefined : v)));

function scenario(then) {
  const script = classroom({ students: 8 }), mod = classroom({ students: 8 });
  script.backend.setProp("draw_salt", ":abcd1234");
  const quiz = (code, bias) => {
    const ctl = (p) => script.host("control", Object.assign({ code }, p));
    ctl({ act: "init" }); ctl({ act: "set", field: "q_seconds", value: "0" }); ctl({ act: "start" });
    script.students.forEach((s) => script.call({ kind: "join", name: s.name, id: s.id, code }));
    for (let q = 1; q <= 5; q++) {
      script.students.forEach((s, i) => { if ((i + q) % 6 !== 0) script.call({ kind: "answer", name: s.name, id: s.id, code, q, answer: "ABCDE"[(i * q + bias) % 3] }); });
      if (q === 2) { ctl({ act: "revote" }); script.students.slice(0, 4).forEach((s) => script.call({ kind: "answer", name: s.name, id: s.id, code, q, answer: "A" })); }
      if (q < 5) ctl({ act: "next" });
    }
    ctl({ act: "next" }); ctl({ act: "release" });
  };
  quiz("26271", 0); quiz("26272", 1);
  script.students.forEach((s, i) => {
    script.call({ kind: "attempt", id: s.id, quiz: "Lecture 1 Vectors", attempt: "1", score: String(3 + (i % 5)), total: "10", seconds: "100", wrong: "L1-01,L1-02,L1-03", asked: "L1-01,L1-02,L1-03,L1-04,L1-05" });
    script.call({ kind: "attempt", id: s.id, quiz: "Lecture 1 Vectors", attempt: "2", score: "8", total: "10", seconds: "80", wrong: i % 2 ? "L1-02" : "", asked: "L1-01,L1-02,L1-03,L1-04,L1-05" });
  });
  script.host("outcomes", { op: "accept", lecture: "1" });
  script.host("groups", { op: "make", set: "Lab", size: "4" });
  const id = script.host("assignments", { op: "save", set: "Lab", title: "Report", due: "2030-01-05", outof: "10", outcome: "L1.1" }).saved;
  script.host("access_codes", { op: "generate" });
  const code = (s) => tab(script, "Access_Codes").find((r) => String(r[0]) === s)[1];
  const gs = script.host("groups", { op: "list", set: "Lab" }).groups[0].members.map((m) => m.id);
  script.call({ action: "group_work", id: gs[0], access: code(gs[0]), op: "submit", aid: id, text: "ans" }); script.call({ action: "group_work", id: gs[1], access: code(gs[1]), op: "part", aid: id, text: "figs" });
  script.call({ action: "group_work", id: gs[0], access: code(gs[0]), op: "peer", aid: id, ratings: JSON.stringify({ [gs[1]]: "little", [gs[2]]: "full" }) }); script.call({ action: "group_work", id: gs[2], access: code(gs[2]), op: "peer", aid: id, ratings: JSON.stringify({ [gs[1]]: "little" }) });
  const book = JSON.parse(script.backend.exportText());
  mod.editWorkbook((b) => { b.sheets = book.sheets; b.props = book.props; });
  const o = { site, random: () => crypto.randomUUID(), counters: A.memoryCounters(() => new Date()) };
  try { then({ script, mod, store: () => fromBackend(mod.backend), o, code, gs }); } finally { script.backend.close(); mod.backend.close(); }
}

test("Learning Progress matches", () => scenario(({ script, store, o }) => {
  const a = script.host("learning_progress", {}), b = P.learningProgress(store(), {}, o);
  assert.deepEqual(norm(b), norm(a));
  assert.ok(a.students.length === 8 && a.groupProgress.length === 1 && a.assignments.length === 1);
}));

test("the student profile and statistics match, with suggestions", () => scenario(({ script, store, o, gs }) => {
  for (const id of [gs[0], gs[1], "20000008"]) { const a = script.host("student_stats", { id }), b = P.studentStats(store(), { id }, o, a.version); assert.deepEqual(norm(b), norm(a), id); }
  assert.deepEqual(norm(P.studentStats(store(), { id: "99999999" }, o)), norm(script.host("student_stats", { id: "99999999" })));
  assert.deepEqual(norm(P.studentStats(store(), { id: "" }, o)), norm(script.host("student_stats", { id: "" })));
  const prof = script.host("student_stats", { id: gs[1] }).profile; assert.ok(prof.groupWork.length === 1 && prof.suggestions.length >= 1);
}));

test("My results gets the same groups, learning, progress and group work", () => scenario(({ script, store, o, code, gs }) => {
  script.host("outcomes", { op: "list" });
  const id = gs[0], a = script.call({ action: "my_results", id, code: code(id) }), b = V.portalResults(store(), { id, code: code(id) }, { post: true, session: "" }, Object.assign({ extras: (s, i) => P.portalExtras(s, i, o) }, o));
  assert.deepEqual(norm(b), norm(a)); assert.equal(a.groupWork, 1); assert.ok(a.groups.length === 1 && a.progress);
}));
