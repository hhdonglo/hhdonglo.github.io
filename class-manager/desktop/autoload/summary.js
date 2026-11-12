// The import summary shown before anything is applied: what kind of records, which assessments (with date and lecture), how many students
// matched, are new, are duplicates or are unknown, and what will be done. Pure: built from the clean data and the plan's report.
"use strict";
const { categoryOf } = require("./categories");

// clean: the merged clean data of the chosen files. report: the plan's report (import-plan.js).
function importSummary(clean, report) {
  const byKey = new Map(), add = (category, name, date, lecture, id) => {
    const k = category + "|" + name, cur = byKey.get(k) || { category, name, date: date || "", lecture: lecture || "", ids: new Set() };
    if (!cur.date && date) cur.date = date; cur.ids.add(id); byKey.set(k, cur);
  };
  (clean.results || []).forEach((r) => add("Quiz", r[1], String(r[4] || "").slice(0, 10), "", r[0])); // [id, quiz, score, out of, date]
  (clean.records || []).forEach((r) => add(r[2], r[3], String(r[0] || "").slice(0, 10), r[6], r[1])); // [date, id, category, assessment, score, out of, lecture]
  const assessments = [...byKey.values()].map((a) => ({ category: a.category, name: a.name, date: a.date, lecture: a.lecture, students: a.ids.size }));
  const sessions = (clean.attendance && clean.attendance.sessions) || [];
  const types = [];
  if ((clean.classList || []).length) types.push("Class list");
  if (sessions.length) types.push("Attendance");
  assessments.forEach((a) => { if (types.indexOf(a.category) < 0) types.push(a.category); });
  const st = report.students || {}, dup = (report.tabs || []).reduce((n, t) => n + (t.duplicates || 0), 0);
  return {
    types, assessments, sessions: sessions.slice(0, 40),
    matched: st.withData || 0, added: st.toAdd || 0, duplicates: dup, unknown: st.flaggedCount || 0,
    actions: ["Match by Student ID", "Add to the right category, one record per student and assessment", "Keep existing records unchanged"]
  };
}

module.exports = { importSummary, categoryOf };
