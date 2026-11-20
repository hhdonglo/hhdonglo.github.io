"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { project } = require("../academic-memory/records");
const log = require("../academic-memory/log");
const { createIndex } = require("../academic-memory/index");
const { createMemory } = require("../academic-memory/ipc");
const { createVault, exportFile, importFile } = require("../vault");
const { classroom, WEB } = require("./classroom");
const { DatabaseSync } = require("node:sqlite");
const { createCodec } = require("../db/codec");
const { createBackend } = require("../backend");

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "cm-memory-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const vault = createVault({ keyFile: path.join(root, "key"), protect: value => value, unprotect: value => value });
  const file = path.join(root, "index.cmv"), workspaces = [
    { id: "course-a", code: "A", title: "Mechanics", created: "2026-11-18T10:00:00Z" },
    { id: "course-b", code: "B", title: "Physics", created: "2026-11-18T11:00:00Z" }
  ];
  const build = index => createMemory({ index, workspace: id => workspaces.find(item => item.id === id),
    workspaces: () => workspaces, dirOf: () => root });
  return { root, vault, file, workspaces, build, memory: build(createIndex(file, vault)) };
}

test("4A projects stable scoped attendance and quiz IDs without modifying source rows", () => {
  const date = new Date("2026-11-19T13:00:00Z");
  const quiz = [date, "Example", "20000001", "QZ1", "", "", "", "", "", 3, 2];
  const tables = {
    Attendance_Control: [["header"], ["A1", "Lecture 1", "Closed", date]],
    Attendance_Log: [["header"], [date, "Lecture 1", "20000001"]],
    Staged_Quiz: [["header"], quiz]
  };
  const read = table => tables[table];
  const first = project("course-a", read, ["attendance", "liveQuizzes"]);
  assert.equal(first.events.length, 2);
  assert.equal(first.records[0].eventId, first.events[0].id);
  assert.equal(first.records[0].date, date.toISOString());
  assert.equal(first.records[1].source.table, "Staged_Quiz");
  assert.equal(tables.Staged_Quiz[1], quiz);

  tables["Form Responses 1"] = tables.Staged_Quiz;
  delete tables.Staged_Quiz;
  const released = project("course-a", read, ["attendance", "liveQuizzes"]);
  assert.equal(released.records[1].id, first.records[1].id);
  assert.equal(released.records[1].eventId, first.records[1].eventId);
  assert.equal(released.records[1].released, true);
  assert.equal(released.records[1].source.table, "Form Responses 1");
  assert.equal(project("course-b", read, ["attendance"]).records[0].workspaceId, "course-b");
  assert.equal(project("course-a", read, ["attendance"]).records.length, 1);
});

test("4A follows a quiz through answer, hold and release without changing the result", t => {
  const cm = classroom({ students: 1, engine: "js" });
  t.after(() => { cm.backend.close(); fs.rmSync(cm.dir, { recursive: true, force: true }); });
  const code = "26271", student = cm.students[0];
  const read = () => {
    const before = cm.backend.exportText();
    const result = project("course-a", cm.backend.rawRows, ["liveQuizzes"]);
    assert.equal(cm.backend.exportText(), before);
    return result;
  };
  const control = act => cm.host("control", { code, act });
  assert.ok(control("init").ok);
  assert.ok(control("start").ok);
  const response = cm.call({ kind: "answer", code, q: "1", answer: "A", id: student.id, name: student.name });
  assert.equal(response.outcome || response, "ok");
  const projected = read();
  const answer = projected.records.find(item => item.kind === "quizAnswer");
  assert.ok(answer.date);
  assert.equal(answer.workspaceId, "course-a");
  assert.equal(answer.source.table, "Answers");
  assert.equal(answer.source.key.studentId, student.id);
  assert.equal(answer.source.key.answer, cm.backend.rawRows("Answers")[1][5]);
  assert.equal(projected.events.find(item => item.id === answer.eventId).source.table, "Quiz_Control");
  assert.equal(read().records.find(item => item.kind === "quizAnswer").id, answer.id);

  assert.ok(control("end").ok);
  const held = read().records.find(item => item.kind === "quizResult");
  assert.equal(held.source.table, "Staged_Quiz");
  assert.equal(held.eventId, answer.eventId);
  assert.ok(control("release").ok);
  const released = read().records.find(item => item.kind === "quizResult");
  assert.equal(released.source.table, "Form Responses 1");
  assert.equal(released.id, held.id);
  assert.equal(released.score, held.score);
  assert.equal(released.score, cm.backend.rawRows("Form Responses 1")[1][9]);
});

