"use strict";
// Lecture numbers from file and folder names: the PHYS 143 layout and messy names. Made-up and course-pack names only.
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const { detect, lectureOf } = require("../autoload/lecture-names");

function walk(d, rel, out) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const r = rel ? rel + "/" + e.name : e.name; if (e.isDirectory()) walk(path.join(d, e.name), r, out); else out.push(r); } return out; }

test("many naming styles give the same number", () => {
  ["lecture1.pdf", "Lecture_01.pptx", "L1.pdf", "Lec 1 slides.pdf", "LECT-01 Intro.docx", "lt1.pdf", "week1.pdf", "Lecture 1 - Vectors.pdf", "Session 1.pdf", "Lectures/Lecture1/notes.pdf"].forEach((n) => assert.strictEqual(lectureOf(n), 1, n));
  assert.strictEqual(lectureOf("Lecture 12 - Waves.pdf"), 12);
  assert.strictEqual(lectureOf("08 Waves.pdf"), 8);
  assert.strictEqual(lectureOf("3_Kinematics.pdf"), 3);
});

test("the folder names the lecture when the file does not; the file wins when both do", () => {
  assert.strictEqual(lectureOf("lecture_7/slides.pdf"), 7);
  assert.strictEqual(lectureOf("Week 4/handout.pdf"), 4);
  assert.strictEqual(lectureOf("lecture_7/lecture08_tutorial.pdf"), 8);
  assert.strictEqual(lectureOf("Lecture 2/Week 9 reading.pdf"), 9); assert.strictEqual(lectureOf("Lecture 2/reading.pdf"), 2);
});

test("things that are not lectures are left alone", () => {
  ["roster_clean.csv", "attendance_week3.csv", "grades.xlsx", "2026-11-03 notes.pdf", "Lab 2 report.pdf", "introduction_tutorial.pdf", "readme.md", "lecturer_notes.pdf"].forEach((n) => assert.strictEqual(lectureOf(n), null, n));
});

test("the PHYS 143 course pack: lectures 1 to 12, banks, files grouped", () => {
  const root = path.join(__dirname, "..", "..", "course-packs", "phys143", "files");
  const r = detect(walk(root, "", []));
  assert.strictEqual(r.last, 12);
  const l1 = r.lectures.find((l) => l.number === 1);
  assert.ok(l1.count >= 6, "lecture 1 has its PDFs and bank"); assert.ok(l1.kinds.bank >= 1 && l1.kinds.tutorial >= 1);
  assert.ok(r.lectures.every((l, i, a) => i === 0 || l.number > a[i - 1].number), "ordered");
});

test("a folder with a missing lecture reports the gap and the last number", () => {
  const files = [1, 2, 3, 4, 5, 7, 8, 9].map((n) => "Lecture " + n + ".pdf").concat(["Lecture 6 slides.pdf"].slice(1), ["syllabus.pdf", "roster.csv", "notes.txt"]);
  const r = detect(files);
  assert.deepStrictEqual(r.gaps, [6]); assert.strictEqual(r.last, 9); assert.strictEqual(r.total, 8); assert.strictEqual(r.unplaced, 3);
});

test("messy names in one folder are grouped and ordered 1 to N", () => {
  const r = detect(["L2 forces.pdf", "lecture_01_intro.pptx", "Lec3/slides.pdf", "Lec3/tutorial.pdf", "week 4 - energy.docx", "05 Momentum.pdf", "quizzes/lecture6.json", "Lecture 10.pdf"]);
  assert.deepStrictEqual(r.lectures.map((l) => l.number), [1, 2, 3, 4, 5, 6, 10]);
  assert.strictEqual(r.lectures[2].count, 2); assert.deepStrictEqual(r.gaps, [7, 8, 9]);
});
