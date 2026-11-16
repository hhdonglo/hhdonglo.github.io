/* rules/outcomes.js links questions to objectives and reads progress as the Apps Script does. */
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const { classroom } = require("./classroom");
const O = require("../rules/outcomes");
const { fromBackend } = require("../rules/store");

const WEB = path.resolve(__dirname, "..", ".."), PACK = path.join(WEB, "course-packs", "phys143", "files");
const site = (p) => { const a = path.join(PACK, p); return JSON.parse(fs.readFileSync(fs.existsSync(a) ? a : path.join(WEB, p), "utf8")); };
const norm = (r) => JSON.parse(JSON.stringify(r, (k, v) => (k === "_session" || k === "version" || k === "generated" ? undefined : v)));
const tab = (c, name) => { const b = JSON.parse(c.backend.exportText()).sheets.find((s) => s.name === name); return b ? b.rows : []; };
const T = (v) => ((typeof v === "string" && /^\d{4}-\d\d-\d\dT/.test(v)) || (v && typeof v === "object" && v.$d) ? "T" : v);
const strip = (rows) => rows.map((r) => { const x = r.map(T); while (x.length && (x[x.length - 1] === "" || x[x.length - 1] == null)) x.pop(); return x; }).filter((r) => r.length > 0);

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
  const book = JSON.parse(script.backend.exportText());
  mod.editWorkbook((b) => { b.sheets = book.sheets; b.props = book.props; });
  const o = { site };
  try { then({ script, mod, store: () => fromBackend(mod.backend), o }); } finally { script.backend.close(); mod.backend.close(); }
}

test("objectives: list, accept suggestions, save links, remove one", () => scenario(({ script, mod, store, o }) => {
  assert.deepEqual(norm(O.outcomesAct(store(), { op: "list" }, o)), norm(script.host("outcomes", { op: "list" })));
  assert.deepEqual(norm(O.outcomesAct(store(), { op: "accept", lecture: "1" }, o)), norm(script.host("outcomes", { op: "accept", lecture: "1" })));
  assert.deepEqual(norm(O.outcomesAct(store(), { op: "accept", lecture: "99" }, o)), norm(script.host("outcomes", { op: "accept", lecture: "99" })));
  const tags = JSON.stringify([{ id: "L1-01", lecture: 1, outcome: 2 }, { id: "L1-02", lecture: 1, outcome: 0 }, { id: "L2-01", outcome: 1 }]);
  assert.deepEqual(norm(O.outcomesAct(store(), { op: "save", tags }, o)), norm(script.host("outcomes", { op: "save", tags })));
  assert.deepEqual(norm(O.outcomesAct(store(), { op: "save", tags: "{bad" }, o)), norm(script.host("outcomes", { op: "save", tags: "{bad" })));
  assert.deepEqual(strip(tab(mod, "Question_Outcomes")), strip(tab(script, "Question_Outcomes")));
  assert.ok(script.host("outcomes", { op: "list" }).lectures.some((l) => l.outcomes.some((x) => x.answers > 0)), "answers are counted per objective");
}));

test("a student's progress matches what My results shows, and the class views are computed", () => scenario(({ script, store, o }) => {
  script.host("outcomes", { op: "accept", lecture: "1" }); O.outcomesAct(store(), { op: "accept", lecture: "1" }, o);
  script.host("access_codes", { op: "generate" });
  const codes = tab(script, "Access_Codes"), ev = O.evidence(store(), o);
  ["20000001", "20000004", "20000007"].forEach((id) => {
    const code = codes.find((r) => String(r[0]) === id)[1], r = script.call({ action: "my_results", id, code }), sp = O.studentProgress(id, ev);
    const shaped = { outcomes: sp.outcomes.map((x) => ({ label: x.label, answers: x.answers, start: x.start, current: x.current, gain: x.gain, level: x.level })), timeline: sp.timeline, overall: { answers: sp.overall.answers, start: sp.overall.start, current: sp.overall.current, gain: sp.overall.gain }, minimum: sp.minimum };
    assert.deepEqual(norm(shaped), norm(r.progress), id);
  });
  const store1 = store(), cls = O.classOutcomes(store1, ev, ev._lects), tl = O.classTimeline(store1, ev), disc = O.discussionStats(store1);
  assert.ok(cls.length >= 1 && tl.length >= 1 && disc.rounds >= 1, "the class views have content");
  assert.equal(disc.pairs > 0, true);
}));
