/* A student's own result when a quiz ends: every phone gets its score at once, on the class list or not, and a late tap that was turned away
   ("wrong question") is never shown as a failure. Showing the score is not recording it: Submit or Discard stays the lecturer's decision. */
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { classroom, PACK } = require("./classroom");

const CODE = "26271", OFF = "55555555", L = ["A", "B", "C", "D"];
const bankFor = (type) => JSON.parse(require("fs").readFileSync(require("path").join(PACK, "quizzes", type === "concept" ? "lecture1_concept.json" : "lecture1.json"), "utf8")).questions;

function play(type) {
  const c = classroom({ students: 3, engine: "js" }), listed = c.students[0];
  c.host("control", { code: CODE, act: "init" });
  if (type) assert.equal(c.host("control", { code: CODE, act: "set", field: "quiz_type", value: type }).ok, true);
  c.host("control", { code: CODE, act: "set", field: "q_seconds", value: "0" });
  c.host("control", { code: CODE, act: "lobby" });
  assert.equal(c.host("control", { code: CODE, act: "start" }).ok, true);
  const bank = bankFor(type), ids = c.host("host", { code: CODE }).status.qids, key = ids.map((id) => L[bank.find((q) => q.id === id).answer]);
  const who = [listed, { id: OFF, name: "Zed" }], rc = {};
  who.forEach((s) => { const j = c.call({ kind: "join", name: s.name, id: s.id, code: CODE, want: "receipt" }); rc[s.id] = j.receipt; assert.ok(j.receipt, "a receipt for " + s.id); });
  const late = [];
  for (let q = 1; q <= ids.length; q++) {
    who.forEach((s) => assert.equal(c.call({ kind: "answer", name: s.name, id: s.id, code: CODE, q: String(q), answer: q === 1 ? (key[0] === "A" ? "B" : "A") : key[q - 1] }).outcome || "ok", "ok"));
    if (q < ids.length) c.host("control", { code: CODE, act: "next" });
    else who.forEach((s) => late.push(c.call({ kind: "answer", name: s.name, id: s.id, code: CODE, q: "1", answer: key[0], want: "receipt" }))); // a tap that arrives after the quiz moved on
  }
  c.host("control", { code: CODE, act: "end" });
  return { c, who, rc, ids, late };
}
const result = (c, id, rc) => c.call({ action: "result", id, code: CODE, rc });

for (const type of [undefined, "concept"]) {
  test("at the end every phone sees its own score, listed or not (" + (type || "exercises") + ")", () => {
    const { c, who, rc, ids } = play(type);
    try {
      who.forEach((s) => {
        const r = result(c, s.id, rc[s.id]);
        assert.equal(r.found, true, s.id + " sees a score: " + JSON.stringify(r));
        assert.equal(r.total, ids.length, JSON.stringify(r)); assert.equal(r.score, ids.length - 1, "one wrong answer to question 1");
        assert.equal(r.onList === false, s.id === OFF, "only the unlisted ID is told to see the lecturer");
      });
    } finally { c.backend.close(); }
  });

  test("a turned-away late tap is not a failure (" + (type || "exercises") + ")", () => {
    const { c, who, rc, late } = play(type);
    try { assert.equal(late[0].outcome, "wrong question"); assert.equal(result(c, who[0].id, rc[who[0].id]).found, true); } finally { c.backend.close(); }
  });

  test("showing the score records nothing for an unlisted ID (" + (type || "exercises") + ")", () => {
    const { c, rc } = play(type);
    try {
      result(c, OFF, rc[OFF]);
      ["Answers", "Form Responses 1", "Staged_Quiz", "Master", "Scores"].forEach((t) => assert.equal((c.backend.rawRows(t) || []).slice(1).some((r) => r.map(String).includes(OFF)), false, t));
    } finally { c.backend.close(); }
  });
}
