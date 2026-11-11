// The web import, step two: write the plan made by import-plan.js into this course's workbook.
// Only adds: a row already in the workbook is never changed or removed, and the Attendance record only gains sessions and marks of 1.
// `book` is the backend's small interface: sheet(name, create) and rows(name); `addToClassList(rows)` adds students; `rebuild()` works out the marks again.
"use strict";

function writeTab(book, op) {
  const sh = book.sheet(op.tab, true);
  const had = sh.getLastRow();
  if (!had || op.header.length > sh.getLastColumn()) sh.getRange(1, 1, 1, op.header.length).setValues([op.header]);
  if (op.rows && op.rows.length) sh.getRange(Math.max(1, had) + 1, 1, op.rows.length, op.header.length).setValues(op.rows);
}

function writeGrid(book, op) { // the Attendance record, whole: its rows are few and every row is a union of what was there and what is new
  const sh = book.sheet(op.tab, true);
  sh.clearContents();
  sh.getRange(1, 1, op.grid.length, op.grid[0].length).setValues(op.grid);
}

function apply(ops, book, hooks) {
  const done = { tabs: 0, rows: 0, students: 0 };
  ops.tabs.forEach((op) => {
    if (op.grid) writeGrid(book, op); else writeTab(book, op);
    done.tabs++; done.rows += op.rows ? op.rows.length : 0;
  });
  if (ops.roster && ops.roster.length) { const r = hooks.addToClassList(ops.roster); done.students = r && r.added !== undefined ? r.added : ops.roster.length; }
  if (ops.tabs.length || done.students) hooks.rebuild();
  return done;
}

module.exports = { apply };
