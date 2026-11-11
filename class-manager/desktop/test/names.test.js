/* Student names: run with `npm test` in class-manager/desktop.
   - A name splits into first and last name ("Last, First" or "First Last") and joins back.
   - A class list row with separate first and last name cells is stored as one name.
   - Exports replace each whole-name column by First name and Last name columns; other tables are untouched.
   - The class list template, saved as Excel, reads back with ID, first and last name columns. */
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const names = require("../names");
const excel = require("../excel");
const { readXlsx } = require("../table");

test("a name splits into first and last name", () => {
  assert.deepEqual(names.splitName("Ama Mensah"), { first: "Ama", last: "Mensah" });
  assert.deepEqual(names.splitName("Ama Serwaa  Mensah"), { first: "Ama Serwaa", last: "Mensah" });
  assert.deepEqual(names.splitName("Mensah, Ama Serwaa"), { first: "Ama Serwaa", last: "Mensah" });
  assert.deepEqual(names.splitName("Kofi"), { first: "Kofi", last: "" });
  assert.deepEqual(names.splitName(""), { first: "", last: "" });
  assert.deepEqual(names.splitName(null), { first: "", last: "" });
});

test("first and last name join into one name", () => {
  assert.equal(names.joinName("Ama", "Mensah"), "Ama Mensah");
  assert.equal(names.joinName(" Ama ", ""), "Ama");
  assert.equal(names.joinName("", "Mensah"), "Mensah");
});

test("a class list row becomes one stored name", () => {
  assert.equal(names.rowName(["1234", "Ama", "Mensah"]), "Ama Mensah");
  assert.equal(names.rowName(["1234", "Ama Mensah"]), "Ama Mensah");
  assert.equal(names.rowName(["1234", "Mensah, Ama"]), "Ama Mensah");
  assert.equal(names.rowName(["1234", "Ama", ""]), "Ama");
  assert.equal(names.rowName(["1234"]), "");
});

test("exports get First name and Last name columns in place of Name", () => {
  const out = names.withNameColumns([["Student ID", "Name", "Score"], ["00123", "Ama Mensah", "7"], ["00124", "", "9"], ["00125", "Boateng, Kofi", 5]]);
  assert.deepEqual(out, [["Student ID", "First name", "Last name", "Score"], ["00123", "Ama", "Mensah", "7"], ["00124", "", "", "9"], ["00125", "Kofi", "Boateng", 5]]);
});

test("tables without a whole-name column are unchanged", () => {
  const quiz = [["Timestamp", "First Name", "ID"], ["t", "Ama", "1234"]];
  assert.equal(names.withNameColumns(quiz), quiz);
  assert.deepEqual(names.withNameColumns([]), []);
  assert.deepEqual(names.withNameColumns([["Student name", "ID"], ["Ama Mensah", "1"]]), [["First name", "Last name", "ID"], ["Ama", "Mensah", "1"]]);
});

test("the Excel class list template has ID, first name and last name", async () => {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "cm-names-")), "t.xlsx");
  fs.writeFileSync(file, await excel.writeXlsx(excel.classListTemplate()));
  const rows = await readXlsx(file);
  assert.deepEqual(rows[0], ["Student ID", "First name", "Last name"]);
  rows.slice(1).forEach((r) => { assert.match(r[0], /^\d{4,12}$/); assert.ok(r[1] && r[2]); });
});
