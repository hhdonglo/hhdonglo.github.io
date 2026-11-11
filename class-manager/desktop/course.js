// The lecturer's own course: lectures, files and question banks, kept in CM's data folder (course/).
// CM ships with no course content. Pages ask for data/lectures.json, quizzes/lectureN.json and the
// lecture files; this module finds them in the course folder first and then in CM's own pages.
// A course pack (.zip) holds course.json (the course settings) and files/ (the course folder). It moves a
// course between computers, and it is how a prepared course is loaded.
"use strict";
const fs = require("fs");
const path = require("path");
const JSZip = require("jszip");

const KINDS = ["slides", "handout", "tutorial", "supplement", "reference"]; // file fields of a lecture

function readJson(f, d) { try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch (e) { return d; } }
function writeJson(f, o) { fs.mkdirSync(path.dirname(f), { recursive: true }); const t = f + ".tmp"; fs.writeFileSync(t, JSON.stringify(o, null, 1)); fs.renameSync(t, f); }
function inside(root, full) { const r = path.normalize(root + path.sep); return path.normalize(full).startsWith(r); }

function createCourse(opts) {
  const DIR = opts.dir;          // the course folder in CM's data folder
  const WEB = opts.web;          // CM's own pages
  const TPL = opts.templates;    // lecture page templates

  // A path below the site root ("/data/lectures.json"), as a file on disk: the course folder first, then CM's pages.
  function resolve(rel) {
    rel = String(rel || "").replace(/^\/+/, "");
    for (const root of [DIR, WEB]) {
      const full = path.join(root, rel);
      if (!inside(root, full)) continue;
      try { if (fs.statSync(full).isFile()) return full; } catch (e) { /* not here */ }
    }
    return null;
  }
  const read = (rel, d) => { const f = resolve(rel); return f ? readJson(f, d) : d; };

  // Lecture pages that the course does not provide are made from the templates.
  function page(rel) {
    const m = String(rel || "").match(/^\/?lecture-(\d{1,2})(-practice)?\.html$/);
    if (!m) return null;
    const n = Number(m[1]), nn = ("0" + n).slice(-2);
    try { return fs.readFileSync(path.join(TPL, m[2] ? "practice.html" : "lecture.html"), "utf8").replace(/\{\{NN\}\}/g, nn).replace(/\{\{N\}\}/g, String(n)); } catch (e) { return null; }
  }

  // Question bank numbers in the course folder.
  function bankNumbers() {
    const out = new Set();
    for (const root of [DIR, WEB]) {
      try { fs.readdirSync(path.join(root, "quizzes")).forEach((f) => { const m = f.match(/^lecture(\d+)\.json$/); if (m) out.add(Number(m[1])); }); } catch (e) { /* none */ }
    }
    return [...out].sort((a, b) => a - b);
  }

  function lecturesDoc() {
    const d = read("data/lectures.json", null) || {};
    d.groups = Array.isArray(d.groups) && d.groups.length ? d.groups : [{ id: "lectures", title: "Lectures", subtitle: "", lectures: [] }];
    d.contacts = d.contacts || [];
    return d;
  }
  function flat(d) { const o = []; (d || lecturesDoc()).groups.forEach((g) => (g.lectures || []).forEach((l) => o.push(Object.assign({ group: g.id }, l)))); return o.sort((a, b) => a.number - b.number); }

  // portal.json as the pages see it: titles and handouts from the lectures, practice from the banks that exist.
  function portal(extraBanks) {
    const p = read("data/portal.json", {}) || {};
    const ls = flat();
    const banks = new Set(bankNumbers().concat(extraBanks || []));
    p.lectures = {}; p.handouts = {};
    ls.forEach((l) => { if (l.number > 0) { p.lectures[String(l.number)] = l.title; if (l.handout) p.handouts[String(l.number)] = l.handout; } });
    p.practice = ls.filter((l) => l.number > 0 && banks.has(l.number) && l.status !== "soon").map((l) => l.number);
    p.settings = p.settings || { showMyResults: true, allowRememberId: true };
    if (!p.currentWeek) p.currentWeek = 1;
    return p;
  }

  function saveLectures(d) { writeJson(path.join(DIR, "data", "lectures.json"), d); syncWeeks(); }
  // The live quiz weeks follow the lectures, so a quiz can be run for every lecture that has a bank.
  function syncWeeks() {
    const lq = read("apps_script/live_quizzes.json", { weeks: {} }) || { weeks: {} };
    lq.weeks = lq.weeks || {};
    const banks = new Set(bankNumbers());
    flat().forEach((l) => { if (l.number > 0 && banks.has(l.number)) lq.weeks[String(l.number)] = l.title; });
    writeJson(path.join(DIR, "apps_script", "live_quizzes.json"), lq);
  }

  function lectures() { return flat().map((l) => Object.assign({}, l, { bank: bankNumbers().includes(l.number) })); }

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

  // ---------- course packs ----------
  async function importPack(file) {
    const zip = await JSZip.loadAsync(fs.readFileSync(file));
    const cj = zip.file("course.json");
    if (!cj) throw new Error("This is not a Class Manager course pack (course.json is missing).");
    const meta = JSON.parse(await cj.async("string"));
    if (meta.format !== "class-manager-course") throw new Error("This is not a Class Manager course pack.");
    const tmp = DIR + ".import"; fs.rmSync(tmp, { recursive: true, force: true }); fs.mkdirSync(tmp, { recursive: true });
    const names = Object.keys(zip.files).filter((n) => n.startsWith("files/") && !zip.files[n].dir);
    for (const n of names) {
      const rel = n.slice(6);
      if (!rel || /(^|\/)\.\.(\/|$)/.test(rel) || path.isAbsolute(rel)) continue;
      const out = path.join(tmp, rel);
      if (!inside(tmp, out)) continue;
      fs.mkdirSync(path.dirname(out), { recursive: true });
      fs.writeFileSync(out, await zip.files[n].async("nodebuffer"));
    }
    const old = DIR + ".previous";
    fs.rmSync(old, { recursive: true, force: true });
    if (fs.existsSync(DIR)) fs.renameSync(DIR, old); // kept until the next import, in case it is needed again
    fs.renameSync(tmp, DIR);
    return { settings: meta.settings || {}, name: meta.name || "", files: names.length };
  }
  async function exportPack(file, settings) {
    const zip = new JSZip();
    const s = Object.assign({}, settings); delete s.scriptUrl; delete s.port; delete s.setupSeen;
    zip.file("course.json", JSON.stringify({ format: "class-manager-course", version: 1, name: [s.courseCode, s.courseTitle].filter(Boolean).join(" "), settings: s }, null, 1));
    const walk = (dir, pre) => { let list = []; try { list = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return; }
      list.forEach((e) => { const f = path.join(dir, e.name); if (e.isDirectory()) walk(f, pre + e.name + "/"); else zip.file("files/" + pre + e.name, fs.readFileSync(f)); }); };
    walk(DIR, "");
    fs.writeFileSync(file, await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }));
    return file;
  }
  function hasContent() { return flat().length > 0 || bankNumbers().length > 0; }
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

  return { resolve, page, portal, bankNumbers, lectures, saveLecture, removeLecture, addLectureFile, removeLectureFile, setCourseInfo, importPack, exportPack, hasContent, setLogo, syncWeeks, KINDS };
}

module.exports = { createCourse };
