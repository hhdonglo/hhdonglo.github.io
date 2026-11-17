/* Topic mastery: from the answer list (evidence.js) and the topic map (map.js), how well each topic is understood.
   Pure functions: rows in, plain data out. Every cut-off is a constant here, so one place changes them.
   Bands: well mastered (70% or more), developing (50 to 69), needs attention (under 50), too early (few answers; shown, never judged). */
"use strict";

const WELL = 70, DEVELOPING = 50;
const MIN_TOPIC_ANSWERS = 10;   // a class band needs this many answers in the topic
const MIN_STUDENT_ANSWERS = 3;  // a student's own band needs this many of their answers
const SMALL_ANSWERS = 20, SMALL_STUDENTS = 5; // below these the topic is flagged "few answers"
const MIN_QUESTION_ANSWERS = 5, MIN_WRONG_ANSWERS = 8, WRONG_SHARE = 25;
const BANDS = ["well", "developing", "attention", "early"];
const BAND_LABEL = { well: "Well mastered", developing: "Developing", attention: "Needs attention", early: "Too early to say" };

const pct = (a, b) => (b ? Math.round(1000 * a / b) / 10 : null);
function bandOf(p, n, min) { return p === null || n < min ? "early" : p >= WELL ? "well" : p >= DEVELOPING ? "developing" : "attention"; }
const letterIndex = (c) => "ABCDE".indexOf(String(c || "").toUpperCase());
const short = (s, n) => { s = String(s || ""); return s.length > n ? s.slice(0, n - 1) + "…" : s; };

function questionLines(rows, map) { // per question: answers, % correct and the live wrong-option spread
  const Q = {};
  rows.forEach((r) => {
    const x = Q[r.qid] || (Q[r.qid] = { id: r.qid, answers: 0, right: 0, live: 0, wrong: {}, key: "" });
    x.answers++; x.right += r.ok;
    if (r.src === "live") { x.live++; if (r.key) x.key = r.key; if (!r.ok && r.option) x.wrong[r.option] = (x.wrong[r.option] || 0) + 1; }
  });
  return Object.keys(Q).map((k) => {
    const x = Q[k], q = map.question(x.id) || {};
    let top = "", n = 0; Object.keys(x.wrong).forEach((o) => { if (x.wrong[o] > n) { n = x.wrong[o]; top = o; } });
    const share = x.live ? Math.round(100 * n / x.live) : 0, opt = letterIndex(top);
    return { id: x.id, stem: short(String(q.q || "").replace(/<[^>]+>/g, ""), 90), answers: x.answers, pct: pct(x.right, x.answers), live: x.live,
      wrong: x.live >= MIN_WRONG_ANSWERS && share >= WRONG_SHARE && top ? { option: top, share, n, text: short(q.options && opt >= 0 ? String(q.options[opt] || "") : "", 90) } : null };
  });
}

// One group of rows (the whole class, or one live quiz) into topics. A row whose question has no lecture is counted in `unmapped`, never guessed.
function summarise(rows, map) {
  const T = {}; let unmapped = 0;
  rows.forEach((r) => {
    const t = map.topic(r.qid); if (!t) { unmapped++; return; }
    const x = T[t.key] || (T[t.key] = { t, answers: 0, right: 0, who: {}, rows: [] });
    x.answers++; x.right += r.ok; x.rows.push(r);
    const w = x.who[r.id] || (x.who[r.id] = { n: 0, right: 0 }); w.n++; w.right += r.ok;
  });
  const topics = Object.keys(T).map((k) => {
    const x = t_(T[k]), ids = Object.keys(x.who), p = pct(x.right, x.answers);
    const sb = { well: 0, developing: 0, attention: 0, early: 0 };
    ids.forEach((id) => { sb[bandOf(pct(x.who[id].right, x.who[id].n), x.who[id].n, MIN_STUDENT_ANSWERS)]++; });
    const lines = questionLines(x.rows, map).filter((l) => l.answers >= MIN_QUESTION_ANSWERS && l.pct !== null);
    const asc = lines.slice().sort((a, b) => a.pct - b.pct || b.answers - a.answers), hardest = asc.slice(0, 3);
    const easiest = asc.slice().reverse().filter((l) => hardest.indexOf(l) < 0).slice(0, 3);
    const C = {}; x.rows.forEach((r) => { const c = map.concept(r.qid); if (!c) return; const y = C[c] || (C[c] = { name: c, answers: 0, right: 0 }); y.answers++; y.right += r.ok; });
    const concepts = Object.keys(C).map((c) => ({ name: C[c].name, answers: C[c].answers, pct: pct(C[c].right, C[c].answers) })).filter((c) => c.answers >= MIN_QUESTION_ANSWERS).sort((a, b) => a.pct - b.pct);
    return Object.assign({}, x.t, { answers: x.answers, right: x.right, pct: p, students: ids.length, band: bandOf(p, x.answers, MIN_TOPIC_ANSWERS), small: x.answers < SMALL_ANSWERS || ids.length < SMALL_STUDENTS,
      studentBands: sb, hardest, easiest, wrong: lines.filter((l) => l.wrong).sort((a, b) => b.wrong.share - a.wrong.share).slice(0, 3).map((l) => ({ id: l.id, stem: l.stem, option: l.wrong.option, share: l.wrong.share, n: l.wrong.n, text: l.wrong.text })), concepts });
  }).sort((a, b) => a.lecture - b.lecture);
  return { topics, answers: rows.length - unmapped, unmapped };
}
const t_ = (x) => ({ t: x.t, answers: x.answers, right: x.right, who: x.who, rows: x.rows });

