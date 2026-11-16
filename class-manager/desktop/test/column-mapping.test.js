/* Editable column mapping for the web import: when a file's headings are not recognised, the lecturer says which
   file column holds each required column, and the plan follows that choice (import-plan.js, options.mapping). */
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { plan } = require("../import-plan");

// A course whose class list has the two students; the Attempts tab is empty.
const local = { read: (n) => (n === "Roster" ? [["Student ID", "Name"], ["20004444", "Ama"], ["20005555", "Yaw"]] : [[]]) };

// An Attempts sheet whose Score and Total headings are the lecturer's own words, which no alias knows.
const book = [{ name: "Attempts", rows: [
  ["Timestamp", "Student ID", "Quiz", "Attempt", "Result pts", "Max pts"],
  ["2026-11-01 10:00", "20004444", "L1", 1, 4, 5],
  ["2026-11-01 10:05", "20005555", "L1", 1, 3, 5]
] }];

test("unrecognised columns skip the tab, and the preview carries what a mapping needs", () => {
  const rep = plan(book, local, {}).report;
  const t = rep.tabs.find((x) => x.tab === "Attempts");
  assert.equal(t.status, "skipped");
  assert.match(t.note, /no column found for Score, Total/);
  assert.deepEqual(t.needs.map((x) => x.key), ["timestamp", "studentid", "quiz", "attempt", "score", "total"]);
  assert.equal(t.fileColumns.length, 6);
  assert.equal(t.fileColumns[4].label, "Result pts");
});

test("the lecturer's mapping is followed, shown in the columns list, and used by the apply plan", () => {
  const mapping = { Attempts: { score: 4, total: 5 } };
  const made = plan(book, local, { mapping });
  const t = made.report.tabs.find((x) => x.tab === "Attempts");
  assert.equal(t.status, "new");
  assert.equal(t.add, 2);
  assert.equal(t.columns.find((c) => c.key === "score").col, 4);
  assert.equal(t.columns.find((c) => c.key === "score").found, "Result pts");
  const op = made.ops.tabs.find((x) => x.tab === "Attempts");
  assert.equal(op.rows[0][4], 4, "the score is read from the mapped column");
  assert.equal(op.rows[0][5], 5, "the total too");
});

test("a mapping outside the file's columns is ignored, not an error", () => {
  const rep = plan(book, local, { mapping: { Attempts: { score: 99, total: -3 } } }).report;
  assert.equal(rep.tabs.find((x) => x.tab === "Attempts").status, "skipped");
});

test("with add-missing on, the ID probe follows the mapping too", () => {
  // The ID is in an unlabelled column that only the mapping names.
  const odd = [{ name: "Attempts", rows: [
    ["Timestamp", "Who", "Quiz", "Attempt", "Score", "Total"],
    ["2026-11-01 10:00", "20007777", "L1", 1, 4, 5]
  ] }];
  const r = plan(odd, local, { addMissing: true, mapping: { Attempts: { studentid: 1 } } });
  assert.equal(r.report.students.toAdd, 1);
  assert.deepEqual(r.ops.roster[0][0], "20007777");
});
