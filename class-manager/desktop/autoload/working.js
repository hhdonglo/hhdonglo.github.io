// The working file: the useful data of the chosen source files, merged and written clean to the app's own folder.
// Class list (ID, first name, last name), quiz results, practice attempts, attendance and quiz questions. Written as one
// Excel workbook (the file that can be exported) and as one CSV per table. The originals are never opened for writing.
"use strict";
const fs = require("fs");
const path = require("path");
const { emptyClean, summaryOf } = require("./extract");
const { writeXlsx } = require("../excel");

// ---------- merge ----------

// Merges the clean data of several files. A name is taken from the first file that has one; marks of 1 win over 0; duplicate rows are dropped.
function mergeCleans(cleans) {
  const out = emptyClean(), people = new Map(), marks = new Map(), sessions = [], ids = new Set(), seen = new Set(), seenA = new Set();
  cleans.forEach((c) => {
    if (!c) return;
    c.classList.forEach(([id, first, last]) => { const cur = people.get(id); if (!cur || (!cur[0] && !cur[1] && (first || last))) people.set(id, [first, last]); });
    c.results.forEach((r) => { const k = r.join("|"); if (!seen.has(k)) { seen.add(k); out.results.push(r); } });
    c.attempts.forEach((r) => { const k = r.join("|"); if (!seenA.has(k)) { seenA.add(k); out.attempts.push(r); } });
    c.attendance.sessions.forEach((s) => { if (sessions.indexOf(s) < 0) sessions.push(s); });
    c.attendance.rows.forEach((r) => { ids.add(r[0]); c.attendance.sessions.forEach((s, i) => { const m = r[i + 1]; if (m === "") return; const k = r[0] + "|" + s; if (marks.get(k) === undefined || (m === 1 && marks.get(k) === 0)) marks.set(k, m); }); });
    out.questions = out.questions.concat(c.questions);
  });
  out.classList = [...people.keys()].sort().map((id) => [id].concat(people.get(id)));
  out.attendance.sessions = sessions;
  out.attendance.rows = [...ids].sort().map((id) => [id].concat(sessions.map((s) => (marks.has(id + "|" + s) ? marks.get(id + "|" + s) : ""))));
  return out;
}

// ---------- write ----------

const HEAD = { classList: ["Student ID", "First name", "Last name"], results: ["Student ID", "Quiz", "Score", "Out of", "Date"], attempts: ["Timestamp", "Student ID", "Quiz", "Attempt", "Score", "Total"] };

// A text cell that starts with = + - @ would be run as a formula by a spreadsheet; it is written as text.
const safe = (v) => (typeof v === "string" && /^[=+\-@]/.test(v) ? "'" + v : v);
const dateText = (v) => (Object.prototype.toString.call(v) === "[object Date]" ? v.getFullYear() + "-" + ("0" + (v.getMonth() + 1)).slice(-2) + "-" + ("0" + v.getDate()).slice(-2) + " " + ("0" + v.getHours()).slice(-2) + ":" + ("0" + v.getMinutes()).slice(-2) : v);
function csv(rows) {
  return "﻿" + rows.map((r) => r.map((v) => { const s = String(safe(dateText(v) === undefined || dateText(v) === null ? "" : dateText(v))); return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }).join(",")).join("\r\n") + "\r\n";
}

// The tables of the working file, as sheets (only those that have data).
function tablesOf(c) {
  const t = [];
  if (c.classList.length) t.push({ name: "Class list", file: "class-list.csv", rows: [HEAD.classList].concat(c.classList) });
  if (c.results.length) t.push({ name: "Quiz results", file: "quiz-results.csv", rows: [HEAD.results].concat(c.results) });
  if (c.attempts.length) t.push({ name: "Practice attempts", file: "practice-attempts.csv", rows: [HEAD.attempts].concat(c.attempts) });
  if (c.attendance.rows.length) t.push({ name: "Attendance", file: "attendance.csv", rows: [["Student ID"].concat(c.attendance.sessions)].concat(c.attendance.rows) });
  return t;
}

function atomic(f, data) { const t = f + ".tmp"; fs.writeFileSync(t, data); fs.renameSync(t, f); }

// Writes the working file and its tables into dir. `sources` is the list of files used (names only, shown in the Read me tab).
async function writeWorking(dir, clean, sources) {
  fs.mkdirSync(dir, { recursive: true });
  const tables = tablesOf(clean), summary = summaryOf(clean);
  tables.forEach((t) => atomic(path.join(dir, t.file), csv(t.rows)));
  const qfile = path.join(dir, "quiz-questions.txt");
  if (clean.questions.length) atomic(qfile, clean.questions.join("\n\n")); else try { fs.unlinkSync(qfile); } catch (e) { /* none */ }
  ["class-list.csv", "quiz-results.csv", "practice-attempts.csv", "attendance.csv"].forEach((n) => { if (!tables.some((t) => t.file === n)) try { fs.unlinkSync(path.join(dir, n)); } catch (e) { /* none */ } });
  const about = [["Class Manager working file"], ["Made by Class Manager from the files you chose. Your original files are never changed."],
    ["Only the useful fields are kept: student ID, names, scores, attendance marks and quiz questions. Other columns are left out."], [""], ["Made from"]].concat(sources.map((s) => [s]));
  const xlsx = path.join(dir, "working-file.xlsx");
  atomic(xlsx, await writeXlsx(tables.map((t) => ({ name: t.name, rows: t.rows })).concat([{ name: "Read me", rows: about }])));
  fs.writeFileSync(path.join(dir, "README.txt"), "Class Manager made these files from the files you chose. Your own files were only read and have not been changed.\r\nworking-file.xlsx holds every table; the .csv files are the same tables one by one. They contain student data: keep this folder private and out of any repository.\r\n");
  return { dir, xlsx, tables: tables.map((t) => ({ name: t.name, rows: t.rows.length - 1, file: t.file })), questions: clean.questions.length, summary };
}

module.exports = { mergeCleans, writeWorking, tablesOf, csv };
