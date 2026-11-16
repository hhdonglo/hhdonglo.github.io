/* The Grades tables: one clean row per student on the class list, built from the records, with the time each value was entered.
   One responsibility: turn the course's tabs into {groups, rows, entries}. Pure: it only reads, through read(name) -> raw rows or null.
   Each group is its own table: Student ID and Name, then one column per quiz date (Quizzes), per session date (Attendance), per assignment, per practice. A blank is "no record".
   Every cell carries the time of the entry it came from; "last" is the time of a student's latest entry of any kind.
   entries(id) gives that student's dated timeline, newest first. */
"use strict";
const { toMs, shownDate } = require("./times");
const { sessionLabel, sessionDate } = require("../rules/session-label");

const clean = (v) => String(v == null ? "" : v).trim();
const idOf = (v) => clean(v).replace(/\D/g, "");
const rowsOf = (read, name) => { const r = read(name); return Array.isArray(r) && r.length ? r.slice(1) : []; };
const fraction = (s, n) => (n > 0 ? s / n : null);
const text = (s, n) => (n ? s + " / " + n : String(s));

// Practice names as the pages send them: "Lecture 3 practice", "Introduction practice", "Mock exam".
function practiceLabel(quiz) {
  const q = clean(quiz);
  if (/mock/i.test(q)) return { key: "p:mock", label: "Mock exam", order: 999 };
  if (/\(missed/i.test(q)) return null; // a run of only the missed questions is not a full attempt
  let m = /^Lecture\s+(\d+)/i.exec(q);
  if (m) return { key: "p:" + Number(m[1]), label: "Lecture " + Number(m[1]), order: Number(m[1]) };
  if (/^Introduction/i.test(q)) return { key: "p:0", label: "Introduction", order: 0 };
  return q ? { key: "p:" + q, label: q, order: 500 } : null;
}

function build(read) {
  const roster = rowsOf(read, "Roster").map((r) => ({ id: idOf(r[0]), name: clean(r[1]) })).filter((s) => s.id);
  const byId = new Map(roster.map((s) => [s.id, { id: s.id, name: s.name, cells: {}, last: null, entries: 0 }]));
  const timeline = new Map(); // id -> [{at, kind, what, result}]
  const add = (id, at, kind, what, result) => { if (!byId.has(id)) return; (timeline.get(id) || timeline.set(id, []).get(id)).push({ at, kind, what, result }); const s = byId.get(id); s.entries++; if (at !== null && (s.last === null || at > s.last)) s.last = at; };
  const setCell = (id, key, cell) => { const s = byId.get(id); if (!s) return; const old = s.cells[key]; if (!old || (cell.at || 0) >= (old.at || 0)) s.cells[key] = cell; };
  const cols = { attendance: [], quiz: new Map(), assignment: [], practice: new Map() };

  // ----- attendance: the grid (1 present, 0 absent) with each check-in's own time from the log -----
  const grid = read("Attendance") || [], control = rowsOf(read, "Attendance_Control"), log = rowsOf(read, "Attendance_Log");
  const opened = new Map(control.map((r) => [clean(r[1]), toMs(r[3])]));
  const checkin = new Map(); log.forEach((r) => { const k = clean(r[1]) + "|" + idOf(r[2]), t = toMs(r[0]); if (t !== null && (!checkin.has(k) || t < checkin.get(k))) checkin.set(k, t); });
  const heads = (grid[0] || []).slice(1).map(clean);
  const labelFor = (h) => [...opened.keys()].find((l) => l === h || l.indexOf(h + " ") === 0) || h;
  // One column per session, headed by its date (a second session on the same day reads "12 Nov 2026 #2").
  heads.forEach((h, i) => {
    const ms = toMs(sessionDate(h)), key = "att:" + i;
    cols.attendance.push({ key, label: sessionLabel(h), kind: "mark", order: ms === null ? 1e15 + i : ms + i });
  });
  cols.attendance.sort((x, y) => x.order - y.order);
  grid.slice(1).forEach((r) => {
    const id = idOf(r[0]); if (!byId.has(id)) return;
    heads.forEach((h, i) => {
      const v = r[i + 1]; if (v === "" || v === undefined || v === null) return;
      const label = labelFor(h), at = checkin.get(label + "|" + id) || opened.get(label) || toMs(sessionDate(h)), here = Number(v) === 1;
      setCell(id, "att:" + i, { t: here ? "1" : "0", n: here ? 1 : 0, at });
      if (here) add(id, at, "Attendance", "Session " + h, "Present");
    });
  });

  // ----- live quizzes: Form Responses 1 (Timestamp, First Name, ID, Join Code, Q1..Q5, Score, Round, Questions, Answers, Week) -----
  const fr = read("Form Responses 1") || [], fh = (fr[0] || []).map(clean);
  const col = (name, dflt) => { const i = fh.findIndex((h) => h.toLowerCase() === name); return i >= 0 ? i : dflt; };
  const cScore = col("score", 9), cN = col("questions", 11), cWeek = col("week", 13), cCode = col("join code", 3);
  rowsOf(read, "Form Responses 1").forEach((r) => {
    const id = idOf(r[2]), at = toMs(r[0]), week = clean(r[cWeek]), code = clean(r[cCode]);
    const key = week ? "q:w" + week : "q:c" + code, label = week ? "Week " + week : "Code " + code;
    const sc = Number(r[cScore]), n = Number(r[cN]) || 0; if (isNaN(sc)) return;
    const q = cols.quiz.get(key) || { key, name: label, kind: "score", first: null }; // the quiz's date is when its first answer arrived
    if (at !== null && (q.first === null || at < q.first)) q.first = at; cols.quiz.set(key, q);
    setCell(id, key, { t: text(sc, n), n: fraction(sc, n), at });
    add(id, at, "Quiz", label + " (live quiz)", text(sc, n));
  });

  // ----- practice: Attempts (Timestamp, Student ID, Quiz, Attempt, Score, Total, ...) -----
  rowsOf(read, "Attempts").forEach((r) => {
    const id = idOf(r[1]), p = practiceLabel(r[2]), at = toMs(r[0]), sc = Number(r[4]), n = Number(r[5]) || 0; if (!p || isNaN(sc)) return;
    cols.practice.set(p.key, { key: p.key, label: p.label, kind: "score", order: p.order });
    setCell(id, p.key, { t: text(sc, n), n: fraction(sc, n), at });
    add(id, at, "Practice", p.label + " practice, try " + clean(r[3] || 1), text(sc, n));
  });

  // ----- assignments: a group's mark goes to each member of that group (Assignments, Groups, Assignment_Marks) -----
  const asg = rowsOf(read, "Assignments"), groups = rowsOf(read, "Groups"), marks = rowsOf(read, "Assignment_Marks");
  asg.forEach((a) => {
    const aid = clean(a[0]), set = clean(a[1]), title = clean(a[3]) || "Assignment " + aid, outOf = Number(a[7]) || 0;
    const mk = marks.filter((m) => clean(m[0]) === aid && clean(m[2]) !== ""); if (!mk.length) return;
    const key = "a:" + aid; cols.assignment.push({ key, label: title, kind: "score" });
    mk.forEach((m) => groups.filter((g) => clean(g[0]) === set && clean(g[1]) === clean(m[1])).forEach((g) => {
      const id = idOf(g[2]), sc = Number(m[2]), at = toMs(m[4]); if (isNaN(sc)) return;
      setCell(id, key, { t: text(sc, outOf), n: fraction(sc, outOf), at }); add(id, at, "Assignment", title, text(sc, outOf));
    }));
  });

  // One column per quiz, headed by its date, oldest first. Two quizzes on one day add the week or code to tell them apart.
  const quizList = [...cols.quiz.values()].sort((a, b) => (a.first === null) - (b.first === null) || (a.first || 0) - (b.first || 0) || a.name.localeCompare(b.name, undefined, { numeric: true }));
  const dayCount = new Map(); quizList.forEach((q) => { const d = shownDate(q.first); dayCount.set(d, (dayCount.get(d) || 0) + 1); });
  const quiz = quizList.map((q) => { const d = shownDate(q.first) || "No date"; return { key: q.key, label: dayCount.get(shownDate(q.first)) > 1 || !q.first ? d + " (" + q.name + ")" : d, kind: "score" }; });
  const practice = [...cols.practice.values()].sort((a, b) => a.order - b.order);
  const groupsOut = [
    { id: "quizzes", label: "Quizzes", columns: quiz },
    { id: "attendance", label: "Attendance", columns: cols.attendance },
    { id: "assignments", label: "Assignments", columns: cols.assignment },
    { id: "practice", label: "Practice", columns: practice }
  ].filter((g) => g.columns.length);
  const rows = [...byId.values()];
  const onList = (id) => byId.has(id);
  return {
    groups: groupsOut, rows,
    summary: { students: rows.length, withRecords: rows.filter((s) => s.entries > 0).length },
    entries: (id) => (timeline.get(idOf(id)) || []).slice().sort((a, b) => (b.at || 0) - (a.at || 0)),
    has: onList
  };
}

module.exports = { build, practiceLabel };
