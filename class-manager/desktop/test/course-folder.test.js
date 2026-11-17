/* Course content found in a chosen folder, including a course pack one folder below it. `npm test` */
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { contentRoot, summary } = require("../course-folder");
const bank = require("../first-run/bank-folder");

const Q = { lecture: 1, title: "Vectors", questions: [{ id: "a", type: "concept", q: "Q?", options: ["1", "2", "3", "4"], answer: 0, exp: "e" }] };
function pack() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "cm-cf-")), p = path.join(d, "PHYS-course-pack"), f = path.join(p, "files");
  fs.mkdirSync(path.join(f, "data"), { recursive: true }); fs.mkdirSync(path.join(f, "quizzes")); fs.mkdirSync(path.join(f, "PHYS", "lecture_1"), { recursive: true });
  fs.writeFileSync(path.join(p, "course.json"), "{}"); fs.writeFileSync(path.join(f, "quizzes", "lecture1.json"), JSON.stringify(Q));
  fs.writeFileSync(path.join(f, "PHYS", "lecture_1", "s.pdf"), "x");
  fs.writeFileSync(path.join(f, "data", "lectures.json"), JSON.stringify({ groups: [{ id: "g", lectures: [{ number: 1, title: "Vectors", slides: "PHYS/lecture_1/s.pdf", handout: "PHYS/lecture_1/missing.pdf" }, { number: 2, title: "Motion" }] }] }));
  fs.writeFileSync(path.join(d, "grades.xlsx"), "x");
  return { d, p, f };
}

test("the content folder is found from the folder around a pack, from the pack and from files/", () => {
  const { d, p, f } = pack();
  assert.equal(contentRoot(d), f); assert.equal(contentRoot(p), f); assert.equal(contentRoot(f), f);
});
test("a folder with no course content is left as it is", () => { const d = fs.mkdtempSync(path.join(os.tmpdir(), "cm-cf-")); assert.equal(contentRoot(d), d); });
test("the summary counts lectures, banks, questions and files, and names what is missing", () => {
  const s = summary(pack().d);
  assert.equal(s.lectures, 2); assert.equal(s.banks, 1); assert.equal(s.questions, 1); assert.equal(s.files, 1);
  assert.deepEqual(s.noBank, [2]); assert.equal(s.missing.length, 1); assert.equal(s.missing[0].file, "PHYS/lecture_1/missing.pdf");
});
test("the quiz scan finds banks inside a pack below the chosen folder, and reports the counts", () => {
  const { d } = pack(), p = bank.plan(d, fs.mkdtempSync(path.join(os.tmpdir(), "cm-cf-")));
  assert.equal(p.loadable, 1); assert.equal(p.content.lectures, 2);
});
