// The lecturer's own course: lectures, files and question banks, kept in CM's data folder (course/).
// CM ships with no course content. Pages ask for data/lectures.json, quizzes/lectureN.json and the
// lecture files; this module finds them in the course folder first and then in CM's own pages.
// A course pack (.zip) holds course.json (the course settings) and files/ (the course folder). It moves a
// course between computers, and it is how a prepared course is loaded.
"use strict";
const fs = require("fs");
const path = require("path");
const { createCourseContent } = require("./course-content");
const { createCoursePack } = require("./course-pack");

const KINDS = ["slides", "handout", "tutorial", "supplement", "reference"]; // file fields of a lecture

function writeJson(f, o) { fs.mkdirSync(path.dirname(f), { recursive: true }); const t = f + ".tmp"; fs.writeFileSync(t, JSON.stringify(o, null, 1)); fs.renameSync(t, f); }

function createCourse(opts) {
  const DIR = opts.dir;          // the course folder in CM's data folder
  const WEB = opts.web;          // CM's own pages
  const TPL = opts.templates;    // lecture page templates
  const { resolve, read, page, bankNumbers, conceptNumbers, lecturesDoc, flat, portal, lectures, practicePages, hasContent } = createCourseContent(DIR, WEB, TPL);
  const { importPack, exportPack } = createCoursePack(DIR);

  function saveLectures(d) { writeJson(path.join(DIR, "data", "lectures.json"), d); syncWeeks(); }
  // The live quiz weeks follow the lectures, so a quiz can be run for every lecture that has a bank.
  function syncWeeks() {
    const lq = read("apps_script/live_quizzes.json", { weeks: {} }) || { weeks: {} };
    lq.weeks = lq.weeks || {};
    const banks = new Set(bankNumbers());
    flat().forEach((l) => { if (l.number > 0 && banks.has(l.number)) lq.weeks[String(l.number)] = l.title; });
    const cw = new Set(conceptNumbers()); lq.concept_weeks = {}; // the weeks a diagnostic quiz can be run for
    flat().forEach((l) => { if (l.number > 0 && cw.has(l.number)) lq.concept_weeks[String(l.number)] = l.title; });
    cw.forEach((n) => { if (n > 0 && !lq.concept_weeks[String(n)]) lq.concept_weeks[String(n)] = lq.weeks[String(n)] || "Lecture " + n; });
    writeJson(path.join(DIR, "apps_script", "live_quizzes.json"), lq);
  }

  function saveLecture(o) {
    const n = Math.round(Number(o.number));
    if (!(n >= 0 && n <= 99)) return { ok: false, why: "The lecture number must be between 0 and 99." };
    const title = String(o.title || "").trim().slice(0, 160);
    if (!title) return { ok: false, why: "Give the lecture a title." };
    const d = lecturesDoc();
    let found = null, from = o.was != null ? Number(o.was) : n;
    d.groups.forEach((g) => { const i = g.lectures.findIndex((l) => l.number === from); if (i >= 0) found = { g, i }; });
    if (from !== n && flat(d).some((l) => l.number === n)) return { ok: false, why: "Lecture " + n + " already exists." };
    const l = found ? found.g.lectures[found.i] : {};
    l.number = n; l.title = title;
    l.summary = String(o.summary || "").trim().slice(0, 600);
    l.outcomes = String(o.outcomes || "").split(/\r?\n/).map((x) => x.trim()).filter(Boolean).slice(0, 20);
    l.status = o.status === "soon" ? "soon" : "available";
    if (found) found.g.lectures[found.i] = l; else d.groups[d.groups.length - 1].lectures.push(l);
    d.groups.forEach((g) => g.lectures.sort((a, b) => a.number - b.number));
    saveLectures(d);
    return { ok: true, lectures: lectures() };
  }
  function removeLecture(n) {
    const d = lecturesDoc();
    d.groups.forEach((g) => { g.lectures = g.lectures.filter((l) => l.number !== Number(n)); });
    saveLectures(d);
    return { ok: true, lectures: lectures() };
  }
  // Copies a file into the course folder and links it to a lecture.
  function addLectureFile(n, kind, src) {
    if (!KINDS.includes(kind)) return { ok: false, why: "Unknown kind of file." };
    const d = lecturesDoc();
    let l = null; d.groups.forEach((g) => g.lectures.forEach((x) => { if (x.number === Number(n)) l = x; }));
    if (!l) return { ok: false, why: "Save the lecture first." };
    const name = path.basename(src).replace(/[^\w.-]+/g, "_").slice(-120);
    const rel = "files/lecture_" + n + "/" + name;
    fs.mkdirSync(path.join(DIR, "files", "lecture_" + n), { recursive: true });
    fs.copyFileSync(src, path.join(DIR, rel));
    l[kind] = rel;
    saveLectures(d);
    return { ok: true, lectures: lectures() };
  }
  function removeLectureFile(n, kind) {
    const d = lecturesDoc();
    d.groups.forEach((g) => g.lectures.forEach((x) => { if (x.number === Number(n) && KINDS.includes(kind)) delete x[kind]; }));
    saveLectures(d);
    return { ok: true, lectures: lectures() };
  }
  function setCourseInfo(o) { // the course title in the lecture data and the class times on the portal
    const d = lecturesDoc(); d.course_title = String(o.courseCode || "").slice(0, 40); saveLectures(d);
    const p = read("data/portal.json", {}) || {};
    if (o.contacts != null) p.contacts = String(o.contacts).slice(0, 200);
    if (o.currentWeek != null) p.currentWeek = Math.max(1, Math.min(52, Number(o.currentWeek) || 1));
    writeJson(path.join(DIR, "data", "portal.json"), p);
  }

  // An optional logo, kept in the course folder.
  function setLogo(src) {
    ["png", "jpg", "jpeg", "svg", "webp"].forEach((x) => { try { fs.unlinkSync(path.join(DIR, "course-logo." + x)); } catch (e) { /* none */ } });
    if (!src) return "";
    const ext = path.extname(src).toLowerCase().replace(".", "");
    if (!["png", "jpg", "jpeg", "svg", "webp"].includes(ext)) throw new Error("Choose a PNG, JPEG, SVG or WebP image.");
    if (fs.statSync(src).size > 2000000) throw new Error("Choose an image smaller than 2 MB.");
    fs.mkdirSync(DIR, { recursive: true });
    fs.copyFileSync(src, path.join(DIR, "course-logo." + ext));
    return "course-logo." + ext;
  }

  return { resolve, page, portal, bankNumbers, conceptNumbers, lectures, practicePages, saveLecture, removeLecture, addLectureFile, removeLectureFile, setCourseInfo, importPack, exportPack, hasContent, setLogo, syncWeeks, KINDS };
}

module.exports = { createCourse };
