// Course material from a folder: find the quiz banks in the lecturer's folder, check them, and load them into the course. Read only on the folder.
"use strict";
const fs = require("fs");
const path = require("path");
const { parseBank, mergeBank, FILE } = require("./quiz-bank");
const { summary } = require("../course-folder");

const MAX_BYTES = 5 * 1024 * 1024;

// quiz files directly in the folder, in its quizzes/ folder, one level below (for example a repository checkout), or inside a course pack (<pack>/files/quizzes).
function find(folder) {
  const out = [];
  const look = (dir, depth) => {
    let names; try { names = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return; }
    names.forEach((d) => {
      if (d.name.startsWith(".") || d.isSymbolicLink()) return;
      const full = path.join(dir, d.name);
      if (d.isFile() && FILE.test(d.name)) out.push(full);
      else if (d.isDirectory() && !/^(node_modules|working)$/.test(d.name) && (depth < 2 || (depth < 5 && /^(files|quizzes|.*course-pack)$/i.test(d.name)))) look(full, depth + 1); // a course pack keeps its banks at <pack>/files/quizzes
    });
  };
  look(folder, 0);
  return out.sort();
}

// What the folder holds and what loading would do. Nothing is written.
function plan(folder, courseDir) {
  const files = find(folder).map((f) => {
    let raw = ""; const rel = path.relative(folder, f);
    try { if (fs.statSync(f).size > MAX_BYTES) return { ok: false, file: rel, problems: ["The file is larger than 5 MB."] }; raw = fs.readFileSync(f, "utf8"); } catch (e) { return { ok: false, file: rel, problems: ["Cannot be read: " + e.message] }; }
    const p = parseBank(path.basename(f), raw); p.file = rel; p.abs = f; return p;
  });
  files.forEach((p) => {
    if (!p.ok) return;
    const target = path.join(courseDir, "quizzes", path.basename(p.abs).toLowerCase());
    let existing = null; try { existing = JSON.parse(fs.readFileSync(target, "utf8")); } catch (e) { /* none yet */ }
    const m = mergeBank(existing, p.doc); p.add = m.added; p.same = m.same; p.differing = m.differing; p.isNew = !existing;
  });
  const dup = new Map();
  files.filter((p) => p.ok).forEach((p) => { const k = path.basename(p.abs).toLowerCase(); (dup.get(k) || dup.set(k, []).get(k)).push(p); });
  dup.forEach((l, k) => { if (l.length > 1) l.forEach((p) => { p.ok = false; p.problems = ["Another file in the folder is also called " + k + "; only one can be loaded."]; }); });
  return { folder, files: files.map(({ doc, abs, ...rest }) => rest), loadable: files.filter((p) => p.ok).length, content: summary(folder) };
}

// Writes each loadable bank into the course folder (add only), then makes sure each lecture exists. `course` is desktop/course.js.
function load(folder, courseDir, course) {
  const result = { loaded: [], skipped: [] };
  find(folder).forEach((f) => {
    const rel = path.relative(folder, f);
    let raw; try { raw = fs.readFileSync(f, "utf8"); } catch (e) { result.skipped.push({ file: rel, why: e.message }); return; }
    const p = parseBank(path.basename(f), raw);
    if (!p.ok) { result.skipped.push({ file: rel, why: p.problems[0] }); return; }
    const target = path.join(courseDir, "quizzes", path.basename(f).toLowerCase());
    let existing = null; try { existing = JSON.parse(fs.readFileSync(target, "utf8")); } catch (e) { /* none yet */ }
    const m = mergeBank(existing, p.doc);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    const tmp = target + ".tmp"; fs.writeFileSync(tmp, JSON.stringify(m.doc, null, 1)); fs.renameSync(tmp, target);
    if (!p.concept && !course.lectures().some((l) => l.number === p.lecture)) course.saveLecture({ number: p.lecture, title: p.title || "Lecture " + p.lecture });
    result.loaded.push({ file: rel, lecture: p.lecture, concept: p.concept, added: m.added, same: m.same, differing: m.differing });
  });
  if (result.loaded.length) course.syncWeeks();
  return result;
}

module.exports = { find, plan, load };