test("4B links and normalized tags survive restart and portable workbook backup", t => {
  const cm = classroom({ engine: "js" });
  const other = classroom({ engine: "js" });
  t.after(() => {
    cm.backend.close(); other.backend.close();
    fs.rmSync(cm.dir, { recursive: true, force: true });
    fs.rmSync(other.dir, { recursive: true, force: true });
  });
  const f = fixture(t), course = { id: "course-a", backend: cm.backend };
  const stored = log.read(course.backend);
  const note = log.saveDiscussion(stored, { title: "Review", tags: [" Lab ", "lab", "week   one"] });
  log.publish(course.backend, stored);
  const context = f.memory.context(course), from = { kind: "discussion", id: note.id }, to = { kind: "workspace", id: "course-b" };
  const link = log.saveLink(context, { from, to, relation: "supports" });
  assert.equal(log.saveLink(context, { from, to, relation: "supports" }).id, link.id);
  log.setTags(context, from, ["Course group", " course  GROUP "]);
  assert.throws(() => log.saveLink(context, { from: { ...from, workspaceId: "course-b" }, to, relation: "related" }), /available target/);
  log.publish(course.backend, context.log);
  cm.reopen();
  course.backend = cm.backend;
  assert.deepEqual(f.memory.describe(course).tags[0].tags, ["course group"]);
  assert.deepEqual(f.memory.describe(course).discussions[0].tags, ["lab", "week one"]);
  f.workspaces[1].archived = true;
  assert.equal(f.memory.describe(course).links[0].toTarget.archived, true);
  f.workspaces.pop();
  assert.equal(f.memory.describe(course).links[0].toTarget, null);
  f.workspaces.push({ id: "course-b", title: "Unrelated course", created: "2026-11-19T11:00:00Z" });
  assert.equal(f.memory.describe(course).links[0].toTarget, null, "a reused ID must not rebind a restored link");

  const portable = exportFile({ workbook: cm.backend.exportText() }, "memory test passphrase");
  const recovered = JSON.parse(importFile(portable, "memory test passphrase").workbook);
  other.editWorkbook(book => { book.props = recovered.props; book.sheets = recovered.sheets; });
  const imported = log.read(other.backend);
  assert.equal(imported.links[0].id, link.id);
  assert.deepEqual(imported.tags[0].tags, ["course group"]);
});

