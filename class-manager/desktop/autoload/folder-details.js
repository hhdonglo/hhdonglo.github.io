// Reads the outline and information files of a course folder and suggests the course details (code, title, term, lecturer, institution...).
// Used when a folder is linked to a course: CM fills the blank boxes and shows what it found and in which file; the lecturer corrects and saves.
// Only reads. Reads at most 12 small files, outline-like names first. The finding itself is course-details.js (pure).
"use strict";
const fs = require("fs");
const path = require("path");
const { listFiles } = require("./scan");
const { readAny } = require("./read-file");
const { findDetails, FIELDS } = require("./course-details");

const LIKELY = /outline|syllabus|course|overview|info|readme|schedule|plan|handbook|module/i;
const STRONG = /outline|syllabus|course.?design|course.?description|handbook/i; // a document named like this is read before anything else
const STUDENT_DATA = /grade|mark|score|attendance|response|roster|class.?list|quiz|backup|removed|group_?[a-z]\b/i; // records about students say nothing about the course
const DOCS = new Set([".docx", ".pdf", ".md", ".markdown", ".txt", ".text"]);
const MAX_FILES = 12, MAX_BYTES = 8 * 1000 * 1000;

const hintsOf = (r) => {
  const rows = [];
  (r.sheets || []).slice(0, 6).forEach((sh) => (sh.rows || []).slice(0, 30).forEach((row) => rows.push(row.slice(0, 12).map((v) => (v instanceof Date ? v : String(v == null ? "" : v).slice(0, 160))))));
  return { rows: rows.slice(0, 120), text: String(r.text || "").slice(0, 60000) };
};

// A course pack made by CM carries its own details: course.json (settings) and data/portal.json (class times, current week, lecture titles).
// Found by name within four levels; read as data, never run. -> { fields: { key: { value, from } }, topics: [{ week, title, from }] }
function structured(root) {
  const out = { fields: {}, topics: [] }, found = {};
  (function walk(dir, depth) {
    let ents; try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return; }
    for (const e of ents) {
      if (e.name.startsWith(".") || e.isSymbolicLink()) continue;
      const full = path.join(dir, e.name);
      if (e.isFile() && (e.name === "course.json" || e.name === "portal.json") && !found[e.name]) found[e.name] = full;
      else if (e.isDirectory() && depth < 4 && !/^(node_modules|\.git)$/.test(e.name)) walk(full, depth + 1);
    }
  })(root, 0);
  const read = (f) => { try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch (e) { return null; } };
  const set = (k, v, from) => { const t = String(v == null ? "" : v).trim(); if (t && !out.fields[k]) out.fields[k] = { value: t, from: path.relative(root, from) }; };
  if (found["course.json"]) { const c = read(found["course.json"]); const st = c && c.format === "class-manager-course" && c.settings;
    if (st) { set("code", st.courseCode, found["course.json"]); set("title", st.courseTitle, found["course.json"]); set("lecturer", st.lecturer, found["course.json"]); set("institution", st.institution, found["course.json"]);
      set("semester", st.semester, found["course.json"]); set("contact", st.contact, found["course.json"]); set("start", st.startDate, found["course.json"]); set("end", st.endDate, found["course.json"]); } }
  if (found["portal.json"]) { const p = read(found["portal.json"]);
    if (p) { set("times", p.contacts, found["portal.json"]); if (Number(p.currentWeek) >= 1 && Number(p.currentWeek) <= 52) set("week", Number(p.currentWeek), found["portal.json"]);
      Object.keys(p.lectures || {}).forEach((k) => { if (Number(k) >= 1 && String(p.lectures[k]).trim()) out.topics.push({ week: Number(k), title: String(p.lectures[k]).trim(), from: path.relative(root, found["portal.json"]) }); }); } }
  return out;
}

// -> { ok, read: [file names], fields: [{ key, label, setting, value, from }], topics, missing: [labels the files do not give] }
async function detailsOfFolder(root, now) {
  const listed = await listFiles(root);
  // The file name decides, not the folder it sits in (a pack folder called "...-course-pack" would make every file look like an outline).
  const rank = (f) => { const b = path.basename(f.rel), d = f.rel.split(/[\\/]/).length;
    return (STRONG.test(b) && DOCS.has(f.ext) ? 0 : LIKELY.test(b) && DOCS.has(f.ext) ? 10 : DOCS.has(f.ext) ? 20 : 30) + d; };
  const pick = listed.files.filter((f) => f.size <= MAX_BYTES && !STUDENT_DATA.test(path.basename(f.rel))).sort((a, b) => rank(a) - rank(b) || a.rel.localeCompare(b.rel)).slice(0, MAX_FILES);
  const items = [];
  for (const f of pick) { try { const h = hintsOf(await readAny(f.path)); if (h.text || h.rows.length) items.push({ file: f.rel, rows: h.rows, text: h.text }); } catch (e) { /* a file that cannot be read is skipped */ } }
  const found = findDetails(items, now || new Date()), st = structured(root);
  const best = (k) => st.fields[k] || found[k]; // the pack's own settings first, the outline text for what they lack
  const have = FIELDS.filter((f) => best(f[0])), topics = st.topics.length ? st.topics : (found.topics || []);
  return { ok: true, read: items.map((i) => i.file).concat(Object.keys(st.fields).length ? [...new Set(Object.values(st.fields).map((x) => x.from))] : []),
    fields: have.map((f) => ({ key: f[0], label: f[1], setting: f[2], value: best(f[0]).value, from: best(f[0]).from, worked: !!best(f[0]).worked })), topics,
    missing: FIELDS.filter((f) => !best(f[0])).map((f) => f[1]) };
}

module.exports = { detailsOfFolder };
