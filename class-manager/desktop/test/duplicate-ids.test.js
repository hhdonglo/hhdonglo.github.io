/* "We should never have a duplicated ID": every way an ID can enter CM, the database rule, and old data with duplicates. */
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { classroom, WEB } = require("./classroom");
const { createBackend } = require("../backend");
const { normalizeId, sameId } = require("../ids");
const shots = require("../roster-shots/ipc");

const tmp = (p) => fs.mkdtempSync(path.join(os.tmpdir(), p));
const ids = (b) => b.rawRows("Roster").slice(1).map((r) => String(r[0]));
const oneEach = (list) => assert.equal(new Set(list).size, list.length, "no ID appears twice: " + list.join(","));

test("the same ID written in different ways is one ID", () => {
  for (const v of ["22583439", " 22583439 ", "022583439", "22583439.0", 22583439, "2258 3439"]) assert.equal(normalizeId(v), "22583439", String(v));
  assert.equal(sameId("022583439", "22583439.0"), true);
  assert.equal(sameId("22583439", "22583430"), false);
});

test("class list paste: a repeated ID is merged, reported, and the list has it once", () => {
  const c = classroom({ students: 2 }); const b = c.backend;
  b.rosterSync([["20000001", "Student1"], ["020000001.0", "Student One"], ["20000003", "New"]], true); b.flush();
  oneEach(ids(b)); assert.equal(b.students.count(), 2);
  assert.equal(b.idNotices().length, 1);
  c.backend.close();
});

test("manual add of an existing ID adds no second student", () => {
  const c = classroom({ students: 2 }); const b = c.backend;
  b.rosterSync([["20000001", "Student1"], ["20000002", "Student2"], [" 20000002 ", "Other"]], true); b.flush();
  oneEach(ids(b)); assert.equal(b.students.count(), 2); b.close();
});

test("Class Roster page save: an ID already on the list is not added again and keeps its name", () => {
  const c = classroom({ students: 2 }); const b = c.backend;
  const h = {}; shots.register({ on: (ch, fn) => { h[ch] = (...a) => fn({ backend: b, backups: { make: () => ({ ok: true, name: "b" }) } }, {}, ...a); } });
  const r = h["cm:rosterShotsSave"]({ rows: [{ id: "020000001", name: "From a screenshot" }, { id: "30000009", name: "Fresh" }] });
  assert.ok(r.ok, r.why);
  oneEach(ids(b)); assert.equal(b.students.count(), 3);
  assert.equal(b.students.get("20000001").name, "Student1", "an existing name is never silently overwritten");
  assert.equal(r.differsFromList.length, 1);
  b.close();
});

test("phone check-in with an unusual ID writes to the one student, never a second row", () => {
  const c = classroom({ students: 2 }); const b = c.backend; const id = "20000001";
  const o = c.host("attend_open", { label: "Week 1" }); assert.equal(o.ok, true);
  const r = c.call({ action: "attend", id: " 0" + id + ".0 ", code: c.codes[id], dev: "abcdefghijklmnopqrstuvwxyz", t: o.session.link });
  assert.equal(r.ok, true, JSON.stringify(r)); assert.equal(r.id, id, "answered with the one normalised ID");
  b.flush();
  oneEach((b.rawRows("Attendance_Log") || [[]]).slice(1).map((x) => String(x[0])));
  oneEach(ids(b)); assert.equal(b.students.count(), 2); b.close();
});

test("a retry of the same check-in (same ckey) is run once and still no duplicate", () => {
  const c = classroom({ students: 2 }); const b = c.backend; const id = "20000002";
  const o = c.host("attend_open", { label: "Week 1" });
  const p = { action: "attend", id: "0" + id, code: c.codes[id], dev: "abcdefghijklmnopqrstuvwxyz", t: o.session.link, ckey: "k1" };
  c.call(p); c.call(p); b.flush();
  oneEach((b.rawRows("Attendance_Log") || [[]]).slice(1).map((x) => String(x[0]))); b.close();
});

test("Apps Script sync and Excel and CSV rows go through the same guard (tidyGrid)", () => {
  const { tidyGrid, tidyLog } = require("../db/id-guard");
  const t = tidyGrid("Roster", [["Student ID", "Name"], ["20000001", "A"], ["020000001.0", ""], ["20000002", "B"]]);
  assert.deepEqual(t.rows.slice(1), [["20000001", "A"], ["20000002", "B"]]);
  assert.equal(t.notices.length, 1);
  const l = tidyLog("Attempts", [["time", "id", "x"], ["t", "22583439.0", 1], ["t", "022583439", 2]]);
  assert.deepEqual(l.rows.slice(1).map((r) => r[1]), ["22583439", "22583439"], "log lines keep every entry, with one ID spelling");
});

test("old data with duplicates is merged when CM opens it, and reported, nothing lost", () => {
  const c = classroom({ students: 2 });
  c.editWorkbook((book) => {
    const s = book.sheets.find((x) => x.name === "Roster");
    s.rows.push(["020000001.0", "Old Duplicate"]);
  });
  const b = c.backend; b.flush();
  oneEach(ids(b)); assert.equal(b.students.count(), 2);
  const n = b.idNotices(); assert.equal(n.length, 1); assert.equal(n[0].entries.length, 2);
  b.close();
});