test("4B validates every target kind and preserves links and tags through SQLite migration", t => {
  const f = fixture(t);
  const dataFile = path.join(f.root, "workbook.json"), dbFile = path.join(f.root, "course.db");
  const open = () => createBackend({ webRoot: WEB, dataFile, dbFile, vault: f.vault, engine: "js" });
  const course = { id: "course-a", backend: open() };
  const date = new Date("2026-11-19T13:00:00Z");
  try {
    course.backend.setRows("Attendance_Control", [["Code", "Label", "Status", "Opened"], ["A1", "Lecture 1", "Closed", date]]);
    course.backend.setRows("Attendance_Log", [["Timestamp", "Session", "Student ID"], [date, "Lecture 1", "20000001"]]);
    const stored = log.read(course.backend);
    const discussion = log.saveDiscussion(stored, { title: "Lab discussion" });
    const file = path.join(f.root, "reading.txt");
    fs.writeFileSync(file, "Linked reference");
    const document = log.addDocument(f.root, file, stored);
    log.publish(course.backend, stored);
    const context = f.memory.context(course);
    const workspaceRef = { kind: "workspace", id: "course-a" };
    const recordRef = { kind: "record", id: context.projection.records[0].id };
    const eventRef = { kind: "event", id: context.projection.events[0].id };
    const docRef = { kind: "document", id: document.id };
    const discussionRef = { kind: "discussion", id: discussion.id };
    const refs = [workspaceRef, recordRef, eventRef, docRef, discussionRef];
    refs.slice(1).forEach((ref, i) => log.saveLink(context, { from: refs[i], to: ref, relation: i % 2 ? "supports" : "related" }));
    refs.forEach(ref => log.setTags(context, ref, [" ＬＡＢ ", "lab", "  week    one "]));
    assert.throws(() => log.setTags(context, { kind: "workspace", id: "course-b" }, ["local"]), /own log/);
    assert.throws(() => log.saveLink(context, { from: recordRef, to: docRef, relation: "unknown" }), /supported link type/);
    assert.throws(() => log.saveLink(context, { from: eventRef, to: eventRef, relation: "related" }), /different targets/);
    log.publish(course.backend, context.log);
    assert.equal(f.memory.describe(course).links.length, 4);
    const before = log.read(course.backend);
    course.backend.close();
    course.backend = null;

    // Exercise the production preflight on the pre-module SQLite layout.
    const legacy = new DatabaseSync(dbFile);
    try { legacy.exec("DROP TABLE course_modules"); } finally { legacy.close(); }
    course.backend = open();
    assert.deepEqual(log.read(course.backend), before);
    const snapshot = fs.readdirSync(f.root).find(name => name.startsWith("module-migration-"));
    assert.ok(snapshot);
    const snapshotDb = new DatabaseSync(path.join(f.root, snapshot, "course.db"), { readOnly: true });
    try {
      const row = snapshotDb.prepare("SELECT value FROM prop WHERE key = ?").get("cm.secret.academic-memory");
      assert.deepEqual(JSON.parse(createCodec(f.vault).unpack(row.value)), before);
    } finally { snapshotDb.close(); }

    fs.unlinkSync(file);
    let state = f.memory.describe(course);
    assert.equal(state.links[2].toTarget, null);
    assert.equal(state.tags.find(item => item.target.kind === "document").resolved, null);
    assert.ok(!state.targets.some(ref => ref.id === document.id));
    assert.throws(() => log.saveLink(f.memory.context(course), { from: eventRef, to: docRef, relation: "follows" }), /available target/);
    const archived = f.memory.context(course);
    archived.log.discussions[0].archived = true;
    log.clearTags(archived, docRef);
    log.publish(course.backend, archived.log);
    state = f.memory.describe(course);
    assert.equal(state.links[3].toTarget.archived, true);
    assert.ok(!state.tags.some(item => item.target.kind === "document"));
    course.backend.setRows("Attendance_Log", [["Timestamp", "Session", "Student ID"]]);
    assert.equal(f.memory.describe(course).links[0].toTarget, null);
  } finally { course.backend?.close(); }
});

