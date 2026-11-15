/* What the Grades screen and the Excel download show: the table from build.js with times written out, plus the sheets for Excel.
   One responsibility: presentation of times and layout (no records, headings, order). Pure. */
"use strict";
const { shown } = require("./times");

const NO_RECORD = "no record";

// JSON-safe table for the screen: every cell has text, a sort value and the time it was entered.
function forScreen(g) {
  const columns = [];
  g.groups.forEach((gr) => gr.columns.forEach((c) => columns.push({ key: c.key, label: c.label, group: gr.label, kind: c.kind })));
  const rows = g.rows.map((s) => {
    const cells = {};
    columns.forEach((c) => {
      const x = s.cells[c.key];
      if (!x) { cells[c.key] = { t: NO_RECORD, empty: true }; return; }
      cells[c.key] = { t: c.kind === "time" ? shown(x.n) : x.t, n: x.n, when: x.at === null || x.at === undefined ? "" : shown(x.at) };
    });
    return { id: s.id, name: s.name, cells, last: s.last, lastText: s.last === null ? NO_RECORD : shown(s.last), entries: s.entries };
  });
  return { groups: g.groups.map((x) => ({ id: x.id, label: x.label, span: x.columns.length })), columns, rows, summary: g.summary, noRecord: NO_RECORD };
}

function timelineForScreen(entries) { return entries.map((e) => ({ when: shown(e.at), kind: e.kind, what: e.what, result: e.result })); }

// Excel: the same layout as the screen (ID, name, grouped columns, last activity), then every entry with its time.
function forExcel(g, entriesOf) {
  const v = forScreen(g);
  const head = ["Student ID", "Name"].concat(v.columns.map((c) => c.group + ": " + c.label), ["Last activity"]);
  const grid = [head].concat(v.rows.map((r) => [r.id, r.name].concat(v.columns.map((c) => (r.cells[c.key].empty ? "" : r.cells[c.key].t)), [r.last === null ? "" : r.lastText])));
  const tl = [["Student ID", "Name", "When", "Kind", "What", "Result"]];
  v.rows.forEach((r) => entriesOf(r.id).forEach((e) => tl.push([r.id, r.name, shown(e.at), e.kind, e.what, e.result])));
  return [{ name: "Grades", rows: grid }, { name: "Timeline", rows: tl }];
}

module.exports = { forScreen, forExcel, timelineForScreen, NO_RECORD };
