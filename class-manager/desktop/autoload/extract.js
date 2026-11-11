// Takes everything useful out of a file's sheets and puts it in one clean shape, whatever the file looked like.
// Only the fields CM needs are kept (ID, names, scores, attendance marks, quiz questions); every other column is left behind.
// The result is the "clean" tables (written to the working file by working.js) and `planBook`, the sheets that the
// existing import (import-plan.js) previews and applies. Pure: reads nothing from disk and writes nothing.
"use strict";
const { detectSheet, blank, text } = require("./detect");
const { idOf, validId, markOf, numOrBlank, splitFull } = require("./values");
const { identify } = require("../import-plan");
const IV = require("../import-values");
const { NAME_TABS } = require("../import-specs"); // the web tabs whose names are the lecturer's own (not typed by students)

const emptyClean = () => ({ classList: [], results: [], attempts: [], attendance: { sessions: [], rows: [] }, questions: [] });
const colsOf = (d) => Object.keys(d.cols).map((f) => ({ field: f, heading: d.cols[f].heading, by: d.cols[f].by })).concat(d.sessions.length ? [{ field: "sessions", heading: d.sessions.length + " session columns", by: "heading" }] : [], d.quizCols.length ? [{ field: "quizzes", heading: d.quizCols.map((q) => q.label).join(", "), by: "heading" }] : []);
const cell = (r, d, f) => (d.cols[f] ? r[d.cols[f].col] : undefined);
const bodyOf = (rows, d) => rows.filter((r) => Array.isArray(r) && r.some((c) => !blank(c) && text(c) !== "")).slice(d.header + 1);
const sessionLabel = (h) => IV.sessionOf(h);

// ---------- one kind of sheet at a time ----------

function names(rows, d, into) { // ID and name pairs, whatever else the sheet holds
  const seen = { ids: 0, bad: 0 };
  bodyOf(rows, d).forEach((r) => {
    const id = idOf(cell(r, d, "id")); if (!id) return;
    if (!validId(id)) { seen.bad++; return; }
    seen.ids++;
    let first = text(cell(r, d, "first")), last = text(cell(r, d, "last"));
    if (!first && !last) [first, last] = splitFull(cell(r, d, "full"));
    const cur = into.get(id);
    if (!cur) into.set(id, { first, last });
    else if (!cur.first && !cur.last && (first || last)) into.set(id, { first, last });
  });
  return seen;
}

function scores(rows, d, quizName, out) {
  let kept = 0;
  bodyOf(rows, d).forEach((r) => {
    const id = idOf(cell(r, d, "id")); if (!validId(id)) return;
    const when = blank(cell(r, d, "date")) ? "" : cell(r, d, "date");
    if (d.cols.score) {
      const v = numOrBlank(cell(r, d, "score")); if (v === "") return;
      const quiz = text(cell(r, d, "quiz")) || quizName;
      out.push([id, quiz, v, numOrBlank(cell(r, d, "out")), when]); kept++;
    } else d.quizCols.forEach((q) => { const v = numOrBlank(r[q.col]); if (v !== "") { out.push([id, q.label, v, "", when]); kept++; } });
  });
  return kept;
}

function attendance(rows, d, into) {
  let kept = 0;
  bodyOf(rows, d).forEach((r) => {
    const id = idOf(cell(r, d, "id")); if (!validId(id)) return;
    d.sessions.forEach((s) => {
      const m = markOf(r[s.col]); if (m === "") return;
      const label = sessionLabel(s.label);
      if (into.sessions.indexOf(label) < 0) into.sessions.push(label);
      const k = id + "|" + label, cur = into.marks.get(k);
      if (cur === undefined || (m === 1 && cur === 0)) { into.marks.set(k, m); kept++; }
      into.ids.add(id);
    });
  });
  return kept;
}

// A quiz bank in a table, written as the question template (app/question-template.md) so the one parser reads every quiz bank.
function questionsText(rows, d) {
  const L = "ABCDE", keys = ["optA", "optB", "optC", "optD", "optE"], blocks = [];
  bodyOf(rows, d).forEach((r) => {
    const q = text(cell(r, d, "question")); if (!q) return;
    const o = keys.map((k) => text(cell(r, d, k)));
    let s = "Q" + (blocks.length + 1) + ". " + q + "\n";
    o.forEach((t, i) => { if (t) s += L[i] + ") " + t + "\n"; });
    const a = text(cell(r, d, "answer")); if (a) s += "Answer: " + a + "\n";
    ["exp:Explanation", "lecture:Lecture", "difficulty:Difficulty", "type:Type"].forEach((p) => { const [f, label] = p.split(":"), v = text(cell(r, d, f)); if (v) s += label + ": " + v + "\n"; });
    blocks.push(s);
  });
  return blocks;
}

// ---------- a web export's own tabs ----------

function fromWebTab(sh, spec, clean, notes) {
  const rows = sh.rows.slice(1).filter((r) => r.some((c) => !blank(c) && text(c) !== ""));
  if (spec.name === "Form Responses 1") rows.forEach((r) => { const id = idOf(r[2]); if (validId(id) && !blank(r[9])) clean.results.push([id, IV.codeOf(r[3]), numOrBlank(r[9]), numOrBlank(r[11]), r[0] || ""]); });
  else if (spec.name === "Attempts") rows.forEach((r) => { const id = idOf(r[1]); if (validId(id)) clean.attempts.push([r[0] || "", id, text(r[2]), numOrBlank(r[3]), numOrBlank(r[4]), numOrBlank(r[5])]); });
  notes.push(rows.length + " rows");
  return rows.length;
}

