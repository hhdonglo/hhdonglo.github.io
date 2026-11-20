"use strict";

// Course modules own capabilities and their records. Platform services remain available.
const actions = {
  attendance: ["attend", "attend_submit", "attend_discard", "attend_review", "attend_remove", "attend_approve", "attend_phone_reset", "attend_unlock", "attend_status", "attend_open", "attend_close"],
  liveQuizzes: ["status", "questions", "review", "ranking", "control", "host", "display", "quiz_default", "result", "join_base", "held_release_quiz", "held_discard_quiz"],
  calendar: ["calendar", "calendar_ics", "calendar_edit"],
  messaging: ["chat"],
  announcements: ["announcements"],
  groups: ["groups", "groups_display"],
  assignments: ["assignments", "group_work"],
  analytics: ["outcomes", "learning_progress", "insights", "class_stats", "student_note", "student_stats"],
  content: ["set_week"]
};
const pages = {
  attendance: ["attend.html", "attendance.html"],
  liveQuizzes: ["quiz.html", "quiz-host.html", "quiz-display.html"],
  content: ["course.html", "app/author.html"],
  practice: ["mock-exam.html", "introduction-practice.html", "app/mailbox.html"],
  groups: ["groups.html"],
  assignments: ["assignments.html", "group-work.html"],
  calendar: ["calendar.html", "calendar.ics"],
  analytics: ["insights.html", "outcomes.html"]
};
const channels = {
  practice: ["mailboxStatus", "mailboxSetup", "mailboxClear", "mailboxPull"],
  liveQuizzes: ["bankFolderPick", "bankFolderLoad"],
  content: ["lectures", "saveLecture", "removeLecture", "lectureFile", "importPack", "exportPack", "lectureOverview", "lectureProgress", "lectureMark",
    "libList", "libAdd", "libAddPaths", "libRemove", "libSet", "libPassages", "search", "summarise", "generate", "banks",
    "bankTitle", "drafts", "draftsAdd", "draftUpdate", "draftsReject", "approve", "withdraw", "importFile", "importText",
    "autoQuestions", "autoCourseSave", "lectureFileView", "lectureFileUpdate", "lectureFileChoose",
    "lectureFileReplace", "lectureFileDetach", "lectureFileUndo", "lectureDescription", "lectureNotify"],
  analytics: ["stats", "studentStats", "progress", "studentNote", "analyticsExtra", "addIntervention", "weeklySummary"],
  attendance: ["signinProblems", "signinDismiss"]
};
const definitions = {
  attendance: {
    label: "Attendance",
    records: ["Attendance_Control", "Attendance_Log", "Attendance", "Attendance_Flags", "Attendance_Phones", "Attendance_Unlock"],
    statistics: [
      ["sessionsHeld", "Submitted course sessions with attendance counted", "Submitted session columns"],
      ["attendanceRate", "All counted sessions in this course", "Nonblank attendance marks for rostered students"],
      ["absences", "All counted sessions in this course", "Nonblank attendance marks for rostered students"],
      ["attendanceTrend", "Per session, last three against earlier, or running course history", "Nonblank attendance marks within the selected sessions"],
      ["attendanceStreak", "Counted sessions, ending at the latest for current streaks", "Recorded marks per student, excluding blank marks"],
      ["arrivalTime", "Latest session or all course sessions", "Student check-ins with a matching session opening time"]
    ]
  },
  liveQuizzes: {
    label: "Live quizzes",
    kinds: ["join", "progress", "answer", "submit"],
    records: ["Quiz_Control", "Answers", "Presence", "Staged_Quiz", "Item_Log", "Form Responses 1", "Scores", "Diagnostic_Log"],
    statistics: [
      ["quizParticipation", "Latest released quiz with results", "Students on the current course roster"],
      ["quizCompletion", "Latest released quiz with recorded joins", "Recorded participants who joined that quiz"],
      ["quizScores", "Latest released quiz with results", "Rostered students with a released result for that quiz"],
      ["quizItemResults", "Released live quiz responses in this course", "Live item responses recorded, including blanks"],
      ["diagnosticResponses", "Recorded diagnostic runs in this course", "Diagnostic item responses recorded, including blanks"],
      ["quizTrajectory", "All released quizzes, ordered by first result", "Rostered students with scores in each comparison or distribution"],
      ["quizDiscrimination", "Recorded live responses for each item", "Top and bottom 27% by score on the other questions, with at least ten responses"]
    ]
  },
  content: {
    label: "Course materials",
    records: ["lectureMetadata", "materialReferences", "questionBanks", "lectureLog"],
    statistics: [["lectureCoverage", "Current course plan", "Lectures in the current plan"], ["lecturesHeld", "Current course plan", "Lectures in the current plan"]]
  },
  practice: {
    label: "Practice and mock exams",
    kinds: ["attempt", "report"],
    requires: ["content"],
    records: ["Attempts", "Reports"],
    statistics: [["practiceAttempts", "Last N days, using the course threshold", "Current roster for unique participation, recorded attempts for volume"], ["practiceCompletion", "All recorded practice in this course", "Practice attempts with an observed score and total"], ["practiceItemResults", "Recorded practice and mock-exam attempts in this course", "Question IDs recorded as asked in each attempt"]]
  },
  groups: {
    label: "Student groups",
    records: ["Groups"],
    statistics: [["groupMembership", "Current group set", "Course students with recorded group membership"]]
  },
  assignments: {
    label: "Assignments",
    requires: ["groups"],
    records: ["Assignments", "Group_Work", "Assignment_Marks"],
    statistics: [["assignmentSubmissions", "Selected assignment", "Groups assigned that task"], ["assignmentMarks", "Selected assignment", "Groups with a recorded mark"]]
  },
  calendar: {
    label: "Calendar",
    records: ["Calendar"],
    statistics: [["upcomingEvents", "Local date onward", "Scheduled events in this course"]]
  },
  messaging: {
    label: "Messaging",
    sharedPages: ["messages.html"],
    records: ["Messages", "Chat_Groups", "Chat_Read"],
    statistics: [["unreadMessages", "Since the user last read each conversation", "Messages visible to that user"]]
  },
  announcements: {
    label: "Announcements",
    sharedPages: ["messages.html"],
    records: ["Announcements", "Chat_Read (announcement markers)"],
    statistics: [["unreadAnnouncements", "Since the user last read announcements", "Published announcements visible to that user"]]
  },
  analytics: {
    label: "Analytics",
    records: ["Interventions", "Student_Notes"],
    statistics: [
      ["riskFlags", "Counted attendance sessions and released quizzes", "Rostered students considered for enabled risk rules"],
      ["learningProgress", "First versus latest recorded answers", "Students and repeated answer pairs with enabled evidence"],
      ["engagementGroups", "Counted attendance and released quizzes, with recent practice when available", "Rostered students whose recorded activity can be classified"],
      ["topicMastery", "Available recorded responses mapped to each topic", "Responses to questions in the topic"],
      ["relationships", "Course history or the selected date window", "Students with both measures during that window"],
      ["supportComparison", "Recorded quizzes before and after each intervention", "Students with comparable prior scores and observations before and after"],
      ["cohortResults", "Released quiz results to date", "Students in each teaching group with results"],
      ["learningVerdict", "Course results to date", "Eligible quizzes and repeated-answer pairs"]
    ]
  }
};

