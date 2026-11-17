/* The Class Roster page is the only way a roster enters CM: screenshots read by Claude, checked, saved once per ID. */
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { review } = require("../roster-shots/review");
const { readShots } = require("../roster-shots/vision");
const shots = require("../roster-shots/ipc");
const gate = require("../roster-shots/gate");
const { classroom } = require("./classroom");

test("one ID, one student: repeats with the same name are merged, two names for one ID are a conflict, the same name under two IDs is allowed", () => {
  const r = review([{ id: "20000001", name: "Ama Mensah", shot: "a" }, { id: " 020000001 ", name: "ama mensah", shot: "b" }, { id: "20000002", name: "Ama Mensah" }, { id: "20000003", name: "Kofi" }, { id: "20000003", name: "Kofi Boateng" }], { names: {} });
  assert.deepEqual(r.students.map((s) => s.id), ["20000001", "20000002"]);
  assert.equal(r.merged.length, 1);
  assert.deepEqual(r.conflicts, [{ id: "20000003", names: ["Kofi", "Kofi Boateng"] }]);
  const picked = review([{ id: "20000003", name: "Kofi" }, { id: "20000003", name: "Kofi Boateng" }], { names: {} }, { "20000003": "Kofi Boateng" });
  assert.deepEqual(picked.students.map((s) => s.name), ["Kofi Boateng"]); assert.equal(picked.conflicts.length, 0);
});

test("an ID that cannot be read with certainty is listed and never saved", () => {
  const r = review([{ id: "2.2583439E7", name: "A" }, { id: "123", name: "B" }, { id: "20000001", name: "C" }], { names: {} });
  assert.equal(r.students.length, 1); assert.equal(r.ambiguous.length, 2);
});

test("a name that differs from the class list is reported and the list keeps its name", () => {
  const r = review([{ id: "20000001", name: "Someone Else" }], { names: { 20000001: "Ama Mensah" } });
  assert.deepEqual(r.alreadyOnList, ["20000001"]); assert.equal(r.differsFromList.length, 1);
});

test("screenshots go to the vision call one at a time, and bad files are refused", async () => {
  const calls = [];
  const ask = async (sys, content) => { calls.push(content); return { students: [{ id: "20000001", name: "Ama Mensah", unclear: false }] }; };
  const out = await readShots([{ name: "a.png", type: "image/png", data: "AAAA" }, { name: "b.png", type: "image/png", data: "AAAA" }], ask);
  assert.equal(calls.length, 2); assert.equal(out.length, 2); assert.equal(out[0].shot, "a.png");
  await assert.rejects(readShots([{ name: "x.docx", type: "application/msword", data: "AA" }], ask), /only PNG/);
  assert.equal((await readShots([{ name: "scan.pdf", type: "application/pdf", data: "AAAA" }], ask)).length, 1); // a scanned PDF goes to Claude as a document
  await assert.rejects(readShots([], ask), /at least one/);
});

function page(c, key) {
  const h = {};
  c.authoring = { status: () => ({ hasKey: key }), askJson: async () => ({ students: [{ id: "20000001", name: "Ama Mensah", unclear: false }, { id: "20000001", name: "Ama Mensah", unclear: false }, { id: "20000002", name: "Kofi Boateng", unclear: true }] }) };
  c.backups = { make: () => ({ ok: true, name: "b" }) };
  shots.register({ on: (ch, fn) => { h[ch] = (...a) => fn(c, {}, ...a); } });
  return h;
}

test("without an API key the screen is told, and nothing is saved", async () => {
  const c = classroom({ students: 0 }), h = page({ backend: classroom({ students: 0 }).backend }, false);
  const r = await h["cm:rosterShotsRead"]([{ name: "a.png", type: "image/png", data: "AAAA" }]);
  assert.equal(r.ok, false); assert.equal(r.needKey, true); c.backend.close();
});

test("read, correct, save: re-adding the same screenshot adds nobody, and conflicts and unreadable IDs block the save", async () => {
  const c = classroom({ students: 0 }), ctx = { backend: c.backend }, h = page(ctx, true);
  const read = await h["cm:rosterShotsRead"]([{ name: "a.png", type: "image/png", data: "AAAA" }]);
  assert.ok(read.ok); assert.equal(read.review.students.length, 2); assert.equal(read.review.merged.length, 1);
  const first = h["cm:rosterShotsSave"]({ rows: read.found });
  assert.ok(first.ok, first.why); assert.equal(first.added, 2); assert.equal(first.backup, "b");
  const again = h["cm:rosterShotsSave"]({ rows: read.found });
  assert.ok(again.ok); assert.equal(again.added, 0, "the same screenshot again adds nobody");
  assert.equal(c.backend.rawRows("Roster").slice(1).length, 2);
  assert.equal(h["cm:rosterShotsSave"]({ rows: [{ id: "20000009", name: "A" }, { id: "20000009", name: "B" }] }).ok, false);
  assert.equal(h["cm:rosterShotsSave"]({ rows: [{ id: "12", name: "A" }] }).ok, false);
  c.backend.close();
});

