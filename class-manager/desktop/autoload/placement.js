// Says what each file in a scanned folder is and where its data goes in CM. Pure: no disk, no screen.
// Input: the analyses of analyze.js (as sent to the screen: kinds, summary, web, useful, ok, hints). Output: one row per file.
// The screen (app/folder-placement.js) shows these rows as the single preview of a folder load. Add a destination here, not in the screen.
"use strict";

const n = (v) => Number(v || 0).toLocaleString("en");
const plural = (v, one, many) => n(v) + " " + (v === 1 ? one : many);

// The kind of file, in the lecturer's words. A file that holds several kinds is named by its main one.
function typeOf(a) {
  if (!a.ok) return "Unreadable";
  const s = a.summary || {};
  if (s.marks || s.sessions) return s.results || s.records ? "Mixed attendance and grades" : "Attendance sheet";
  if (s.results || s.attempts) return "Quiz results";
  if (s.records) return "Grades and marks";
  if (s.students) return "Class list";
  if (s.questions) return "Quiz questions";
  if (a.web) return "CM web export";
  if (a.hints && a.hints.text && a.hints.text.length > 40) return "Course outline or notes";
  return "Not recognised";
}

// Where each kind of data in the file goes. Each: { what, where, loads } (loads = true when "Load all" writes it).
function destinationsOf(a) {
  if (!a.ok || !a.useful) return [];
  const s = a.summary || {}, out = [];
  if (a.web && !(s.marks || s.sessions || s.results || s.attempts || s.records)) out.push({ what: "Its own tabs (attendance, quizzes, records)", where: "Attendance and Grades, matched by student ID", loads: true });
  if (s.marks || s.sessions) out.push({ what: plural(s.sessions, "attendance session", "attendance sessions"), where: "Attendance", loads: true });
  if (s.results) out.push({ what: plural(s.results, "quiz result", "quiz results"), where: "Grades: quiz columns", loads: true });
  if (s.attempts) out.push({ what: plural(s.attempts, "practice attempt", "practice attempts"), where: "Grades: practice attempts", loads: true });
  if (s.records) out.push({ what: plural(s.records, "record", "records"), where: "Grades: Records (laboratory, assignment, practice)", loads: true });
  if (s.students) out.push({ what: plural(s.students, "student ID", "student IDs"), where: "Checked against the class list only. Nobody is added.", loads: false });
  if (s.questions) out.push({ what: plural(s.questions, "question set", "question sets"), where: "Review queue on the Author page (you approve each one)", loads: false });
  return out;
}

// One row for each file, plus what the whole folder gives.
function placementOf(files) {
  const rows = (files || []).map((a) => {
    const d = destinationsOf(a);
    return { id: a.id, rel: a.rel, type: typeOf(a), destinations: d, loads: d.some((x) => x.loads), skipped: !a.ok || !a.useful, big: !!a.big,
      note: !a.ok ? (a.error || "The file cannot be read.") : !a.useful ? (a.why || "") : "" };
  });
  const count = (t) => rows.filter((r) => r.type === t).length;
  return { rows, loading: rows.filter((r) => r.loads && !r.big).length, skipped: rows.filter((r) => r.skipped).length,
    attendance: count("Attendance sheet") + count("Mixed attendance and grades"), grades: count("Quiz results") + count("Grades and marks") + count("Mixed attendance and grades") };
}

module.exports = { typeOf, destinationsOf, placementOf };
