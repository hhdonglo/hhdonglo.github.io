"use strict";
// Topic mastery: the map, the evidence rules, the bands, per quiz, over time, and one student's own view. Made-up data only.
const test = require("node:test");
const assert = require("node:assert/strict");
const MAP = require("../rules/topics/map");
const EV = require("../rules/topics/evidence");
const M = require("../rules/topics/mastery");
const T = require("../rules/topics");
const RK = require("../app/dashboard/risk");

const site = (p) => {
  if (p === "/data/lectures.json") return { groups: [{ lectures: [{ number: 1, title: "Vectors" }, { number: 3, title: "Newton's laws" }] }] };
  if (p === "/quizzes/lecture1.json") return { title: "Vectors", questions: [{ id: "L1-01", q: "Add two vectors", options: ["a", "b", "c"], ref: "Lecture 1 deck, slide ‘Vector addition’" }, { id: "L1-02", q: "Dot product", options: ["x", "y", "z"], concept: "Products" }] };
  if (p === "/quizzes/lecture3.json") return { title: "Newton", questions: [{ id: "L3-01", q: "Puck", options: ["p", "q", "r", "s"] }] };
  throw new Error("not found " + p);
};

test("topic map: lecture from the id, title from the lectures list, concept from the bank or the slide in ref, nothing invented", () => {
  const m = MAP.build({ site }, [1, 3]);
  assert.equal(m.topic("L3-01").name, "Lecture 3: Newton's laws");
  assert.equal(m.topic("L0-02").name, "Introduction");
  assert.equal(m.topic("X-1"), null, "a question with no lecture has no topic");
  assert.equal(m.concept("L1-01"), "Vector addition"); assert.equal(m.concept("L1-02"), "Products"); assert.equal(m.concept("L3-01"), "");
});

const row = (id, qid, ok, o) => Object.assign({ id, qid, ok, src: "live", quiz: "Week 1", t: 1, option: ok ? "A" : "B", key: "A" }, o);
function many(qid, n, rightN, quiz, ids) { const out = []; for (let i = 0; i < n; i++) out.push(row((ids || [])[i] || "s" + i, qid, i < rightN ? 1 : 0, { quiz })); return out; }

test("bands: 70 and over well mastered, 50 to 69 developing, under 50 needs attention, few answers too early", () => {
  assert.equal(M.bandOf(70, 20, 10), "well"); assert.equal(M.bandOf(69.9, 20, 10), "developing"); assert.equal(M.bandOf(49, 20, 10), "attention");
  assert.equal(M.bandOf(90, 4, 10), "early"); assert.equal(M.bandOf(null, 0, 3), "early");
});

test("class summary: percent per topic, students by band, hardest and easiest questions, a shared wrong answer, unmapped counted", () => {
  const map = MAP.build({ site }, [1, 3]);
  const rows = many("L1-01", 20, 18).concat(many("L1-02", 20, 4), many("L3-01", 10, 2), [row("z", "ZZ-9", 1)]);
  const s = M.summarise(rows, map), l1 = s.topics.filter((t) => t.key === "L1")[0], l3 = s.topics.filter((t) => t.key === "L3")[0];
  assert.equal(s.unmapped, 1);
  assert.equal(l1.answers, 40); assert.equal(l1.pct, 55); assert.equal(l1.band, "developing");
  assert.equal(l1.hardest[0].id, "L1-02"); assert.equal(l1.easiest.length, 0, "two questions: the hardest one is not repeated as easiest"); // easiest excludes those already listed
  assert.equal(l1.wrong[0].id, "L1-02"); assert.equal(l1.wrong[0].option, "B"); assert.equal(l1.wrong[0].text, "y");
  assert.equal(l3.band, "attention"); assert.equal(l3.small, true, "10 answers is flagged as few");
  assert.ok(l1.concepts.some((c) => c.name === "Vector addition" && c.pct === 90));
});

test("student bands in a topic need three of their own answers", () => {
  const map = MAP.build({ site }, [1]);
  const rows = [row("a", "L1-01", 1), row("a", "L1-02", 1), row("a", "L1-01", 1), row("b", "L1-01", 0), row("b", "L1-02", 0), row("b", "L1-01", 0), row("c", "L1-01", 1)];
  const t = M.summarise(rows, map).topics[0];
  assert.deepEqual(t.studentBands, { well: 1, developing: 0, attention: 1, early: 1 });
});

