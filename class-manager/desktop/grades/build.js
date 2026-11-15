/* The Grades table: one clean row per student, built from the records, with the time each value was entered.
   One responsibility: turn the course's tabs into {groups, rows, entries}. Pure: it only reads, through read(name) -> raw rows or null.
   Columns: Student ID and Name, then groups: Attendance, Quizzes (one column per week), Assignments, Practice. A blank is "no record".
   Every cell carries the time of the entry it came from; "last" is the time of a student's latest entry of any kind.
   entries(id) gives that student's dated timeline, newest first. */
"use strict";
const { toMs } = require("./times");

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
  if (heads.length) cols.attendance = [{ key: "att_n", label: "Sessions attended", kind: "count" }, { key: "att_pct", label: "Attendance %", kind: "percent" }, { key: "att_last", label: "Last check-in", kind: "time" }];
  const present = new Map();
  grid.slice(1).forEach((r) => {
    const id = idOf(r[0]); if (!byId.has(id)) return; let n = 0, lastAt = null;
    heads.forEach((h, i) => {
      if (Number(r[i + 1]) !== 1) return; n++;
      const label = labelFor(h), at = checkin.get(label + "|" + id) || opened.get(label) || toMs(h);
      add(id, at, "Attendance", "Session " + h, "Present"); if (at !== null && (lastAt === null || at > lastAt)) lastAt = at;
    });
    present.set(id, { n, lastAt });
  });
  byId.forEach((s) => {
    if (!heads.length) return; const p = present.get(s.id) || { n: 0, lastAt: null };
    s.cells.att_n = { t: p.n + " of " + heads.length, n: p.n, at: p.lastAt };
    s.cells.att_pct = { t: Math.round(100 * p.n / heads.length) + "%", n: p.n / heads.length, at: p.lastAt };
    if (p.lastAt !== null) s.cells.att_last = { t: null, n: p.lastAt, at: p.lastAt, time: true };
  });

  // ----- live quizzes: Form Responses 1 (Timestamp, First Name, ID, Join Code, Q1..Q5, Score, Round, Questions, Answers, Week) -----
  const fr = read("Form Responses 1") || [], fh = (fr[0] || []).map(clean);
  const col = (name, dflt) => { const i = fh.findIndex((h) => h.toLowerCase() === name); return i >= 0 ? i : dflt; };
  const cScore = col("score", 9), cN = col("questions", 11), cWeek = col("week", 13), cCode = col("join code", 3);
  rowsOf(read, "Form Responses 1").forEach((r) => {
    const id = idOf(r[2]), at = toMs(r[0]), week = clean(r[cWeek]), code = clean(r[cCode]);
    const key = week ? "q:w" + week : "q:c" + code, label = week ? "Week " + week : "Code " + code;
    const sc = Number(r[cScore]), n = Number(r[cN]) || 0; if (isNaN(sc)) return;
    cols.quiz.set(key, { key, label, kind: "score", order: week ? Number(week) : 900 });
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

  const quiz = [...cols.quiz.values()].sort((a, b) => a.order - b.order), practice = [...cols.practice.values()].sort((a, b) => a.order - b.order);
  const groupsOut = [
    { id: "attendance", label: "Attendance", columns: cols.attendance },
    { id: "quizzes", label: "Quizzes", columns: quiz },
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
