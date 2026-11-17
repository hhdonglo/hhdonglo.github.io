/* Diagnostic quiz and exercises: the quiz mode is chosen in the lecturer's quiz window; a diagnostic uses the diagnostic bank (quizzes/lectureN_concept.json),
   shows the class which concepts were understood, and never reaches Grades (Master, Scores, Totals, Form Responses 1) or the exercise item log. */
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { classroom, PACK } = require("./classroom");
const QH = require("../../assets/quiz-host-text.js");

const CODE = "26271"; // week 1
const rowsOf = (b, tab) => (b.rawRows(tab) || []).slice(1).filter((r) => r.some((x) => x !== "" && x != null));
const letters = ["A", "B", "C", "D"];

function run(c, type, nCorrectStudents) {
  assert.equal(c.host("control", { code: CODE, act: "init" }).ok, true);
  if (type) { const r = c.host("control", { code: CODE, act: "set", field: "quiz_type", value: type }); assert.equal(r.ok, true, JSON.stringify(r)); }
  c.host("control", { code: CODE, act: "set", field: "q_seconds", value: "0" });
  assert.equal(c.host("control", { code: CODE, act: "lobby" }).ok, true);
  const start = c.host("control", { code: CODE, act: "start" }); assert.equal(start.ok, true, JSON.stringify(start));
  const bank = JSON.parse(require("fs").readFileSync(require("path").join(PACK, "quizzes", type === "concept" ? "lecture1_concept.json" : "lecture1.json"), "utf8")).questions;
  const ids = c.host("host", { code: CODE }).status.qids, key = ids.map((id) => letters[bank.find((q) => q.id === id).answer]);
  for (let q = 1; q <= ids.length; q++) {
    c.students.forEach((s, i) => { // the first nCorrectStudents answer every question right, the others always wrong
      const right = key[q - 1], wrong = letters.find((l) => l !== right);
      const r = c.call({ kind: "answer", name: s.name, id: s.id, code: CODE, q: String(q), answer: i < nCorrectStudents ? right : wrong });
      assert.equal(typeof r === "string" ? r : r.outcome, "ok");
    });
    if (q < ids.length) assert.equal(c.host("control", { code: CODE, act: "next" }).ok, true);
  }
  return { ids, key };
}

test("the mode is stored with the quiz, defaults to exercises, and a diagnostic uses the diagnostic bank", () => {
  const c = classroom({ students: 4, engine: "js" });
  try {
    c.host("control", { code: CODE, act: "init" });
    let h = c.host("host", { code: CODE });
    assert.equal(h.quizType, "standard"); assert.deepEqual(Object.keys(h.conceptWeeks).sort(), ["1", "2"]);
    assert.equal(c.get({ action: "status", code: CODE }).quizType, "standard", "students and the projector read the mode from the status");
    const r = c.host("control", { code: CODE, act: "set", field: "quiz_type", value: "concept" }); assert.equal(r.ok, true);
    assert.equal(r.status.quizType, "concept");
    assert.equal(c.host("control", { code: CODE, act: "set", field: "week", value: "3" }).ok, false, "a week with no diagnostic bank is refused while Diagnostic quiz is chosen");
    assert.match(c.host("control", { code: CODE, act: "set", field: "mode", value: "timed" }).why, /one question at a time/);
    c.host("control", { code: CODE, act: "lobby" }); c.host("control", { code: CODE, act: "start" });
    const ids = c.host("host", { code: CODE }).status.qids;
    assert.ok(ids.length >= 5 && ids.every((id) => /^L1-C\d+$/.test(id)), "questions come from lecture1_concept.json: " + ids);
    const qs = c.get({ action: "questions", code: CODE }).questions; assert.equal(qs.length, ids.length);
    assert.equal(c.host("control", { code: CODE, act: "set", field: "quiz_type", value: "standard" }).ok, true, "the mode can be changed back before a round starts");
  } finally { c.backend.close(); }
});