const modules = Object.freeze(Object.fromEntries(Object.entries(definitions).map(([id, definition]) => [
  id,
  Object.freeze({
    id,
    label: definition.label,
    requires: Object.freeze(definition.requires || []),
    pages: Object.freeze(pages[id] || []),
    actions: Object.freeze(actions[id] || []),
    kinds: Object.freeze(definition.kinds || []),
    sharedPages: Object.freeze(definition.sharedPages || []),
    channels: Object.freeze(channels[id] || []),
    records: Object.freeze(definition.records),
    statistics: Object.freeze(definition.statistics.map(([id, window, denominator]) => Object.freeze({ id, window, denominator })))
  })
])));

function defaultModules() {
  return Object.keys(modules);
}

function validateModules(ids) {
  if (!Array.isArray(ids)) throw new Error("Course modules must be a list.");
  const enabled = new Set(ids);
  if (enabled.size !== ids.length) throw new Error("The course module list contains a duplicate.");
  for (const id of ids) {
    if (typeof id !== "string" || !Object.hasOwn(modules, id)) throw new Error("Unknown course module: " + String(id));
    for (const dependency of modules[id].requires) {
      if (!enabled.has(dependency)) throw new Error(id + " requires " + dependency + ".");
    }
  }
  return ids.slice();
}

module.exports = { modules, defaultModules, validateModules };
