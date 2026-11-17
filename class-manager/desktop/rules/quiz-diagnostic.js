/* Diagnostic quizzes: short, low-stakes quizzes that show whether the class understands a concept. They are not marks.
   One responsibility: the class diagnostic (per question and per concept), the record kept when a diagnostic ends (the Diagnostic_Log tab),
   and the summary over all diagnostics for Class Analytics. The mode itself (the quiz_type setting) is in rules/quiz-control.js.
   The website does the same on phys143-quiz-host.html (Concept diagnostic): same wording, same bank files (quizzes/lectureN_concept.json), each
   question carrying a "tag", the concept it tests. Nothing here goes to Master, Scores, Totals or Form Responses 1, so a diagnostic never changes a grade.
   Counts only: the class diagnostic and the summary show how many answered and how many were right, never names. o = {site} as in quiz-control. */
"use strict";
const C = require("./quiz-control");
const R = require("./quiz-results");

const TAB = "Diagnostic_Log", HEADER = ["Timestamp", "Join Code", "Round", "Week", "Student ID", "Q", "Question ID", "Concept", "Answer", "Correct answer", "Correct"];
const LETTERS = ["A", "B", "C", "D", "E"], UNTAGGED = "Untagged", MIN_ANSWERS = 10;
const up = (v) => String(v).trim().toUpperCase();
const plain = (t) => String(t || "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
const pct = (right, n) => (n ? Math.round(1000 * right / n) / 10 : null);
const rowsOf = (store) => { const r = store.rows(TAB); return r && r.length > 1 ? r.slice(1) : []; };

// The questions of a diagnostic quiz as it stands: [{q, id, tag, text, letter}] in the order asked.
function questionsOf(store, code, c, o) {
  const e = C.liveEntry(store, code, c, o); if (!e || e.inline) return [];
  const bank = o.site("/quizzes/" + e.bank + ".json").questions;
  return C.qids(c).map((id, i) => { const b = bank.find((x) => x.id === id); return b ? { q: i + 1, id, tag: String(b.tag || UNTAGGED), text: plain(b.q).slice(0, 110), letter: LETTERS[b.answer] } : null; }).filter(Boolean);
}

function fold(list, tagOf) { // [{tag, answered, right, questions, pct}] in order of first appearance
  const by = {}, order = [];
  list.forEach((x) => { const t = tagOf(x); if (!by[t]) { by[t] = { tag: t, answered: 0, right: 0, questions: 0 }; order.push(t); } by[t].answered += x.answered; by[t].right += x.right; by[t].questions++; });
  return order.map((t) => Object.assign(by[t], { pct: pct(by[t].right, by[t].answered) }));
}

// The class diagnostic for the round in progress or just ended (answers so far). null when the quiz is not a diagnostic.
function live(store, code, c, o) {
  if (!C.isConcept(c)) return null;
  try {
    const got = R.latestAnswers(store, code), qs = questionsOf(store, code, c, o);
    const byQ = qs.map((q) => {
      let answered = 0, right = 0;
      Object.keys(got).forEach((id) => { const a = got[id].ans[q.q - 1]; if (a) { answered++; if (a === q.letter) right++; } });
      return { q: q.q, tag: q.tag, answered, right, pct: pct(right, answered), text: q.text };
    });
    return { byQ, byTag: fold(byQ, (x) => x.tag) };
  } catch (e) { return null; }
}

// When a diagnostic ends: keep each student's answer to each question with its concept, for the round (a reopened quiz replaces it).
function record(store, code, c, o) {
  if (!C.isConcept(c)) return 0;
  const got = R.latestAnswers(store, code), qs = questionsOf(store, code, c, o), rnd = R.roundOf(store, code), wk = Number(c.v[20]) || 1, now = store.now(), add = [];
  Object.keys(got).forEach((id) => qs.forEach((q) => {
    const a = String(got[id].ans[q.q - 1] || ""); add.push([now, code, rnd, wk, id, q.q, q.id, q.tag, a, q.letter || "", a && a === q.letter ? 1 : 0]);
  }));
  const keep = rowsOf(store).filter((r) => !(up(r[1]) === code && (Number(r[2]) || 0) === rnd));
  store.setRows(TAB, [HEADER.slice()].concat(keep, add));
  return add.length;
}

// Everything the lecturer has run as a diagnostic: for each quiz its concepts, and over all quizzes of a week the concepts together.
// Counts and shares only. A share is called "Too early" below MIN_ANSWERS answers, never a verdict.
function summary(store, o) {
  const quizzes = {}, order = [];
  rowsOf(store).forEach((r) => {
    const k = up(r[1]) + "|" + (Number(r[2]) || 0), a = String(r[8] || "");
    const z = quizzes[k] || (quizzes[k] = { code: up(r[1]), round: Number(r[2]) || 0, week: Number(r[3]) || 0, at: r[0], students: {}, q: {} });
    if (!order.includes(k)) order.push(k);
    z.students[String(r[4])] = 1;
    const q = z.q[r[5]] || (z.q[r[5]] = { q: Number(r[5]), id: String(r[6]), tag: String(r[7] || UNTAGGED), answered: 0, right: 0 });
    if (a) { q.answered++; q.right += Number(r[10]) ? 1 : 0; }
  });
  let titles = {}; try { titles = o.site("/apps_script/live_quizzes.json").weeks || {}; } catch (e) { /* titles are a nicety */ }
  const list = order.map((k) => {
    const z = quizzes[k], qs = Object.values(z.q).sort((x, y) => x.q - y.q).map((x) => Object.assign(x, { pct: pct(x.right, x.answered) }));
    return { code: z.code, round: z.round, week: z.week, title: titles[String(z.week)] || "", at: z.at, students: Object.keys(z.students).length, questions: qs, concepts: fold(qs, (x) => x.tag) };
  });
  const byWeek = {};
  list.forEach((z) => { (byWeek[z.week] || (byWeek[z.week] = [])).push(z); });
  const weeks = Object.keys(byWeek).map(Number).sort((a, b) => a - b).map((w) => {
    const all = [].concat(...byWeek[w].map((z) => z.questions)), concepts = fold(all, (x) => x.tag).map((c) => Object.assign(c, { early: c.answered < MIN_ANSWERS }));
    concepts.sort((x, y) => (x.early - y.early) || ((x.pct == null ? 101 : x.pct) - (y.pct == null ? 101 : y.pct)));
    return { week: w, title: titles[String(w)] || "", quizzes: byWeek[w].length, concepts };
  });
  return { ok: true, quizzes: list, weeks, minAnswers: MIN_ANSWERS };
}

module.exports = { TAB, HEADER, MIN_ANSWERS, live, record, summary, questionsOf };
