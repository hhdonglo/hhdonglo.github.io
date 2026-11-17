"use strict";
const test = require("node:test");
const assert = require("node:assert");
const { overview } = require("../lecture-progress/overview");

test("Lecture 1 to the last, with titles, files, banks and plain statuses", () => {
  const files = ["lecture_1/lecture01_vectors.pdf", "lecture_1/lecture01_tutorial.pdf", "lecture_2/slides.pdf", "quizzes/lecture1.json", "quizzes/lecture2.json", "Lecture 4.pdf"];
  const o = overview(files, [{ number: 1, title: "Vectors", bank: true }, { number: 2, title: "Motion", bank: true }, { number: 3, title: "Forces", bank: false }, { number: 4, title: "", bank: false }]);
  assert.deepStrictEqual(o.rows.map((r) => r.label), ["Lecture 1", "Lecture 2", "Lecture 3", "Lecture 4"]);
  assert.strictEqual(o.rows[0].title, "Vectors"); assert.strictEqual(o.rows[0].status, "Complete"); assert.strictEqual(o.rows[0].fileCount, 2);
  assert.strictEqual(o.rows[2].status, "Nothing found"); assert.strictEqual(o.rows[3].status, "No quiz bank");
  assert.deepStrictEqual(o.gaps, [3]); assert.strictEqual(o.last, 4);
});

test("a lecture with a bank but no files says so; an empty course gives no rows", () => {
  assert.strictEqual(overview(["quizzes/lecture1.json"], [{ number: 1, bank: true }]).rows[0].status, "No files");
  assert.strictEqual(overview([], []).rows.length, 0);
});
