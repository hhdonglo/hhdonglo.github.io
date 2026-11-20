"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");
const test = require("node:test");
const { openCourse } = require("../db/migrate");
const { CourseMigrationError } = require("../db/module-config");
const store = require("../db/store");
const { createVault } = require("../vault");
const { modules, defaultModules, validateModules } = require("../module-registry");

function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cm-modules-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const vault = createVault({ keyFile: path.join(dir, "data.key"), protect: bytes => bytes, unprotect: bytes => bytes });
  return { dir, dbFile: path.join(dir, "course.db"), jsonFile: path.join(dir, "workbook.json"), vault };
}

const snapshots = dir => fs.readdirSync(dir).filter(name => name.startsWith("module-migration-"));
const tables = ["meta", "sheet", "cell_row", "prop", "student", "id_notice", "receipt"];
const rows = db => tables.map(table => db.prepare("SELECT * FROM " + table + " ORDER BY 1").all());

test("legacy migration snapshots sealed and auxiliary WAL rows and is repeat-safe", t => {
  const opts = fixture(t);
  const legacy = store.open(opts.dbFile, opts.vault);
  try {
    legacy.save({ sheets: [{ id: 1, name: "Roster", rows: [["ID", "Name"], ["1001", "Example"]] }], props: { setting: "test" } });
    legacy.raw.prepare("INSERT INTO student VALUES (?, ?, ?)").run("student", legacy.codec.pack({ id: "1001" }), 0);
    legacy.raw.prepare("INSERT INTO id_notice VALUES (?, ?, ?, ?)").run("notice", legacy.codec.pack({ id: "1001" }), "open", 1);
    legacy.raw.prepare("INSERT INTO receipt VALUES (?, ?, ?)").run("receipt", "accepted", 1);
    const before = rows(legacy.raw);
    assert.ok(fs.statSync(opts.dbFile + "-wal").size > 0);

    const opened = openCourse(opts);
    try {
      assert.deepEqual(opened.enabledModules, defaultModules());
      assert.deepEqual(rows(opened.db.raw), before);
    } finally {
      opened.db.close();
    }
    const [directory] = snapshots(opts.dir);
    assert.ok(directory);
    const restoredFile = path.join(opts.dir, "restored.db");
    fs.copyFileSync(path.join(opts.dir, directory, "course.db"), restoredFile);
    const restored = new DatabaseSync(restoredFile, { readOnly: true });
    try {
      assert.deepEqual(rows(restored), before);
      assert.deepEqual(legacy.codec.unpack(restored.prepare("SELECT data FROM cell_row WHERE row_no = 1").get().data), ["1001", "Example"]);
    } finally {
      restored.close();
    }

    const again = openCourse(opts);
    try {
      assert.deepEqual(again.enabledModules, defaultModules());
      assert.deepEqual(snapshots(opts.dir), [directory]);
    } finally {
      again.db.close();
    }
  } finally {
    legacy.close();
  }
});

test("a future version refuses the course before importing a pending workbook", t => {
  const opts = fixture(t);
  const db = store.open(opts.dbFile, opts.vault);
  db.setMeta("schema_version", 999);
  db.close();
  const contents = fs.readFileSync(opts.dbFile);
  fs.writeFileSync(opts.jsonFile, '{"sheets":[],"props":{}}');
  assert.throws(() => openCourse(opts), { name: "CourseMigrationError", message: /Unsupported course database schema version/ });
  assert.deepEqual(fs.readFileSync(opts.dbFile), contents);
  assert.ok(fs.existsSync(opts.jsonFile));
  assert.deepEqual(snapshots(opts.dir), []);
});

test("an unreadable legacy payload blocks migration and preserves the original", t => {
  const opts = fixture(t);
  const db = store.open(opts.dbFile, opts.vault);
  db.raw.prepare("INSERT INTO student VALUES (?, ?, ?)").run("student", Buffer.from("broken"), 0);
  db.close();
  const contents = fs.readFileSync(opts.dbFile);
  assert.throws(() => openCourse(opts), CourseMigrationError);
  assert.deepEqual(fs.readFileSync(opts.dbFile), contents);
});

test("snapshot creation failure leaves the original database untouched", t => {
  const opts = fixture(t);
  store.open(opts.dbFile, opts.vault).close();
  const contents = fs.readFileSync(opts.dbFile);
  t.mock.method(fs, "mkdtempSync", () => { throw new Error("disk full"); });

  assert.throws(() => openCourse(opts), { name: "CourseMigrationError", message: /disk full/ });
  assert.deepEqual(fs.readFileSync(opts.dbFile), contents);
});

test("new courses start without a recovery snapshot and explicit lists survive workbook restore", t => {
  const opts = fixture(t);
  const first = openCourse(opts);
  assert.deepEqual(first.enabledModules, defaultModules());
  first.db.raw.prepare("UPDATE course_modules SET enabled = ?").run(JSON.stringify([]));
  first.db.close();
  fs.writeFileSync(opts.jsonFile, '{"sheets":[],"props":{}}');
  const restored = openCourse(opts);
  try {
    assert.deepEqual(restored.enabledModules, []);
    assert.deepEqual(snapshots(opts.dir), []);
  } finally {
    restored.db.close();
  }

  const raw = new DatabaseSync(opts.dbFile);
  raw.exec("UPDATE course_modules SET version = 999");
  raw.close();
  assert.throws(() => openCourse(opts), /Unsupported course module version/);
});

test("module lists reject unknown modules, duplicates and missing dependencies", () => {
  assert.deepEqual(validateModules(["attendance", "liveQuizzes"]), ["attendance", "liveQuizzes"]);
  assert.throws(() => validateModules(["unknown"]), /Unknown/);
  assert.throws(() => validateModules(["attendance", "attendance"]), /duplicate/);
  assert.throws(() => validateModules(["assignments"]), /requires groups/);
});

test("the registry declares each module's entry points, owned records and statistics", () => {
  for (const [id, module] of Object.entries(modules)) {
    assert.equal(module.id, id);
    assert.ok(module.pages.length || module.sharedPages.length || module.channels.length, id + " has a screen or channel");
    assert.ok(module.actions.length || module.kinds.length || module.channels.length, id + " has a request or channel");
    assert.ok(module.records.length, id + " has record ownership");
    assert.ok(module.statistics.length, id + " declares statistics");
  }
});
