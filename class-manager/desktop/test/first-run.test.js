/* First-run setup: one central password, then the roster, then the course material; quiz banks in the online format. */
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { stageOf, refusal } = require("../first-run/stages");
const { createCentralLogin } = require("../first-run/central-login");
const { parseBank, mergeBank } = require("../first-run/quiz-bank");
const bank = require("../first-run/bank-folder");

const ONLINE = path.resolve(__dirname, "..", "..", "course-packs", "phys143", "files", "quizzes");
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), "cm-fr-"));

test("the order is password, roster, material; the roster can be skipped, student data cannot", () => {
  let s = stageOf({});
  assert.equal(s.current, "password");
  assert.equal(refusal("cm:rosterShotsSave", s).needs, "password");
  s = stageOf({ passwordChosen: true });
  assert.equal(refusal("cm:rosterShotsSave", s), null);
  assert.equal(refusal("cm:importApply", s).needs, "roster");
  s = stageOf({ passwordChosen: true, roster: 40 });
  assert.equal(refusal("cm:importApply", s), null); assert.equal(s.current, "material");
  assert.equal(stageOf({ passwordChosen: true, roster: 40, banks: 3 }).complete, true);
  assert.equal(refusal("cm:setup", stageOf({})), null, "reading is never held back");
});

test("central password: chosen once, checked, recovered, lockout, never stored in clear", () => {
  const dir = tmp(), file = path.join(dir, "central-login.json");
  let t = 0; const L = createCentralLogin({ file, now: () => t });
  assert.equal(L.status().chosen, false);
  assert.equal(L.set("short").ok, false);
  const r = L.set("river stone lantern 42"); assert.equal(r.ok, true); assert.match(r.recovery, /^[A-Z2-9]{5}(-[A-Z2-9]{5}){3}$/);
  assert.ok(!fs.readFileSync(file, "utf8").includes("river stone"));
  assert.equal(createCentralLogin({ file }).check("river stone lantern 42").ok, true, "survives a restart");
  assert.equal(L.check("wrong").ok, false);
  assert.equal(L.recover(r.recovery.toLowerCase(), "another phrase 77!").ok, true);
  assert.equal(L.check("river stone lantern 42").ok, false); assert.equal(L.check("another phrase 77!").ok, true);
  for (let i = 0; i < 8; i++) L.check("nope");
  assert.match(L.check("another phrase 77!").why, /Too many/); t += 61000; assert.equal(L.check("another phrase 77!").ok, true);
});

test("every online quiz file is accepted exactly as it is", () => {
  const files = fs.readdirSync(ONLINE).filter((f) => /^lecture\d+(_concept)?\.json$/.test(f));
  assert.ok(files.length >= 10);
  for (const f of files) { const p = parseBank(f, fs.readFileSync(path.join(ONLINE, f), "utf8")); assert.equal(p.ok, true, f + ": " + p.problems.join(" ")); }
});

test("bad banks are named, not guessed at", () => {
  const q = { id: "L1-01", type: "concept", q: "x", options: ["a", "b", "c", "d"], answer: 1, exp: "e" };
  assert.equal(parseBank("lecture1.json", JSON.stringify({ lecture: 1, questions: [q, q] })).ok, false, "duplicate id");
  assert.match(parseBank("lecture1.json", JSON.stringify({ questions: [Object.assign({}, q, { answer: 4 })] })).problems.join(), /answer must be/);
  assert.match(parseBank("lecture2.json", JSON.stringify({ lecture: 1, questions: [q] })).problems.join(), /file name says/);
  assert.equal(parseBank("x.json", "{oops").ok, false);
});

test("merging adds only new ids and never changes an existing question", () => {
  const q = (id, a) => ({ id, type: "concept", q: "x" + a, options: ["a", "b", "c", "d"], answer: 0, exp: "e" });
  const have = { lecture: 1, title: "T", questions: [q("A", 1)] };
  const m = mergeBank(have, { lecture: 1, title: "T", questions: [q("A", 2), q("B", 1)] });
  assert.deepEqual(m.doc.questions.map((x) => x.id), ["A", "B"]); assert.equal(m.doc.questions[0].q, "x1"); assert.deepEqual(m.differing, ["A"]); assert.equal(m.added, 1);
});

