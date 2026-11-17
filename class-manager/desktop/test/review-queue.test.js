/* Sending many quiz question sets to the review queue, and cleaning lecture titles read from files. All data is made up.
   Run with `npm test` in class-manager/desktop. */
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { createAuthoring } = require("../authoring");
const { cleanTitle } = require("../autoload/topic-titles");
const { findDetails } = require("../autoload/course-details");

function setup(banks) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "au-")), web = fs.mkdtempSync(path.join(os.tmpdir(), "web-"));
  fs.mkdirSync(path.join(web, "quizzes"));
  for (let l = 1; l <= 12; l++) fs.writeFileSync(path.join(web, "quizzes", "lecture" + l + ".json"), JSON.stringify({ lecture: l, questions: Array.from({ length: banks }, (_, i) => ({ id: "L" + l + "-" + i, q: "Base question " + i + " of " + l + " " + "word ".repeat(40), options: ["a", "b", "c", "d"], answer: 0 })) }));
  return createAuthoring({ dir, webRoot: web, loadKey: () => "", log() {} });
}
const sets = (n, per) => Array.from({ length: n }, (_, s) => { let t = "Lecture " + (s % 12 + 1) + "\n\n"; for (let q = 1; q <= per; q++) t += "Q" + q + ". Question " + s + "-" + q + " text " + "word ".repeat(30) + "\nA) one\nB) two\nC) three\nD) four\nAnswer: B\nExplanation: because\n\n"; return t; });

test("64 question sets are checked and queued in linear time, not frozen", () => {
  const au = setup(60), t0 = Date.now();
  const r = au.importText(sets(64, 20).join("\n\n"), {}, "big"); // 1280 questions
  const d = au.addDrafts(r.items, "imported");
  assert.equal(d.length, 1280);
  assert.equal(au.listDrafts().length, 1280);
  assert.ok(Date.now() - t0 < 3000, "took " + (Date.now() - t0) + " ms; the old quadratic checks took far longer as drafts grew");
});

test("duplicate warnings still work against the bank and the drafts", () => {
  const au = setup(3);
  const bank = "Base question 1 of 1 " + "word ".repeat(40);
  const mk = (q) => ({ lecture: 1, type: "concept", q, options: ["a", "b", "c", "d"], answer: 0, exp: "x" });
  const first = au.addDrafts([mk("A fresh question about momentum")], "imported")[0];
  assert.ok(!first.warnings.some((w) => /already/.test(w)));
  const again = au.addDrafts([mk("A fresh question about momentum"), mk(bank)], "imported");
  assert.ok(again[0].warnings.some((w) => /among the drafts/.test(w)));
  assert.ok(again[1].warnings.some((w) => /Lecture 1 bank/.test(w)));
});

test("lecture titles: cut-off lines are joined, fragments and arrow chains are dropped, suffixes removed", () => {
  assert.equal(cleanTitle("Thermal Proper-", "ties of Matter"), "Thermal Properties of Matter");
  assert.equal(cleanTitle("The Second Law of", "Thermodynamics"), "The Second Law of Thermodynamics");
  assert.equal(cleanTitle("Vectors - Tutorial Sheet"), "Vectors");
  assert.equal(cleanTitle("a collision"), null);
  assert.equal(cleanTitle("interaction -> force -> net"), null);
  assert.equal(cleanTitle("The Second Law of"), null);
  const f = findDetails([{ file: "o.txt", rows: [], text: "Week 10: Thermal Proper-\nties\nWeek 11: a collision\nWeek 12: Gravitation - Tutorial Sheet" }], new Date());
  assert.deepEqual(f.topics.map((t) => [t.week, t.title]), [[10, "Thermal Properties"], [12, "Gravitation"]]);
});
