/* Unlisted IDs: students who sign in with an ID that is not on the class list are held apart (never added automatically), see a warning to ask their lecturer,
   stay out of the class list, the grid, Master, Presence, Answers and every class figure, and are moved in only when the lecturer adds them. */
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const U = require("../rules/unlisted");
const { fromBackend } = require("../rules/store");
const { classroom } = require("./classroom");
const AT = require("../rules/attendance");

const dev = (n) => "phonedevice" + n + "abcdefghijklmnopqrstuvwxyz";
const OFF = "55555555", CODE = "26271";
const handlers = () => { const H = {}; require("../unlisted-ipc").register({ on: (n, f) => { H[n] = f; } }); return H; };
const tokenOf = (store) => AT.linkFor(AT.openSession(store).secret, Math.floor(Date.now() / 30000));
const tab = (c, name) => (c.backend.rawRows(name) || []).slice(1);

function session() {
  const c = classroom({ students: 3, engine: "js" }), store = () => fromBackend(c.backend);
  assert.equal(c.host("attend_open", { nogeo: "1" }).ok, true);
  const t = tokenOf(store());
  const claim = (id, d) => c.call({ action: "claim_code", id, dev: dev(d), t });
  const attend = (id, d, code) => c.call({ action: "attend", id, dev: dev(d), t, code: code || "" });
  return { c, store, claim, attend };
}

test("an unlisted ID is told so, signs in with no code, and is held apart (attendance)", () => {
  const { c, store, claim, attend } = session();
  const cl = claim(OFF, 1); assert.equal(cl.ok, true); assert.equal(cl.onList, false); assert.equal(cl.code, undefined, "no access code is shown to an unlisted ID");
  const r = attend(OFF, 1); assert.equal(r.ok, true); assert.equal(r.onList, false);
  assert.equal(attend(OFF, 1).already, true, "signing in again is one sign-in, not two");
  assert.deepEqual(tab(c, "Unlisted_IDs").map((r) => [r[0], r[5], r[4]]), [[OFF, "waiting", 1]]);
  assert.equal(tab(c, "Unlisted_Records").length, 1);
  assert.equal(tab(c, "Roster").some((r) => String(r[0]) === OFF), false, "never added to the class list by signing in");
  // a listed student is unchanged
  const mine = c.students[0], k = claim(mine.id, 2); assert.equal(k.code, c.codes[mine.id]);
  assert.equal(attend(mine.id, 2, k.code).onList, true);
  c.host("attend_close"); c.host("attend_submit");
  const grid = c.backend.rawRows("Attendance"); assert.equal(grid.slice(1).some((r) => String(r[0]) === OFF), false, "no row in the attendance grid");
  assert.equal(grid.slice(1).length, 3);
  assert.equal(c.host("class_stats", {}).rosterSize, 3, "class figures count the class list only");
  c.backend.close();
});

test("a student with no record is left alone: with no class list nobody is unlisted", () => {
  const c = classroom({ students: 0, engine: "js" });
  assert.equal(U.isUnlisted(fromBackend(c.backend), OFF), false);
  assert.equal(U.note(fromBackend(c.backend), { id: OFF, kind: "attendance", ref: "x" }).ok, false);
  c.backend.close();
});

test("the holding area is capped, one row per ID, a repeat is one record, and rejected IDs are not listed again", () => {
  const c = classroom({ students: 2, engine: "js" }), st = fromBackend(c.backend);
  for (let i = 0; i < U.MAX_IDS; i++) assert.equal(U.note(st, { id: String(70000000 + i), kind: "attendance", ref: "s1" }).ok, true);
  assert.equal(U.note(st, { id: "69999999", kind: "attendance", ref: "s1" }).why, "too many", "a flood of made-up IDs cannot grow the list without limit");
  assert.equal(U.note(st, { id: "70000000", kind: "attendance", ref: "s1" }).ok, true); assert.equal(U.list(st).items.length, U.MAX_IDS);
  assert.equal(U.recordsOf(st, "70000000").length, 1);
  assert.equal(U.reject(st, ["70000000"], "discard").ok, true);
  assert.equal(U.note(st, { id: "70000000", kind: "attendance", ref: "s2" }).kept, false, "a discarded ID signs in with the warning but nothing is kept");
  assert.equal(U.recordsOf(st, "70000000").length, 0);
  assert.equal(U.reject(st, ["70000001"], "aside").mode, "aside"); assert.equal(U.recordsOf(st, "70000001").length, 1, "set aside keeps the records");
  assert.equal(U.restore(st, ["70000001"]).restored, 1); assert.equal(U.list(st).items.find((x) => x.id === "70000001").status, "waiting");
  c.backend.close();
});