test("loading from a folder writes the online file unchanged, and loading twice adds nothing", () => {
  const folder = tmp(), course = tmp(), calls = [];
  fs.mkdirSync(path.join(folder, "quizzes"));
  fs.copyFileSync(path.join(ONLINE, "lecture1.json"), path.join(folder, "quizzes", "lecture1.json"));
  fs.writeFileSync(path.join(folder, "lecture9.json"), "{broken");
  const fake = { lectures: () => [], saveLecture: (o) => calls.push(o.number), syncWeeks: () => calls.push("sync") };
  const pl = bank.plan(folder, course); assert.equal(pl.loadable, 1); assert.equal(pl.files.length, 2);
  const r = bank.load(folder, course, fake);
  assert.equal(r.loaded.length, 1); assert.equal(r.skipped.length, 1); assert.deepEqual(calls, [1, "sync"]);
  const want = JSON.parse(fs.readFileSync(path.join(ONLINE, "lecture1.json"), "utf8")), got = JSON.parse(fs.readFileSync(path.join(course, "quizzes", "lecture1.json"), "utf8"));
  assert.deepEqual(got, want);
  assert.equal(bank.load(folder, course, fake).loaded[0].added, 0);
});

test("student data waits for the roster; course material never does (Hope, 2026-11-17)", () => {
  const s0 = stageOf({ passwordChosen: true }); // password chosen, empty roster
  for (const ch of ["cm:importPick", "cm:importPlan", "cm:importApply", "cm:autoPick", "cm:autoPickFiles", "cm:autoScan", "cm:autoPlan", "cm:lmsRosterFile", "cm:lmsRosterService"]) {
    const r = refusal(ch, s0); assert.equal(r.needs, "roster", ch); assert.equal(r.goto, "setup.html#class"); assert.match(r.why, /Nothing about students/);
  }
  for (const ch of ["cm:saveLecture", "cm:removeLecture", "cm:lectureFile", "cm:importPack", "cm:libAdd", "cm:libAddPaths", "cm:generate", "cm:autoQuestions", "cm:autoCourse", "cm:autoCourseSave",
    "cm:bankFolderPick", "cm:bankFolderLoad", "cm:importFile", "cm:importText", "cm:saveCourse", "cm:rosterShotsSave"]) assert.equal(refusal(ch, s0), null, ch + " works with an empty roster");
  assert.equal(refusal("cm:autoPick", stageOf({ passwordChosen: true, roster: 3 })), null);
  assert.equal(stageOf({ passwordChosen: true }).open.material, true);
});

test("no student-data file-opening call is left outside the gate", () => {
  const { NEEDS } = require("../first-run/stages");
  // Course material and CM's own files: allowed with no roster. Anything else that opens a file must be gated above.
  const OK = new Set(["cm:chooseLogo", "cm:backupImport", "cm:linkedChoose", "cm:linkedRestore", "cm:folderDetails", "cm:rosterShotsRead", "cm:setPassword", "cm:saveTemplate", "cm:importTemplate", "cm:autoExport", "cm:saveExcel", "cm:lmsGradebookFile", "cm:linkFolder", "cm:export", "cm:backupExport",
    "cm:saveLecture", "cm:lectureFile", "cm:importPack", "cm:libAdd", "cm:libAddPaths", "cm:generate", "cm:autoQuestions", "cm:autoCourse", "cm:autoCourseSave", "cm:bankFolderPick", "cm:bankFolderLoad", "cm:importFile", "cm:importText"]);
  const root = path.resolve(__dirname, "..");
  const files = ["main.js", "import-ipc.js", "autoload-ipc.js", "lms/ipc.js", "first-run/ipc.js", "roster-shots/ipc.js"];
  const open = [];
  for (const f of files) for (const part of fs.readFileSync(path.join(root, f), "utf8").split(/\bon\("(?=cm:)/).slice(1)) {
    const ch = part.slice(0, part.indexOf('"')), body = part.split(/\n(?=on\(|\s*on\()/)[0];
    if (/showOpenDialog|readFileSync|tableOf\(/.test(body) && !NEEDS[ch] && !OK.has(ch)) open.push(ch);
  }
  assert.deepEqual(open, [], "gate these in first-run/stages.js NEEDS, or list them as course material: " + open.join(", "));
});
