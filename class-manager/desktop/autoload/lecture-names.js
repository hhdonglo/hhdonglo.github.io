// Finds the lecture numbers in the file and folder names of a course folder, whatever style they are written in, and groups the files by lecture.
// One responsibility: names in, a list of lectures 1 to N out (with files, kinds and gaps). Pure: no file access (autoload/scan.js lists the files).
// Styles: lecture1, Lecture_01, L1, Lec 2, Lt3, week3, "Lecture 4 - Title", session5, topic6, ch7, a number first ("08 Waves.pdf") and the same words in folder names.
"use strict";

const MAX = 60;
const STRONG = /(?<![a-z])(?:lectures?|lecs?|lects?|lt|l)[\s_.\-]*0*(\d{1,2})(?![a-z0-9])/i;      // lecture words first
const WEAK = /(?<![a-z])(?:weeks?|wk|sessions?|topics?|chapters?|ch|units?|modules?)[\s_.\-]*0*(\d{1,2})(?![a-z0-9])/i;
const LEADING = /^0*(\d{1,2})(?![0-9])[\s_.\-)\]]+(?=[a-z])/i;                                       // "08 Waves", "3_Title"
const STUDENT = /roster|class.?list|attendance|grade|marks?|scores?|responses?|backup|removed|timetable|syllabus|outline/i;
const KINDS = [["bank", /quiz|bank|questions?|\.json$/i], ["tutorial", /tutorial|tut\b|exercise|problem|worksheet|practice/i], ["handout", /handout|notes?\b/i], ["slides", /slides?|\.pptx?$|\.key$|presentation/i], ["reference", /reference|supplement/i]];

const base = (n) => n.replace(/\.[^.]+$/, "");
function numberIn(text) {
  const t = String(text || "");
  let m = STRONG.exec(t) || WEAK.exec(t);
  return m ? Number(m[1]) : null;
}
function kindOf(rel) { const n = rel.split(/[\\/]/).pop(); for (const [k, re] of KINDS) if (re.test(n)) return k; return "file"; }

// The lecture number of one file: its own name first, then its folders from the nearest outwards. null when none says.
function lectureOf(rel) {
  const parts = String(rel).split(/[\\/]/).filter(Boolean);
  if (!parts.length || STUDENT.test(parts[parts.length - 1])) return null;
  const file = base(parts[parts.length - 1]), dirs = parts.slice(0, -1).reverse();
  let n = numberIn(file);
  if (n == null) for (const d of dirs) { n = numberIn(d); if (n != null) break; }
  if (n == null) n = LEADING.test(file) ? Number(LEADING.exec(file)[1]) : null;
  if (n == null) for (const d of dirs) { if (LEADING.test(d + " ")) { n = Number(LEADING.exec(d + " ")[1]); break; } }
  return n != null && n >= 1 && n <= MAX ? n : null;
}

// files: [{ rel }] or relative paths. -> { lectures: [{ number, files: [rel], count, kinds: { slides: n, ... } }], gaps: [numbers], last, total, unplaced: n }
function detect(files) {
  const by = {}; let unplaced = 0;
  (files || []).forEach((f) => {
    const rel = typeof f === "string" ? f : f.rel, n = lectureOf(rel);
    if (n == null) { unplaced++; return; }
    const e = by[n] || (by[n] = { number: n, files: [], kinds: {} });
    e.files.push(rel); const k = kindOf(rel); e.kinds[k] = (e.kinds[k] || 0) + 1;
  });
  const lectures = Object.keys(by).map(Number).sort((a, b) => a - b).map((n) => Object.assign(by[n], { count: by[n].files.length }));
  const last = lectures.length ? lectures[lectures.length - 1].number : 0, have = new Set(lectures.map((l) => l.number)), gaps = [];
  for (let i = 1; i <= last; i++) if (!have.has(i)) gaps.push(i);
  return { lectures, gaps, last, total: lectures.length, unplaced };
}

module.exports = { detect, lectureOf };
