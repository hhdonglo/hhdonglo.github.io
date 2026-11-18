/* Quiz administration: the central list stops every quiz from one place, and the Quiz administration button opens the quiz that is waiting or running. */
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const QC = require("../../assets/quiz-central.js");
const { stopQuery } = require("../app/stop-live.js");

const Q = [{ code: "26271", title: "Week 3", state: "lobby", joined: 0 }, { code: "26272", state: "running", joined: 40 }, { code: "26273", state: "paused", joined: 12 }];

test("stop all ends running and paused quizzes and closes waiting rooms", () => {
  assert.deepEqual(QC.stopPlan(Q), [{ code: "26271", act: "reset" }, { code: "26272", act: "end" }, { code: "26273", act: "end" }]);
  assert.deepEqual(QC.stopPlan([]), []);
});

test("the list shows each quiz once, marks the one shown, and escapes titles", () => {
  const h = QC.rows(Q.concat([{ code: "9", title: "<b>x</b>", state: "running", joined: 1 }]), "26272");
  assert.equal((h.match(/class='qc-row'|class='qc-row' /g) || []).length + (h.match(/aria-current/g) || []).length, 5);
  assert.match(h, /Shown below/); assert.ok(!h.includes("<b>x</b>")); assert.match(h, /Close lobby/); assert.match(h, /data-qc-open='26271'/);
});

test("closing a lobby uses reset, a running quiz uses end", () => {
  assert.equal(stopQuery("quiz", "26271", "lobby"), "action=control&act=reset&code=26271");
  assert.equal(stopQuery("quiz", "26272", "running"), "action=control&act=end&code=26272");
});

test("the quiz window carries the panel and Class Tools opens the quiz by its code", () => {
  const host = fs.readFileSync(path.join(__dirname, "../../quiz-host.html"), "utf8"), home = fs.readFileSync(path.join(__dirname, "../app/home.html"), "utf8");
  assert.match(host, /id="h-all"/); assert.match(host, /assets\/quiz-central\.js/);
  assert.match(home, /setAttribute\("data-win","quiz-host\.html\?code="/);
  assert.match(home, /data-open-quiz/);
});
