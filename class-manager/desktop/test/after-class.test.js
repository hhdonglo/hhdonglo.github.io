// After class card: held attendance and quiz results, with a confirmation before every action.
const test = require("node:test"), assert = require("node:assert"), fs = require("node:fs"), path = require("node:path");
const { heldText, ACTIONS } = require("../app/after-class.js");

test("held text counts sessions and check-ins", () => {
  const t = heldText({ ok: true, quiz: 3, sessions: [{ label: "17/11 #1", present: 40 }, { label: "17/11 #2", present: 2 }] });
  assert.equal(t.sessions, "Held sessions: 2, 42 checked in"); assert.equal(t.quiz, "Quiz results held: 3");
  assert.deepEqual(t.list, ["17/11 #1: 40 checked in", "17/11 #2: 2 checked in"]);
});
test("nothing held, and no answer", () => {
  assert.equal(heldText({ ok: true, quiz: 0, sessions: [] }).sessions, "Held sessions: none");
  assert.match(heldText(null).sessions, /unavailable/);
});
test("each action asks first and reports what happened", () => {
  assert.deepEqual(Object.keys(ACTIONS), ["attend_submit", "attend_discard", "held_release_quiz", "held_discard_quiz"]);
  for (const a of Object.values(ACTIONS)) assert.match(a.ask, /\?/);
  assert.equal(ACTIONS.attend_submit.done({ submitted: ["17/11 #1"] }), "Attendance submitted: 17/11 #1.");
  assert.equal(ACTIONS.held_release_quiz.done({ released: 5 }), "Released 5 quiz result(s).");
});
test("the card and its buttons are in Class Tools", () => {
  const h = fs.readFileSync(path.join(__dirname, "../app/home.html"), "utf8");
  for (const a of Object.keys(ACTIONS)) assert.ok(h.includes('data-held="' + a + '"'), a);
  assert.match(h, /src="after-class\.js"/);
});
