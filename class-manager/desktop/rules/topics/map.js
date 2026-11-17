/* Topic map: which lecture topic and concept each question belongs to. Nothing is invented.
   Topic   = the lecture the question id names (L3-07 is Lecture 3), titled from data/lectures.json; a question with no lecture in its id has no topic and is counted as unmapped.
   Concept = the bank's own `concept`, `topic` or first `tag` field when it has one; otherwise the slide named in the question's `ref` (the text in quotes); otherwise none.
   o = {site}: reads the course's JSON files (data/lectures.json, quizzes/lectureN.json). Plain data in and out; no store. */
"use strict";

const plain = (t) => String(t || "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
const lectureOf = (qid) => { const m = /^L(\d+)-/i.exec(String(qid || "")); return m ? Number(m[1]) : -1; };
const keyOf = (n) => "L" + n;
const labelOf = (n) => (n === 0 ? "Introduction" : "Lecture " + n);

function lectureTitles(o) { // {number: title} from data/lectures.json
  const out = {};
  try { const d = o.site("/data/lectures.json"); (d.groups || []).forEach((g) => (g.lectures || []).forEach((l) => { const n = Number(l.number); if (!isNaN(n) && l.title) out[n] = plain(l.title); })); } catch (e) { /* titles are optional */ }
  return out;
}
function bank(o, n) { try { const b = o.site("/quizzes/lecture" + n + ".json"); return { title: plain(b.title), questions: b.questions || [] }; } catch (e) { return { title: "", questions: [] }; } }

// The concept a bank question names for itself, or the slide its `ref` points to. "" when it names neither.
function conceptOf(q) {
  const own = plain(q.concept || q.topic || (Array.isArray(q.tags) ? q.tags[0] : q.tags));
  if (own) return own;
  const m = /[‘“"']([^’”"']{3,80})[’”"']/.exec(String(q.ref || ""));
  return m ? plain(m[1]) : "";
}

/* Build the map for the lectures wanted (numbers). Returns {topic(qid), concept(qid), question(qid), topics(), unmappedCount(qids)}.
   topic(qid) -> {key, lecture, label, title, name} or null. */
function build(o, wanted) {
  const titles = lectureTitles(o), banks = {}, byQ = {}, seen = {};
  const need = {}; Object.keys(titles).forEach((k) => { need[k] = 1; }); (wanted || []).forEach((k) => { if (k >= 0) need[k] = 1; });
  Object.keys(need).forEach((k) => {
    const b = bank(o, k); banks[k] = b; if (b.title && !titles[k]) titles[k] = b.title;
    b.questions.forEach((q) => { if (q && q.id) byQ[String(q.id).trim()] = q; });
  });
  const topicOf = (n) => { if (n < 0) return null; const t = titles[n] || ""; return { key: keyOf(n), lecture: n, label: labelOf(n), title: t, name: labelOf(n) + (t ? ": " + t : "") }; };
  return {
    topic: (qid) => { const n = lectureOf(qid); if (n < 0) return null; if (!seen[n]) seen[n] = topicOf(n); return seen[n]; },
    concept: (qid) => { const q = byQ[String(qid || "").trim()]; return q ? conceptOf(q) : ""; },
    question: (qid) => byQ[String(qid || "").trim()] || null,
    topics: () => Object.keys(titles).map(Number).sort((a, b) => a - b).map(topicOf)
  };
}

module.exports = { build, conceptOf, lectureOf, keyOf, labelOf, plain };
