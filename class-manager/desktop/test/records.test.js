"use strict";
// Record categories, scores written as fractions, and one record per student and assessment. Made-up data only.
const test = require("node:test");
const assert = require("node:assert");
const { categoryOf, stampOf } = require("../autoload/categories");
const { fractionOf, scoreCell } = require("../autoload/values");
const { extractBook, planBookOf } = require("../autoload/extract");
const { plan } = require("../import-plan");
const { apply } = require("../import-apply");
const { classroom } = require("./classroom");

test("a heading says which category an assessment belongs to, and when", () => {
  assert.strictEqual(categoryOf("Lab 2"), "Laboratory");
  assert.strictEqual(categoryOf("Assignment 1"), "Assignment");
  assert.strictEqual(categoryOf("Practice 3"), "Practice");
  assert.strictEqual(categoryOf("Group project B"), "Group assessment");
  assert.strictEqual(categoryOf("Quiz 3 (2026-09-29)"), "Quiz");
  assert.strictEqual(categoryOf("Q1"), "Quiz");
  assert.deepStrictEqual(stampOf("Quiz 3 (2026-09-29 09:05)"), { name: "Quiz 3", date: "2026-09-29", time: "09:05", lecture: "" });
  assert.deepStrictEqual(stampOf("Lab 2 - Week 5"), { name: "Lab 2 - Week 5", date: "", time: "", lecture: "5" });
  assert.strictEqual(stampOf("Quiz (29/09/2026)").date, "2026-09-29");
});

test("scores written as fractions are read with their total", () => {
  assert.deepStrictEqual(fractionOf("1 / 5"), { score: 1, total: 5 });
  assert.deepStrictEqual(fractionOf("8 of 10"), { score: 8, total: 10 });
  assert.strictEqual(fractionOf("5/0"), null);
  assert.deepStrictEqual(scoreCell(72), { score: 72, total: "" });
  assert.strictEqual(scoreCell("absent"), null);
});

const sheet = () => [{ name: "Sheet1", rows: [
  ["Student ID", "Name", "Level", "Quiz 1", "Quiz 2", "Lab 1", "Total", "Out of", "Percent"],
  ["22524013", "Keziah", 2, "1 / 5", "5 / 5", "15/20", 6, 10, 60],
  ["22525330", "Kingsley", 2, "1 / 5", "3 / 5", "12/20", 4, 10, 40],
  ["22525393", "Zerne", 2, "1 / 5", "1 / 5", "", 2, 10, 20]] }];

test("a table of fractions gives quiz results and laboratory records, and ignores total, out of and percent", () => {
  const ex = extractBook(sheet(), "scores.xlsx");
  assert.strictEqual(ex.clean.results.length, 6);
  assert.deepStrictEqual(ex.clean.results[0], ["22524013", "Quiz 1", 1, 5, ""]);
  assert.strictEqual(ex.clean.records.length, 2);
  assert.deepStrictEqual(ex.clean.records[0], ["", "22524013", "Laboratory", "Lab 1", 15, 20, ""]);
  const names = planBookOf([], ex).map((s) => s.name);
  assert.ok(names.includes("Records") && names.includes("Quiz scores"));
});

test("through the screens' calls: records are filed once per student and assessment, and a later file adds only the new assessment", async () => {
  const fs = require("fs"), os = require("os"), path = require("path");
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "cm-rec-")), data = fs.mkdtempSync(path.join(os.tmpdir(), "cm-recd-"));
  const csv = (rows) => rows.map((r) => r.join(",")).join("\n") + "\n";
  fs.writeFileSync(path.join(root, "list.csv"), csv([["Student ID", "Surname", "First name"], ["20000001", "Mensah", "Ama"], ["20000002", "Boateng", "Kofi"]]));
  fs.writeFileSync(path.join(root, "labs.csv"), csv([["Student ID", "Lab 1", "Lab 2"], ["20000001", "15/20", "18/20"], ["20000002", "12/20", "16/20"]]));
  const handlers = new Map(), c = classroom();
  c.id = "t2"; c.backups = { make: () => ({ ok: true, name: "b" }) };
  const dialog = { showOpenDialog: async () => ({ canceled: false, filePaths: [root] }) };
  require("../autoload-ipc").register({ on: (ch, fn) => handlers.set(ch, fn), dialog, winOf: () => null, shell: null, dirOf: () => data });
  require("../import-ipc").register({ on: (ch, fn) => handlers.set(ch, fn), dialog, winOf: () => null, shell: null });
  const e = { sender: { send() {} } }, call = (ch, ...a) => handlers.get(ch)(c, e, ...a);
  const found = await call("cm:autoPick"), ids = found.files.filter((f) => f.useful).map((f) => f.id);
  const p = await call("cm:autoPlan", { ids }); assert.ok(p.ok, p.why);
  assert.ok((await call("cm:importApply", { addMissing: true })).ok);
  const recs = c.backend.rows("Records");
  assert.strictEqual(recs.length - 1, 4, "two students, two labs");
  assert.ok(recs.slice(1).every((r) => r[2] === "Laboratory"));
  const again = await call("cm:autoPlan", { ids }); assert.strictEqual(again.report.changes, 0, "the same file adds nothing");
  fs.writeFileSync(path.join(root, "labs.csv"), csv([["Student ID", "Lab 1", "Lab 2", "Lab 3"], ["20000001", "15/20", "18/20", "19/20"], ["20000002", "12/20", "16/20", "18/20"]]));
  const f2 = await call("cm:autoScan", { force: true }), ids2 = f2.files.filter((f) => f.useful).map((f) => f.id);
  const p2 = await call("cm:autoPlan", { ids: ids2 }); assert.strictEqual(p2.report.changes, 2, "only Lab 3 is new");
  assert.ok((await call("cm:importApply", { addMissing: false })).ok);
  assert.strictEqual(c.backend.rows("Records").length - 1, 6);
  c.backend.rosterSync([["20000001", "Ama Mensah"]], false);
  const st = c.backend.studentStats({ id: "20000001" });
  assert.strictEqual(st.records.filter((x) => x.category === "Laboratory").length, 3, "the student's own history shows every laboratory");
});

test("the student's records and notes come from the server script, and a note is kept for that student only", () => {
  const c = classroom(); c.backend.rosterSync([["20000001", "Ama Mensah"], ["20000002", "Kofi Boateng"]], false);
  assert.strictEqual(c.backend.studentNote("20000001", "Asked for extra help").ok, true);
  assert.strictEqual(c.backend.studentNote("29999999", "not on the list").ok, false);
  assert.strictEqual(c.backend.studentNote("20000001", "   ").ok, false);
  const r = c.backend.studentStats({ id: "20000001" });
  assert.strictEqual(r.ok, true); assert.strictEqual(r.notes.length, 1); assert.strictEqual(r.notes[0].text, "Asked for extra help");
  assert.strictEqual(c.backend.studentStats({ id: "20000002" }).notes.length, 0);
  const V = require("../app/records-view");
  const html = V.html({ records: [{ category: "Laboratory", assessment: "Lab 1", score: 15, outOf: 20, date: "2026-09-15", lecture: "3" }], notes: [{ text: "<b>x</b>", time: "2026-09-20T10:00:00Z" }] });
  assert.ok(html.includes("Lab 1") && html.includes("15 / 20") && !html.includes("<b>x</b>"));
});
