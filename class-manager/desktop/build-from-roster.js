// Builds the record tabs from the class list alone: a row for every student in Attendance, Master and Scores, ready for the first session.
// The lecturer supplies only student IDs and names (the Roster tab); everything else follows. Add only: a student who already has a row is left as it is.
// The layouts are the ones the server script writes (see apps_script/src/10-assessment.gs and 20-attendance.gs), so the script carries on from here.
"use strict";

const digits = (v) => String(v == null ? "" : v).replace(/\D/g, "");

// Rows [id, name] of the Roster tab, from its values.
function rosterOf(rows) {
  const out = [], seen = new Set();
  (rows || []).forEach((r) => { const id = digits(r[0]); if (id.length >= 4 && id.length <= 12 && !seen.has(id)) { seen.add(id); out.push([id, String(r[1] == null ? "" : r[1]).trim()]); } });
  return out;
}

// Appends a row for each student whose ID (column idCol) is not in the tab yet; writes the heading rows first when the tab is empty.
function addStudents(sh, heading, students, rowFor, idCol) {
  if (sh.getLastRow() === 0 && heading.length) sh.getRange(1, 1, heading.length, heading[0].length).setValues(heading);
  const have = new Set(), n = sh.getLastRow(), first = heading.length + 1;
  if (n >= first) sh.getRange(first, idCol + 1, n - first + 1, 1).getValues().forEach((r) => have.add(digits(r[0])));
  const add = students.filter((s) => !have.has(s[0])).map(rowFor);
  if (add.length) { const w = add.reduce((m, r) => Math.max(m, r.length), 1); add.forEach((r) => { while (r.length < w) r.push(""); }); sh.getRange(Math.max(sh.getLastRow(), heading.length) + 1, 1, add.length, w).setValues(add); }
  return add.length;
}

// book: sheet(name, create), rows(name). Returns how many students each tab gained.
function buildFromRoster(book) {
  const students = rosterOf(book.rows("Roster"));
  if (!students.length) return { students: 0 };
  const sheet = (name) => book.sheet(name, true);
  const scores = sheet("Scores"), scoreHead = scores.getLastRow() < 3 ? [["Student ID", "Total", "Out of", "Average %"], ["key", "", "", ""], ["Out of", "", "", ""]] : [];
  if (scoreHead.length) scores.clearContents();
  return {
    students: students.length,
    attendance: addStudents(sheet("Attendance"), [["Student ID"]], students, (s) => [s[0]], 0),
    master: addStudents(sheet("Master"), [["Student ID", "Name", "Last updated"]], students, (s) => [s[0], s[1], ""], 0),
    scores: addStudents(scores, scoreHead.length ? scoreHead : [["", "", "", ""], ["", "", "", ""], ["", "", "", ""]], students, (s) => [s[0], "", "", ""], 0)
  };
}

module.exports = { buildFromRoster, rosterOf };
