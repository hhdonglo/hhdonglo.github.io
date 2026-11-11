/* Importing results from the web version: run with `npm test` in class-manager/desktop (Node 20 or later, no Electron needed).
   The "web" workbook is the made-up class of sample-class.js written as an Excel file the way Google Sheets writes one.
   - Cells keep their kind: text, numbers and dates.
   - The preview counts what would be added and changes nothing.
   - Applying adds the records, matched to the class list by student ID, and works out Master, Scores and Totals again.
   - Importing the same file again adds nothing (no duplicates), and it never changes a record that is already there.
   - Attendance gains sessions and marks of 1 only; open sessions and link secrets are not copied.
   - Learning Progress and the statistics see the imported practice attempts. */
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const V = require("../import-values");
const { readBook } = require("../xlsx-book");
const { plan } = require("../import-plan");
const { apply } = require("../import-apply");
const { classroom } = require("./classroom");
const { sampleClass } = require("./sample-class");
const { makeXlsx } = require("./web-export");

const tmp = (p) => fs.mkdtempSync(path.join(os.tmpdir(), p));
const NOW = Date.UTC(2026, 10, 10, 12, 0, 0);

async function webFile(mutate) {
  const s = sampleClass({ now: NOW });
  const tabs = Object.assign({}, s.tabs);
  if (mutate) mutate(tabs, s);
  const file = path.join(tmp("cm-web-"), "web.xlsx");
  fs.writeFileSync(file, await makeXlsx(Object.entries(tabs).map(([name, rows]) => ({ name, rows }))));
  return { file, s, tabs };
}
const local = (c) => ({ read: (n) => c.backend.rows(n) });
const hooks = (c) => ({ addToClassList: (rows) => c.backend.rosterSync(rows, false), rebuild: () => c.backend.rebuildMarks() });
// A course whose class list is the first `n` students of the made-up class, as a lecturer's own section would be.
function course(s, n) {
  const c = classroom();
  c.backend.rosterSync(s.ids.slice(0, n).map((id, i) => [id, s.names[i]]), true);
  return c;
}
const reportOf = (r, tab) => r.report.tabs.find((t) => t.tab === tab);

test("values: the same record gives the same key whatever the spreadsheet made of it", () => {
  assert.equal(V.idOf(22524013), "22524013");
  assert.equal(V.idOf("22524013.0"), "22524013");
  assert.equal(V.idOf(" 2252 4013 "), "22524013");
  assert.equal(V.codeOf(26271), "26271");
  assert.equal(V.codeOf("ab12 "), "AB12");
  assert.equal(V.numOf("0.0"), "0");
  assert.equal(V.timeOf(new Date(2026, 10, 4, 8, 25, 36, 258)), "2026-11-04 08:25:36");
  assert.equal(V.timeOf("2026-11-04 08:25:36.25800"), "2026-11-04 08:25:36");
  assert.equal(V.sessionOf(new Date(2026, 10, 4)), "04/11/2026");
  assert.equal(V.markOf("1.0"), 1);
  assert.equal(V.markOf(""), "");
});

test("the reader keeps text, numbers and dates, and skips hidden sheets", async () => {
  const file = path.join(tmp("cm-rd-"), "a.xlsx");
  fs.writeFileSync(file, await makeXlsx([
    { name: "Data", rows: [["When", "ID", "Note"], [new Date(2026, 10, 4, 8, 25, 36), 22524013, "007"]] },
    { name: "Hidden", rows: [["x"]], hidden: true }]));
  const book = await readBook(file);
  assert.deepEqual(book.map((s) => s.name), ["Data"]);
  const row = book[0].rows[1];
  assert.equal(row[0].getTime(), new Date(2026, 10, 4, 8, 25, 36).getTime());
  assert.equal(row[1], 22524013);
  assert.equal(row[2], "007");
});

test("a CSV of one tab is recognised by its columns", async () => {
  const file = path.join(tmp("cm-csv-"), "export.csv");
  fs.writeFileSync(file, "Timestamp,Student ID,Quiz,Attempt,Score,Total,Seconds,Wrong question ids\n2026-11-01 09:28:30,20000001,Lecture 1 practice,1,4,5,300,L1-Q2\n");
  const { s } = await webFile();
  const c = course(s, 3);
  c.backend.rosterSync([["20000001", "Test"]], false);
  const r = plan(await readBook(file), local(c));
  assert.equal(reportOf(r, "Attempts").add, 1);
});

