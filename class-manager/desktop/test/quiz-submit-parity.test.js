/* rules/quiz-submit.js answers what a student's page sends in the same way as the Apps Script: the same outcomes, receipts and records. */
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const { classroom } = require("./classroom");
const Q = require("../rules/quiz-control");
const S = require("../rules/quiz-submit");
const R = require("../rules/quiz-results");
const T2 = require("../rules/score-tables");
const { fromBackend } = require("../rules/store");

const WEB = path.resolve(__dirname, "..", ".."), PACK = path.join(WEB, "course-packs", "phys143", "files");
const site = (p) => { const a = path.join(PACK, p); return JSON.parse(fs.readFileSync(fs.existsSync(a) ? a : path.join(WEB, p), "utf8")); };
const CODE = "26271", TABS = ["Answers", "Presence", "Staged_Quiz", "Attempts", "Reports", "Log", "Form Responses 1"];
const tab = (c, name) => { const b = JSON.parse(c.backend.exportText()).sheets.find((s) => s.name === name); return b ? b.rows : []; };
const T = (v) => ((typeof v === "string" && /^\d{4}-\d\d-\d\dT/.test(v)) || (v && typeof v === "object" && v.$d) ? "T" : v);
const strip = (rows) => rows.map((r) => { const x = r.map(T); while (x.length && (x[x.length - 1] === "" || x[x.length - 1] == null)) x.pop(); return x; }).filter((r) => r.length > 0);

function pair() {
  const script = classroom({ students: 3 }), mod = classroom({ students: 3 });
  [script, mod].forEach((c) => { c.backend.setProp("draw_salt", ":abcd1234"); c.backend.setProp("sess_secret", "fixedsecretfixedsecret"); });
  const store = fromBackend(mod.backend), o = { site, random: () => "x" };
  const ctl = (p, code) => { script.host("control", Object.assign({ code: code || CODE }, p)); Q.act(store, p, code || CODE, Object.assign({}, o, R.hooks(store, Object.assign({}, o, T2.hooks(store, o))))); };
  const both = (p) => {
    const a = script.call(p), b = S.handle(store, p, o), want = typeof a === "string" ? { outcome: a } : { outcome: a.outcome, json: a };
    assert.equal(b.outcome, want.outcome, JSON.stringify(p)); if (want.json) assert.deepEqual(b.json, want.json, "receipt " + JSON.stringify(p));
    TABS.forEach((nm) => assert.deepEqual(strip(tab(mod, nm)), strip(tab(script, nm)), nm + " after " + JSON.stringify(p)));
    return b;
  };
  return { script, mod, ctl, both, close: () => { script.backend.close(); mod.backend.close(); } };
}
const s0 = { name: "Student1", id: "20000001" }, s1 = { name: "Student2", id: "20000002" };

test("a paced quiz: join, answers, and every refusal", () => {
  const P = pair(), A = (s, q, a, x) => P.both(Object.assign({ kind: "answer", code: CODE, q, answer: a }, s, x));
  P.ctl({ act: "init" }); P.ctl({ act: "set", field: "q_seconds", value: "0" });
  A(s0, 1, "A"); // not open yet
  P.both(Object.assign({ kind: "join", code: CODE }, s0)); P.ctl({ act: "start" });
  P.both(Object.assign({ kind: "join", code: CODE, want: "receipt" }, s1)); P.both(Object.assign({ kind: "progress", code: CODE }, s0));
  A(s0, 1, "B", { conf: "high" }); A(s0, 1, "Z"); A(s0, 2, "A"); A(s0, 9, "A"); A({ name: "", id: "1" }, 1, "A"); A(s1, 1, "C", { want: "receipt" });
  A({ name: "Late", id: "20000003" }, 1, "A");
  P.ctl({ act: "set", field: "allow_late_join", value: "no" }); A({ name: "Late", id: "20000099" }, 1, "A");
  P.both(Object.assign({ kind: "join", code: CODE }, { name: "Late", id: "20000098" }));
  P.ctl({ act: "revote" }); A(s0, 1, "D"); P.ctl({ act: "pause" }); A(s0, 1, "E");
  P.both(Object.assign({ kind: "join", code: "NOCODE" }, s0));
  P.close();
});

test("a timed quiz: whole submissions, duplicates, the deadline and a closed quiz", () => {
  const P = pair(), Sub = (s, x) => P.both(Object.assign({ kind: "submit", code: CODE, q1: "A", q2: "b", q3: "C", q4: "x", q5: "E" }, s, x));
  P.ctl({ act: "init" }); P.ctl({ act: "set", field: "mode", value: "timed" });
  Sub(s0); P.ctl({ act: "lobby" }); Sub(s0); P.ctl({ act: "start" });
  Sub(s0, { want: "receipt" }); Sub(s0); Sub(s1); Sub({ name: "", id: "5" }); Sub(s1, { code: "NOCODE" });
  P.ctl({ act: "pause" }); Sub({ name: "N", id: "20000003" }); P.ctl({ act: "resume" }); P.ctl({ act: "end" }); Sub({ name: "N", id: "20000003" });
  P.ctl({ act: "release" }); Sub({ name: "N", id: "20000004" });
  P.close();
});

test("practice attempts and question reports are kept the same way", () => {
  const P = pair(), store = fromBackend(P.mod.backend), p = { kind: "attempt", id: "20000001", quiz: "Lecture 1 Vectors", attempt: "1", score: "7", total: "10", seconds: "40", wrong: "L1-01", asked: "L1-01,L1-02" };
  assert.equal(P.script.call(p), S.attempt(store, p)); assert.equal(P.script.call({ kind: "attempt" }), S.attempt(store, { kind: "attempt" }));
  assert.deepEqual(strip(tab(P.mod, "Attempts")), strip(tab(P.script, "Attempts")));
  const r = { kind: "report", page: "p", lecture: "L1", qid: "L1-01", question: "q", answer: "a", comment: "=cmd" };
  assert.equal(P.script.call(r), S.report(store, r, {})); assert.deepEqual(strip(tab(P.mod, "Reports")), strip(tab(P.script, "Reports")));
  P.close();
});
