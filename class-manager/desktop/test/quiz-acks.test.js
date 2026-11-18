/* What a phone knows about its own live quiz answers: only what the class server confirmed is claimed as received. */
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { create } = require("../../assets/quiz-acks");

test("confirmed answers are counted and worded; none confirmed leaves the caller's wording", () => {
  const a = create(); assert.equal(a.endNote(), null);
  a.chosen(1, "A"); a.reply(1, "A", "ok"); a.chosen(2, "B"); a.reply(2, "B", "wrong question");
  assert.equal(a.confirmed(), 1); assert.match(a.endNote(), /received 1 answer from you/);
  assert.deepEqual(a.refused(), [{ q: 2, why: "the lecturer had already moved to the next question" }]);
});
test("a reply for an answer the student has since changed is ignored; unanswered sends stay pending", () => {
  const a = create(); a.chosen(1, "A"); a.chosen(1, "C"); a.reply(1, "A", "ok");
  assert.equal(a.confirmed(), 0); assert.deepEqual(a.pending(), [{ q: 1, answer: "C" }]);
});