// Each live quiz on its own (live answers only: practice has no quiz), in the order given.
function byQuiz(rows, map, order) {
  const live = rows.filter((r) => r.src === "live"), out = {};
  (order || []).forEach((q) => { const part = live.filter((r) => r.quiz === q); out[q] = part.length ? summarise(part, map) : { topics: [], answers: 0, unmapped: 0 }; });
  return out;
}

// Mastery by topic over the quizzes: values[i] is the % correct in quiz i (null when the topic was not asked or has under 5 answers there).
function overTime(per, order) {
  const keys = {}, series = [];
  order.forEach((q) => per[q].topics.forEach((t) => { if (!keys[t.key]) { keys[t.key] = { key: t.key, label: t.label, title: t.title, name: t.name, lecture: t.lecture, values: [], answers: [] }; series.push(keys[t.key]); } }));
  series.forEach((s) => order.forEach((q) => { const t = per[q].topics.filter((x) => x.key === s.key)[0]; s.values.push(t && t.answers >= MIN_QUESTION_ANSWERS ? t.pct : null); s.answers.push(t ? t.answers : 0); }));
  return series.sort((a, b) => a.lecture - b.lecture);
}

// {id: {topicKey: {pct, n}}} for the correlations. Only the class list reaches here (evidence.js).
function perStudent(rows, map) {
  const out = {};
  rows.forEach((r) => { const t = map.topic(r.qid); if (!t) return; const s = out[r.id] || (out[r.id] = {}), x = s[t.key] || (s[t.key] = { right: 0, n: 0 }); x.n++; x.right += r.ok; });
  Object.keys(out).forEach((id) => Object.keys(out[id]).forEach((k) => { const x = out[id][k]; out[id][k] = { pct: pct(x.right, x.n), n: x.n }; }));
  return out;
}

const ADVICE = {
  well: () => "A short practice before the exam keeps it fresh.",
  developing: (c, lab) => (c ? "Revise " + c + ", then" : "Re-read the " + lab + " slides, then") + " redo the practice quiz.",
  attention: (c, lab) => "Start here: " + (c ? "re-read " + c + " and" : "re-read the " + lab + " slides and") + " work through the questions to revisit, then redo the practice quiz.",
  early: (c, lab, n) => "Only " + n + " of " + MIN_STUDENT_ANSWERS + " answers needed so far. Try the " + lab + " practice quiz."
};
// One student's own topics, from their own rows only. Weakest first, so the list reads as "revise these first".
function studentTopics(rows, map) {
  const T = {};
  rows.forEach((r) => { const t = map.topic(r.qid); if (!t) return; const x = T[t.key] || (T[t.key] = { t, n: 0, right: 0, C: {} }); x.n++; x.right += r.ok; const c = map.concept(r.qid); if (c && !r.ok) x.C[c] = (x.C[c] || 0) + 1; });
  const rank = { attention: 0, developing: 1, early: 2, well: 3 };
  return Object.keys(T).map((k) => {
    const x = T[k], p = pct(x.right, x.n), b = bandOf(p, x.n, MIN_STUDENT_ANSWERS);
    const weak = Object.keys(x.C).sort((a, c) => x.C[c] - x.C[a])[0] || "";
    return { key: x.t.key, lecture: x.t.lecture, label: x.t.label, title: x.t.title, name: x.t.name, asked: x.n, right: x.right, pct: p, band: b, bandLabel: BAND_LABEL[b], concept: weak, advice: ADVICE[b](weak, x.t.label, x.n) };
  }).sort((a, b) => rank[a.band] - rank[b.band] || (a.pct === null ? 101 : a.pct) - (b.pct === null ? 101 : b.pct) || a.lecture - b.lecture);
}

module.exports = { summarise, byQuiz, overTime, perStudent, studentTopics, bandOf, BANDS, BAND_LABEL, WELL, DEVELOPING, MIN_TOPIC_ANSWERS, MIN_STUDENT_ANSWERS };
