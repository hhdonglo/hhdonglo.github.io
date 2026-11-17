/* Unlisted IDs, end to end: Add brings the whole picture in with the student (class list, access code, attendance, quiz answers, figures);
   Keep aside and Discard behave as promised, and the waiting count (the badge on Class Roster) drops. */
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { fromBackend } = require("../rules/store");
const { classroom } = require("./classroom");
const AT = require("../rules/attendance");
const U = require("../rules/unlisted");

const dev = (n) => "phonedevice" + n + "abcdefghijklmnopqrstuvwxyz";
const A = "10417910", B = "104191740", CODE = "26271";
const H = (() => { const h = {}; require("../unlisted-ipc").register({ on: (n, f) => { h[n] = f; } }); return h; })();
const tab = (c, name) => (c.backend.rawRows(name) || []).slice(1);

function room() {
  const c = classroom({ students: 3, engine: "js" }), st = () => fromBackend(c.backend);
  assert.equal(c.host("attend_open", { nogeo: "1" }).ok, true);
  const t = AT.linkFor(AT.openSession(st()).secret, Math.floor(Date.now() / 30000));
  [[A, 1], [A, 1], [B, 2]].forEach(([id, d]) => c.call({ action: "attend", id, dev: dev(d), t, code: "" }));
  c.host("attend_close"); c.host("attend_submit");
  c.host("control", { code: CODE, act: "init" }); c.host("control", { code: CODE, act: "set", field: "q_seconds", value: "0" }); c.host("control", { code: CODE, act: "start" });
  c.call({ kind: "join", name: "AMA", id: A, code: CODE });
  ["B", "C", "A", "D"].forEach((a, i) => c.call({ kind: "answer", name: "Aman", id: B, code: CODE, q: String(i + 1), answer: a }));
  c.call({ kind: "answer", name: "AMA", id: A, code: CODE, q: "1", answer: "B" });
  return { c, ctx: { backend: c.backend } };
}

test("the badge count is the number waiting, and it drops as IDs are decided", () => {
  const { c, ctx } = room();
  assert.equal(H["cm:unlistedCount"](ctx).waiting, 2);
  assert.equal(H["cm:unlistedReject"](ctx, null, [A], "aside").ok, true);
  assert.equal(H["cm:unlistedCount"](ctx).waiting, 1);
  assert.equal(H["cm:unlistedRestore"](ctx, null, [A]).ok, true);
  assert.equal(H["cm:unlistedCount"](ctx).waiting, 2);
  c.backend.close();
});

test("discard: the records are deleted, the rows leave the waiting list and the count drops; nothing reaches the class", () => {
  const { c, ctx } = room();
  const r = H["cm:unlistedReject"](ctx, null, [A, B], "discard");
  assert.equal(r.ok, true); assert.equal(r.rejected, 2); assert.ok(r.records > 0);
  assert.equal(H["cm:unlistedCount"](ctx).waiting, 0);
  assert.equal(H["cm:unlistedList"](ctx).items.filter((x) => x.status !== "discarded").length, 0, "nothing is left to show");
  assert.equal(tab(c, "Unlisted_Records").length, 0);
  assert.equal(tab(c, "Roster").some((x) => [A, B].includes(String(x[0]))), false);
  c.backend.close();
});

test("keep aside: records stay, the count drops, the rows show under Set aside", () => {
  const { c, ctx } = room();
  assert.equal(H["cm:unlistedReject"](ctx, null, [A, B], "aside").ok, true);
  assert.equal(H["cm:unlistedCount"](ctx).waiting, 0);
  assert.equal(H["cm:unlistedList"](ctx).items.filter((x) => x.status === "set aside").length, 2);
  assert.ok(tab(c, "Unlisted_Records").length >= 4);
  c.backend.close();
});

test("add: the student arrives with an access code, attendance, quiz answers and counts in the class figures", () => {
  const { c, ctx } = room();
  const before = c.host("class_stats", {}), heldAnswers = H["cm:unlistedList"](ctx).items.find((x) => x.id === B).quizzes[0].answers;
  assert.ok(heldAnswers >= 1);
  const r = H["cm:unlistedAdd"](ctx, null, [{ id: A, name: "AMA" }, { id: B, name: "Aman" }]);
  assert.equal(r.ok, true); assert.equal(r.added, 2);
  [A, B].forEach((id) => assert.ok(tab(c, "Access_Codes").some((x) => String(x[0]) === id), "access code for " + id));
  assert.equal(H["cm:unlistedCount"](ctx).waiting, 0);
  const grid = c.backend.rawRows("Attendance"), col = grid[0].length - 1;
  [A, B].forEach((id) => assert.equal(Number(grid.slice(1).find((x) => String(x[0]) === id)[col]), 1, "attendance mark for " + id));
  assert.equal(c.host("class_stats", {}).rosterSize, before.rosterSize + 2, "class figures now count them");
  assert.equal(tab(c, "Answers").filter((x) => String(x[1]) === B).length, heldAnswers, "every held quiz answer is now a live answer");
  // The result is held for release, then released as usual: marks and statistics follow.
  const q = c.host("held_items").quizzes.find((x) => String(x.code) === CODE); assert.ok(q, "the quiz result is held for release");
  assert.equal(c.host("held_release_quiz", { code: q.code, round: q.round }).ok, true);
  [A, B].forEach((id) => assert.ok(tab(c, "Form Responses 1").some((x) => String(x[2]) === id), "result released for " + id));
  assert.equal(U.list(fromBackend(c.backend)).items.length, 0);
  c.backend.close();
});
