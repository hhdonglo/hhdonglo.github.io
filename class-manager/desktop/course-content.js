/* Course material reads, with fallback to the bundled site. */
"use strict";
const fs = require("fs");
const path = require("path");

function inside(root, full) { const r = path.normalize(root + path.sep); return path.normalize(full).startsWith(r); }
function readJson(f, d) { try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch (e) { return d; } }

function createCourseContent(DIR, WEB, TPL) {
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

  // Diagnostic bank numbers (quizzes/lectureN_concept.json): short concept checks, kept apart from the exercises.
  function conceptNumbers() {
    const out = new Set();
    for (const root of [DIR, WEB]) {
      try { fs.readdirSync(path.join(root, "quizzes")).forEach((f) => { const m = f.match(/^lecture(\d+)_concept\.json$/); if (m) out.add(Number(m[1])); }); } catch (e) { /* none */ }
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

  function lectures() { return flat().map((l) => Object.assign({}, l, { bank: bankNumbers().includes(l.number) })); }
  function practicePages() {
    const entries = lecturesDoc().groups.flatMap(group => Array.isArray(group?.lectures) ? group.lectures : []);
    return [...new Set(entries.map(lecture => String(lecture?.practice_page || "").split(/[?#]/)[0].replace(/^\.\//, ""))
      .filter(page => /^(?:[\w.-]+\/)*[\w.-]+\.html$/.test(page) && !page.split("/").some(part => part === "." || part === "..")))];
  }
  function hasContent() { return flat().length > 0 || bankNumbers().length > 0; }

  return { resolve, read, page, bankNumbers, conceptNumbers, lecturesDoc, flat, portal, lectures, practicePages, hasContent };
}

module.exports = { createCourseContent, inside };
