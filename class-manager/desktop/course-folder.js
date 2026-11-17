// Finds the course content inside a folder the lecturer chose, whatever the layout, and counts what is there. Read only.
// A course folder holds data/lectures.json, quizzes/lectureN.json and the lecture files. A course pack wraps that as
// <pack>/course.json plus <pack>/files/..., and may itself sit one folder below the chosen folder.
"use strict";
const fs = require("fs");
const path = require("path");

const isDir = (p) => { try { return fs.statSync(p).isDirectory(); } catch (e) { return false; } };
const isFile = (p) => { try { return fs.statSync(p).isFile(); } catch (e) { return false; } };
const hasContent = (d) => isFile(path.join(d, "data", "lectures.json")) || isDir(path.join(d, "quizzes"));
const subdirs = (d) => { try { return fs.readdirSync(d, { withFileTypes: true }).filter((e) => e.isDirectory() && !e.name.startsWith(".") && !e.isSymbolicLink()).map((e) => path.join(d, e.name)).sort(); } catch (e) { return []; } };

// The folder that holds the course content: the chosen folder itself, or the files/ folder of a pack found up to two levels below it.
function contentRoot(folder) {
  if (hasContent(folder)) return folder;
  const packs = [folder, ...subdirs(folder)].concat(subdirs(folder).flatMap(subdirs));
  for (const p of packs) if (isFile(path.join(p, "course.json")) && hasContent(path.join(p, "files"))) return path.join(p, "files");
  return folder;
}

// What the content holds: lectures, banks, questions, and any lecture file named in lectures.json that is not on disk.
function summary(folder) {
  const root = contentRoot(folder), out = { root, lectures: 0, banks: 0, questions: 0, files: 0, missing: [], noBank: [] };
  let doc = null; try { doc = JSON.parse(fs.readFileSync(path.join(root, "data", "lectures.json"), "utf8")); } catch (e) { /* none */ }
  const banks = new Set();
  try { fs.readdirSync(path.join(root, "quizzes")).forEach((f) => { const m = f.match(/^lecture(\d+)\.json$/); if (!m) return; banks.add(Number(m[1])); out.banks++; try { out.questions += (JSON.parse(fs.readFileSync(path.join(root, "quizzes", f), "utf8")).questions || []).length; } catch (e) { /* counted by the bank check */ } }); } catch (e) { /* none */ }
  ((doc && doc.groups) || []).forEach((g) => (g.lectures || []).forEach((l) => {
    out.lectures++;
    if (l.number > 0 && !banks.has(l.number)) out.noBank.push(l.number);
    ["slides", "handout", "tutorial", "supplement", "reference"].forEach((k) => { if (!l[k]) return; if (isFile(path.join(root, l[k]))) out.files++; else out.missing.push({ lecture: l.number, kind: k, file: l[k] }); });
  }));
  return out;
}

module.exports = { contentRoot, summary };