test("a file with none of the known tabs says so and changes nothing", async () => {
  const file = path.join(tmp("cm-none-"), "x.csv");
  fs.writeFileSync(file, "colour,size\nred,3\n");
  const { s } = await webFile();
  const r = plan(await readBook(file), local(course(s, 3)));
  assert.equal(r.report.changes, 0);
  assert.match(r.report.warnings[0], /none of the tabs/);
});

test("the preview counts what would be added, matches by ID, and writes nothing", async () => {
  const { file, s, tabs } = await webFile();
  const c = course(s, 20);
  const before = JSON.stringify(c.backend.tabs());
  const r = plan(await readBook(file), local(c));
  const onList = new Set(s.ids.slice(0, 20));
  const resp = reportOf(r, "Form Responses 1");
  assert.equal(resp.add, tabs["Form Responses 1"].slice(1).filter((x) => onList.has(String(x[2]))).length);
  assert.equal(resp.offList, tabs["Form Responses 1"].length - 1 - resp.add);
  assert.ok(reportOf(r, "Attempts").add > 0);
  assert.ok(reportOf(r, "Attendance").newSessions.length === 8);
  assert.equal(r.report.students.classList, 20);
  assert.equal(r.report.students.withData, 20);
  assert.ok(r.report.students.notOnList > 0 && r.report.students.toAdd === 0);
  assert.ok(r.report.ignored.some((x) => x.tab === "Presence"), "live session logs are listed as not imported");
  assert.equal(JSON.stringify(c.backend.tabs()), before, "a preview changes nothing");
});

test("applying adds the records and works out the marks again; applying twice adds nothing", async () => {
  const { file, s, tabs } = await webFile();
  const c = course(s, 20);
  const book = await readBook(file);
  const first = plan(book, local(c));
  const done = apply(first.ops, c.backend, hooks(c));
  assert.ok(done.rows > 0);
  const onList = new Set(s.ids.slice(0, 20));
  const have = (name) => (c.backend.rows(name) || []).length - 1;
  assert.equal(have("Form Responses 1"), tabs["Form Responses 1"].slice(1).filter((x) => onList.has(String(x[2]))).length);
  assert.equal(have("Attempts"), tabs.Attempts.slice(1).filter((x) => onList.has(String(x[1]))).length);
  assert.ok(have("Attendance_Log") > 0 && have("Item_Log") > 0);
  const scores = c.backend.rows("Scores");
  assert.ok(scores && scores.length > 3, "Scores is filled");
  assert.ok((c.backend.rows("Totals") || []).length > 1, "Totals is filled");
  const again = plan(book, local(c));
  assert.equal(again.report.changes, 0, "nothing is added the second time");
  again.report.tabs.forEach((t) => assert.equal(t.add, 0, t.tab));
  assert.equal(again.ops.tabs.length, 0);
  const n = have("Form Responses 1");
  apply(again.ops, c.backend, hooks(c));
  assert.equal(have("Form Responses 1"), n);
});

test("imported practice attempts reach the statistics and Learning Progress", async () => {
  const { file, s } = await webFile();
  const c = course(s, 20);
  apply(plan(await readBook(file), local(c)).ops, c.backend, hooks(c));
  const st = c.backend.stats({});
  assert.ok(st && st.ok !== false, "class statistics work out");
  const pr = c.backend.progress({});
  assert.ok(pr && pr.ok, "learning progress works out");
  const text = JSON.stringify(pr);
  assert.match(text, /Secure|Developing|Beginning|Not enough evidence/);
});

test("attendance gains sessions and marks of 1, and never loses a mark", async () => {
  const { file, s } = await webFile();
  const c = course(s, 5);
  const id = s.ids[0], other = s.ids[1];
  const sh = c.backend.sheet("Attendance", true);
  const first = s.tabs.Attendance[0][1]; // the first session's label
  sh.getRange(1, 1, 3, 2).setValues([["Student ID", first], [id, 0], [other, 1]]);
  const book = await readBook(file);
  const r = plan(book, local(c));
  apply(r.ops, c.backend, hooks(c));
  const grid = c.backend.rows("Attendance");
  const row = (x) => grid.find((g) => String(g[0]) === x);
  const webRow = s.tabs.Attendance.find((g) => g[0] === id), webOther = s.tabs.Attendance.find((g) => g[0] === other);
  assert.equal(row(id)[1], webRow[1] ? 1 : 0, "a 0 here becomes 1 if the web has a 1");
  assert.equal(row(other)[1], 1, "a 1 here stays 1 even if the web has 0");
  assert.equal(grid[0].length, s.tabs.Attendance[0].length, "the other sessions are added as columns");
  assert.equal(String(webOther.length), String(grid[0].length));
});

