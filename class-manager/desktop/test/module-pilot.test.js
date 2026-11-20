"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");
const { classroom } = require("./classroom");
const { createHub } = require("../relay/hub");
const { createLiveSession } = require("../relay/live-session");
const { createLiveQuiz } = require("../relay/live-quiz");
const settings = require("../course-module-settings");
const access = require("../module-access");
const attendanceRules = require("../rules/attendance");
const { fromBackend } = require("../rules/store");

function course(t, count) {
  const cm = classroom({ students: count, engine: "js" });
  t.after(() => {
    cm.backend.close();
    fs.rmSync(cm.dir, { recursive: true, force: true });
  });
  return cm;
}

test("the attendance-only and attendance-plus-quizzes pilot keeps records and requests separate", async t => {
  const a = course(t, 1), b = course(t, 2), code = "26271";
  assert.ok((await settings.save(a, ["attendance"])).ok);
  assert.ok((await settings.save(b, ["attendance", "liveQuizzes"])).ok);
  a.reopen();
  b.reopen();
  assert.deepEqual(settings.state(a).enabled, ["attendance"]);
  assert.deepEqual(settings.state(b).enabled, ["attendance", "liveQuizzes"]);
  assert.equal(a.backend.students.count(), 1);
  assert.equal(b.backend.students.count(), 2);
  assert.ok(access.browserAccess(settings.state(a).enabled).disabledPages.includes("quiz.html"));
  assert.ok(!access.browserAccess(settings.state(b).enabled).disabledPages.includes("quiz.html"));
  assert.equal(a.host("control", { act: "init", code }).disabled, "liveQuizzes");
  assert.equal(a.get({ action: "questions", code }).disabled, "liveQuizzes");
  assert.equal(a.call({ kind: "join", id: a.students[0].id, code }).disabled, "liveQuizzes");
  assert.equal(a.call({ kind: "attempt", id: a.students[0].id }).disabled, "practice");
  assert.equal(JSON.parse(a.backend.doPost({ action: "version" }, "kind=join").text).disabled, "liveQuizzes");
  assert.ok(b.host("control", { act: "init", code }).ok);
  assert.ok(b.host("control", { act: "start", code }).ok);
  assert.match((await settings.save(b, ["attendance"])).why, /Close live quizzes/);
  assert.equal(a.get({ action: "portal_status" }).quiz, "none");
  assert.equal(b.get({ action: "portal_status" }).quiz, "running");
  const student = b.students[0];
  const answer = b.call({ kind: "answer", id: student.id, name: student.name, code, q: "1", answer: "A" });
  assert.equal(answer.outcome || answer, "ok");
  assert.equal((a.backend.rawRows("Answers") || []).slice(1).length, 0);
  assert.ok(a.host("attend_open", { nogeo: "1" }).ok);
  const session = attendanceRules.openSession(fromBackend(a.backend));
  const token = attendanceRules.linkFor(session.secret, Math.floor(Date.now() / 30000));
  assert.ok(a.call({ action: "attend", id: a.students[0].id, dev: "phone1abcdefghijklmnopqrstuvwxyz", t: token }).ok);
  assert.equal(b.get({ action: "portal_status" }).attendance, "closed");
  assert.equal((b.backend.rawRows("Attendance_Log") || []).slice(1).length, 0);
  assert.match((await settings.save(a, [])).why, /Close attendance/);
  assert.ok(a.host("attend_close").ok);
  assert.ok(a.host("attend_submit").ok);
  const attendance = a.backend.rawRows("Attendance_Control");
  assert.ok((await settings.save(a, [])).ok);
  assert.equal(a.host("attend_open", { nogeo: "1" }).disabled, "attendance");
  assert.ok((await settings.save(a, ["attendance"])).ok);
  a.reopen();
  assert.deepEqual(a.backend.rawRows("Attendance_Control"), attendance);
  assert.ok(a.host("attend_status").ok);
  assert.equal(b.get({ action: "portal_status" }).quiz, "running");
});

test("disabling live modules closes stale sessions on the Worker and requires relay confirmation", async t => {
  const { handle } = await import("../../relay/hub/worker.mjs");
  const { fakeD1 } = await import("../../relay/hub/test/fake-d1.js");
  const { setup } = await import("../../relay/hub/src/db.js");
  const DB = fakeD1();
  await setup(DB);
  const env = { DB, RELAY_SECRET: "test-secret-0123456789", POW_BITS: "8" };
  const address = "https://hub.test";
  let offline = false;
  const fetch = async (url, init) => {
    if (offline) throw new Error("relay is offline");
    return handle(new Request(url, init), env, Math.floor(Date.now() / 1000));
  };
  const cm = course(t, 1);
  const hub = createHub({ backend: cm.backend, address, fetch });
  const opts = { backend: cm.backend, hub, address: () => address, pages: address };
  const live = createLiveSession(opts), liveQuiz = createLiveQuiz(opts);
  const courseState = { backend: cm.backend, live, liveQuiz };
  const { course: id } = await hub.register();
  const code = "26271";
  assert.ok((await hub.post("/v1/quiz/put", { code, status: { state: "running", known: true }, questions: [{ stem: "Example" }] })).ok);
  assert.ok((await hub.post("/v1/live/open", { label: "test", secret: "01234567890123456789012345", mode: "off", roster: { [cm.students[0].id]: "" } })).ok);
  offline = true;
  const failed = await settings.save(courseState, ["attendance"]);
  assert.equal(failed.ok, false);
  assert.ok(cm.backend.enabledModules().includes("liveQuizzes"));

  offline = false;
  assert.ok((await settings.save(courseState, ["attendance"])).ok);
  const phoneQuiz = await fetch(address + "/v1/quiz/call", {
    method: "POST", body: JSON.stringify({ course: id, params: { action: "questions", code } })
  });
  assert.deepEqual((await phoneQuiz.json()).questions, []);
  assert.ok((await settings.save(courseState, [])).ok);
  const phoneAttendance = await fetch(address + "/v1/attend", {
    method: "POST", body: JSON.stringify({ course: id, id: cm.students[0].id, dev: "phone1abcdefghijklmnopqrstuvwxyz" })
  });
  assert.equal((await phoneAttendance.json()).why, "closed");
});

test("one desktop instance creates and isolates courses through its IPC and HTTP entry points", t => {
  const path = require("node:path");
  const root = fs.mkdtempSync(path.join(require("node:os").tmpdir(), "cm-desktop-pilot-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const result = require("node:child_process").spawnSync(process.execPath, [
    path.join(__dirname, "desktop-course-pilot.js"), root
  ], { encoding: "utf8", timeout: 30000, env: { ...process.env, CM_RELAY_URL: "" } });
  assert.equal(result.status, 0, result.error?.message || result.stderr || result.stdout);
});
