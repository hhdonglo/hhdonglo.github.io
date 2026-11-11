/* Loading data from a folder: run with `npm test` in class-manager/desktop (Node 20 or later, no Electron needed).
   All data is made up. The tests check that files in any layout give the same clean data, that only the useful fields are kept,
   that originals are never changed, that a rescan reads only what changed, and that the existing import is used for the preview. */
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");
const JSZip = require("jszip");
const { detectSheet } = require("../autoload/detect");
const { extractBook } = require("../autoload/extract");
const { createStore } = require("../autoload/store");
const { scanFolder } = require("../autoload/folder");
const { mergeCleans, writeWorking } = require("../autoload/working");
const { readAny } = require("../autoload/read-file");
const { readBook } = require("../xlsx-book");
const { parseQuestions } = require("../authoring");
const { makeXlsx } = require("./web-export");
const { classroom } = require("./classroom");

const tmp = (p) => fs.mkdtempSync(path.join(os.tmpdir(), p));
const sha = (f) => crypto.createHash("sha1").update(fs.readFileSync(f)).digest("hex");
const write = (dir, rel, text) => { const f = path.join(dir, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, text); return f; };
const extractCsv = async (text) => { const d = tmp("cm-al-"); const f = write(d, "a.csv", text); return extractBook((await readAny(f)).sheets, "a.csv"); };

test("a class list is found by synonyms and only ID and names are kept", async () => {
  const ex = await extractCsv("S/N,Matric No,Surname,Other names,Level,Phone,Email\n1,20000001,Mensah,Ama,100,0244000000,a@x.org\n2,20000002,Boateng,Kofi,100,0244000001,k@x.org\n");
  assert.deepEqual(ex.clean.classList, [["20000001", "Ama", "Mensah"], ["20000002", "Kofi", "Boateng"]]);
  assert.equal(JSON.stringify(ex.clean).includes("0244"), false, "phone numbers and emails are not kept");
});

test("with no usable headings, the ID and name columns are found from what the cells hold", async () => {
  const ex = await extractCsv("Ama Mensah,20000001,Level 100\nKofi Boateng,20000002,Level 100\nEfua Owusu,20000003,Level 100\n");
  assert.equal(ex.clean.classList.length, 3);
  assert.deepEqual(ex.clean.classList[0], ["20000001", "Ama", "Mensah"]);
  assert.match(ex.sheets[0].columns.map((c) => c.by).join(), /content/);
});

test("title rows above the headings do not matter, and 'Last, First' is split", async () => {
  const ex = await extractCsv("Department of Physics,,\nRegistered students,,\n,,\nIndex Number,Full Name,Programme\n20000001,\"Mensah, Ama\",BSc\n20000002,Kofi Boateng,BSc\n");
  assert.deepEqual(ex.clean.classList, [["20000001", "Ama", "Mensah"], ["20000002", "Kofi", "Boateng"]]);
});

test("scores: one score file without a quiz column is named after the file; a wide table gives one quiz per column", async () => {
  const one = await extractCsv("ID,Marks\n20000001,7\n20000002,5\n");
  assert.deepEqual(one.clean.results.map((r) => [r[0], r[1], r[2]]), [["20000001", "a", 7], ["20000002", "a", 5]]);
  const wide = await extractCsv("Student ID,Name,Quiz 1,Quiz 2,Level\n20000001,Ama Mensah,8,9,100\n20000002,Kofi Boateng,6,\n");
  assert.deepEqual(wide.clean.results.map((r) => [r[0], r[1], r[2]]), [["20000001", "Quiz 1", 8], ["20000001", "Quiz 2", 9], ["20000002", "Quiz 1", 6]]);
  assert.equal(wide.clean.classList.length, 2, "names in a score file also fill the class list");
});

test("attendance: dated columns of P/A, Present/Absent or 1/0", async () => {
  const ex = await extractCsv("Student ID,04/11/2026,10/11/2026,Remarks\n20000001,P,A,late\n20000002,Present,Absent,\n20000003,1,0,\n");
  assert.deepEqual(ex.clean.attendance.sessions, ["04/11/2026", "10/11/2026"]);
  assert.deepEqual(ex.clean.attendance.rows, [["20000001", 1, 0], ["20000002", 1, 0], ["20000003", 1, 0]]);
});

