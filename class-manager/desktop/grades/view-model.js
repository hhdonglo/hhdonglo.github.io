/* What the Grades screen and the Excel download show: the tables from build.js with times written out, plus the sheets for Excel.
   One responsibility: presentation of times and layout (no records, headings, order). Pure. */
"use strict";
const { shown } = require("./times");

const NO_RECORD = "no record";

// JSON-safe tables for the screen, one per group (Quizzes, Attendance, ...): ID, Name, then one column per date. Every cell has text, a sort value and the time it was entered.
function tableOf(g, gr) {
  const columns = gr.columns.map((c) => ({ key: c.key, label: c.label, kind: c.kind }));
  const rows = g.rows.map((s) => {
    const cells = {}; let entries = 0, last = null;
    columns.forEach((c) => {
      const x = s.cells[c.key];
      if (!x) { cells[c.key] = { t: "", empty: true }; return; }
      entries++; if (x.at !== null && x.at !== undefined && (last === null || x.at > last)) last = x.at;
      cells[c.key] = { t: x.t, n: x.n, when: x.at === null || x.at === undefined ? "" : shown(x.at) };
    });
    return { id: s.id, name: s.name, cells, entries, last };
  });
  return { id: gr.id, label: gr.label, columns, rows, summary: { students: rows.length, withRecords: rows.filter((r) => r.entries > 0).length } };
}
function forScreen(g) { return { tables: g.groups.map((gr) => tableOf(g, gr)), summary: g.summary, noRecord: NO_RECORD }; }

function timelineForScreen(entries) { return entries.map((e) => ({ when: shown(e.at), kind: e.kind, what: e.what, result: e.result })); }

// Excel (and CSV): one sheet per table with the same layout as the screen (ID, Name, one column per date), then every entry with its time.
function forExcel(g, entriesOf) {
  const v = forScreen(g);
  const sheets = v.tables.map((t) => ({ name: t.label, rows: [["Student ID", "Name"].concat(t.columns.map((c) => c.label))].concat(t.rows.map((r) => [r.id, r.name].concat(t.columns.map((c) => (r.cells[c.key].empty ? "" : r.cells[c.key].t))))) }));
  if (!sheets.length) sheets.push({ name: "Quizzes", rows: [["Student ID", "Name"]].concat(g.rows.map((r) => [r.id, r.name])) });
  const tl = [["Student ID", "Name", "When", "Kind", "What", "Result"]];
  g.rows.forEach((r) => entriesOf(r.id).forEach((e) => tl.push([r.id, r.name, shown(e.at), e.kind, e.what, e.result])));
  return sheets.concat([{ name: "Timeline", rows: tl }]);
}

module.exports = { forScreen, forExcel, timelineForScreen, NO_RECORD };
