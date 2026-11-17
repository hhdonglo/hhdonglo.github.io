// Before class card: the check lines, the week text, and that the Lecturer menu shortcut now opens Class Tools.
const test = require("node:test"), assert = require("node:assert"), fs = require("node:fs"), path = require("node:path");
const { checkLines, weekText } = require("../app/before-class.js");
const good = { ok: true, rosterCount: 140, week: 3, weekListed: true, bankQuestions: 29, masterOn: true, totalsMode: "Best" };

test("all clear gives only ok lines", () => {
  const L = checkLines(good, { accuracy: 10 }, true);
  assert.ok(L.every((l) => l.level === "ok"), JSON.stringify(L));
  assert.match(L[1].text, /140 IDs/); assert.match(L[2].text, /Week 3.*29 questions/);
});
test("each problem is flagged at the right level", () => {
  const L = checkLines(Object.assign({}, good, { rosterCount: 0, bankQuestions: 0, masterOn: false }), { error: "blocked" }, false);
  const by = (re) => L.find((l) => re.test(l.text));
  assert.equal(by(/list is empty/).level, "bad"); assert.equal(by(/No quiz bank/).level, "bad");
  assert.equal(by(/recording is off/).level, "warn"); assert.equal(by(/not confirmed/).level, "warn"); assert.equal(by(/blocked/).level, "bad");
});
test("no answer and poor location accuracy", () => {
  assert.equal(checkLines(null, { accuracy: 500 }, true)[0].level, "bad");
  assert.equal(checkLines(good, { accuracy: 500 }, true).pop().level, "warn");
  assert.match(checkLines(good, { error: "none" }, true).pop().text, /no location/);
});
test("no line says app, lecturer password or Apps Script", () => {
  const src = fs.readFileSync(path.join(__dirname, "../app/before-class.js"), "utf8") + fs.readFileSync(path.join(__dirname, "../app/home.html"), "utf8");
  assert.doesNotMatch(src, /lecturer password|Apps Script|Deploy &gt;/i);
});
test("week text", () => { assert.equal(weekText({ lectures: { 3: "Newton's laws" } }, 3), "Week 3, Lecture 3: Newton's laws"); });
test("Lecturer menu opens Class Tools, and the card is in the page", () => {
  const h = fs.readFileSync(path.join(__dirname, "../app/home.html"), "utf8");
  assert.match(h, /data-goview="class" data-key="L"/); assert.doesNotMatch(h, /data-win="lecturer\.html"/);
  assert.match(h, /id="before-class"/); assert.match(h, /src="before-class\.js"/);
});
