"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { classroom } = require("./classroom");
const { assemble, courseStats } = require("../course-analytics");
const model = require("../app/board/model");
const board = require("../app/board/render");
const view = require("../app/analytics/module-view");
const dashboard = require("../app/dashboard/rules");
const Explore = require("../app/charts/explore-data");
const Graphs = require("../app/charts/panel");
const { aggregates, ruleText } = require("../summary");
const { modules, defaultModules } = require("../module-registry");

function seed(c) {
  const backend = c.backend;
  const [a, b, c3, d] = c.students.map(s => s.id);
  const date = new Date().toISOString();
  backend.setRows("Attendance", [
    ["Student ID", "1/11/2026", "2/11/2026", "3/11/2026", "4/11/2026", "5/11/2026"],
    [a, 1, 1, 1, 1, 0], [b, 1, 0, "", 1, 0], [c3, 0, 1, 1, 0, 0], [d, "", 1, 0, 0, 0]
  ]);
  backend.setRows("Form Responses 1", [["Timestamp"], ...[
    [a, "AB111", 2, 1, 1], [b, "AB111", 5, 1, 1], [a, "AB222", 1, 1, 2],
    [a, "AB222", 2, 2, 2], [b, "AB222", 4, 1, 2], [c3, "AB222", 3, 1, 2]
  ].map(([id, code, score, round, week]) => [date, "", id, code, "", "", "", "", "", score, round, 5, "", week])]);
  backend.setRows("Presence", [["Timestamp"], ...[a, b, c3, d].map(id => [date, id, "", "AB222", ""])]);
  backend.setRows("Item_Log", [["Timestamp"], ...Array.from({ length: 12 }, (_, i) =>
    [date, "AB222", i < 4 ? 2 : 1, 2, [a, b, c3][Math.floor(i / 4)], "", "L1-0" + (i % 4 + 1), i < 4 ? "A" : "B", "A", i < 4 ? 1 : 0, "H"])]);
  backend.setRows("Attempts", [["Timestamp"], [date, a, "Lecture 2", "", 1, 5, 30, "L2-01", "L2-01"]]);
}

test("each registered statistic has a unique identifier, data window and denominator", () => {
  const statistics = Object.values(modules).flatMap(module => module.statistics);
  assert.equal(new Set(statistics.map(stat => stat.id)).size, statistics.length);
  assert.ok(statistics.every(stat => stat.id && stat.window && stat.denominator));
});

for (const engine of ["js", "script"]) test(engine + " reconciles analytics and restores them without rewriting retained rows", t => {
  const c = classroom({ engine, students: 4 });
  t.after(() => c.backend.close());
  seed(c);
  c.backend.setRows("Diagnostic_Log", [["Timestamp"], [new Date().toISOString(), "DIAG01", 1, 1, c.students[0].id, 1, "L2-01", "Vectors", "A", "B", 0]]);
  c.backend.setRows("Question_Stats", [["Question ID", "Lecture"], ["L2-01", 2]]);
  const tabs = ["Attendance", "Form Responses 1", "Presence", "Item_Log", "Attempts", "Diagnostic_Log", "Question_Stats"];
  const readRows = () => JSON.parse(JSON.stringify(tabs.map(tab => c.backend.rawRows(tab))));
  const original = readRows();
  const snapshot = () => courseStats(c.backend, {});
  const full = snapshot();
  const metrics = new Map(full.analytics.metrics.map(metric => [metric.id, metric]));
  const values = id => { const m = metrics.get(id); return [m.value, m.sample, m.numerator]; };
  assert.deepEqual(values("attendanceRate"), [64.3, 14, 9]);
  assert.deepEqual(values("absences"), [5, 14, undefined]);
  assert.deepEqual(values("sessionsHeld"), [4, 4, undefined]);
  assert.deepEqual(values("quizScores"), [60, 3, undefined]);
  assert.deepEqual(values("quizParticipation"), [75, 4, 3]);
  assert.deepEqual(values("quizCompletion"), [75, 4, 3]);
  assert.deepEqual(values("practiceAttempts"), [1, 4, 1]);
  assert.deepEqual(values("quizItemResults"), [12, 12, undefined]);
  assert.deepEqual(values("practiceItemResults"), [1, 1, undefined]);
  assert.deepEqual(values("diagnosticResponses"), [1, 1, undefined]);
  assert.equal(full.analytics.available.diagnostics, true);
  assert.deepEqual(full.analytics.suggestions.support.students.map(s => s.id), [c.students[0].id]);
  assert.deepEqual(full.analytics.suggestions.revisit, { title: "Lecture 1", sample: 12, value: 33.3, evidence: "Limited evidence" });
  assert.match(view.suggestions(full), /Observational association/);
  assert.match(view.measurements(full), /9 of 14 marks · Descriptive evidence/);

  c.backend.saveModules(["attendance", "analytics"]);
  const attendance = snapshot();
  assert.deepEqual(attendance.quizzes, []);
  assert.deepEqual(attendance.questions, []);
  assert.equal(attendance.attendance.rate, 64.3);
  assert.equal(c.host("class_stats").quizzes.length, 0);
  assert.deepEqual(c.host("insights").questions, []);
  assert.equal(attendance.analytics.available.diagnostics, false);
  assert.doesNotMatch(ruleText(aggregates(attendance)), /quiz|practice/i);
  assert.equal(c.host("student_stats", { id: c.students[0].id }).student.practiceAttempts, 0);
  assert.deepEqual(attendance.analytics.suggestions, { support: null, revisit: null });
  assert.deepEqual(model.kpis(attendance).map(card => card.key), ["students", "attendance", "risk"]);
  assert.deepEqual(model.progress(attendance, { target: 8 }).map(tab => tab.key), ["attendance"]);
  assert.doesNotMatch(view.measurements(attendance), /quiz|practice/i);
  assert.doesNotMatch(board.html(attendance, { target: 8 }), /Quiz average per quiz|Lectures held against the plan|Topics needing attention/);
  assert.doesNotMatch(dashboard.health(attendance).reasons.join(" "), /quiz|practice/i);
  assert.deepEqual(Explore.forScreen("ov-quizzes", attendance, {}), []);

  c.backend.saveModules(["liveQuizzes", "analytics"]);
  const quizzes = snapshot();
  assert.deepEqual(quizzes.attendance.bySession, []);
  assert.equal(quizzes.questions.reduce((sum, q) => sum + q.answers, 0), 12);
  assert.doesNotMatch(Graphs.render(quizzes), /measure:att|Does attendance go with performance/);
  assert.doesNotMatch(ruleText(aggregates(quizzes)), /attendance/i);
  assert.equal(quizzes.analytics.available.diagnostics, true);
  assert.deepEqual(readRows(), original);

  c.backend.saveModules(defaultModules());
  assert.deepEqual(snapshot().analytics, full.analytics);
  assert.deepEqual(readRows(), original);
});

test("an enabled module with no records supplies no measures", t => {
  const c = classroom({ engine: "js", students: 3 });
  t.after(() => c.backend.close());
  c.backend.saveModules(["attendance", "analytics"]);
  const stats = c.backend.stats({});
  const d = { ...stats, analytics: assemble(stats, c.backend.enabledModules()) };
  assert.deepEqual(d.analytics.metrics, []);
  assert.equal(dashboard.health(d).word, "Not enough data");
  assert.deepEqual(model.kpis(d).map(card => card.key), ["students"]);
  assert.equal(board.html(d), "");
});
