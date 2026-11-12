/* A course pack shaped like the lecturer's real PHYS 143 folder: wrapper folder, course.json one level down, outline in Word with the dates in a paragraph. `npm test` */
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const JSZip = require("jszip");
const { createCourse } = require("../course");
const { detailsOfFolder } = require("../autoload/folder-details");

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), "cm-rp-"));
const meta = JSON.stringify({ format: "class-manager-course", version: 1, name: "PHYS 143", settings: { courseCode: "PHYS 143", courseTitle: "Mechanics and Thermal Physics", semester: "" } });
const OUTLINE = "Credits: 3\nSemester: First Semester, 2026/2027 Academic Year\nThe course runs for 11 teaching weeks, from 26 October 2026 to 15 January 2027: mechanics first, then thermal physics. You attend two lecture periods a week with your group, plus tutorials set by your group facilitator. Lecture videos are posted on Sakai every week.\n";
const course = (dir) => createCourse({ dir: path.join(dir, "course"), web: path.join(dir, "web"), templates: path.join(dir, "tpl") });
const zipTo = async (file, entries) => { const z = new JSZip(); Object.keys(entries).forEach((k) => z.file(k, entries[k])); fs.writeFileSync(file, await z.generateAsync({ type: "nodebuffer" })); };

test("a pack zip that holds only course.json imports its details, reports 0 files and replaces nothing", async () => {
  const d = tmp(), c = course(d); fs.mkdirSync(path.join(d, "course")); fs.writeFileSync(path.join(d, "course", "keep.txt"), "kept");
  await zipTo(path.join(d, "p.zip"), { "course.json": meta });
  const r = await c.importPack(path.join(d, "p.zip"));
  assert.equal(r.files, 0); assert.equal(r.replaced, false); assert.equal(r.settings.courseCode, "PHYS 143");
  assert.equal(fs.readFileSync(path.join(d, "course", "keep.txt"), "utf8"), "kept"); // the existing course content is still there
});

test("a pack zip made by compressing the pack folder (one wrapper folder) is imported", async () => {
  const d = tmp(), c = course(d);
  await zipTo(path.join(d, "p.zip"), { "PHYS143-course-pack/course.json": meta, "PHYS143-course-pack/files/data/portal.json": "{}", "PHYS143-course-pack/files/.DS_Store": "x", "__MACOSX/PHYS143-course-pack/course.json": "x" });
  const r = await c.importPack(path.join(d, "p.zip"));
  assert.equal(r.files, 1); assert.equal(r.replaced, true); assert.ok(fs.existsSync(path.join(d, "course", "data", "portal.json")));
});

test("a wrapper folder with the pack one level down, loose student files and a Word outline fills semester and both teaching dates", async () => {
  const d = tmp(), pack = path.join(d, "PHYS143-course-pack");
  fs.mkdirSync(path.join(pack, "files", "data"), { recursive: true });
  fs.writeFileSync(path.join(pack, "course.json"), meta); fs.writeFileSync(path.join(pack, "files", "data", "portal.json"), JSON.stringify({ currentWeek: 6, contacts: "Tuesday 09:30 to 11:20" }));
  fs.writeFileSync(path.join(d, "Course_Outline.txt"), OUTLINE);
  fs.writeFileSync(path.join(d, "grades.csv"), "ID,Name,Score\n1,A,5\n2,B,6\n"); // student records are not read as course information
  const r = await detailsOfFolder(d), by = Object.fromEntries(r.fields.map((f) => [f.key, f]));
  assert.equal(by.code.value, "PHYS 143"); assert.equal(by.semester.value, "First Semester, 2026/2027 Academic Year");
  assert.equal(by.start.value, "2026-10-26"); assert.equal(by.end.value, "2027-01-15"); assert.equal(by.week.value, "6");
  assert.ok(!r.read.some((f) => /grades/.test(f)));
});

test("a folder can be imported as a pack, including one level of wrapper folder", async () => {
  const d = tmp(), c = course(d), pack = path.join(d, "wrap", "PHYS143-course-pack");
  fs.mkdirSync(path.join(pack, "files", "data"), { recursive: true });
  fs.writeFileSync(path.join(pack, "course.json"), meta); fs.writeFileSync(path.join(pack, "files", "data", "portal.json"), "{}"); fs.writeFileSync(path.join(d, "wrap", "grades.xlsx"), "x");
  const r = await c.importPack(path.join(d, "wrap"));
  assert.equal(r.files, 1); assert.ok(fs.existsSync(path.join(d, "course", "data", "portal.json")));
});