test("sessions still open are not copied, secrets are dropped, and a code in use here is kept", async () => {
  const { file, s } = await webFile((tabs) => {
    const ctl = tabs.Attendance_Control.map((r) => r.slice());
    ctl.push(["9001", "20/11/2026 #1", "Open", new Date(2026, 10, 20, 8), "", "topsecret", "", "", ""]);
    ctl.push(["9002", "21/11/2026 #1", "Closed", new Date(2026, 10, 21, 8), new Date(2026, 10, 21, 8, 20), "secret2", "", "", ""]);
    ctl.push(["4100", "22/11/2026 #1", "Submitted", new Date(2026, 10, 22, 8), new Date(2026, 10, 22, 8, 20), "secret3", "", "", ""]); // code 4100 belongs to the first session
    tabs.Attendance_Control = ctl;
  });
  const c = course(s, 5);
  const r = plan(await readBook(file), local(c));
  const rep = reportOf(r, "Attendance_Control");
  assert.equal(rep.open, 2);
  assert.equal(rep.conflicts, 1);
  assert.equal(rep.add, s.sessions.length);
  apply(r.ops, c.backend, hooks(c));
  const rows = c.backend.rows("Attendance_Control").slice(1);
  assert.equal(rows.length, s.sessions.length);
  rows.forEach((x) => assert.equal(String(x[5] || ""), "", "the link secret is never copied"));
  assert.ok(!rows.some((x) => /^(Open|Closed)$/.test(x[2])));
});

test("students not on the class list are left out, or added with their names when asked", async () => {
  const { file, s } = await webFile();
  const c = course(s, 5);
  const book = await readBook(file);
  const without = plan(book, local(c), { addMissing: false });
  assert.ok(without.report.students.notOnList > 0);
  assert.equal(without.ops.roster.length, 0);
  const withAll = plan(book, local(c), { addMissing: true });
  assert.equal(withAll.report.students.toAdd, s.ids.length - 5);
  assert.equal(withAll.report.students.notOnList, 0);
  assert.ok(withAll.ops.roster.every((x) => x[1]), "names come from the file");
  apply(withAll.ops, c.backend, hooks(c));
  assert.equal(c.backend.rows("Roster").filter((r) => V.idOf(r[0]).length >= 4).length, s.ids.length);
  assert.equal(plan(book, local(c), { addMissing: true }).report.changes, 0);
});

test("an empty class list is reported, not guessed", async () => {
  const { file } = await webFile();
  const c = classroom();
  const r = plan(await readBook(file), local(c));
  assert.equal(r.report.changes, 0);
  assert.match(r.report.warnings.join(" "), /no class list/);
});

test("columns are found by name, and the live quiz results by position whatever the first heading says", async () => {
  const { file, s } = await webFile((tabs) => {
    tabs["Form Responses 1"] = tabs["Form Responses 1"].map((r, i) => (i ? r : ["hh"].concat(r.slice(1))));
    tabs.Reports = [["Timestamp", "Lecture", "Question id", "Question", "Answer shown", "Comment", "", "Email"], [new Date(2026, 10, 2, 9), "Lecture 1", "L1-15", "q?", "a", "c", "", "x@example.org"]];
    tabs.Attempts = tabs.Attempts.map((r) => r.slice().reverse().slice(0, 0).concat(r)); // unchanged: same columns
  });
  const c = course(s, 20);
  const r = plan(await readBook(file), local(c));
  assert.ok(reportOf(r, "Form Responses 1").add > 0);
  assert.equal(reportOf(r, "Reports").add, 1);
  apply(r.ops, c.backend, hooks(c));
  const rep = c.backend.rows("Reports");
  assert.equal(rep[1][5], "c");
  assert.equal(rep[0].length >= 7, true);
});

