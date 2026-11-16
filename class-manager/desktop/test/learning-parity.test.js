/* rules/learning.js gives the lecturer's Teaching insights, a student's questions to revisit, records and notes as the Apps Script does. */
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { classroom } = require("./classroom");
const L = require("../rules/learning");
const { fromBackend } = require("../rules/store");

const CODE = "26271";
const ago = (d) => new Date(Date.now() - d * 864e5).toISOString();
const tab = (c, name) => { const b = JSON.parse(c.backend.exportText()).sheets.find((s) => s.name === name); return b ? b.rows : []; };
const T = (v) => ((typeof v === "string" && /^\d{4}-\d\d-\d\dT/.test(v)) || (v && typeof v === "object" && v.$d) ? "T" : v);
const strip = (rows) => rows.map((r) => { const x = r.map(T); while (x.length && (x[x.length - 1] === "" || x[x.length - 1] == null)) x.pop(); return x; }).filter((r) => r.length > 0);

function scenario(then) {
  const script = classroom({ students: 4 }), mod = classroom({ students: 4 });
  script.backend.setProp("draw_salt", ":abcd1234");
  const ctl = (p) => script.host("control", Object.assign({ code: CODE }, p)), ans = (s, q, a, conf) => script.call({ kind: "answer", name: s.name, id: s.id, code: CODE, q, answer: a, conf });
  ctl({ act: "init" }); ctl({ act: "set", field: "q_seconds", value: "0" }); ctl({ act: "start" });
  script.students.forEach((s, i) => { script.call({ kind: "join", name: s.name, id: s.id, code: CODE }); });
  for (let q = 1; q <= 5; q++) { script.students.slice(0, 3).forEach((s, i) => ans(s, q, "ABCDE"[(q * 2 + i) % 5], "HML"[i])); if (q < 5) ctl({ act: "next" }); }
  ctl({ act: "next" }); ctl({ act: "release" });
  const attempt = (id, quiz, n, score, total, wrong, asked, at) => script.call({ kind: "attempt", id, quiz, attempt: String(n), score: String(score), total: String(total), seconds: "30", wrong, asked });
  attempt("20000001", "Lecture 1 Vectors", 1, 6, 10, "L1-01,L1-02", "L1-01,L1-02,L1-03");
  attempt("20000001", "Lecture 1 Vectors (missed questions)", 2, 1, 2, "L1-02", "L1-01,L1-02");
  attempt("20000001", "Mock exam", 1, 7, 10, "L2-04", "L1-03,L2-04");
  attempt("20000002", "Introduction", 1, 4, 5, "L0-01", "L0-01");
  attempt("20000002", "Lecture 2 Motion", 1, 3, 5, "", "");
  const book = JSON.parse(script.backend.exportText());
  const extra = (b) => {
    const put = (name, rows) => { let t = b.sheets.find((x) => x.name === name); if (!t) { t = { name, rows: [] }; b.sheets.push(t); } t.rows = rows; };
    put("Attendance", [["Student ID", "Mon", "Tue"], ["20000001", 1, 1], ["20000002", 1, 0], ["20000003", 0, 0], ["20000004", "", 1]]);
    put("Records", [["Timestamp", "Student ID", "Category", "Assessment", "Score", "Out of", "Lecture"], [{ $d: ago(5) }, "20000001", "Lab", "Lab 1", 8, 10, "1"]]);
    put("Student_Notes", [["Timestamp", "Student ID", "Note", "By"], [{ $d: ago(3) }, "20000001", "First note", "lecturer"], [{ $d: ago(1) }, "20000001", "Second note", "lecturer"]]);
  };
  [script, mod].forEach((c) => c.editWorkbook((b) => { if (c === mod) { b.sheets = book.sheets; b.props = book.props; } extra(b); }));
  const store = () => fromBackend(mod.backend);
  try { then({ script, mod, store }); } finally { script.backend.close(); mod.backend.close(); }
}
const norm = (r) => JSON.parse(JSON.stringify(r, (k, v) => (k === "_session" || k === "version" ? undefined : v)));

test("Teaching insights match, and write the same Question_Stats tab", () => scenario(({ script, mod, store }) => {
  for (const p of [{}, { att: "90", quiz: "80", idle: "3" }]) {
    const a = script.host("insights", p), b = L.insights(store(), p, a.version);
    assert.deepEqual(norm(b), norm(a), JSON.stringify(p));
  }
  assert.ok(script.host("insights", {}).questions.length >= 5, "live questions are counted");
  assert.deepEqual(strip(tab(mod, "Question_Stats")), strip(tab(script, "Question_Stats")));
}));

test("a student's questions to revisit match what My results shows", () => scenario(({ script, store }) => {
  script.host("access_codes", { op: "generate" });
  const codes = tab(script, "Access_Codes");
  ["20000001", "20000002", "20000003"].forEach((id) => {
    const code = codes.find((r) => String(r[0]) === id)[1], r = script.call({ action: "my_results", id, code });
    assert.equal(r.ok, true);
    assert.deepEqual(norm(L.studentLearning(store(), id)), norm({ mastery: r.mastery, revisit: r.revisit, practice: r.practice }), id);
  });
}));

test("a student's records and notes, and adding a note", () => scenario(({ script, mod, store }) => {
  const a = script.host("student_stats", { id: "20000001" }), rec = L.studentRecords(store(), "20000001");
  // The script's sandbox does not see its dates as Dates (another realm), so it prints them as text; in Google they are dates and give these forms.
  const noDate = (xs) => xs.map((x) => Object.assign({}, x, { date: undefined, time: undefined }));
  assert.deepEqual(norm(noDate(rec.records)), norm(noDate(a.records))); assert.deepEqual(norm(noDate(rec.notes)), norm(noDate(a.notes)));
  assert.match(rec.records[0].date, /^\d{4}-\d\d-\d\d$/); assert.match(rec.notes[0].time, /^\d{4}-\d\d-\d\dT/); assert.equal(rec.notes[0].text, "Second note");
  for (const [id, text] of [["20000001", "A new note"], ["99999999", "x"], ["20000002", ""]]) assert.deepEqual(norm(L.noteAdd(store(), id, text)), norm(script.host("student_note", { id, text })));
  assert.deepEqual(strip(tab(mod, "Student_Notes")), strip(tab(script, "Student_Notes")));
}));
