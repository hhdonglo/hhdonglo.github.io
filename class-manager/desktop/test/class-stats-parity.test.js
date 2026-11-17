/* rules/class-stats.js gives the lecturer's Class statistics, the learning verdict and the areas to target as the Apps Script does. */
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { classroom } = require("./classroom");
const S = require("../rules/class-stats");
const { fromBackend } = require("../rules/store");

const ago = (d, m) => new Date(Date.now() - d * 864e5 + (m || 0) * 6e4).toISOString();
// CM adds clean session dates ("2 Nov 2026"), a date field and the attendance bands (people); the Apps Script copy keeps the file's own heading. Both sides are compared on the clean date.
const { sessionLabel } = require("../rules/session-label");
const norm = (r) => JSON.parse(JSON.stringify(r, (k, v) => (k === "_session" || k === "topics" || k === "topicsError" || k === "version" || k === "generated" || k === "people" || k === "date" ? undefined : typeof v === "string" ? v.replace(/\b\d\d\/\d\d\/\d{4}\b/g, (d) => sessionLabel(d)) : v)));

function scenario(n, then) {
  const script = classroom({ students: n }), mod = classroom({ students: n });
  script.backend.setProp("draw_salt", ":abcd1234");
  const quiz = (code, wrongBias) => {
    const ctl = (p) => script.host("control", Object.assign({ code }, p));
    ctl({ act: "init" }); ctl({ act: "set", field: "q_seconds", value: "0" }); ctl({ act: "start" });
    script.students.forEach((s) => script.call({ kind: "join", name: s.name, id: s.id, code }));
    for (let q = 1; q <= 5; q++) {
      script.students.forEach((s, i) => { if ((i + q + code.length) % 7 !== 0) script.call({ kind: "answer", name: s.name, id: s.id, code, q, answer: "ABCDE"[(i * q + wrongBias) % 3], conf: "HML"[i % 3] }); });
      if (q < 5) ctl({ act: "next" });
    }
    ctl({ act: "next" }); ctl({ act: "release" });
  };
  quiz("26271", 0); quiz("26272", 1);
  script.students.slice(0, 8).forEach((s, i) => {
    script.call({ kind: "attempt", id: s.id, quiz: "Lecture 1 Vectors", attempt: "1", score: String(4 + (i % 4)), total: "10", seconds: "120", wrong: "L1-01,L1-02", asked: "L1-01,L1-02,L1-03,L1-04" });
    if (i % 2) script.call({ kind: "attempt", id: s.id, quiz: "Lecture 1 Vectors", attempt: "2", score: "9", total: "10", seconds: "90", wrong: "", asked: "L1-01,L1-02,L1-03,L1-04" });
  });
  const book = JSON.parse(script.backend.exportText());
  const extra = (b) => {
    const put = (name, rows) => { let t = b.sheets.find((x) => x.name === name); if (!t) { t = { name, rows: [] }; b.sheets.push(t); } t.rows = rows; };
    const ids = script.students.map((s) => s.id);
    put("Attendance", [["Student ID", "02/11/2026", "09/11/2026", "16/11/2026"]].concat(ids.map((id, i) => [id, i % 3 ? 1 : 0, i % 4 ? 1 : 0, i % 5 === 0 ? "" : (i % 2)])));
    put("Attendance_Control", [["Code", "Label", "Status", "Opened", "Closed", "Secret", "Lat", "Lon", "Radius m"], ["AAAA", "02/11/2026", "Closed", { $d: ago(14) }, { $d: ago(14, 50) }, "s", "", "", ""], ["BBBB", "09/11/2026", "Closed", { $d: ago(7) }, { $d: ago(7, 50) }, "s", "", "", ""]]);
    put("Attendance_Log", [["Time", "Session", "ID", "Name", "Outcome", "By"]].concat(ids.flatMap((id, i) => [[{ $d: ago(14, 1 + i) }, "02/11/2026", id, "N", "ok", "student"], [{ $d: ago(7, 3 + (i % 5) * 4) }, "09/11/2026", id, "N", "ok", i === 2 ? "lecturer" : "student"]])));
  };
  [script, mod].forEach((c) => c.editWorkbook((b) => { if (c === mod) { b.sheets = book.sheets; b.props = book.props; } extra(b); }));
  try { then({ script, mod, store: () => fromBackend(mod.backend) }); } finally { script.backend.close(); mod.backend.close(); }
}

test("Class statistics match: attendance, quizzes, questions, students, groups, verdict and targets", () => scenario(12, ({ script, store }) => {
  for (const p of [{}, { effort: "40", perf: "60", idle: "1", misses: "1" }]) {
    const a = script.host("class_stats", p), b = S.classStats(store(), p, a.version);
    assert.deepEqual(norm(b), norm(a), JSON.stringify(p));
  }
  const a = script.host("class_stats", {});
  assert.equal(a.quizzes.length, 2); assert.ok(a.students.length === 12 && a.questions.length > 5 && a.attendance.sessions === 3);
  assert.ok(a.learning.signals.length >= 1 && a.targets.length >= 1, "a verdict and targets are produced");
}));

test("an empty class gives the same empty answers", () => {
  const script = classroom({ students: 0 }), mod = classroom({ students: 0 });
  try {
    const a = script.host("class_stats", {}), b = S.classStats(fromBackend(mod.backend), {}, a.version);
    assert.deepEqual(norm(b), norm(a));
  } finally { script.backend.close(); mod.backend.close(); }
});