test("a quiz bank in Excel becomes questions the existing parser reads, with the answer by letter, number or text", async () => {
  const d = tmp("cm-qb-"), f = path.join(d, "bank.xlsx");
  fs.writeFileSync(f, await makeXlsx([{ name: "Bank", rows: [
    ["No", "Question", "Option A", "Option B", "Option C", "Option D", "Correct", "Explanation", "Week"],
    [1, "What is the SI unit of force?", "joule", "newton", "watt", "pascal", "B", "F = ma", 2],
    [2, "Which quantity is a vector?", "mass", "speed", "velocity", "energy", 3, "", 1],
    [3, "The unit of power is", "watt", "newton", "joule", "volt", "watt", "", 4]] }]));
  const ex = extractBook((await readAny(f)).sheets, "bank.xlsx");
  const items = parseQuestions(ex.clean.questions.join("\n"), {});
  assert.deepEqual(items.map((q) => q.answer), [1, 2, 0]);
  assert.equal(items[0].lecture, 2);
});

test("Word files: a table is read as a table, and questions in the template are found in the text", async () => {
  const d = tmp("cm-docx-");
  const make = async (name, bodyXml) => { const z = new JSZip(); z.file("word/document.xml", '<w:document><w:body>' + bodyXml + "</w:body></w:document>"); const f = path.join(d, name); fs.writeFileSync(f, await z.generateAsync({ type: "nodebuffer" })); return f; };
  const cell = (t) => "<w:tc><w:p><w:r><w:t>" + t + "</w:t></w:r></w:p></w:tc>";
  const row = (a) => "<w:tr>" + a.map(cell).join("") + "</w:tr>";
  const t = await make("list.docx", "<w:p><w:r><w:t>Class list</w:t></w:r></w:p><w:tbl>" + row(["Student Number", "Name"]) + row(["20000001", "Ama Mensah"]) + row(["20000002", "Kofi Boateng"]) + "</w:tbl>");
  const ex = extractBook((await readAny(t)).sheets, "list.docx");
  assert.equal(ex.clean.classList.length, 2);
  const p = (s) => "<w:p><w:r><w:t>" + s + "</w:t></w:r></w:p>";
  const q = await make("q.docx", ["Q1. What is 2+2?", "A) 3", "B) 4", "C) 5", "D) 6", "Answer: B"].map(p).join(""));
  const { analyzeFile } = require("../autoload/analyze");
  const a = await analyzeFile(q, d);
  assert.deepEqual(a.kinds, ["quiz questions"]);
});

test("a file with nothing usable says why, and names its columns", async () => {
  const ex = await extractCsv("colour,size\nred,3\nblue,4\n");
  assert.equal(ex.summary.students + ex.summary.results + ex.summary.marks + ex.summary.questions, 0);
  assert.match(ex.sheets[0].note, /colour, size/);
});

test("the web export's own tabs are used as they are, with names from Master", async () => {
  const d = tmp("cm-web-"), f = path.join(d, "web.xlsx");
  fs.writeFileSync(f, await makeXlsx([
    { name: "Form Responses 1", rows: [["Timestamp", "First Name", "ID", "Join Code", "Q1", "Q2", "Q3", "Q4", "Q5", "Score", "Round", "Questions", "Answers", "Week"], [new Date(2026, 10, 4, 8, 0, 0), "Ama", 20000001, "ABC1", 1, 1, 0, 1, 1, 4, 0, 5, "", 1]] },
    { name: "Roster", rows: [["Student ID", "", "Note"], [20000001, "", ""], [20000002, "", ""]] },
    { name: "Master", rows: [["Student ID", "Name", "Last updated"], [20000001, "Ama Mensah", ""]] },
    { name: "Key", rows: [["Join Code", "Host key"], ["ABC1", "SECRET"]] }]));
  const ex = extractBook((await readAny(f)).sheets, "web.xlsx");
  assert.ok(ex.web);
  assert.deepEqual(ex.clean.classList, [["20000001", "Ama", "Mensah"], ["20000002", "", ""]]);
  assert.equal(JSON.stringify(ex.clean).includes("SECRET"), false);
});

