/* One folder with everything: the files are found in every sub-folder, each is named by kind, and the preview says where its data goes.
   All data is made up. Run with `npm test` in class-manager/desktop. */
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { createStore } = require("../autoload/store");
const { scanFolder } = require("../autoload/folder");
const { placementOf, typeOf, destinationsOf } = require("../autoload/placement");

const tmp = (p) => fs.mkdtempSync(path.join(os.tmpdir(), p));
const write = (dir, rel, text) => { const f = path.join(dir, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, text); };

test("a mixed folder: attendance, quiz results, grades and a note are told apart and placed", async () => {
  const root = tmp("cm-pl-"), work = tmp("cm-plw-");
  write(root, "attendance/week1.csv", "Student ID,04/11/2026,10/11/2026\n20000001,P,A\n20000002,P,P\n");
  write(root, "quizzes/deep/q1.csv", "ID,Marks\n20000001,7\n20000002,5\n");
  write(root, "grades/marks.csv", "Student ID,Lab 1 (10),Assignment 1 (20)\n20000001,8,15\n20000002,9,17\n");
  write(root, "notes/readme.txt", "just a note about the course\n");
  const r = await scanFolder(root, createStore(work), {});
  const files = r.analyses.map((a, i) => Object.assign({}, a, { id: i }));
  const p = placementOf(files);
  const by = (name) => p.rows.find((x) => x.rel.endsWith(name));
  assert.equal(by("week1.csv").type, "Attendance sheet");
  assert.match(by("week1.csv").destinations[0].where, /^Attendance/);
  assert.equal(by("q1.csv").type, "Quiz results");
  assert.match(by("q1.csv").destinations.map((d) => d.where).join(), /Grades/);
  assert.equal(by("marks.csv").type, "Grades and marks");
  assert.equal(by("readme.txt").skipped, true);
  assert.equal(p.loading, 3);
  assert.equal(p.skipped, 1);
});

test("a class list in the folder is only checked against, never loaded as students", () => {
  const a = { ok: true, useful: true, summary: { students: 140 }, rel: "list.csv" };
  assert.equal(typeOf(a), "Class list");
  const d = destinationsOf(a);
  assert.equal(d[0].loads, false);
  assert.match(d[0].where, /Nobody is added/);
});

test("quiz questions are held for review, never loaded straight to students", () => {
  const d = destinationsOf({ ok: true, useful: true, summary: { questions: 4 } });
  assert.equal(d[0].loads, false);
  assert.match(d[0].where, /approve/);
});

test("an unreadable file is skipped with its reason", () => {
  const p = placementOf([{ id: 0, rel: "bad.xlsx", ok: false, error: "corrupt" }]);
  assert.equal(p.rows[0].type, "Unreadable");
  assert.equal(p.rows[0].skipped, true);
  assert.equal(p.rows[0].note, "corrupt");
});

test("a whole-course list flagged big is not counted as loading", () => {
  const p = placementOf([{ id: 0, rel: "all.csv", ok: true, useful: true, big: { students: 1500 }, summary: { students: 1500, marks: 3, sessions: 1 } }]);
  assert.equal(p.loading, 0);
});
