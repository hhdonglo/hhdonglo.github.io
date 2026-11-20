"use strict";

const { createHash } = require("node:crypto");
const { normalizeId } = require("../ids");

function idFor(kind, ...parts) {
  return kind + ":" + createHash("sha256").update(JSON.stringify(parts)).digest("hex").slice(0, 32);
}

function dateOf(value) {
  if (!(value instanceof Date) && (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}(?:T| |$)/.test(value))) return null;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? new Date(time).toISOString() : null;
}

// Read-only projections. Source rows are addressed by domain keys, not by row position.
function project(workspaceId, readRows, modules) {
  const events = new Map(), records = new Map();
  const rows = table => (readRows(table) || []).slice(1);
  const entry = (id, kind, date, table, key, fields) =>
    ({ id, workspaceId, kind, date, source: { table, key }, ...fields });

  if (modules.includes("attendance")) {
    const byLabel = new Map();
    for (const row of rows("Attendance_Control")) {
      const code = String(row[0] || "").trim().toUpperCase(), label = String(row[1] || "").trim();
      if (!code || !label) continue;
      const id = idFor("attendanceSession", code);
      byLabel.set(label, id);
      events.set(id, entry(id, "attendanceSession", dateOf(row[3]), "Attendance_Control", { code },
        { title: label, status: String(row[2] || "") }));
    }
    for (const row of rows("Attendance_Log")) {
      const label = String(row[1] || "").trim(), studentId = normalizeId(row[2]), eventId = byLabel.get(label);
      if (!label || !studentId) continue;
      const id = idFor("attendanceCheckIn", label, studentId);
      records.set(id, entry(id, "attendanceCheckIn", dateOf(row[0]), "Attendance_Log", { label, studentId },
        { eventId: eventId || null, studentId }));
    }
  }

  if (modules.includes("liveQuizzes")) {
    const stage = "Staged_Quiz", released = "Form Responses 1";
    for (const table of [stage, released]) {
      for (const row of rows(table)) {
        const studentId = normalizeId(row[2]), code = String(row[3] || "").trim().toUpperCase(), round = Number(row[10]) || 0;
        if (!studentId || !code) continue;
        const eventId = idFor("quizRound", code, round), date = dateOf(row[0]);
        const earlier = events.get(eventId);
        if (!earlier || date && (!earlier.date || date < earlier.date)) {
          events.set(eventId, entry(eventId, "quizRound", date, table, { code, round }, { title: "Quiz " + code }));
        }
        const id = idFor("quizResult", code, round, studentId);
        records.set(id, entry(id, "quizResult", date, table, { code, round, studentId },
          { eventId, studentId, score: row[9], released: table === released }));
      }
    }
    for (const row of rows("Quiz_Control")) {
      const code = String(row[0] || "").trim().toUpperCase(), round = Number(row[16]) || 0;
      if (!code) continue;
      const eventId = idFor("quizRound", code, round);
      if (!events.has(eventId)) {
        events.set(eventId, entry(eventId, "quizRound", dateOf(row[10]), "Quiz_Control", { code, round },
          { title: "Quiz " + code, status: String(row[1] || "") }));
      }
    }
    for (const row of rows("Answers")) {
      const studentId = normalizeId(row[1]), code = String(row[3] || "").trim().toUpperCase();
      const question = Number(row[4]), answer = String(row[5] || "").trim().toUpperCase();
      const round = Number(row[6]) || 0, vote = Number(row[8]) || 0, date = dateOf(row[0]);
      if (!studentId || !code || !Number.isInteger(question) || question < 1 || !answer) continue;
      const eventId = idFor("quizRound", code, round);
      const key = { code, round, studentId, question, vote, date, answer, confidence: String(row[7] || "") };
      const id = idFor("quizAnswer", key);
      records.set(id, entry(id, "quizAnswer", date, "Answers", key, { eventId, studentId, question, vote }));
      if (!events.has(eventId)) {
        events.set(eventId, entry(eventId, "quizRound", date, "Answers", { code, round }, { title: "Quiz " + code }));
      }
    }
  }
  return { events: [...events.values()], records: [...records.values()] };
}

module.exports = { project };
