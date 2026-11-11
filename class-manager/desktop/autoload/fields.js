// The fields CM can use from a file, and the headings that mean each one. One list to edit: add a heading here
// and every kind of file (class list, scores, attendance, quiz bank) understands it. Pure; no disk, no Electron.
"use strict";

// A heading without case, spaces or punctuation: "Student ID", "student_id" and "STUDENT-ID" all give "studentid".
const headOf = (v) => String(v == null ? "" : v).toLowerCase().replace(/[^a-z0-9]/g, "");

// field -> headings (already written the way headOf writes them).
const HEADINGS = {
  id: ["studentid", "id", "studentnumber", "studentno", "idnumber", "indexnumber", "indexno", "matricnumber", "matricno", "matric", "registrationnumber", "regno", "candidatenumber", "studentidnumber", "idno", "uid"],
  first: ["firstname", "first", "givenname", "givennames", "forename", "othernames"],
  last: ["lastname", "last", "surname", "familyname"],
  full: ["name", "fullname", "studentname", "nameofstudent", "names", "studentsname", "candidatename"],
  score: ["score", "marks", "mark", "points", "result", "obtained", "scored", "rawscore", "marksobtained", "scoreobtained"],
  out: ["outof", "maximum", "max", "maxmarks", "maxscore", "totalmarks", "possible", "fullmarks", "total"],
  quiz: ["quiz", "quizname", "assessment", "test", "title", "assignment", "exam", "activity", "quiztitle"],
  date: ["date", "timestamp", "datetime", "time", "submitted", "sessiondate", "when", "dateofquiz"],
  question: ["question", "questions", "questiontext", "stem", "item", "q", "prompt"],
  optA: ["a", "optiona", "choicea", "answera", "option1", "choice1", "answer1", "opta"],
  optB: ["b", "optionb", "choiceb", "answerb", "option2", "choice2", "answer2", "optb"],
  optC: ["c", "optionc", "choicec", "answerc", "option3", "choice3", "answer3", "optc"],
  optD: ["d", "optiond", "choiced", "answerd", "option4", "choice4", "answer4", "optd"],
  optE: ["e", "optione", "choicee", "answere", "option5", "choice5", "answer5", "opte"],
  answer: ["answer", "correctanswer", "correct", "key", "solution", "rightanswer", "correctoption", "answerkey", "ans"],
  exp: ["explanation", "exp", "feedback", "rationale", "reason", "workedsolution"],
  lecture: ["lecture", "week", "topic", "chapter", "unit", "lectureno", "weeknumber"],
  difficulty: ["difficulty", "level", "grade", "hardness"],
  type: ["type", "questiontype", "category", "kind"]
};

// Headings that must never be taken as a quiz or session (they are about the student, not about an assessment).
const NOT_AN_ASSESSMENT = /^(level|year|age|phone|telephone|mobile|email|emailaddress|programme|program|course|group|section|gender|sex|hall|room|class|status|nationality|index|remark|remarks|comment|comments|notes|note)$/;

// The field a heading means, or "" if it means none. An exact match wins; a long heading that contains a known one ("Student ID Number (UCC)") also counts.
function fieldOfHeading(heading, exactOnly) {
  const h = headOf(heading);
  if (!h) return "";
  for (const f of Object.keys(HEADINGS)) if (HEADINGS[f].indexOf(h) >= 0) return f;
  if (exactOnly) return "";
  let best = "", len = 0;
  for (const f of Object.keys(HEADINGS)) {
    if (f.slice(0, 3) === "opt") continue;
    for (const w of HEADINGS[f]) if (w.length >= 5 && h.indexOf(w) >= 0 && w.length > len) { best = f; len = w.length; }
  }
  return best;
}

module.exports = { headOf, HEADINGS, NOT_AN_ASSESSMENT, fieldOfHeading };