test("the screen's calls: pick, change the option, apply, and a failed backup stops the import", async () => {
  const { file, s } = await webFile();
  const c = course(s, 5);
  const handlers = {};
  let backupOk = true;
  const ctx = { id: "phys-143", backend: c.backend, backups: { make: () => (backupOk ? { ok: true, name: "workbook-test.cmv" } : { ok: false, why: "disk full" }) } };
  require("../import-ipc").register({
    on: (ch, fn) => { handlers[ch] = (...a) => fn(ctx, {}, ...a); },
    dialog: { showOpenDialog: async () => ({ canceled: false, filePaths: [file] }) }, winOf: () => null });
  const picked = await handlers["cm:importPick"]();
  assert.ok(picked.ok && picked.report.students.notOnList > 0);
  const more = handlers["cm:importPlan"]({ addMissing: true });
  assert.equal(more.report.students.notOnList, 0);
  backupOk = false;
  const refused = handlers["cm:importApply"]({ addMissing: false });
  assert.equal(refused.ok, false);
  assert.match(refused.why, /backup/);
  assert.equal((c.backend.rows("Attempts") || []).length, 0, "nothing was written");
  backupOk = true;
  const ok = handlers["cm:importApply"]({ addMissing: false });
  assert.ok(ok.ok && ok.done.rows > 0 && ok.backup === "workbook-test.cmv");
  assert.equal(handlers["cm:importPlan"]({}).ok, false, "the file is forgotten after an import");
});

test("continuing from existing data: an empty course takes the class list from the file, including students with no records yet", async () => {
  const { file, s } = await webFile((tabs) => { tabs.Roster = tabs.Roster.concat([["29990001", "Quiet Student"]]); });
  const c = classroom(); // a new course: no class list
  const book = await readBook(file);
  const r = plan(book, local(c), { addMissing: true });
  assert.equal(r.report.students.toAdd, s.ids.length + 1);
  assert.ok(r.ops.roster.some((x) => x[0] === "29990001" && x[1] === "Quiet Student"));
  apply(r.ops, c.backend, hooks(c));
  assert.equal(c.backend.rows("Roster").filter((x) => V.idOf(x[0]).length >= 4).length, s.ids.length + 1);
  assert.ok((c.backend.rows("Form Responses 1") || []).length > 1);
  assert.equal(plan(book, local(c), { addMissing: true }).report.changes, 0, "continuing twice adds nothing");
});

test("from scratch: only student IDs and names are needed, and every tab gets a row per student", () => {
  const { buildFromRoster } = require("../build-from-roster");
  const c = classroom();
  c.backend.rosterSync([["20000001", "Ama Mensah"], ["20000002", "Kofi Boateng"], ["20000003", ""]], false);
  const r = c.backend.buildFromRoster();
  assert.equal(r.students, 3);
  const ids = (name, from) => c.backend.rows(name).slice(from).map((x) => String(x[0]));
  assert.deepEqual(ids("Attendance", 1), ["20000001", "20000002", "20000003"]);
  assert.deepEqual(ids("Master", 1), ["20000001", "20000002", "20000003"]);
  assert.deepEqual(ids("Scores", 3), ["20000001", "20000002", "20000003"]);
  assert.equal(c.backend.rows("Master")[1][1], "Ama Mensah");
  assert.deepEqual(c.backend.buildFromRoster(), { students: 3, attendance: 0, master: 0, scores: 0 }, "building again adds nothing");
  c.backend.rosterSync([["20000004", "Esi Ofori"]], false);
  assert.equal(c.backend.buildFromRoster().attendance, 1, "a new student gets a row");
  assert.equal(buildFromRoster({ sheet: () => null, rows: () => null }).students, 0);
  // The script carries on from here: a quiz result for a student lands in the row that was built.
  const rows = [["Student ID", "Quiz", "Score", "Out of"], ["20000001", "Week 1", 4, 5]];
  const l = { read: (n) => c.backend.rows(n) };
  apply(plan([{ name: "Quiz scores", rows }], l).ops, c.backend, hooks(c));
  assert.equal(c.backend.rows("Scores").filter((x) => String(x[0]) === "20000001").length, 1);
});

