/* Start quiz when the week has no question bank: a plain sentence, nothing saved, no server error (it was reported as "could not reach the class sheet"). */
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { classroom, WEB } = require("./classroom");
const { failure, WHY } = require("../exec-failure");

test("Start quiz with no bank for the week is refused in words, and works once the bank is there", () => {
  const c = classroom({ students: 2, engine: "js" });
  const code = "262701"; // week-shaped join code (week 1); the bank is not reachable
  assert.equal(c.host("control", { code, act: "init" }).ok, true);
  assert.equal(c.host("control", { code, act: "lobby" }).ok, true);
  c.state.missing = /^quizzes\//;
  const r = c.host("control", { code, act: "start" });
  assert.equal(r.ok, false);
  assert.match(r.why, /^there are no questions for lecture 1 yet\./);
  assert.doesNotMatch(r.why, /sheet|app\b|&/i);
  assert.equal(c.host("host", { code }).status.state, "lobby", "nothing changed");
  c.state.missing = null;
  const ok = c.host("control", { code, act: "start" });
  assert.equal(ok.ok, true, JSON.stringify(ok));
  assert.equal(ok.status.state, "running");
});

test("a server error reaches the page as an answer with a plain sentence", () => {
  const logged = [];
  const f = failure(new Error("boom"), (e) => logged.push(e.message));
  assert.equal(f.status, 500);
  assert.deepEqual(JSON.parse(f.body), { ok: false, why: WHY });
  assert.deepEqual(logged, ["boom"]);
  assert.doesNotThrow(() => failure(new Error("x"), () => { throw new Error("log failed"); }));
});

test("the desktop server answers errors through exec-failure, and no CM page mentions a class sheet", () => {
  assert.match(fs.readFileSync(path.join(__dirname, "../main.js"), "utf8"), /require\("\.\/exec-failure"\)\.failure\(e\)/);
  for (const f of ["attendance.html", "lecturer.html", "quiz-host.html", "quiz.html", "config.js"]) assert.doesNotMatch(fs.readFileSync(path.join(WEB, f), "utf8"), /class sheet/i, f);
  const src = fs.readFileSync(path.join(WEB, "config.js"), "utf8");
  const win = {}; new Function("window", "document", "location", src)(win, { querySelectorAll: () => [], addEventListener() {} }, { href: "http://x/" }); const CM = win.CM; CM.desktop = true;
  assert.match(CM.noAnswer(), /^CM did not answer\./);
  CM.desktop = false; assert.match(CM.noAnswer(), /^Could not reach the class server\./);
});