test("a diagnostic shows the class which concepts were missed, and never reaches Grades", () => {
  const c = classroom({ students: 4, engine: "js" });
  try {
    run(c, "concept", 3); // three students right, one always wrong
    const live = c.host("host", { code: CODE });
    assert.ok(live.diag && live.diag.byQ.length >= 5, "the class diagnostic appears while the quiz runs");
    assert.ok(live.diag.byQ.every((q) => q.answered === 4 && q.right === 3 && q.pct === 75), JSON.stringify(live.diag.byQ[0]));
    assert.equal(live.diag.byTag.reduce((n, t) => n + t.answered, 0), live.diag.byQ.length * 4);
    assert.equal(c.host("control", { code: CODE, act: "end" }).ok, true);
    assert.equal(rowsOf(c.backend, "Staged_Quiz").length, 0, "nothing is held for release");
    assert.equal(c.host("control", { code: CODE, act: "release" }).ok, true);
    ["Form Responses 1", "Staged_Quiz", "Master", "Scores", "Totals", "Item_Log"].forEach((t) => {
      const rows = rowsOf(c.backend, t); assert.ok(!rows.some((r) => r.some((x) => String(x).indexOf(c.students[0].id) >= 0)), t + " holds nothing of the diagnostic");
    });
    const log = rowsOf(c.backend, "Diagnostic_Log");
    assert.equal(log.length, 4 * live.diag.byQ.length, "one row per student and question");
    assert.ok(log.every((r) => r[7] && r[1] === CODE), "each row carries its concept");
    // Class Analytics reads the same record, by concept
    const S = require("../rules/quiz-diagnostic").summary(require("../rules/store").fromBackend(c.backend), { site: c.backend.site });
    assert.equal(S.weeks.length, 1); assert.equal(S.weeks[0].week, 1); assert.equal(S.quizzes[0].students, 4);
    assert.ok(S.weeks[0].concepts.length >= 2 && S.weeks[0].concepts.every((x) => x.pct === 75));
    const V = require("../app/analytics/render"), card = V.diagnostics(S);
    assert.match(card, /Diagnostic quizzes/); assert.match(card, /Week 1/); assert.match(card, /too early \(\d+ answers\)/, "four students are too few to judge a concept");
    assert.match(V.diagnostics({ ok: true, weeks: [] }), /No diagnostic quiz has been run yet/); assert.doesNotMatch(card, /\bapp\b|&amp;/i);
  } finally { c.backend.close(); }
});

test("exercises still go to Grades as before and leave no diagnostic record", () => {
  const c = classroom({ students: 4, engine: "js" });
  try {
    run(c, null, 2);
    assert.equal(c.host("host", { code: CODE }).diag, undefined, "no class diagnostic for exercises");
    c.host("control", { code: CODE, act: "end" });
    assert.ok(rowsOf(c.backend, "Staged_Quiz").length >= 4, "results are held for release");
    c.host("control", { code: CODE, act: "release" });
    assert.ok(rowsOf(c.backend, "Form Responses 1").length >= 4);
    assert.ok(rowsOf(c.backend, "Item_Log").length > 0);
    assert.equal(rowsOf(c.backend, "Diagnostic_Log").length, 0);
  } finally { c.backend.close(); }
});

test("the lecturer's window words: mode labels, weeks with a diagnostic bank, and the class diagnostic table", () => {
  assert.equal(QH.typeLabel("concept"), "Diagnostic quiz"); assert.equal(QH.typeLabel("standard"), "Exercises");
  assert.deepEqual(QH.weeksFor({ 1: "Vectors", 3: "Newton" }, { 1: "Vectors" }, true), { 1: "Vectors" });
  assert.deepEqual(QH.weeksFor({ 1: "Vectors", 3: "Newton" }, { 1: "Vectors" }, false), { 1: "Vectors", 3: "Newton" });
  assert.match(QH.typeNote("standard", { 1: "Vectors" }), /Week 1 \(Vectors\)/);
  assert.match(QH.typeNote("concept", {}), /not for marks/);
  const html = QH.diagHtml({ byTag: [{ tag: "A", answered: 10, right: 9 }, { tag: "B", answered: 10, right: 2 }], byQ: [{ q: 1, tag: "B", answered: 10, right: 2 }] }, (x) => x);
  assert.ok(html.indexOf("<td>B</td>") < html.indexOf("<td>A</td>"), "the weakest concept comes first");
  [QH.typeNote("standard", {}), QH.typeNote("concept", {})].forEach((t) => assert.doesNotMatch(t, /\bapp\b|&/i));
});

test("the course folder lists the weeks that have a diagnostic bank, and the pages offer the choice", () => {
  const fs = require("fs"), path = require("path"), WEB = path.resolve(__dirname, "..", "..");
  const lq = JSON.parse(fs.readFileSync(path.join(PACK, "apps_script", "live_quizzes.json"), "utf8"));
  Object.keys(lq.concept_weeks).forEach((w) => assert.ok(fs.existsSync(path.join(PACK, "quizzes", "lecture" + w + "_concept.json")), "bank for week " + w));
  const host = fs.readFileSync(path.join(WEB, "quiz-host.html"), "utf8");
  assert.match(host, /Diagnostic quiz \(short concept check, not for marks\)/); assert.match(host, /Exercises \(practice questions/);
  assert.match(fs.readFileSync(path.join(WEB, "quiz.html"), "utf8"), /Diagnostic quiz: checks your understanding of concepts, not for marks/);
  assert.match(fs.readFileSync(path.join(WEB, "quiz-display.html"), "utf8"), /id="d-type"/);
});