test("quiz: an unlisted ID joins and answers, gets the warning, and nothing reaches the live tabs", () => {
  const c = classroom({ students: 3, engine: "js" });
  assert.equal(c.host("control", { code: CODE, act: "init" }).ok, true);
  c.host("control", { code: CODE, act: "set", field: "q_seconds", value: "0" });
  assert.equal(c.host("control", { code: CODE, act: "start" }).ok, true);
  const listed = c.students[0];
  const join = (id, extra) => c.call(Object.assign({ kind: "join", name: "Zed", id, code: CODE, want: "receipt" }, extra));
  const j = join(OFF); assert.equal(j.ok, true); assert.equal(j.onList, false, "the phone is told to show the warning");
  assert.equal(join(listed.id).onList, undefined, "a listed student gets no warning");
  const a = c.call({ kind: "answer", name: "Zed", id: OFF, code: CODE, q: "1", answer: "B", want: "receipt" }); assert.equal(a.ok, true); assert.equal(a.onList, false);
  c.call({ kind: "answer", name: "Zed", id: OFF, code: CODE, q: "1", answer: "C" }); // the later answer replaces the earlier
  const recs = tab(c, "Unlisted_Records").filter((r) => r[2] === "quiz answer"); assert.equal(recs.length, 1); assert.equal(JSON.parse(recs[0][4]).answer, "C");
  assert.equal((c.backend.rawRows("Presence") || []).slice(1).some((r) => String(r[1]) === OFF), false, "not counted as present");
  assert.equal((c.backend.rawRows("Answers") || []).slice(1).some((r) => String(r[1]) === OFF), false, "not in the live answers");
  assert.equal(c.host("class_stats", {}).rosterSize, 3);
  c.backend.close();
});

test("adding on the review screen: the class list, a code and the records move in; rejecting moves nothing", async () => {
  const { c, store, claim, attend } = session();
  attend(OFF, 1); attend("66666666", 2);
  c.host("attend_close"); c.host("attend_submit");
  const H = handlers(), ctx = { backend: c.backend };
  assert.equal(H["cm:unlistedList"](ctx).waiting, 2);
  assert.equal(H["cm:unlistedReject"](ctx, null, ["66666666"], "aside").ok, true);
  assert.equal(c.backend.rawRows("Roster").slice(1).some((r) => String(r[0]) === "66666666"), false, "rejecting never adds");
  const r = H["cm:unlistedAdd"](ctx, null, [{ id: OFF, name: "Zed Zed" }, { id: "66666666", name: "No" }]);
  assert.equal(r.ok, true); assert.equal(r.added, 2, "a set-aside ID can still be added by the lecturer");
  const ro = c.backend.rawRows("Roster").slice(1).find((x) => String(x[0]) === OFF); assert.ok(ro && ro[1] === "Zed Zed");
  assert.ok(c.backend.rawRows("Access_Codes").slice(1).some((x) => String(x[0]) === OFF), "an access code is made");
  const grid = c.backend.rawRows("Attendance"), col = grid[0].length - 1, row = grid.slice(1).find((x) => String(x[0]) === OFF);
  assert.ok(row && Number(row[col]) === 1, "the session already submitted counts for the new student");
  assert.equal(c.backend.rawRows("Attendance_Log").slice(1).find((x) => String(x[2]) === OFF)[3], "Yes");
  assert.equal(tab(c, "Unlisted_IDs").length, 0); assert.equal(tab(c, "Unlisted_Records").length, 0);
  assert.equal(H["cm:unlistedAdd"](ctx, null, [{ id: OFF }]).ok, false, "nothing left to add");
  c.backend.close();
});

test("adding moves quiz answers and the held result in; the lecturer releases it as usual", () => {
  const c = classroom({ students: 3, engine: "js" });
  c.host("control", { code: CODE, act: "init" }); c.host("control", { code: CODE, act: "set", field: "q_seconds", value: "0" }); c.host("control", { code: CODE, act: "start" });
  c.call({ kind: "join", name: "Zed", id: OFF, code: CODE }); c.call({ kind: "answer", name: "Zed", id: OFF, code: CODE, q: "1", answer: "B" });
  const H = handlers(), ctx = { backend: c.backend };
  const l = H["cm:unlistedList"](ctx).items[0]; assert.equal(l.quizzes[0].answers, 1);
  const r = H["cm:unlistedAdd"](ctx, null, [{ id: OFF, name: "Zed" }]); assert.equal(r.ok, true); assert.equal(r.moved.quizzes, 1);
  assert.ok(c.backend.rawRows("Answers").slice(1).some((x) => String(x[1]) === OFF && String(x[5]) === "B"), "the answer is now a live answer");
  assert.ok(c.backend.rawRows("Presence").slice(1).some((x) => String(x[1]) === OFF), "and counts as joined");
  assert.ok(c.backend.rawRows("Staged_Quiz").slice(1).some((x) => String(x[2]) === OFF), "the result is held with the others until released");
  c.backend.close();
});
