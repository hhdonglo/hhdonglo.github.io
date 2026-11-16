/* Learning objectives and progress: questions linked to objectives, every answer as evidence, progress by objective, the class by calendar week and the
   ask-discuss-revise evidence. A port of the outcomes and progress part of apps_script/src/30-analytics.gs, with the same answers.
   o = {site}: the course's JSON files (data/lectures.json, quizzes/lectureN.json). */
"use strict";
const AC = require("./access-codes");
const L = require("./learning");
const { normalizeId } = require("../ids");
const { logLine } = require("./store");

const QOUT = "Question_Outcomes", QOUT_HEAD = ["Question ID", "Lecture", "Outcome", "Set"], ITEMS = "Item_Log";
const PROG_MIN = 3, PROG_SECURE = 70, PROG_DEVELOPING = 50, PROG_LEVELS = ["Secure", "Developing", "Beginning", "Not enough evidence"];
const pct = L.pct, plain = (t) => String(t || "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
const body = (store, tab, w) => { const r = store.rows(tab); return r && r.length > 1 ? r.slice(1).map((x) => x.slice(0, w)) : []; };
const dmy = (t) => { if (!t) return ""; const d = new Date(t), p = (n) => String(n).padStart(2, "0"); return p(d.getDate()) + "/" + p(d.getMonth() + 1) + "/" + d.getFullYear(); };
const clean = (v, max) => { let s = String(v == null ? "" : v).trim().slice(0, max); if (/^[=+\-@]/.test(s)) s = "'" + s; return s; };
const mondayOf = (t) => { const d = new Date(t); return new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7)).getTime(); };

function lecturesInfo(o) { // {number: {title, outcomes: [text]}} from data/lectures.json
  const out = {};
  try { const d = o.site("/data/lectures.json"); (d.groups || []).forEach((g) => (g.lectures || []).forEach((l) => { const n = Number(l.number); if (!isNaN(n)) out[n] = { title: String(l.title || ""), outcomes: (l.outcomes || []).map((x) => plain(x)) }; })); } catch (e) { /* no lecture list */ }
  return out;
}
const bankFor = (o, n) => { try { return o.site("/quizzes/lecture" + n + ".json").questions || []; } catch (e) { return []; } };
const tagRows = (store) => body(store, QOUT, 4);
function outcomeMap(store, lects, o) { // {qid: {lec, n, from}}: the bank's own field, then the lecturer's tags
  const map = {};
  Object.keys(lects).forEach((k) => bankFor(o, k).forEach((q) => { const n = Number(q.outcome); if (q.id && n >= 1 && n <= lects[k].outcomes.length) map[q.id] = { lec: Number(k), n, from: "bank" }; }));
  tagRows(store).forEach((r) => { const id = String(r[0]).trim(), n = Number(r[2]); if (!id) return; if (n > 0) map[id] = { lec: Number(r[1]), n, from: "lecturer" }; else delete map[id]; });
  return map;
}
function outcomeKey(qid, map) { const t = map[qid]; if (t) return "L" + t.lec + "." + t.n; const l = L.lectureOfQid(qid); return l >= 0 ? "L" + l : ""; }
function outcomeLabel(key, lects) {
  const m = /^L(\d+)(?:\.(\d+))?$/.exec(key); if (!m) return key;
  const l = lects[Number(m[1])], lname = Number(m[1]) === 0 ? "Introduction" : "Lecture " + m[1];
  if (!m[2]) return lname + " (not linked to an objective)";
  const t = l && l.outcomes[Number(m[2]) - 1]; return lname + ", objective " + m[2] + (t ? ": " + t : "");
}
const STOP = { the: 1, and: 1, for: 1, are: 1, how: 1, its: 1, has: 1, was: 1, why: 1, who: 1, use: 1, one: 1, two: 1, with: 1, that: 1, this: 1, from: 1, into: 1, which: 1, what: 1, when: 1, their: 1, there: 1, these: 1, those: 1, will: 1, able: 1, students: 1, student: 1, should: 1, using: 1, between: 1, given: 1, value: 1, following: 1, correct: 1, answer: 1 };
const stems = (t) => plain(t).toLowerCase().replace(/[^a-z0-9 ]+/g, " ").split(/\s+/).filter((w) => w.length > 2 && !STOP[w]).map((w) => w.replace(/ies$/, "y").replace(/(ing|ed|es|s)$/, "")).filter((w) => w.length > 2);
function suggestOutcome(q, outcomes) { // the objective whose words the question shares most, or 0
  const qs = {}; stems(q.q + " " + (q.exp || "") + " " + (q.options || []).join(" ")).forEach((w) => { qs[w] = 1; });
  let best = 0, bestScore = 0;
  outcomes.forEach((oc, i) => { let sc = 0; const seen = {}; stems(oc).forEach((w) => { if (qs[w] && !seen[w]) { seen[w] = 1; sc++; } }); if (sc > bestScore) { bestScore = sc; best = i + 1; } });
  return best;
}

