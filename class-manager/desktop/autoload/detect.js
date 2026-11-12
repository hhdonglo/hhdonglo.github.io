// Works out what a sheet of cells is: a class list, quiz scores, an attendance record or a quiz bank, and which column holds what.
// Columns are found by their heading (fields.js) and, where the heading says nothing, by what the cells contain. Nothing is
// assumed about order, extra columns or the position of the heading row. Pure; no disk, no Electron.
"use strict";
const { headOf, fieldOfHeading, NOT_AN_ASSESSMENT } = require("./fields");

const blank = (v) => v === undefined || v === null || v === "" || (typeof v === "number" && Number.isNaN(v));
const isDate = (v) => Object.prototype.toString.call(v) === "[object Date]";
const text = (v) => (blank(v) ? "" : String(v).trim());
const SAMPLE = 400; // cells looked at per column; enough to judge a column of any length

// A student ID: 4 to 12 digits, possibly written as 22524013.0 or with spaces.
const idLike = (v) => /^\d{4,12}$/.test(typeof v === "number" ? String(Math.round(v)) : text(v).replace(/\.0+$/, "").replace(/\s+/g, ""));
const nameLike = (v) => { const s = text(v); return s.length >= 2 && s.length <= 80 && /[A-Za-z]/.test(s) && !/\d/.test(s) && !/@/.test(s); };
const numberLike = (v) => !blank(v) && !isDate(v) && text(v) !== "" && Number.isFinite(Number(v));
const fractionOf = (v) => /^\s*\d+(?:\.\d+)?\s*(?:\/|of|out of)\s*[1-9]\d*(?:\.\d+)?\s*$/i.test(text(v)); // 1/5, 1 / 5, 8 of 10 (the same rule as values.js, repeated here to avoid a circular require)
const scoreLike = (v) => numberLike(v) || !!fractionOf(v); // 7, 7.5 or 1/5
const fractionLike = (v) => !!fractionOf(v);
const markLike = (v) => /^(1|0|1\.0|0\.0|p|a|y|n|yes|no|present|absent|true|false|✓|✔)$/i.test(text(v));
const sessionHeading = (h) => isDate(h) || /^\d{1,2}[\/.\-]\d{1,2}([\/.\-]\d{2,4})?$/.test(text(h)) || /^\d{4}-\d{2}-\d{2}/.test(text(h)) || /^(week|session|lecture|day|class)\s*\d+/i.test(text(h));

// The share of the non-blank cells of a column for which test is true.
function share(rows, col, test) {
  let n = 0, k = 0;
  for (let i = 0; i < rows.length && n < SAMPLE; i++) { const v = rows[i][col]; if (blank(v) || text(v) === "") continue; n++; if (test(v)) k++; }
  return n ? k / n : 0;
}
const width = (rows) => rows.reduce((w, r) => Math.max(w, r.length), 0);

// The row that holds the headings: the first of the top rows with the most known headings. -1 if none looks like headings.
function headerRow(rows) {
  let best = -1, bestN = 0;
  for (let i = 0; i < Math.min(rows.length, 12); i++) {
    const n = (rows[i] || []).filter((c) => typeof c === "string" && fieldOfHeading(c, true)).length;
    if (n > bestN) { best = i; bestN = n; }
  }
  if (best >= 0) return best;
  // No known heading: a first row of text over rows that hold numbers is still a heading row.
  const first = rows[0] || [];
  return first.length && first.every((c) => typeof c === "string" && !numberLike(c)) && rows.length > 1 && rows[1].some(numberLike) ? 0 : -1;
}

function detectSheet(rows) {
  rows = (rows || []).filter((r) => Array.isArray(r) && r.some((c) => !blank(c) && text(c) !== ""));
  const out = { kind: "unknown", header: -1, cols: {}, sessions: [], quizCols: [], missing: [], notes: [], rows: 0, headings: [] };
  if (rows.length < 1) return out;
  const h = headerRow(rows), head = h >= 0 ? rows[h] : [], body = rows.slice(h + 1);
  out.header = h; out.rows = body.length; out.headings = head.map(text).filter(Boolean).slice(0, 24);
  const used = new Set(), w = width(rows);
  const take = (f, col, by) => { if (!out.cols[f] && col >= 0 && !used.has(col)) { out.cols[f] = { col, heading: text(head[col]), by }; used.add(col); } };
  head.forEach((c, i) => { const f = typeof c === "string" ? fieldOfHeading(c) : ""; if (f) take(f, i, "heading"); });

  // Headings said nothing about the ID or the name: look at what the columns hold.
  if (!out.cols.id) {
    let best = -1, bestShare = 0.8;
    for (let c = 0; c < w; c++) { if (used.has(c)) continue; const s = share(body, c, idLike); if (s > bestShare) { best = c; bestShare = s; } }
    if (best >= 0) { take("id", best, "content"); out.notes.push("Student ID taken from the column of ID-like numbers" + (head[best] ? " (“" + text(head[best]) + "”)" : "")); }
  }
  if (!out.cols.full && !out.cols.first) {
    for (let c = 0; c < w; c++) { if (used.has(c)) continue; if (share(body, c, nameLike) >= 0.8) { take("full", c, "content"); out.notes.push("Names taken from the column of names" + (head[c] ? " (“" + text(head[c]) + "”)" : "")); break; } }
  }

  // Attendance: columns headed with a date or a session whose cells are marks.
  head.forEach((c, i) => { if (used.has(i) || blank(c) || text(c) === "") return; if (sessionHeading(c) && share(body, i, markLike) >= 0.6) out.sessions.push({ col: i, label: c }); });
  // Several quiz columns, each headed with the quiz's name and holding numbers: a wide table of scores.
  if (!out.sessions.length && out.cols.id && !out.cols.score) {
    head.forEach((c, i) => {
      if (used.has(i) || typeof c !== "string" || !text(c) || fieldOfHeading(c)) return;
      if (NOT_AN_ASSESSMENT.test(headOf(c)) || /^(percent|percentage|percentagescore|pct|mean|average|total|outof|max|maximum)$/.test(headOf(c))) return;
      const named = /quiz|test|exam|assign|mid|practice|lab|project|week|ca\b|score|mark|q\d/i.test(c);
      if ((named && share(body, i, scoreLike) >= 0.6) || share(body, i, fractionLike) >= 0.6) out.quizCols.push({ col: i, label: text(c) }); // a column of fractions such as 1/5 is a score column whatever its heading
    });
  }

  const f = out.cols;
  const options = ["optA", "optB", "optC", "optD"].filter((k) => f[k]).length;
  if (f.question && options >= 2) out.kind = "questions";
  else if (f.id && out.sessions.length >= 1) out.kind = "attendance";
  else if (f.id && f.score) out.kind = "scores";
  else if (f.id && out.quizCols.length) out.kind = "scores";
  else if (f.id && (f.full || f.first || f.last)) out.kind = "roster";
  else if (f.id) out.kind = "roster";
  if (out.kind === "unknown") out.missing = f.question ? ["at least two answer options"] : ["student ID column"];
  else if (out.kind === "scores" && !f.score && !out.quizCols.length) out.missing = ["score column"];
  else if (out.kind === "roster" && !(f.full || f.first || f.last)) out.notes.push("No name column found: only the student IDs are used");
  return out;
}

module.exports = { detectSheet, idLike, markLike, numberLike, nameLike, sessionHeading, blank, text };
