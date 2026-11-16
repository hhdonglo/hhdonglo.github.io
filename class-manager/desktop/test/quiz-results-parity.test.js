/* rules/quiz-results.js compiles, releases and discards a quiz's results in the same way as the Apps Script. */
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const { classroom } = require("./classroom");
const Q = require("../rules/quiz-control");
const R = require("../rules/quiz-results");
const { fromBackend } = require("../rules/store");

const WEB = path.resolve(__dirname, "..", ".."), PACK = path.join(WEB, "course-packs", "phys143", "files");
const site = (p) => { const a = path.join(PACK, p); return JSON.parse(fs.readFileSync(fs.existsSync(a) ? a : path.join(WEB, p), "utf8")); };
const CODE = "26271", TABS = ["Quiz_Control", "Answers", "Presence", "Staged_Quiz", "Item_Log", "Form Responses 1", "Key"];
const tab = (c, name) => { const b = JSON.parse(c.backend.exportText()).sheets.find((s) => s.name === name); return b ? b.rows : []; };
// Times differ; compare the rest. Trailing blank rows are not records.
const strip = (rows) => rows.filter((r) => r.some((v) => v !== "" && v != null)).map((r, i) => (i === 0 ? r : r.map((v) => ((typeof v === "string" && /^\d{4}-\d\d-\d\dT/.test(v)) || (typeof v === "number" && v > 1e12) ? "T" : (v && typeof v === "object" && v.$d ? "T" : v)))));

function scenario(then) {
  const script = classroom({ students: 3 }), mod = classroom({ students: 3 });
  [script, mod].forEach((c) => c.backend.setProp("draw_salt", ":abcd1234"));
  script.host("control", { code: CODE, act: "init" }); script.host("control", { code: CODE, act: "set", field: "q_seconds", value: "0" });
  script.host("control", { code: CODE, act: "start" });
  const ans = (s, q, a, extra) => script.call(Object.assign({ kind: "answer", name: s.name, id: s.id, code: CODE, q, answer: a }, extra || {}));
  script.students.forEach((s) => script.call({ kind: "join", name: s.name, id: s.id, code: CODE }));
  for (let q = 1; q <= 5; q++) {
    script.students.forEach((s, i) => ans(s, q, "ABCDE"[(q + i) % 5], { conf: "HML"[i] }));
    if (q === 2) { script.host("control", { code: CODE, act: "revote" }); ans(script.students[0], 2, "E"); ans(script.students[1], 2, "C"); }
    if (q < 5) script.host("control", { code: CODE, act: "next" });
  }
  const book = JSON.parse(script.backend.exportText());
  mod.editWorkbook((b) => TABS.forEach((nm) => { const src = book.sheets.find((x) => x.name === nm); if (!src) return; let t = b.sheets.find((x) => x.name === nm); if (!t) { t = { name: nm, rows: [] }; b.sheets.push(t); } t.rows = src.rows; }));
  const store = fromBackend(mod.backend), o = { site, random: () => "x" };
  const step = (p) => { const a = script.host("control", Object.assign({ code: CODE }, p)), b = Q.act(store, p, CODE, Object.assign({}, o, R.hooks(store, o))); assert.equal(b.ok, a.ok, JSON.stringify(p)); };
  const same = (label) => TABS.concat([]).forEach((nm) => assert.deepEqual(strip(tab(mod, nm)), strip(tab(script, nm)), label + ": " + nm));
  try { then({ step, same, script, mod, store, o }); } finally { script.backend.close(); mod.backend.close(); }
}

test("end compiles the answers into held results, presence and the item log", () => scenario(({ step, same, store }) => {
  step({ act: "end" }); same("after end");
  assert.equal(strip(tab(script, "Staged_Quiz")).length, 4, "three held results and a header");
  const got = R.latestAnswers(store, CODE); assert.equal(Object.keys(got).length, 3);
  assert.equal(R.answerCounts(store, CODE, 2).changed, 2);
  step({ act: "end" }); step({ act: "reopen", min: "1" }); step({ act: "end" }); same("compiled again");
}));

test("release moves held results to Form Responses 1; a second release changes nothing", () => scenario(({ step, same }) => {
  step({ act: "end" }); step({ act: "release" }); same("after release"); step({ act: "release" }); same("again");
}));

test("discard drops the held results and their item log", () => scenario(({ step, same }) => {
  step({ act: "end" }); step({ act: "discard" }); same("after discard");
}));
