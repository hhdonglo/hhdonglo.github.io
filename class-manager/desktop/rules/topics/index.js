/* Topic mastery, assembled: the class (semester, per quiz, over time, per student) and one student's own view.
   classTopics(store, o, quizOrder) is added to the class statistics as `topics`; studentTopics(store, o, id) goes into My results. */
"use strict";
const MAP = require("./map");
const EV = require("./evidence");
const M = require("./mastery");

function mapFor(rows, o) { const lec = {}; rows.forEach((r) => { const n = MAP.lectureOf(r.qid); if (n >= 0) lec[n] = 1; }); return MAP.build(o || { site: () => { throw new Error("no site"); } }, Object.keys(lec).map(Number)); }

function classTopics(store, o, quizOrder) {
  const rows = EV.gather(store, null), map = mapFor(rows, o), order = quizOrder || [];
  const semester = M.summarise(rows, map), per = M.byQuiz(rows, map, order);
  return { cutoffs: { well: M.WELL, developing: M.DEVELOPING, minTopicAnswers: M.MIN_TOPIC_ANSWERS, minStudentAnswers: M.MIN_STUDENT_ANSWERS }, answers: semester.answers, unmapped: semester.unmapped,
    semester: semester.topics, byQuiz: per, overTime: M.overTime(per, order), students: M.perStudent(rows, map) };
}
function studentTopics(store, o, id) { const rows = EV.gather(store, id), map = mapFor(rows, o); return M.studentTopics(rows, map); }

module.exports = { classTopics, studentTopics };
