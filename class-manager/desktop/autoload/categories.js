// The record categories of a student's master record, and how an assessment's heading says which one it belongs to and when it happened.
// Every record of every source is filed under a Student ID in one of these categories, time-stamped, and appended to the history.
// Pure functions; no file access. Tested in test/records.test.js.
"use strict";
const { isoDate } = require("./course-details");

// Where each category is stored in the course workbook. Attendance and quizzes keep their older tabs; the others share the Records tab.
const CATEGORIES = [
  { name: "Attendance", tab: "Attendance", note: "one column per session" },
  { name: "Quiz", tab: "Form Responses 1", note: "live quiz results, one per student, quiz and round" },
  { name: "Practice", tab: "Records", note: "practice scores from files; practice attempts made in CM are in Attempts" },
  { name: "Laboratory", tab: "Records", note: "one record per student and laboratory" },
  { name: "Assignment", tab: "Records", note: "one record per student and assignment" },
  { name: "Group assessment", tab: "Records", note: "one record per student and group assessment" },
  { name: "Notes", tab: "Student_Notes", note: "the lecturer's notes about a student" }
];
const RECORD_CATEGORIES = ["Practice", "Laboratory", "Assignment", "Group assessment"]; // the ones filed in the Records tab

// The category an assessment heading belongs to. A heading that says nothing is a quiz.
function categoryOf(label) {
  const s = String(label || "").toLowerCase();
  if (/\blab\b|\blabs\b|laborator/.test(s)) return "Laboratory";
  if (/group/.test(s)) return "Group assessment";
  if (/assign|project|coursework|homework|essay|report/.test(s)) return "Assignment";
  if (/practice|exercise|drill/.test(s)) return "Practice";
  return "Quiz";
}

// The stamp in a heading such as "Quiz 3 (2026-09-29 09:05)" or "Lab 2 - Week 5": { name, date, time, lecture }. Missing parts are "".
function stampOf(label) {
  const raw = String(label == null ? "" : label).trim();
  let date = "", time = "", lecture = "", name = raw;
  const iso = /(\d{4}-\d{2}-\d{2})/.exec(raw), dmy = /(\d{1,2}\/\d{1,2}\/\d{4})/.exec(raw);
  if (iso) date = iso[1]; else if (dmy) date = isoDate(dmy[1]);
  const t = /\b(\d{1,2}:\d{2})\b/.exec(raw); if (t) time = t[1].padStart(5, "0");
  const w = /\b(?:lecture|week|wk)\s*(\d{1,2})\b/i.exec(raw); if (w) lecture = w[1];
  name = raw.replace(/\(([^)]*)\)/g, (m, inner) => (/\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{4}|\d{1,2}:\d{2}/.test(inner) ? "" : m)).replace(/\s+/g, " ").trim() || raw;
  return { name, date, time, lecture };
}

module.exports = { CATEGORIES, RECORD_CATEGORIES, categoryOf, stampOf };
