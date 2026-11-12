// What the web import knows about each tab of a Class Manager workbook: its columns, which column holds the student ID,
// and what makes two rows the same record (so a second import adds nothing). One entry per tab; add a tab here to import it.
// Marks (Master, Scores, Totals) are not imported: they are worked out again from the imported records.
"use strict";
const V = require("./import-values");

// header: the columns CM's script reads, by position. need: how many leading columns a file must have.
// text: columns written as text (IDs, codes). id: the column with the student ID (-1: none). key: the same record gives the same key.
// onList: false when the tab is a record of people who are NOT on the class list, so the class list filter does not apply.
const LOG_TABS = [
  { name: "Form Responses 1", label: "Live quiz results", positional: true, need: 10, id: 2, text: [2, 3],
    header: ["Timestamp", "First Name", "ID", "Join Code", "Q1", "Q2", "Q3", "Q4", "Q5", "Score", "Round", "Questions", "Answers", "Week"],
    key: (r) => [V.idOf(r[2]), V.codeOf(r[3]), V.numOf(r[10]) || "0"].join("|") }, // the script counts one result per student, code and round
  { name: "Attempts", label: "Practice and mock exam attempts", need: 6, id: 1, text: [1],
    header: ["Timestamp", "Student ID", "Quiz", "Attempt", "Score", "Total", "Seconds", "Wrong question ids", "Question ids"],
    key: (r) => [V.timeOf(r[0]), V.idOf(r[1]), V.codeOf(r[2]), V.numOf(r[3])].join("|") },
  { name: "Item_Log", label: "Answers to each live quiz question", need: 10, id: 4, text: [1, 4],
    header: ["Timestamp", "Join Code", "Round", "Week", "Student ID", "Q", "Question ID", "Answer", "Correct answer", "Correct", "Confidence", "First answer", "Discussed"],
    key: (r) => [V.codeOf(r[1]), V.numOf(r[2]) || "0", V.idOf(r[4]), V.numOf(r[5])].join("|") },
  { name: "Attendance_Log", label: "Attendance check-ins", need: 4, id: 2, text: [2],
    header: ["Timestamp", "Session", "Student ID", "On roster", "Device", "Location"],
    key: (r) => [V.sessionOf(r[1]), V.idOf(r[2])].join("|") }, // one check-in per student per session
  { name: "Attendance_Flags", label: "Attendance flags", need: 5, id: 2, text: [2],
    header: ["Timestamp", "Session", "Student ID", "Device", "Reason"],
    key: (r) => [V.sessionOf(r[1]), V.idOf(r[2]), String(r[4] || "").trim()].join("|") },
  { name: "Not_On_List", label: "Check-ins by IDs not on the class list", need: 3, id: 2, text: [2], onList: false,
    header: ["Timestamp", "Session", "Student ID"],
    key: (r) => [V.sessionOf(r[1]), V.idOf(r[2])].join("|") },
  { name: "Records", label: "Laboratory, assignment, practice and group assessment records", need: 5, id: 1, text: [1],
    header: ["Timestamp", "Student ID", "Category", "Assessment", "Score", "Out of", "Lecture"],
    key: (r) => [V.idOf(r[1]), String(r[2] || "").trim().toLowerCase(), String(r[3] || "").trim().toLowerCase()].join("|") }, // one record per student, category and assessment
  { name: "Student_Notes", label: "Notes about students", need: 3, id: 1, text: [1],
    header: ["Timestamp", "Student ID", "Note", "By"],
    key: (r) => [V.timeOf(r[0]), V.idOf(r[1]), String(r[2] || "").trim()].join("|") },
  { name: "Reports", label: "Question reports from students", need: 6, id: -1, text: [],
    header: ["Timestamp", "Lecture", "Question id", "Question", "Answer shown", "Comment", "Page"],
    key: (r) => [V.timeOf(r[0]), String(r[2] || "").trim(), String(r[5] || "").trim()].join("|") },
  // Sessions still open or waiting to be submitted on the web are not imported (see import-plan.js, prepareSession); the link secret is never copied.
  { name: "Attendance_Control", label: "Attendance sessions", need: 5, id: -1, text: [], session: true,
    header: ["Code", "Label", "Status", "Opened", "Closed", "Secret", "Lat", "Lon", "Radius m"],
    key: (r) => V.sessionOf(r[1]) }
];

// Other headings that mean the same column (compared without case, spaces or punctuation), so a file need not use the script's exact words.
const ALIASES = {
  studentid: ["id", "studentnumber", "studentno", "idnumber", "indexnumber", "studentidnumber", "matricnumber"], id: ["studentid", "studentnumber", "studentno", "indexnumber", "idnumber"],
  timestamp: ["time", "datetime", "date", "submitted", "when"], firstname: ["name", "studentname", "first", "givenname"], score: ["marks", "mark", "points", "result"],
  joincode: ["code", "quizcode", "quiz"], session: ["date", "sessiondate", "label"], quiz: ["quizname", "assessment", "title", "test"], total: ["outof", "maximum", "max", "questions"],
  device: ["devicehash"], lecture: ["lecturename"], comment: ["comments", "note", "notes"]
};

// The tab of marks per session (1 present, 0 absent), merged by its own rule (import-plan.js, planAttendance).
const ATTENDANCE_TAB = "Attendance";
// Where names can come from for students who are added to the class list.
const NAME_TABS = ["Roster", "Master", "Totals"];
// Tabs that are known and deliberately not imported, with the reason shown in the preview.
const SKIPPED = {
  Master: "marks are worked out again from the records", Scores: "marks are worked out again from the records", Totals: "marks are worked out again from the records",
  Leaderboard: "a view of the quiz results", Attendance_Named: "a view of attendance",
  Answers: "raw answers of live sessions, kept only while a quiz runs", Presence: "who joined a live quiz, kept only while a quiz runs",
  Staged_Quiz: "results held on the web and not yet released", Archive: "discarded quiz rounds", Quiz_Control: "state of live quizzes",
  Key: "the web version's own settings and host key", Portal: "the web version's own settings", Explanations: "the web version's own settings",
  Log: "the web version's own audit log", "Read me": "instructions in the template", Auto_Added: "a note of IDs added automatically on the web",
  Access_Codes: "personal access codes belong to one installation", Attendance_Phones: "phones registered on the web", Question_Stats: "worked out again", Groups: "not imported by this version"
};

module.exports = { ALIASES, LOG_TABS, ATTENDANCE_TAB, NAME_TABS, SKIPPED };
