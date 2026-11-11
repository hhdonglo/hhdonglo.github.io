// The start template: a workbook with the headings the import recognises, to fill in and load ("Use a template" on the first-run screen).
// Only the headings are given, so loading it unfilled adds nothing. Pure; written to a file by excel.js.
"use strict";

// Quiz scores, one row per student per quiz: the simple table that is turned into live quiz results by import-plan.js (SCORE_TAB).
const SCORE_TAB = "Quiz scores";
const SCORE_HEAD = ["Student ID", "Quiz", "Score", "Out of", "Date"];

function templateSheets() {
  return [
    { name: "Read me", rows: [
      ["How to use this template"],
      ["1. Roster: one row per student. Student ID (4 to 12 digits), First name, Last name. This is the only sheet you need."],
      ["2. Quiz scores (optional): one row per student per quiz. Quiz is the name of the quiz, Score and Out of are numbers, Date is optional (for example 2026-11-10)."],
      ["3. Attendance (optional): one column per session, headed with its date (for example 10/11/2026). Put 1 for present and 0 for absent."],
      ["4. Save the file, then in Class Manager choose Use a template and load it. You see a preview before anything is added."],
      ["Importing the same file again never creates duplicates."]] },
    { name: "Roster", rows: [["Student ID", "First name", "Last name"]] },
    { name: SCORE_TAB, rows: [SCORE_HEAD] },
    { name: "Attendance", rows: [["Student ID"]] }
  ];
}

module.exports = { SCORE_TAB, SCORE_HEAD, templateSheets };