test("4C sealed search rebuilds from opted-in notes and live file links within the current course", t => {
  const cm = classroom({ engine: "js" });
  const other = classroom({ engine: "js" });
  t.after(() => {
    cm.backend.close(); other.backend.close();
    fs.rmSync(cm.dir, { recursive: true, force: true });
    fs.rmSync(other.dir, { recursive: true, force: true });
  });
  const f = fixture(t), a = { id: "course-a", backend: cm.backend }, b = { id: "course-b", backend: other.backend };
  const stored = log.read(a.backend), file = path.join(f.root, "reading-notes.txt");
  fs.writeFileSync(file, "File body should never be indexed.");
  const doc = log.addDocument(f.root, file, stored);
  const replacement = path.join(f.root, "other-course");
  fs.mkdirSync(replacement);
  fs.writeFileSync(path.join(replacement, doc.path), "A different file with the same name.");
  assert.throws(() => log.resolveDocument(replacement, doc), /folder has changed/);
  const note = log.saveDiscussion(stored, { title: "Newton review", notes: "local needle", searchable: true, attachments: [doc.id], decisions: ["Use examples"], actionItems: ["Prepare worksheet"] });
  log.saveDiscussion(stored, { title: "Private needle", notes: "private needle", searchable: false });
  log.publish(a.backend, stored);
  const result = f.memory.search(a, "local needle")[0];
  assert.equal(result.id, note.id);
  assert.equal(f.memory.source(a, result).discussion.notes, "local needle");
  assert.throws(() => f.memory.source(b, result), /outside the current course/);
  assert.deepEqual(f.memory.search(a, "use examples")[0], result);
  assert.deepEqual(f.memory.search(a, "prepare worksheet")[0], result);
  assert.deepEqual(f.memory.search(b, "local needle"), []);
  assert.deepEqual(f.memory.search(a, "private needle"), []);
  const fileResult = f.memory.search(a, "reading-notes")[0];
  assert.equal(fileResult.id, doc.id);
  assert.deepEqual(f.memory.source(a, fileResult), { kind: "document", id: doc.id, title: doc.title });
  assert.deepEqual(f.memory.search(a, "never be indexed"), []);
  assert.ok(f.vault.isSealed(fs.readFileSync(f.file)));
  assert.ok(!fs.readFileSync(f.file).includes("local needle"));

  // Repair works even when the same running CM instance is asked to refresh.
  fs.unlinkSync(f.file);
  f.memory.refresh(a, true);
  assert.ok(f.vault.isSealed(fs.readFileSync(f.file)));
  const plaintext = JSON.stringify({ version: 1, workspaces: { "course-a": [{ ...result, content: "forged" }] } });
  fs.writeFileSync(f.file, plaintext);
  const reader = createIndex(f.file, f.vault);
  assert.deepEqual(reader.search(a.id, "forged"), []);
  assert.equal(f.memory.search(a, "local needle")[0].id, note.id);

  fs.unlinkSync(file);
  assert.throws(() => f.memory.source(a, fileResult), /no longer available/);
  stored.discussions.find(item => item.id === note.id).archived = true;
  log.publish(a.backend, stored);
  fs.writeFileSync(f.file, "broken index");
  const renewed = f.build(createIndex(f.file, f.vault));
  assert.deepEqual(renewed.search(a, "local needle"), []);
  assert.throws(() => renewed.source(a, result), /no longer available/);
  assert.deepEqual(renewed.search(a, "reading-notes"), []);
  assert.equal(renewed.describe(a).documents[0].missing, true);
  assert.equal(renewed.search(a, "mechanics")[0].kind, "workspace");
  assert.throws(() => log.fileIn(f.root, other.dir), /inside this course/);
});

test("4C launch reconciliation prunes stale buckets and resolves indexed events from the current course", t => {
  const f = fixture(t), stored = createIndex(f.file, f.vault);
  stored.replace("old-course", [{ id: "old", workspaceId: "old-course", content: "stale" }]);
  stored.replace("course-a", [{ id: "old-note", workspaceId: "course-a", content: "retired note" }]);
  f.workspaces[1].archived = true;
  f.memory.reconcile();
  assert.deepEqual(stored.search("old-course", "stale"), []);
  assert.deepEqual(stored.search("course-b", "physics"), []);
  assert.deepEqual(stored.search("course-a", "retired note"), []);
  assert.equal(stored.search("course-a", "mechanics")[0].kind, "workspace");

  const cm = classroom({ engine: "js" });
  t.after(() => { cm.backend.close(); fs.rmSync(cm.dir, { recursive: true, force: true }); });
  const a = { id: "course-a", backend: cm.backend };
  const date = new Date("2026-11-19T10:00:00Z");
  cm.backend.setRows("Attendance_Control", [["header"], ["A1", "Lecture 1", "Closed", date]]);
  const event = f.memory.search(a, "attendance")[0];
  assert.equal(event.kind, "event");
  assert.deepEqual(f.memory.source(a, event), {
    kind: "event", title: "Lecture 1", date: date.toISOString(), source: { table: "Attendance_Control", key: { code: "A1" } }
  });
  cm.backend.saveModules([]);
  assert.throws(() => f.memory.source(a, event), /no longer available/);
  assert.deepEqual(f.memory.search(a, "attendance"), []);
});