// ---- Every answer as evidence, by student, in time order ----
function evidence(store, o) {
  const lects = lecturesInfo(o), map = outcomeMap(store, lects, o), out = {}, rel = L.releasedSet(store);
  const add = (id, t, qid, ok, src) => { if (!id || !qid) return; const k = outcomeKey(qid, map); if (!k) return; (out[id] = out[id] || []).push({ t, qid, ok, src, key: k }); };
  body(store, ITEMS, 13).forEach((r) => {
    const id = normalizeId(r[4]), code = String(r[1]).trim().toUpperCase(), rnd = Number(r[2]) || 0;
    if (!rel[String(r[4]).trim() + "|" + code + "|" + rnd] || !String(r[7]).trim()) return; // released and answered
    add(id, new Date(r[0]).getTime() || 0, String(r[6]).trim(), Number(r[9]) ? 1 : 0, "live");
  });
  L.attemptRows(store).forEach((a) => a.asked.forEach((q) => add(a.id, a.ts, q, a.wrong.indexOf(q) < 0 ? 1 : 0, a.mock ? "mock" : "practice")));
  Object.keys(out).forEach((id) => out[id].sort((a, b) => a.t - b.t));
  out._lects = lects; out._map = map; return out;
}
const levelOf = (n, cur) => (n < PROG_MIN || cur === null ? "Not enough evidence" : cur >= PROG_SECURE ? "Secure" : cur >= PROG_DEVELOPING ? "Developing" : "Beginning");
function progressOf(evs) { // start: the first answers; current: the latest answers (three each once there are six, otherwise half each)
  const n = evs.length, k = n >= 6 ? 3 : Math.floor(n / 2), ok = evs.reduce((a, e) => a + e.ok, 0);
  const start = k ? pct(evs.slice(0, k).reduce((a, e) => a + e.ok, 0), k) : null, cur = k ? pct(evs.slice(n - k).reduce((a, e) => a + e.ok, 0), k) : (n ? pct(ok, n) : null);
  return { answers: n, right: ok, pct: pct(ok, n), start, current: cur, gain: start !== null && cur !== null ? Math.round(10 * (cur - start)) / 10 : null, level: levelOf(n, cur), first: n ? evs[0].t : 0, last: n ? evs[n - 1].t : 0 };
}
function studentProgress(id, ev) { // by outcome, and over time (proportion correct per calendar week of answers)
  const mine = ev[id] || [], lects = ev._lects, by = {};
  mine.forEach((e) => { (by[e.key] = by[e.key] || []).push(e); });
  const outcomes = Object.keys(by).map((k) => { const p = progressOf(by[k]); p.key = k; p.label = outcomeLabel(k, lects); p.linked = /\./.test(k); return p; }).sort((a, b) => a.key.localeCompare(b.key, undefined, { numeric: true }));
  const weeks = {}, order = [];
  mine.forEach((e) => { const m = mondayOf(e.t); if (!weeks[m]) { weeks[m] = { right: 0, n: 0 }; order.push(m); } weeks[m].right += e.ok; weeks[m].n++; });
  const timeline = order.sort((a, b) => a - b).map((w) => ({ week: dmy(w), n: weeks[w].n, pct: pct(weeks[w].right, weeks[w].n) }));
  const all = progressOf(mine), lv = {}; PROG_LEVELS.forEach((l) => { lv[l] = 0; }); outcomes.forEach((oc) => { lv[oc.level]++; });
  return { overall: all, outcomes, timeline, levels: lv, minimum: PROG_MIN };
}
const rosterSet = (store) => { const r = {}; AC.rosterRows(store).forEach((x) => { r[normalizeId(x[0])] = true; }); delete r[""]; return r; };
function classOutcomes(store, ev, lects) { // outcome by outcome: who has evidence, the mean current level and gain, students at each level
  const roster = rosterSet(store), has = Object.keys(roster).length > 0, keys = {};
  Object.keys(ev).forEach((id) => {
    if (id.charAt(0) === "_" || (has && !roster[id])) return; const by = {};
    ev[id].forEach((e) => { (by[e.key] = by[e.key] || []).push(e); });
    Object.keys(by).forEach((k) => { const p = progressOf(by[k]), x = keys[k] || (keys[k] = { key: k, students: 0, answers: 0, right: 0, cur: [], gain: [], levels: {} }); x.students++; x.answers += p.answers; x.right += p.right; if (p.answers >= PROG_MIN) x.cur.push(p.current); if (p.gain !== null && p.answers >= 4) x.gain.push(p.gain); x.levels[p.level] = (x.levels[p.level] || 0) + 1; });
  });
  const mean = (xs) => (xs.length ? Math.round(10 * xs.reduce((a, b) => a + b, 0) / xs.length) / 10 : null);
  return Object.keys(keys).map((k) => { const x = keys[k]; PROG_LEVELS.forEach((l) => { x.levels[l] = x.levels[l] || 0; }); return { key: k, label: outcomeLabel(k, lects), linked: /\./.test(k), students: x.students, answers: x.answers, pct: pct(x.right, x.answers), current: mean(x.cur), gain: mean(x.gain), gainN: x.gain.length, levels: x.levels }; }).sort((a, b) => a.key.localeCompare(b.key, undefined, { numeric: true }));
}
function classTimeline(store, ev) { // the class by calendar week of answers; the quartiles are not shown below four students
  const roster = rosterSet(store), has = Object.keys(roster).length > 0, weeks = {}, order = [];
  Object.keys(ev).forEach((id) => {
    if (id.charAt(0) === "_" || (has && !roster[id])) return; const mine = {};
    ev[id].forEach((e) => { const m = mondayOf(e.t), w = mine[m] || (mine[m] = { r: 0, n: 0 }); w.r += e.ok; w.n++; });
    Object.keys(mine).forEach((m) => { const w = weeks[m] || (weeks[m] = { pcts: [], answers: 0 }); if (order.indexOf(m) < 0) order.push(m); w.pcts.push(pct(mine[m].r, mine[m].n)); w.answers += mine[m].n; });
  });
  const q = (xs, f) => { const i = (xs.length - 1) * f, lo = Math.floor(i), hi = Math.ceil(i); return Math.round(10 * (xs[lo] + (xs[hi] - xs[lo]) * (i - lo))) / 10; };
  return order.map(Number).sort((a, b) => a - b).map((m) => {
    const w = weeks[m], xs = w.pcts.slice().sort((a, b) => a - b);
    return { week: dmy(m), students: xs.length, answers: w.answers, mean: Math.round(10 * xs.reduce((a, b) => a + b, 0) / xs.length) / 10, median: q(xs, 0.5), q1: xs.length >= 4 ? q(xs, 0.25) : null, q3: xs.length >= 4 ? q(xs, 0.75) : null };
  });
}
// Ask, discuss, revise: every question that had a second vote. Normalised gain = (after - before) / (100 - before).
function discussionStats(store) {
  const rows = body(store, ITEMS, 13), qs = {}, order = [], byStudent = {};
  rows.forEach((r) => {
    if (Number(r[12]) !== 1) return;
    const k = String(r[1]).trim().toUpperCase() + "|" + (Number(r[2]) || 0) + "|" + r[5], key = String(r[8]).trim(), f = String(r[11]).trim(), a = String(r[7]).trim(), id = normalizeId(r[4]);
    const q = qs[k] || (qs[k] = { code: String(r[1]).trim().toUpperCase(), round: Number(r[2]) || 0, q: Number(r[5]), qid: String(r[6]).trim(), week: r[3], date: dmy(new Date(r[0]).getTime()), before: 0, beforeN: 0, after: 0, afterN: 0, wrongToRight: 0, rightToWrong: 0, pairs: 0 });
    if (order.indexOf(k) < 0) order.push(k);
    if (f) { q.beforeN++; if (f === key) q.before++; }
    if (a) { q.afterN++; if (a === key) q.after++; }
    if (f && a) {
      q.pairs++; const s = byStudent[id] || (byStudent[id] = { pairs: 0, wrongToRight: 0, rightToWrong: 0, stayedRight: 0, stayedWrong: 0 }); s.pairs++;
      if (f !== key && a === key) { q.wrongToRight++; s.wrongToRight++; } else if (f === key && a !== key) { q.rightToWrong++; s.rightToWrong++; } else if (f === key) s.stayedRight++; else s.stayedWrong++;
    }
  });
  const gainOf = (b, a) => (b === null || a === null || b >= 100 ? null : Math.round(100 * (a - b) / (100 - b)) / 100);
  const list = order.map((k) => { const q = qs[k]; q.beforePct = pct(q.before, q.beforeN); q.afterPct = pct(q.after, q.afterN); q.gain = gainOf(q.beforePct, q.afterPct); return q; });
  let B = 0, BN = 0, A = 0, AN = 0, w2r = 0, r2w = 0, pairs = 0;
  list.forEach((q) => { B += q.before; BN += q.beforeN; A += q.after; AN += q.afterN; w2r += q.wrongToRight; r2w += q.rightToWrong; pairs += q.pairs; });
  const bp = pct(B, BN), ap = pct(A, AN);
  return { questions: list, rounds: list.length, pairs, beforePct: bp, afterPct: ap, gain: gainOf(bp, ap), wrongToRight: w2r, rightToWrong: r2w, byStudent, note: "Normalised gain is the share of the possible improvement reached after discussion (0 none, 1 all). A question where most were right at first has little room to gain." };
}
// Members' outcome evidence before the task was set and after it, for an assignment linked to an outcome.
function asgBeforeAfter(a, ids, ev) {
  if (!a.outcome) return null; const b = { r: 0, n: 0 }, f = { r: 0, n: 0 };
  ids.forEach((id) => (ev[id] || []).forEach((e) => { if (e.key !== a.outcome) return; const x = e.t < a.created ? b : f; x.n++; x.r += e.ok; }));
  return { outcome: a.outcome, label: outcomeLabel(a.outcome, ev._lects), before: pct(b.r, b.n), beforeN: b.n, after: pct(f.r, f.n), afterN: f.n, small: b.n < 10 || f.n < 10 };
}

