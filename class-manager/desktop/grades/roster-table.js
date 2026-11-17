/* The "Roster with grades" table: the class list and every result side by side, one row per student on the class list.
   One responsibility: add one more group to what build.js returns. It reuses the quiz, attendance and assignment columns already built (nothing is recomputed from the records)
   and adds four figures worked out from them: Quiz average, Sessions attended, Attendance %, Practice done.
   A figure is left blank ("no record") when the student has nothing behind it, so a student with no records never counts as having records. Pure. */
"use strict";

const pct = (x) => Math.round(x * 100) + "%";
const sum = (a) => a.reduce((s, x) => s + x, 0);

// g: the result of build(). Returns a copy with the group "roster" first and the extra figures added to each row's cells.
function withRoster(g) {
  const by = (id) => (g.groups.find((x) => x.id === id) || { columns: [] }).columns;
  const quiz = by("quizzes"), att = by("attendance"), asg = by("assignments"), prac = by("practice");
  const figures = [{ key: "r:avg", label: "Quiz average", kind: "score" }, { key: "r:att", label: "Sessions attended", kind: "score" }, { key: "r:attpct", label: "Attendance %", kind: "score" }, { key: "r:prac", label: "Practice done", kind: "score" }]
    .filter((f) => (f.key === "r:avg" ? quiz.length : f.key === "r:prac" ? prac.length : att.length));
  const columns = quiz.concat(figures.filter((f) => f.key === "r:avg"), att.length ? [figures.find((f) => f.key === "r:att"), figures.find((f) => f.key === "r:attpct")] : [], asg, figures.filter((f) => f.key === "r:prac"));
  if (!columns.length) return g; // nothing recorded yet: no table to show
  const rows = g.rows.map((s) => {
    const cells = Object.assign({}, s.cells), has = (c) => s.cells[c.key];
    const q = quiz.filter(has).map((c) => s.cells[c.key].n).filter((n) => typeof n === "number");
    if (q.length) cells["r:avg"] = { t: pct(sum(q) / q.length), n: sum(q) / q.length, at: null };
    const marked = att.filter(has);
    if (marked.length) { const here = marked.filter((c) => s.cells[c.key].n === 1).length; cells["r:att"] = { t: here + " / " + att.length, n: here, at: null }; cells["r:attpct"] = { t: pct(here / att.length), n: here / att.length, at: null }; }
    const done = prac.filter(has).length;
    if (done) cells["r:prac"] = { t: done + " / " + prac.length, n: done, at: null };
    return Object.assign({}, s, { cells });
  });
  return Object.assign({}, g, { rows, groups: [{ id: "roster", label: "Roster with grades", columns }].concat(g.groups) });
}

module.exports = { withRoster };
