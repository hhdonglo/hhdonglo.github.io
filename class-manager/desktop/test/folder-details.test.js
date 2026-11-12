/* Course details read from a linked folder (autoload/folder-details.js, Courses dialog): `npm test`. Made-up files only. */
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { detailsOfFolder } = require("../autoload/folder-details");
const { findDetails } = require("../autoload/course-details");

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), "cm-fd-"));

test("a labelled outline fills code, title, term, lecturer and institution, each with its file", async () => {
  const d = tmp(); fs.mkdirSync(path.join(d, "Week1"));
  fs.writeFileSync(path.join(d, "Course-outline.md"), "Course code: PHYS 143\nCourse title: Mechanics and Thermal Physics\nSemester: Semester 2, 2026/27\nLecturer: Dr A. Mensah\nInstitution: University of Example\n");
  fs.writeFileSync(path.join(d, "Week1", "notes.txt"), "notes");
  const r = await detailsOfFolder(d), by = Object.fromEntries(r.fields.map((f) => [f.key, f]));
  assert.equal(by.title.value, "Mechanics and Thermal Physics"); assert.equal(by.title.from, "Course-outline.md");
  assert.equal(by.code.value, "PHYS 143"); assert.equal(by.semester.value, "Semester 2, 2026/27"); assert.equal(by.lecturer.value, "Dr A. Mensah"); assert.equal(by.institution.value, "University of Example");
  assert.deepEqual(r.read.slice(0, 1), ["Course-outline.md"]); // outline-like names are read first
});

test("an outline without labels is read from its first lines", () => {
  const f = findDetails([{ file: "syllabus.md", rows: [], text: "# PHYS 143: Mechanics and Thermal Physics\n\nSemester 2, 2026/27\n\nUniversity of Example\nInstructor: Dr B" }], new Date());
  assert.equal(f.code.value, "PHYS 143"); assert.equal(f.title.value, "Mechanics and Thermal Physics"); assert.equal(f.semester.value, "Semester 2, 2026/27"); assert.equal(f.institution.value, "University of Example");
});

test("a folder with nothing readable gives no fields and no error; an unreadable file is skipped", async () => {
  const d = tmp(); fs.writeFileSync(path.join(d, "photo.png"), "x"); fs.writeFileSync(path.join(d, "broken.docx"), "not a zip");
  const r = await detailsOfFolder(d); assert.equal(r.ok, true); assert.deepEqual(r.fields, []);
});

test("wiring: the Courses dialog reads the folder when it is linked or has a blank title, and says it is CM", () => {
  const home = fs.readFileSync(path.join(__dirname, "../app/home.html"), "utf8");
  assert.match(home, /id="cd-found"/); assert.match(home, /cmApp\.folderDetails/); assert.match(home, /CM found these in the course files/); assert.match(home, /readFolder\(id,false\)/);
  assert.match(fs.readFileSync(path.join(__dirname, "../main.js"), "utf8"), /on\("cm:folderDetails"/);
  assert.match(fs.readFileSync(path.join(__dirname, "../preload.js"), "utf8"), /folderDetails: call/);
});