// Host only: list the lectures, their objectives and every question with its link; save links; accept suggestions.
function outcomesAct(store, p, o) {
  const op = String(p.op || "list").toLowerCase(), lects = lecturesInfo(o);
  if (op === "save" || op === "accept") {
    const rows = tagRows(store), byId = {}, now = store.now(); let changes = [];
    rows.forEach((r, i) => { byId[String(r[0]).trim()] = i; });
    if (op === "save") { try { changes = JSON.parse(String(p.tags || "[]")); } catch (e) { return { ok: false, why: "the links could not be read" }; } }
    else {
      const ln = Number(p.lecture), lo = lects[ln]; if (!lo) return { ok: false, why: "no such lecture" };
      const cur = outcomeMap(store, lects, o);
      bankFor(o, ln).forEach((q) => { if (q.id && !cur[q.id]) { const sg = suggestOutcome(q, lo.outcomes); if (sg) changes.push({ id: q.id, lecture: ln, outcome: sg }); } });
    }
    changes.slice(0, 2000).forEach((c) => {
      const id = clean(c.id, 40).replace(/^'/, ""); let l = Number(c.lecture); const n = Math.max(0, Math.min(20, Number(c.outcome) || 0)); if (!id) return;
      if (isNaN(l) || l < 0) l = L.lectureOfQid(id);
      const row = [id, l, n, now]; if (byId[id] !== undefined) rows[byId[id]] = row; else { byId[id] = rows.length; rows.push(row); }
    });
    store.setRows(QOUT, [QOUT_HEAD.slice()].concat(rows));
    logLine(store, "outcome links", op + ": " + changes.length, "", "");
    const res = outcomesAct(store, { op: "list" }, o); res.saved = changes.length; return res;
  }
  const map = outcomeMap(store, lects, o), ev = evidence(store, o), cls = classOutcomes(store, ev, lects), byKey = {}; cls.forEach((x) => { byKey[x.key] = x; });
  const lectures = Object.keys(lects).map(Number).sort((a, b) => a - b).map((n) => {
    const l = lects[n], bank = bankFor(o, n), count = {};
    const qs = bank.map((q) => { const t = map[q.id], sg = l.outcomes.length ? suggestOutcome(q, l.outcomes) : 0; if (t) count[t.n] = (count[t.n] || 0) + 1; return { id: q.id, text: plain(q.q).slice(0, 220), type: q.type || "", outcome: t ? t.n : 0, from: t ? t.from : "", suggested: sg }; });
    return { number: n, title: l.title, questions: qs, untagged: qs.filter((q) => !q.outcome).length, outcomes: l.outcomes.map((text, i) => { const k = "L" + n + "." + (i + 1), c = byKey[k]; return { n: i + 1, text, questions: count[i + 1] || 0, answers: c ? c.answers : 0, pct: c ? c.pct : null, students: c ? c.students : 0, levels: c ? c.levels : null }; }) };
  });
  return { ok: true, lectures, levels: PROG_LEVELS, minimum: PROG_MIN };
}

module.exports = { lecturesInfo, outcomeMap, outcomeKey, outcomeLabel, suggestOutcome, outcomesAct, evidence, progressOf, studentProgress, classOutcomes, classTimeline, discussionStats, asgBeforeAfter, PROG_MIN, PROG_LEVELS, PROG_SECURE, PROG_DEVELOPING };
