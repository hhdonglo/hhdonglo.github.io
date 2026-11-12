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

test("a CM course pack gives its settings, class times, current week and lecture titles; what the files lack is listed as missing", async () => {
  const d = tmp(); fs.mkdirSync(path.join(d, "files", "data"), { recursive: true });
  fs.writeFileSync(path.join(d, "course.json"), JSON.stringify({ format: "class-manager-course", version: 1, settings: { courseCode: "PHYS 143", courseTitle: "Mechanics and Thermal Physics", institution: "University of Example", lecturer: "Dr A. Test", semester: "", contact: "a.test@example.edu" } }));
  fs.writeFileSync(path.join(d, "files", "data", "portal.json"), JSON.stringify({ currentWeek: 6, contacts: "Tuesday 09:30 to 11:20", lectures: { 1: "Vectors", 2: "Motion" } }));
  const r = await detailsOfFolder(d), by = Object.fromEntries(r.fields.map((f) => [f.key, f]));
  assert.equal(by.contact.value, "a.test@example.edu"); assert.equal(by.times.value, "Tuesday 09:30 to 11:20"); assert.equal(by.week.value, "6"); assert.equal(by.lecturer.value, "Dr A. Test");
  assert.equal(by.title.from, "course.json"); assert.equal(by.week.from.replace(/\\/g, "/"), "files/data/portal.json");
  assert.deepEqual(r.topics.map((t) => t.title), ["Vectors", "Motion"]);
  assert.deepEqual(r.missing, ["Semester", "First day of teaching", "Last day of teaching"]); // nothing invented
});

test("an outline gives the contact e-mail and the first and last day from a teaching-dates line", () => {
  const f = findDetails([{ file: "outline.md", rows: [], text: "PHYS 143: Mechanics\nTeaching: 2 November 2026 to 20 February 2027\nContact: a.test@example.edu" }], new Date(Date.UTC(2026, 10, 18)));
  assert.equal(f.contact.value, "a.test@example.edu"); assert.equal(f.start.value, "2026-11-02"); assert.equal(f.end.value, "2027-02-20");
});

test("wiring: the New course form fills every field from a folder and says what it could not find", () => {
  const setup = fs.readFileSync(path.join(__dirname, "../app/setup.html"), "utf8");
  ["c-code", "c-title", "c-lect", "c-inst", "c-sem", "c-contact", "c-start", "c-end", "c-times", "c-week"].forEach((id) => assert.match(setup, new RegExp("\"" + id + "\"")));
  assert.match(setup, /Fill from the course folder/); assert.match(setup, /Not in the files, so left for you/); assert.match(setup, /fdAuto\(\)/);
});
