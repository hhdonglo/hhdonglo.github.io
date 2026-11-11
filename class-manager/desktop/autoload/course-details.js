// Finds course details (code, title, lecturer, semester, teaching dates, class times, week) in the files the lecturer loads,
// so the Course details form can be pre-filled. It only suggests: the lecturer sees each value with the file it came from and can correct it.
// Pure functions: no file access, no screen. Input is what analyze.js keeps as `hints` for each file.
"use strict";

const STOP = new Set(["ID", "NO", "QR", "Q", "WK", "CSV", "PDF", "DOC", "FIG", "TABLE", "LEVEL", "GROUP", "WEEK", "QUIZ", "SHEET"]);
const LABELS = {
  title: /^(course\s+title|course\s+name|title)$/i,
  lecturer: /^(lecturer|course\s+lecturer|instructor|taught\s+by|teacher)$/i,
  semester: /^(semester|term)$/i,
  institution: /^(institution|university|college)$/i,
  start: /^(first\s+day(\s+of\s+teaching)?|start\s+date|semester\s+start|teaching\s+starts?)$/i,
  end: /^(last\s+day(\s+of\s+teaching)?|end\s+date|semester\s+end|teaching\s+ends?)$/i,
  times: /^(class\s+times?|lecture\s+times?|schedule|timetable)$/i,
  week: /^(current\s+week)$/i,
  code: /^(course\s+code|course|code)$/i
};
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const pad = (n) => String(n).padStart(2, "0");

// A date as yyyy-mm-dd, from a Date, dd/mm/yyyy, yyyy-mm-dd or "4 November 2026". Returns "" when it is not a date.
function isoDate(v) {
  if (v instanceof Date && !isNaN(v)) return v.getFullYear() + "-" + pad(v.getMonth() + 1) + "-" + pad(v.getDate());
  const s = String(v == null ? "" : v).trim();
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s); if (m) return ok(+m[1], +m[2], +m[3]);
  m = /^(\d{1,2})[\/.](\d{1,2})[\/.](\d{4})$/.exec(s); if (m) return ok(+m[3], +m[2], +m[1]);
  m = /^(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]{3,9})\.?,?\s+(\d{4})$/.exec(s);
  if (m) { const k = MONTHS.indexOf(m[2].slice(0, 3).toLowerCase()); if (k >= 0) return ok(+m[3], k + 1, +m[1]); }
  return "";
}
function ok(y, mo, d) { const t = new Date(Date.UTC(y, mo - 1, d)); return t.getUTCFullYear() === y && t.getUTCMonth() === mo - 1 && t.getUTCDate() === d && y > 1990 && y < 2100 ? y + "-" + pad(mo) + "-" + pad(d) : ""; }

const cellText = (v) => (v instanceof Date ? isoDate(v) : String(v == null ? "" : v).trim());
const CODE = /\b([A-Z]{2,5})[\s_-]?(\d{3,4}[A-Z]?)\b/g;
const SEMESTER = /\b(first|second|third|1st|2nd|3rd)\s+semester\s+(\d{4}(?:\/\d{2,4})?)/i;
const TIMES = /\b((?:mon|tues|wednes|thurs|fri|satur|sun)day)\s+(\d{1,2})[:.](\d{2})\s*(?:to|-|–)\s*(\d{1,2})[:.](\d{2})/i;

function codesIn(text, count) {
  let m; CODE.lastIndex = 0;
  while ((m = CODE.exec(text))) { if (!STOP.has(m[1])) { const k = m[1] + " " + m[2]; count[k] = (count[k] || 0) + 1; } }
}

// sources: [{ file, rows: [[cell, ...], ...], text }]. Returns { code: { value, from }, title, ... } with only the fields that were found.
function findDetails(sources, today) {
  const found = {}, set = (k, value, from) => { if (value && !found[k]) found[k] = { value: String(value), from }; };
  const codeCount = {}, codeFrom = {};
  (sources || []).forEach((src) => {
    const file = src.file || "", base = file.replace(/^.*[\\/]/, "");
    const before = Object.assign({}, codeCount); codesIn(base, codeCount);
    Object.keys(codeCount).forEach((k) => { if (codeCount[k] !== before[k] && !codeFrom[k]) codeFrom[k] = file; });
    const lines = [];
    (src.rows || []).forEach((row) => {
      const cells = row.map(cellText);
      cells.forEach((c, i) => {
        if (!c) return;
        const pair = /^([A-Za-z ]{3,30}?)\s*[:\-–]\s*(.+)$/.exec(c);
        let label = pair ? pair[1].trim() : c, value = pair ? pair[2].trim() : (cells.slice(i + 1).find((x) => x) || "");
        Object.keys(LABELS).forEach((k) => {
          if (!LABELS[k].test(label) || !value) return;
          if (k === "start" || k === "end") set(k, isoDate(value) || isoDate(row[i + 1]), file);
          else if (k === "code") { const cc = {}; codesIn(value, cc); const first = Object.keys(cc)[0]; if (first) set("code", first, file); }
          else if (k === "week") { const w = parseInt(value, 10); if (w >= 1 && w <= 52) set("week", w, file); }
          else if (value.length <= 160 && !isoDate(value)) set(k === "times" ? "times" : k, value, file);
        });
        if (c.length < 200) lines.push(c);
      });
    });
    const text = lines.join("\n") + "\n" + String(src.text || "").slice(0, 4000);
    const sem = SEMESTER.exec(text); if (sem) set("semester", sem[1][0].toUpperCase() + sem[1].slice(1).toLowerCase() + " semester " + sem[2], file);
    const tm = TIMES.exec(text); if (tm) set("times", tm[1][0].toUpperCase() + tm[1].slice(1).toLowerCase() + " " + pad(+tm[2]) + ":" + tm[3] + " to " + pad(+tm[4]) + ":" + tm[5], file);
    const cc = {}; codesIn(lines.slice(0, 12).join("\n"), cc); Object.keys(cc).forEach((k) => { codeCount[k] = (codeCount[k] || 0) + cc[k]; if (!codeFrom[k]) codeFrom[k] = file; });
  });
  if (!found.code) { const top = Object.keys(codeCount).sort((a, b) => codeCount[b] - codeCount[a])[0]; if (top) set("code", top, codeFrom[top]); }
  if (!found.week && found.start) { // the week of teaching today, counted from the first day
    const s = Date.parse(found.start.value + "T00:00:00Z"), now = today instanceof Date ? today.getTime() : Date.now();
    const w = Math.floor((now - s) / (7 * 864e5)) + 1, e = found.end ? Date.parse(found.end.value + "T00:00:00Z") : null;
    if (w >= 1 && w <= 52 && (!e || now <= e + 7 * 864e5)) found.week = { value: String(w), from: found.start.from, worked: true };
  }
  return found;
}

// What each field is called on the form and in the settings.
const FIELDS = [["code", "Course code", "courseCode"], ["title", "Course title", "courseTitle"], ["lecturer", "Lecturer", "lecturer"], ["institution", "Institution", "institution"],
  ["semester", "Semester", "semester"], ["start", "First day of teaching", "startDate"], ["end", "Last day of teaching", "endDate"], ["times", "Class times", "contacts"], ["week", "Current week", "currentWeek"]];

module.exports = { findDetails, isoDate, FIELDS };