test("a folder: nested files are found, hidden files and links are skipped, a rescan reads only what changed, originals stay as they were", async () => {
  const root = tmp("cm-folder-"), work = tmp("cm-work-");
  write(root, "class/list.csv", "Student ID,First name,Last name,Phone\n20000001,Ama,Mensah,0244\n20000002,Kofi,Boateng,0245\n");
  write(root, "scores/q1.csv", "ID,Marks\n20000001,7\n20000002,5\n");
  write(root, "notes/readme.txt", "just a note about the course\n");
  write(root, ".hidden/secret.csv", "ID,Marks\n20000001,1\n");
  write(root, "~$lock.xlsx", "x");
  try { fs.symlinkSync(path.join(root, "class"), path.join(root, "link")); } catch (e) { /* no links here */ }
  const before = { l: sha(path.join(root, "class/list.csv")), s: sha(path.join(root, "scores/q1.csv")) };
  const store = createStore(work);
  let r = await scanFolder(root, store, {});
  assert.equal(r.analyses.length, 3);
  assert.equal(r.reread, 3);
  assert.deepEqual(r.analyses.filter((a) => a.useful).map((a) => a.rel).sort(), [path.join("class", "list.csv"), path.join("scores", "q1.csv")]);
  r = await scanFolder(root, store, {});
  assert.equal(r.reread, 0, "unchanged files are not read again");
  write(root, "scores/q1.csv", "ID,Marks\n20000001,7\n20000002,5\n20000003,9\n");
  r = await scanFolder(root, store, {});
  assert.equal(r.reread, 1);
  fs.unlinkSync(path.join(root, "scores/q1.csv"));
  r = await scanFolder(root, store, {});
  assert.equal(r.analyses.length, 2);
  assert.equal(sha(path.join(root, "class/list.csv")), before.l, "the original is unchanged");
  // The working file is clean, readable, and holds nothing from the ignored columns.
  const useful = r.analyses.filter((a) => a.useful);
  const w = await writeWorking(path.join(work, "working"), mergeCleans(useful.map((a) => a.clean)), useful.map((a) => a.rel));
  const book = await readBook(w.xlsx);
  assert.ok(book.map((s) => s.name).includes("Class list"));
  assert.equal(book.find((s) => s.name === "Class list").rows.length, 3);
  assert.equal(fs.readFileSync(path.join(w.dir, "class-list.csv"), "utf8").includes("0244"), false);
});

test("a large folder is scanned quickly and a rescan opens nothing", async () => {
  const root = tmp("cm-big-"), work = tmp("cm-bigw-");
  for (let i = 0; i < 300; i++) { let t = "Student ID,Score\n"; for (let k = 0; k < 150; k++) t += (20000001 + k) + "," + (k % 10) + "\n"; write(root, "d" + (i % 10) + "/quiz" + i + ".csv", t); }
  const store = createStore(work);
  let t0 = Date.now(), r = await scanFolder(root, store, {});
  assert.equal(r.analyses.length, 300); assert.ok(Date.now() - t0 < 20000);
  t0 = Date.now(); r = await scanFolder(root, store, {});
  assert.equal(r.reread, 0); assert.ok(Date.now() - t0 < 3000);
});

test("through the screens' calls: preview, import, a second import adds nothing, questions go to the review queue", async () => {
  const root = tmp("cm-ipc-"), data = tmp("cm-data-");
  write(root, "list.csv", "Student ID,Surname,First name,Level\n20000001,Mensah,Ama,100\n20000002,Boateng,Kofi,100\n");
  write(root, "q1.csv", "ID,Marks\n20000001,7\n20000002,5\n");
  write(root, "att.csv", "Student ID,04/11/2026\n20000001,P\n20000002,A\n");
  const handlers = new Map(), c = classroom();
  c.id = "t1"; c.backups = { make: () => ({ ok: true, name: "b1" }) };
  c.authoring = { importText: (t) => ({ items: parseQuestions(t, {}) }), addDrafts: (items) => items };
  const dialog = { showOpenDialog: async () => ({ canceled: false, filePaths: [root] }) };
  require("../autoload-ipc").register({ on: (ch, fn) => handlers.set(ch, fn), dialog, winOf: () => null, shell: null, dirOf: () => data });
  require("../import-ipc").register({ on: (ch, fn) => handlers.set(ch, fn), dialog, winOf: () => null, shell: null });
  const e = { sender: { send() {} } }, call = (ch, ...a) => handlers.get(ch)(c, e, ...a);
  const rosterBefore = c.backend.rows("Roster").length;
  const found = await call("cm:autoPick");
  assert.equal(found.files.length, 3);
  const p = await call("cm:autoPlan", { ids: found.files.map((f) => f.id) });
  assert.ok(p.ok); assert.equal(p.addMissing, true);
  assert.ok(fs.existsSync(path.join(data, "working", "working-file.xlsx")));
  assert.equal(c.backend.rows("Roster").length, rosterBefore, "the preview changes nothing");
  assert.ok(p.report.changes > 0);
  const done = await call("cm:importApply", { addMissing: true });
  assert.ok(done.ok); assert.equal(c.backend.rows("Roster").length, rosterBefore + 2);
  const again = await call("cm:autoPlan", { ids: found.files.map((f) => f.id) });
  assert.equal(again.report.changes, 0, "the same files add nothing a second time");
  const none = await call("cm:autoQuestions", { ids: [0] });
  assert.equal(none.ok, false);
});