// ---------- the whole file ----------

// book: [{ name, rows }]. label: the file's name (used as the quiz name when a score file does not say).
function extractBook(book, label) {
  const clean = emptyClean(), sheets = [], nameMap = new Map(), rosterIds = new Set(), att = { sessions: [], marks: new Map(), ids: new Set() };
  const quizName = text(label).replace(/\.[^.]+$/, "") || "Quiz";
  let web = false, questionBlocks = [];

  (book || []).forEach((sh) => {
    if (!sh || !Array.isArray(sh.rows)) return;
    const rec = { name: sh.name, role: "", status: "ignored", note: "", columns: [], rowsIn: Math.max(0, sh.rows.length - 1), rowsKept: 0 };
    sheets.push(rec);
    if (!sh.rows.length) { rec.note = "empty"; return; }
    const known = identify(sh, book.length === 1);
    if (known.kind === "log") {
      web = true; rec.status = "used"; const notes = [];
      rec.rowsKept = fromWebTab(sh, known.spec, clean, notes);
      rec.role = known.spec.label;
      return;
    }
    const d = detectSheet(sh.rows);
    rec.columns = colsOf(d);
    if (known.kind === "skipped") { // derived or private tabs: not imported, but their names can still fill the class list
      rec.note = "not imported (" + known.why + ")";
      if (NAME_TABS.indexOf(sh.name) >= 0 && d.cols.id && (d.cols.full || d.cols.first)) { const n = names(sh.rows, d, nameMap); rec.note += "; " + n.ids + " names used for the class list"; }
      return;
    }
    if (known.kind === "attendance" && d.sessions.length) { web = true; d.kind = "attendance"; }
    if (d.kind === "roster" && d.cols.id) {
      const n = names(sh.rows, d, nameMap); bodyOf(sh.rows, d).forEach((r) => { const id = idOf(cell(r, d, "id")); if (validId(id)) rosterIds.add(id); });
      rec.role = "Class list"; rec.status = "used"; rec.rowsKept = n.ids; if (n.bad) rec.note = n.bad + " rows without a valid ID left out";
    } else if (d.kind === "scores") {
      rec.role = "Quiz scores"; rec.status = "used"; rec.rowsKept = scores(sh.rows, d, text(sh.name) && book.length > 1 ? text(sh.name) : quizName, clean.results);
      if (d.cols.id && (d.cols.full || d.cols.first)) names(sh.rows, d, nameMap);
    } else if (d.kind === "attendance") {
      rec.role = "Attendance"; rec.status = "used"; rec.rowsKept = attendance(sh.rows, d, att);
      if (d.cols.id && (d.cols.full || d.cols.first)) names(sh.rows, d, nameMap);
    } else if (d.kind === "questions") {
      const b = questionsText(sh.rows, d); questionBlocks = questionBlocks.concat(b);
      rec.role = "Quiz questions"; rec.status = "used"; rec.rowsKept = b.length;
    } else rec.note = d.missing.length ? "not recognised: no " + d.missing.join(", ") + ". Columns found: " + (d.headings.join(", ") || "none") : "not recognised";
    d.notes.forEach((n) => { rec.note = (rec.note ? rec.note + ". " : "") + n; });
  });

  // The clean class list: the IDs of every class list found; if there is none, every ID that has names or records.
  const ids = rosterIds.size ? [...rosterIds] : [...nameMap.keys()];
  clean.classList = ids.sort().map((id) => { const n = nameMap.get(id) || { first: "", last: "" }; return [id, n.first, n.last]; });
  const seen = new Set();
  clean.results = clean.results.filter((r) => { const k = r.join("|"); if (seen.has(k)) return false; seen.add(k); return true; });
  clean.attendance.sessions = att.sessions;
  clean.attendance.rows = [...att.ids].sort().map((id) => [id].concat(att.sessions.map((s) => (att.marks.has(id + "|" + s) ? att.marks.get(id + "|" + s) : ""))));
  clean.questions = questionBlocks;
  return { web, clean, sheets, summary: summaryOf(clean) };
}

function summaryOf(c) {
  return { students: c.classList.length, withNames: c.classList.filter((r) => r[1] || r[2]).length, results: c.results.length, attempts: c.attempts.length,
    sessions: c.attendance.sessions.length, marks: c.attendance.rows.reduce((n, r) => n + r.slice(1).filter((x) => x !== "").length, 0), questions: c.questions.length };
}

// The sheets the existing import previews and applies: the web export's own tabs as they are, or tables made from the clean data.
function planBookOf(book, ex) {
  if (ex.web) return book;
  const c = ex.clean, out = [];
  if (c.classList.length) out.push({ name: "Roster", rows: [["Student ID", "First name", "Last name"]].concat(c.classList) });
  if (c.results.length) out.push({ name: "Quiz scores", rows: [["Student ID", "Quiz", "Score", "Out of", "Date"]].concat(c.results) });
  if (c.attendance.rows.length) out.push({ name: "Attendance", rows: [["Student ID"].concat(c.attendance.sessions)].concat(c.attendance.rows) });
  return out;
}

module.exports = { extractBook, planBookOf, summaryOf, emptyClean };