test("per quiz and over time: each live quiz on its own; a topic with under 5 answers in a quiz is a gap, not a number", () => {
  const map = MAP.build({ site }, [1, 3]);
  const rows = many("L1-01", 10, 3, "Week 1").concat(many("L1-01", 10, 8, "Week 2"), many("L3-01", 3, 3, "Week 2"), many("L1-01", 6, 6, "").map((r) => Object.assign(r, { src: "practice" })));
  const per = M.byQuiz(rows, map, ["Week 1", "Week 2"]);
  assert.equal(per["Week 1"].topics[0].pct, 30); assert.equal(per["Week 2"].topics[0].pct, 80);
  const ot = M.overTime(per, ["Week 1", "Week 2"]);
  assert.deepEqual(ot.filter((s) => s.key === "L1")[0].values, [30, 80]); assert.deepEqual(ot.filter((s) => s.key === "L3")[0].values, [null, null]);
});

test("a student's own topics: weakest first, plain advice naming the concept they missed, and too early below three answers", () => {
  const map = MAP.build({ site }, [1, 3]);
  const rows = [row("a", "L1-01", 0, { src: "practice" }), row("a", "L1-01", 0, { src: "practice" }), row("a", "L1-02", 1, { src: "practice" }), row("a", "L3-01", 1)];
  const t = M.studentTopics(rows, map);
  assert.equal(t[0].key, "L1"); assert.equal(t[0].band, "attention"); assert.match(t[0].advice, /re-read Vector addition/); assert.equal(t[0].asked, 3);
  assert.equal(t[1].band, "early"); assert.match(t[1].advice, /1 of 3/);
});

// A made-up workbook: the tabs the evidence rules read.
function store(tabs) { return { rows: (n) => tabs[n] || null }; }
const ITEM = (id, code, qid, ans, key, ok, rnd) => [new Date(Date.UTC(2026, 10, 4)), code, rnd || 1, "", id, "", qid, ans, key, ok, ""];
const RESP = (id, code, wk, rnd) => [new Date(), "", id, code, "", "", "", "", "", 3, rnd || 1, 5, "", wk];
test("evidence: only released answers of students on the class list, a blank is not an answer, a student's own view takes their ID only", () => {
  const tabs = {
    Roster: [["Student ID", "Name"], ["20000001", "A"], ["20000002", "B"]],
    Item_Log: [[], ITEM("20000001", "1111", "L1-01", "A", "A", 1), ITEM("20000002", "1111", "L1-01", "B", "A", 0), ITEM("20000009", "1111", "L1-01", "A", "A", 1), ITEM("20000001", "1111", "L1-02", "", "A", 0), ITEM("20000001", "2222", "L1-01", "A", "A", 1)],
    "Form Responses 1": [[], RESP("20000001", "1111", 1), RESP("20000002", "1111", 1), RESP("20000009", "1111", 1)],
    Attempts: [[]]
  };
  const rows = EV.gather(store(tabs), null);
  assert.equal(rows.length, 2, "not on the list, blank and held (code 2222 not released) are all left out");
  assert.ok(rows.every((r) => r.quiz === "Week 1"));
  const mine = T.studentTopics(store(tabs), { site }, "20000002");
  assert.equal(mine.length, 1); assert.equal(mine[0].asked, 1);
  const cls = T.classTopics(store(tabs), { site }, ["Week 1"]);
  assert.equal(cls.byQuiz["Week 1"].topics[0].answers, 2); assert.equal(cls.students["20000001"].L1.pct, 100);
});

test("at risk: a quiz sat by almost no one is not a quiz, and a reason that fits the whole class flags no one", () => {
  const st = []; for (let i = 0; i < 20; i++) st.push({ id: "s" + i, attendance: 40, missedInARow: 2, quizAverage: null, quizzesTaken: 0 });
  const r = RK.atRisk({ students: st, thresholds: {}, attendance: { sessions: 4 }, quizzes: [{ students: 1 }, { students: 2 }, { students: 3 }] });
  assert.equal(r.quizzes, 0); assert.equal(r.total, 0); assert.equal(r.classWide.length, 2);
  // Individual evidence still flags: five students under the threshold in a class of twenty.
  const st2 = st.map((s, i) => Object.assign({}, s, { attendance: i < 5 ? 30 : 95, missedInARow: 0 }));
  const r2 = RK.atRisk({ students: st2, thresholds: {}, attendance: { sessions: 5 }, quizzes: [] });
  assert.equal(r2.total, 5); assert.equal(r2.strong, 5); assert.equal(r2.classWide.length, 0);
});
