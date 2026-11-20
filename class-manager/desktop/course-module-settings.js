"use strict";

const { modules, defaultModules, validateModules } = require("./module-registry");
const attendance = require("./rules/attendance");
const quizzes = require("./rules/quiz-control");
const held = require("./rules/held");
const { fromBackend } = require("./rules/store");

const presets = {
  all: defaultModules,
  attendance: () => ["attendance"],
  attendanceQuizzes: () => ["attendance", "liveQuizzes"]
};

function initialModules(preset = "all") {
  if (!Object.hasOwn(presets, preset)) throw new Error("Choose a course feature preset.");
  return presets[preset]();
}

function state(course) {
  return {
    ok: true,
    enabled: course.backend.enabledModules(),
    choices: Object.values(modules).map(({ id, label, requires }) => ({ id, label, requires }))
  };
}

function busy(course, removed) {
  const store = fromBackend(course.backend);
  const pending = held.items(store);
  if (removed.includes("attendance") && (attendance.openSession(store) || pending.sessions.length)) {
    return "Close attendance and submit or discard its held check-ins before disabling Attendance.";
  }
  const activeQuiz = () => (store.rows(quizzes.TAB) || []).slice(1).some(v =>
    ["lobby", "running", "paused", "ended"].includes(String(v[1]).trim().toLowerCase()));
  if (removed.includes("liveQuizzes") && (activeQuiz() || pending.quizzes.length)) {
    return "Close live quizzes and submit or discard their held results before disabling Live quizzes.";
  }
  return "";
}

async function save(course, requested) {
  if (course.moduleChange) return { ok: false, why: "A module change is already in progress." };
  try {
    const next = validateModules(requested);
    const removed = course.backend.enabledModules().filter(id => !next.includes(id));
    const problem = busy(course, removed);
    if (problem) return { ok: false, why: problem };
    course.moduleChange = true;
    try {
      if (removed.includes("attendance") && course.live) await course.live.closeForModules();
      if (removed.includes("liveQuizzes") && course.liveQuiz) await course.liveQuiz.closeForModules();
      // Existing relay events may have arrived during the drain.
      const after = busy(course, removed);
      if (after) return { ok: false, why: after };
      course.backend.flush();
      course.backend.saveModules(next);
      return state(course);
    } finally {
      course.moduleChange = false;
    }
  } catch (error) {
    return { ok: false, why: error.message };
  }
}

module.exports = { state, save, initialModules };