test("page requests and scripts cannot add students; they may still read and remove", () => {
  assert.equal(gate.addsStudents({ kind: "roster_sync", rows: "[]" }), true);
  assert.equal(gate.addsStudents({ action: "roster_edit", op: "add", id: "20000001" }), true);
  assert.equal(gate.addsStudents({ action: "roster_edit", op: "remove", id: "20000001" }), false);
  assert.equal(gate.addsStudents({ action: "roster_edit", op: "check", id: "20000001" }), false);
  assert.equal(JSON.parse(gate.refusal()).ok, false);
});

test("updating a saved class list keeps every record: new students are added, a name is corrected only when chosen, dropped students are set aside and restorable", () => {
  const c = classroom({ students: 0 }), b = c.backend, h = {};
  shots.register({ on: (ch, fn) => { h[ch] = (...a) => fn({ backend: b, authoring: { status: () => ({ hasKey: true }) }, backups: { make: () => ({ ok: true, name: "b" }) } }, {}, ...a); } });
  const R = (rows) => rows.map(([id, name]) => ({ id, name }));
  assert.ok(h["cm:rosterShotsSave"]({ rows: R([["20000001", "Ama Mensah"], ["20000002", "Kofi Boateng"], ["20000003", "Esi Owusu"]]) }).ok);
  const mark = (tab, id, vals) => { const rows = b.rawRows(tab); const r = rows.find((x, i) => i > 0 && String(x[0]) === id); vals.forEach((v, i) => { r[i + 1] = v; }); b.setRows(tab, rows); };
  mark("Attendance", "20000001", [1, 1]); mark("Attendance", "20000003", [1, 1]); mark("Scores", "20000002", [42, 50, 84]);
  const next = R([["20000001", "Ama Mensah-Asare"], ["20000002", "Kofi Boateng"], ["20000004", "Yaw Darko"]]);
  const keep = h["cm:rosterShotsSave"]({ rows: next }); // add only: no name changes, nobody dropped
  assert.equal(keep.added, 1); assert.equal(keep.renamed, 0); assert.equal(keep.removed, 0);
  assert.equal(b.rawRows("Roster").find((r) => r[0] === "20000001")[1], "Ama Mensah");
  const upd = h["cm:rosterShotsSave"]({ rows: next, renames: ["20000001"], replace: true });
  assert.equal(upd.renamed, 1); assert.equal(upd.removed, 1);
  const name = (tab) => b.rawRows(tab).find((r) => r[0] === "20000001")[1];
  assert.equal(name("Roster"), "Ama Mensah-Asare"); assert.equal(name("Master"), "Ama Mensah-Asare");
  assert.deepEqual(b.rawRows("Attendance").find((r) => r[0] === "20000001").slice(1, 3), [1, 1], "attendance stays with the same ID");
  assert.equal(b.rawRows("Scores").find((r) => r[0] === "20000002")[1], 42);
  assert.ok(!b.rawRows("Roster").some((r) => r[0] === "20000003"), "a dropped student leaves the list");
  assert.ok(b.rawRows("Removed_Students").some((r) => r[1] === "20000003"), "and is kept, with all rows, in Removed_Students");
  assert.equal(b.rawRows("Roster").slice(1).length, 3);
  assert.ok(require("../remove-student").restore(b, "20000003").ok);
  assert.deepEqual(b.rawRows("Attendance").find((r) => r[0] === "20000003").slice(1, 3), [1, 1], "restored with the attendance it had");
  b.close();
});

test("saving a class list with a first name only, a last name only and no name keeps each as typed", () => {
  const c = classroom({ students: 0 }), h = page({ backend: c.backend }, true);
  const r = h["cm:rosterShotsSave"]({ rows: [{ id: "20000001", name: "Ama" }, { id: "20000002", name: "Boateng" }, { id: "20000003", name: "" }] });
  assert.ok(r.ok, r.why); assert.equal(r.added, 3);
  assert.deepEqual(c.backend.rawRows("Roster").slice(1).map((x) => [String(x[0]), String(x[1] || "")]), [["20000001", "Ama"], ["20000002", "Boateng"], ["20000003", ""]]);
  c.backend.close();
});

test("the ID is the only key: two students may share a name, and a nameless ID is kept through Master", () => {
  const c = classroom({ students: 0 }), h = page({ backend: c.backend }, true);
  const r = h["cm:rosterShotsSave"]({ rows: [{ id: "20000001", name: "Ama Mensah" }, { id: "20000002", name: "Ama Mensah" }, { id: "20000003", name: "" }] });
  assert.ok(r.ok, r.why); assert.equal(r.added, 3); assert.equal(r.conflicts === undefined || r.conflicts.length === 0, true);
  const master = c.backend.rawRows("Master").slice(1).map((x) => String(x[0]));
  assert.ok(["20000001", "20000002", "20000003"].every((id) => master.includes(id)), "every ID reaches Master, named or not");
  c.backend.close();
});