test("the template loads: roster, quiz scores and attendance, and an unfilled template adds nothing", async () => {
  const tpl = require("../import-template"), excel = require("../excel");
  const file = path.join(tmp("cm-tpl-"), "t.xlsx");
  fs.writeFileSync(file, await excel.writeXlsx(tpl.templateSheets()));
  const empty = classroom();
  assert.equal(plan(await readBook(file), { read: (n) => empty.backend.rows(n) }, { addMissing: true }).report.changes, 0, "headings only");
  const filled = tpl.templateSheets();
  filled[1].rows.push(["20000001", "Ama", "Mensah"], ["20000002", "Kofi", "Boateng"]);
  filled[2].rows.push(["20000001", "Week 1", 4, 5, "2026-11-10"], ["20000002", "Week 1", 3, 5, ""]);
  filled[3].rows[0].push("10/11/2026"); filled[3].rows.push(["20000001", 1], ["20000002", 0]);
  fs.writeFileSync(file, await excel.writeXlsx(filled));
  const c = classroom();
  const r = plan(await readBook(file), { read: (n) => c.backend.rows(n) }, { addMissing: true });
  assert.equal(r.report.students.toAdd, 2);
  apply(r.ops, c.backend, hooks(c));
  assert.equal(c.backend.rows("Roster")[1][1], "Ama Mensah");
  assert.equal((c.backend.rows("Totals") || []).length, 3);
  assert.equal(String(c.backend.rows("Attendance")[1][1]), "1");
  assert.equal(plan(await readBook(file), { read: (n) => c.backend.rows(n) }, { addMissing: true }).report.changes, 0);
});

test("a missing required column is named plainly, with the columns that were found", () => {
  const c = classroom(); c.backend.rosterSync([["20000001", "Ama"]], false);
  const book = [{ name: "Attempts", rows: [["Timestamp", "Student ID", "Quiz", "Attempt", "Total"], [new Date(), "20000001", "Lecture 1 practice", 1, 5]] }];
  const r = plan(book, { read: (n) => c.backend.rows(n) });
  const t = r.report.tabs[0];
  assert.equal(t.status, "skipped");
  assert.deepEqual(t.missing, ["Score"]);
  assert.match(t.note, /no column found for Score.*Timestamp, Student ID, Quiz, Attempt, Total/);
  const scores = plan([{ name: "Quiz scores", rows: [["Student ID", "Quiz"], ["20000001", "W1"]] }], { read: (n) => c.backend.rows(n) });
  assert.match(scores.report.tabs[0].note, /no column found for Score/);
});

test("other headings that mean the same are recognised", () => {
  const c = classroom(); c.backend.rosterSync([["20000001", "Ama"]], false);
  const book = [{ name: "Attempts", rows: [["Date", "Student Number", "Quiz", "Attempt", "Marks", "Out of"], [new Date(2026, 10, 5, 9), "20000001", "Lecture 1 practice", 1, 4, 5]] }];
  const r = plan(book, { read: (n) => c.backend.rows(n) });
  assert.equal(r.report.tabs[0].add, 1);
  assert.ok(r.report.tabs[0].columns.some((x) => x.need === "Student ID" && x.found === "Student Number"));
});

test("a large file is read in chunks and planned quickly", async () => {
  const N = 40000, ids = Array.from({ length: 1200 }, (_, i) => String(30000001 + i));
  const rows = [["Timestamp", "Student ID", "Quiz", "Attempt", "Score", "Total", "Seconds", "Wrong question ids"]];
  for (let i = 0; i < N; i++) rows.push([new Date(2026, 9, 1 + (i % 28), 9, i % 60, i % 59), ids[i % ids.length], "Lecture " + (1 + (i % 12)) + " practice", 1 + Math.floor(i / 1200), i % 6, 5, 300, ""]);
  const file = path.join(tmp("cm-big-"), "big.xlsx");
  fs.writeFileSync(file, await makeXlsx([{ name: "Attempts", rows }]));
  const t0 = Date.now(), progress = [];
  const book = await readBook(file, (p) => progress.push(p.rows));
  const tRead = Date.now() - t0;
  assert.equal(book[0].rows.length, N + 1);
  assert.ok(progress.length >= N / 3000 - 1, "progress is reported as the sheet is read");
  const c = classroom(); c.backend.rosterSync(ids.map((id) => [id, ""]), false);
  const t1 = Date.now();
  const r = plan(book, { read: (n) => c.backend.rows(n) });
  assert.equal(r.report.tabs[0].add, N);
  const tPlan = Date.now() - t1;
  assert.ok(tRead < 15000 && tPlan < 5000, "read " + tRead + " ms, plan " + tPlan + " ms");
  console.log("# 40,000 rows: read " + tRead + " ms, plan " + tPlan + " ms");
});
