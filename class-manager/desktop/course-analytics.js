"use strict";

const { modules } = require("./module-registry");
const risk = require("./app/dashboard/risk");

function assemble(data, enabled, diagnosticResponses = 0) {
  const definitions = new Map(enabled.flatMap(id => modules[id].statistics).map(stat => [stat.id, stat]));
  const metrics = [];
  function measure(id, label, value, sample, unit, thin, extra = {}) {
    if (!definitions.has(id) || !sample || value == null) return;
    metrics.push({ ...definitions.get(id), label, value, sample, unit, evidence: thin ? "Limited evidence" : "Descriptive evidence", ...extra });
  }
  const attendance = data.attendance;
  const count = attendance.bySession.reduce((sum, session) => sum + session.counted, 0);
  const present = attendance.bySession.reduce((sum, session) => sum + session.present, 0);
  const sessions = attendance.bySession.filter(session => session.counted > 0).length;
  measure("sessionsHeld", "Attendance sessions counted", sessions, sessions, "sessions", sessions < risk.MIN_SESSIONS);
  measure("attendanceRate", "Attendance rate", attendance.rate, count, "marks", sessions < risk.MIN_SESSIONS, { numerator: present, percent: true });
  measure("absences", "Absences", count - present, count, "marks", sessions < risk.MIN_SESSIONS);

  const latest = data.quizzes.filter(quiz => quiz.stats.n > 0).at(-1);
  if (latest) {
    measure("quizScores", "Latest quiz average", latest.stats.mean, latest.stats.n, "students", latest.stats.n < 10, { percent: true, window: latest.quiz });
    measure("quizParticipation", "Latest quiz participation", latest.participation, data.rosterSize, "rostered students", latest.stats.n < 10,
      { numerator: latest.students, percent: true, window: latest.quiz });
    measure("quizCompletion", "Latest quiz completion", latest.completion, latest.joined, "joined students", latest.joined < 10,
      { numerator: Math.min(latest.students, latest.joined), percent: true, window: latest.quiz });
  }

  const practiceCount = data.students.reduce((sum, student) => sum + student.practiceRecent, 0);
  const active = data.students.filter(student => student.practiceRecent > 0).length;
  if (data.students.some(student => student.practiceAttempts > 0)) measure("practiceAttempts", "Students practising", active, data.rosterSize, "rostered students", active < 5,
    { numerator: active, window: "Last " + data.thresholds.idle + " days", detail: practiceCount + " recorded attempts" });

  const quizAnswers = data.questions.reduce((sum, question) => sum + question.live, 0);
  const practiceAnswers = data.questions.reduce((sum, question) => sum + question.practice, 0);
  measure("quizItemResults", "Live quiz answers recorded", quizAnswers, quizAnswers, "responses", quizAnswers < 20);
  measure("practiceItemResults", "Practice answers recorded", practiceAnswers, practiceAnswers, "responses", practiceAnswers < 20);

  measure("diagnosticResponses", "Diagnostic responses recorded", diagnosticResponses, diagnosticResponses, "responses", diagnosticResponses < 10);

  const eligible = sessions >= risk.MIN_SESSIONS ||
    data.quizzes.filter(quiz => quiz.students >= risk.MIN_TAKERS).length >= risk.MIN_QUIZZES;
  if (eligible) {
    const windows = [];
    if (count) windows.push("Counted attendance sessions");
    if (latest) windows.push("Released quizzes");
    measure("riskFlags", "Students to check in with", risk.atRisk(data).strong, data.rosterSize,
      "rostered students", data.rosterSize < 10, { window: windows.join(" and ") });
  }

  // Suggestions require evidence for both engagement and performance.
  const candidates = data.students.filter(student => student.group === "Working hard but struggling" &&
    (student.sessions >= risk.MIN_SESSIONS || student.quizzesTaken >= risk.MIN_QUIZZES) &&
    (student.quizAverage != null ? student.quizzesTaken >= risk.MIN_QUIZZES : student.practiceAttempts >= 3));
  const revisit = data.learning.topics.filter(topic => topic.answers >= 10 && topic.pct != null && topic.pct < 60)
    .sort((a, b) => a.pct - b.pct || b.answers - a.answers)[0];
  const available = {
    attendance: definitions.has("attendanceRate") && count > 0,
    quizzes: definitions.has("quizScores") && !!latest,
    practice: definitions.has("practiceAttempts") && data.students.some(student => student.practiceAttempts > 0),
    questions: quizAnswers + practiceAnswers > 0,
    diagnostics: definitions.has("diagnosticResponses") && diagnosticResponses > 0,
    learning: data.learning.verdict !== "Not enough data" || quizAnswers + practiceAnswers > 0,
    engagement: data.students.some(student => student.group !== "Not enough data"),
    strongRisk: eligible,
    risk: definitions.has("riskFlags") && (count > 0 || !!latest),
    content: enabled.includes("content"),
    groups: enabled.includes("groups"),
    assignments: enabled.includes("assignments")
  };
  return { enabled, available, metrics, suggestions: {
    support: candidates.length ? { sample: candidates.length, evidence: candidates.length < 5 ? "Limited evidence" : "Descriptive evidence",
      students: Array.from(candidates, ({ id, name }) => ({ id, name })) } : null,
    revisit: revisit ? { title: revisit.label, sample: revisit.answers, value: revisit.pct,
      evidence: revisit.answers < 20 ? "Limited evidence" : "Descriptive evidence" } : null
  } };
}

function courseStats(backend, options) {
  const data = backend.analyticsStats ? backend.analyticsStats(options) : backend.stats(options);
  if (!data.ok || !backend.enabledModules) return data;
  const enabled = backend.enabledModules();
  const log = enabled.includes("liveQuizzes") && backend.rawRows?.("Diagnostic_Log");
  const targets = data.targets.map(target => {
    if (target.group === "Working hard but struggling") return { ...target, evidence: "High recorded participation and scores below " + data.thresholds.perf + "%" };
    if (target.group === "Disengaged") return { ...target, evidence: "Scores at or above " + data.thresholds.perf + "% alongside lower recorded participation" };
    if (target.group === "Needs a check-in") return { ...target, evidence: "Lower recorded participation and low or missing scores" };
    return target;
  });
  return { ...data, targets, analytics: assemble(data, enabled, log ? Math.max(0, log.length - 1) : 0) };
}

module.exports = { assemble, courseStats };
