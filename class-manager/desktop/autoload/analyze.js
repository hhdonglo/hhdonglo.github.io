// Looks at one file and says what useful data it holds: reads it (read-file.js), finds the class list, scores, attendance
// and quiz questions in it (extract.js), and keeps only that. The file itself is only read. Returns plain data that can be
// stored (store.js) and merged with other files (working.js).
"use strict";
const fs = require("fs");
const path = require("path");
const { readAny } = require("./read-file");
const { extractBook, summaryOf } = require("./extract");

const KIND_WORDS = (s) => [s.students && "class list", (s.results || s.attempts) && "quiz results", s.marks && "attendance", s.questions && "quiz questions"].filter(Boolean);

// Free text (a Word or text file, a PDF) that holds questions in the question template. Returns the question text blocks.
function questionsInText(txt) {
  if (!txt || txt.length < 20) return [];
  const { parseQuestions } = require("../authoring");
  const items = parseQuestions(txt, {});
  return items.filter((q) => q.q && q.options.length >= 2).length ? [txt] : [];
}

// The first rows of each sheet and the start of the text, kept small. Only the text of cells, never a whole file.
function hintsOf(r) {
  const rows = [];
  (r.sheets || []).slice(0, 6).forEach((sh) => (sh.rows || []).slice(0, 30).forEach((row) => rows.push(row.slice(0, 12).map((v) => (v instanceof Date ? v : String(v == null ? "" : v).slice(0, 160))))));
  return { rows: rows.slice(0, 120), text: String(r.text || "").slice(0, 4000) };
}

async function analyzeFile(file, root, onProgress) {
  const st = fs.statSync(file);
  const out = { path: file, rel: path.relative(root || path.dirname(file), file), name: path.basename(file), ext: path.extname(file).toLowerCase(), size: st.size, mtimeMs: st.mtimeMs,
    ok: true, error: "", useful: false, web: false, sheets: [], summary: null, kinds: [], clean: null, why: "" };
  try {
    const r = await readAny(file, onProgress);
    const ex = extractBook(r.sheets, out.name);
    const fromText = questionsInText(r.text);
    ex.clean.questions = ex.clean.questions.concat(fromText);
    if (fromText.length) ex.sheets.push({ name: "(text)", role: "Quiz questions", status: "used", note: "", columns: [], rowsIn: 0, rowsKept: 1 });
    out.hints = hintsOf(r); // the top of each sheet and the start of a document, for finding course details (course-details.js)
    out.web = ex.web; out.sheets = ex.sheets; out.clean = ex.clean; out.summary = summaryOf(ex.clean);
    out.kinds = KIND_WORDS(out.summary);
    out.truncated = !!r.truncated;
    out.useful = out.kinds.length > 0 || ex.web;
    if (!out.useful) {
      const heads = ex.sheets.filter((s) => s.note).map((s) => (s.name ? s.name + ": " : "") + s.note).slice(0, 3);
      out.why = "No class list, scores, attendance or quiz questions were found. " + (heads.join(" ") || "The file has no table with a student ID column and no questions in the question layout.");
    }
  } catch (err) { out.ok = false; out.error = err.message; }
  return out;
}

module.exports = { analyzeFile, questionsInText };
