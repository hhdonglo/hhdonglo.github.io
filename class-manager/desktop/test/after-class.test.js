// "Held, waiting for your decision" card and the Stop buttons on Class Tools.
const test = require("node:test"), assert = require("node:assert"), fs = require("node:fs"), path = require("node:path");
const { rowsOf, ACTIONS, EMPTY } = require("../app/after-class.js");
const { stopQuery, ASK } = require("../app/stop-live.js");
const home = fs.readFileSync(path.join(__dirname, "../app/home.html"), "utf8");

test("one row for each held session and each held quiz, each with its own parameters", () => {
  const rows = rowsOf({ ok: true, sessions: [{ code: "4821", label: "17/11/2026", present: 40, absent: 3, notOnList: 1 }], quizzes: [{ code: "26271", round: 0, title: "Vectors", count: 12 }] });
  assert.equal(rows.length, 2);
  assert.equal(rows[0].name, "Attendance 17/11/2026"); assert.match(rows[0].detail, /40 checked in, 3 not, 1 not on the class list \(kept apart\)/);
  assert.equal(rows[0].params, "session=4821"); assert.equal(rows[0].submit, "attend_submit"); assert.equal(rows[0].discard, "attend_discard");
  assert.equal(rows[1].params, "code=26271&round=0"); assert.equal(rows[1].submit, "held_release_quiz"); assert.equal(rows[1].discard, "held_discard_quiz");
  assert.equal(rows[1].detail, "12 results");
});
test("nothing held, and no answer", () => {
  assert.deepEqual(rowsOf({ ok: true, sessions: [], quizzes: [] }), []); assert.deepEqual(rowsOf(null), []);
  assert.match(EMPTY, /Nothing is held/);
});
test("each action names the item, asks first, and says what it did", () => {
  const r = rowsOf({ ok: true, sessions: [{ code: "1", label: "17/11/2026", present: 1, absent: 0, notOnList: 0 }], quizzes: [] })[0];
  assert.deepEqual(Object.keys(ACTIONS), ["attend_submit", "attend_discard", "held_release_quiz", "held_discard_quiz"]);
  for (const a of Object.values(ACTIONS)) assert.match(a.ask(r), /\?/);
  assert.match(ACTIONS.attend_discard.ask(r), /cannot be undone/); assert.match(ACTIONS.attend_submit.ask(r), /17\/11\/2026/);
  assert.equal(ACTIONS.attend_submit.done({ submitted: ["17/11/2026"] }), "Submitted: 17/11/2026.");
  assert.equal(ACTIONS.held_release_quiz.done({ released: 5 }), "Submitted 5 quiz result(s).");
});
test("Stop asks first, says nothing is recorded, and uses the existing backend actions", () => {
  assert.equal(stopQuery("attendance"), "action=attend_close"); assert.equal(stopQuery("quiz", "26271"), "action=control&act=end&code=26271");
  assert.match(ASK.attendance, /held, not recorded/); assert.match(ASK.quiz("26271"), /held, not recorded/);
});
test("Class Tools has the Held card, the Stop attendance button and the scripts; the old After class card is gone", () => {
  assert.match(home, /Held, waiting for your decision/); assert.match(home, /id="att-stop"/); assert.match(home, /data-stop-quiz=/);
  assert.match(home, /src="after-class\.js"/); assert.match(home, /src="stop-live\.js"/);
  assert.doesNotMatch(home, /data-held=/); assert.doesNotMatch(home, /Release held quiz results/);
});
