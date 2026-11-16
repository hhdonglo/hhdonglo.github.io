/* Learning evidence: a student's own record (what to revisit), per-question statistics, Teaching insights, student records and notes. A port of
   studentLearning_, questionStats_, insights_, studentRecords_ and studentNoteAdd_ (apps_script/src/30-analytics.gs, 35-records.gs), with the same answers.
   o = {} (nothing needed from outside); time is store.now(). */
"use strict";
const AC = require("./access-codes");
const { normalizeId } = require("../ids");
const { append } = require("./store");

const ITEMS = "Item_Log", ATTEMPTS = "Attempts", RESPONSES = "Form Responses 1", ATT = "Attendance", QSTATS = "Question_Stats", RECORDS = "Records", NOTES = "Student_Notes";
const QSTATS_HEADER = ["Question ID", "Lecture", "Answers", "% correct", "Label", "Live answers", "Live % correct", "Correct option", "Most chosen wrong option", "Discrimination", "Confident and wrong", "Practice answers", "Practice % correct", "Updated"];
const RECORDS_HEAD = ["Timestamp", "Student ID", "Category", "Assessment", "Score", "Out of", "Lecture"], NOTES_HEAD = ["Timestamp", "Student ID", "Note", "By"];
const pct = (a, b) => (b ? Math.round(1000 * a / b) / 10 : null);
const splitIds = (s) => String(s || "").split(/[\s,]+/).map((x) => x.replace(/^'/, "").trim()).filter(String);
const lectureOfQid = (qid) => { const m = /^L(\d+)-/i.exec(String(qid || "")); return m ? Number(m[1]) : -1; };
const body = (store, tab, w) => { const r = store.rows(tab); return r && r.length > 1 ? r.slice(1).map((x) => x.slice(0, w)) : []; };
const up = (v) => String(v).trim().toUpperCase();
const dmy = (d) => { const p = (n) => String(n).padStart(2, "0"); return p(d.getDate()) + "/" + p(d.getMonth() + 1) + "/" + d.getFullYear(); };
const ymd = (d) => { const p = (n) => String(n).padStart(2, "0"); return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()); };

function practiceLecture(quiz) { // 'Lecture 5 ...' -> 5, 'Introduction ...' -> 0, mock -> null
  const q = String(quiz || ""); if (/mock/i.test(q)) return null;
  const m = /^Lecture\s+(\d+)/i.exec(q); if (m) return Number(m[1]);
  return /^Introduction/i.test(q) ? 0 : null;
}
function attemptRows(store) { // [{ts, id, quiz, score, total, secs, wrong[], asked[], missed, mock, lec}]
  return body(store, ATTEMPTS, 9).map((r) => {
    const quiz = String(r[2]);
    return { ts: new Date(r[0]).getTime() || 0, id: normalizeId(r[1]), quiz, score: Number(r[4]) || 0, total: Number(r[5]) || 0, secs: Number(r[6]) || 0, wrong: splitIds(r[7]), asked: splitIds(r[8]), missed: /\(missed/i.test(quiz), mock: /mock/i.test(quiz), lec: practiceLecture(quiz) };
  }).filter((x) => x.id);
}
function releasedSet(store) { const out = {}; body(store, RESPONSES, 14).forEach((r) => { out[String(r[2]).trim() + "|" + up(r[3]) + "|" + (Number(r[10]) || 0)] = true; }); return out; }

// Per lecture: right and asked, from the latest full practice attempt, the latest mock exam and every released live quiz question.
function studentLearning(store, id) {
  const mine = attemptRows(store).filter((a) => a.id === id).sort((a, b) => a.ts - b.ts), lec = {}, revisit = [], seen = {}, practice = {}, latestFull = {};
  let mock = null;
  const add = (l, right, asked) => { if (l < 0 || !asked) return; if (!lec[l]) lec[l] = { right: 0, asked: 0 }; lec[l].right += right; lec[l].asked += asked; };
  const want = (qid, from) => { if (qid && !seen[qid]) { seen[qid] = true; revisit.push({ id: qid, from }); } };
  mine.forEach((a) => {
    const label = a.mock ? "Mock exam" : (a.lec === null ? "" : (a.lec === 0 ? "Introduction" : "Lecture " + a.lec));
    if (label) {
      const pr = practice[label] || (practice[label] = { label, attempts: 0, best: null, last: null }); pr.attempts++; pr.lastTs = a.ts;
      if (!a.missed && a.total) { pr.last = { score: a.score, total: a.total }; if (!pr.best || a.score / a.total > pr.best.score / pr.best.total) pr.best = { score: a.score, total: a.total }; }
    }
    if (a.mock) { if (!a.missed) mock = a; return; }
    if (a.lec === null) return;
    if (!a.missed) latestFull[a.lec] = { a, still: a.wrong.slice() };
    else if (latestFull[a.lec]) { const lf = latestFull[a.lec]; lf.still = lf.still.filter((q) => a.wrong.indexOf(q) >= 0 || (a.asked.length && a.asked.indexOf(q) < 0)); }
  });
  Object.keys(latestFull).forEach((k) => {
    const a = latestFull[k].a;
    if (a.asked.length) a.asked.forEach((q) => add(lectureOfQid(q), a.wrong.indexOf(q) < 0 ? 1 : 0, 1)); else add(Number(k), a.score, a.total);
    latestFull[k].still.forEach((q) => want(q, a.lec === 0 ? "Introduction practice" : "Lecture " + a.lec + " practice"));
  });
  if (mock) { mock.asked.forEach((q) => add(lectureOfQid(q), mock.wrong.indexOf(q) < 0 ? 1 : 0, 1)); mock.wrong.forEach((q) => want(q, "Mock exam")); }
  const rel = releasedSet(store);
  body(store, ITEMS, 11).forEach((r) => {
    if (normalizeId(r[4]) !== id) return;
    if (!rel[String(r[4]).trim() + "|" + up(r[1]) + "|" + (Number(r[2]) || 0)]) return; // held results stay hidden until released
    const qid = String(r[6]).trim(), ok = Number(r[9]) ? 1 : 0; add(lectureOfQid(qid), ok, 1);
    if (!ok) want(qid, r[3] ? "Week " + r[3] + " live quiz" : "Live quiz");
  });
  const mastery = Object.keys(lec).map((k) => ({ lecture: Number(k), right: lec[k].right, asked: lec[k].asked, pct: pct(lec[k].right, lec[k].asked) })).sort((a, b) => a.lecture - b.lecture);
  return { mastery, revisit: revisit.slice(0, 60), practice: Object.keys(practice).map((k) => practice[k]) };
}

// Per question: proportion correct, the spread of A to E, blanks, the most chosen wrong option, discrimination (upper and lower 27 per cent) and confidence counts.
function questionStats(items, attempts) {
  const Q = {}, attemptTotals = {};
  const q_ = (qid) => Q[qid] || (Q[qid] = { id: qid, lecture: lectureOfQid(qid), live: 0, liveRight: 0, dist: { A: 0, B: 0, C: 0, D: 0, E: 0 }, key: "", confWrong: 0, confAnswered: 0, lowRight: 0, pr: 0, prRight: 0, resp: [], blank: 0 });
  const akey = (r) => String(r[4]).trim() + "|" + up(r[1]) + "|" + (Number(r[2]) || 0);
  items.forEach((r) => { const t = attemptTotals[akey(r)] || (attemptTotals[akey(r)] = { right: 0, n: 0 }); t.n++; if (Number(r[9])) t.right++; });
  items.forEach((r) => {
    const qid = String(r[6]).trim(); if (!qid) return;
    const x = q_(qid), ok = Number(r[9]) ? 1 : 0, ans = String(r[7]).trim().toUpperCase(), cf = String(r[10]).trim().toUpperCase().charAt(0);
    x.live++; x.liveRight += ok; x.key = String(r[8]).trim().toUpperCase() || x.key;
    if (ans && x.dist[ans] !== undefined) x.dist[ans]++; else if (!ans) x.blank++;
    if (cf) { x.confAnswered++; if (!ok && cf === "H") x.confWrong++; if (ok && cf === "L") x.lowRight++; }
    const t = attemptTotals[akey(r)]; x.resp.push({ ok, total: t && t.n > 1 ? (t.right - ok) / (t.n - 1) : 0 }); // the rest of the quiz, without this question
  });
  attempts.forEach((a) => { a.asked.forEach((qid) => { const x = q_(qid); x.pr++; if (a.wrong.indexOf(qid) < 0) x.prRight++; }); });
  return Object.keys(Q).map((k) => {
    const x = Q[k], n = x.resp.length; let d = null;
    if (n >= 10) {
      const s = x.resp.slice().sort((a, b) => b.total - a.total), g = Math.max(1, Math.round(0.27 * n));
      const upv = s.slice(0, g).reduce((t, v) => t + v.ok, 0) / g, lo = s.slice(n - g).reduce((t, v) => t + v.ok, 0) / g; d = Math.round(100 * (upv - lo)) / 100;
    }
    let wrongTop = "", wrongN = 0; Object.keys(x.dist).forEach((L) => { if (L !== x.key && x.dist[L] > wrongN) { wrongN = x.dist[L]; wrongTop = L; } });
    const n2 = x.live + x.pr, p2 = n2 ? (x.liveRight + x.prRight) / n2 : null, label = n2 >= 10 ? (p2 >= 0.7 ? "Easy" : p2 >= 0.3 ? "Moderate" : "Difficult") : "";
    return { id: x.id, lecture: x.lecture, live: x.live, livePct: pct(x.liveRight, x.live), key: x.key, dist: x.dist, wrongTop, wrongTopN: wrongN, discrimination: d, confidentWrong: x.confWrong, unsureRight: x.lowRight, confAnswered: x.confAnswered, practice: x.pr, practicePct: pct(x.prRight, x.pr), blank: x.blank, answers: n2, pct: p2 === null ? null : Math.round(1000 * p2) / 10, label };
  }).sort((a, b) => a.lecture - b.lecture || (a.id < b.id ? -1 : 1));
}

// ---- Teaching insights (host only). version is the script version the pages compare. ----
function insights(store, p, version) {
  const now = store.now().getTime(), attMin = Math.max(0, Math.min(100, Number(p.att) || 70)), quizMin = Math.max(0, Math.min(100, Number(p.quiz) || 50)), idleDays = Math.max(1, Math.min(120, Number(p.idle) || 14));
  const roster = AC.rosterRows(store).map((r) => ({ id: normalizeId(r[0]), name: AC.cleanName(r[1]) })).filter((r) => r.id), inRoster = {}; roster.forEach((r) => { inRoster[r.id] = true; });
  const out = { ok: true, version, rosterSize: roster.length, thresholds: { att: attMin, quiz: quizMin, idle: idleDays } };
  const grid = (() => { const g = store.rows(ATT); return g && g.length > 1 && g[0].length > 1 ? g : null; })(), att = {}, sessions = [];
  if (grid) {
    for (let c = 1; c < grid[0].length; c++) if (String(grid[0][c]).trim()) sessions.push({ col: c, label: String(grid[0][c]).trim(), present: 0, counted: 0 });
    for (let i = 1; i < grid.length; i++) {
      const aid = normalizeId(grid[i][0]); if (!aid) continue; let pr = 0, ct = 0;
      sessions.forEach((s) => { const v = grid[i][s.col]; if (v === "" || v === null || v === undefined) return; ct++; s.counted++; if (Number(v)) { pr++; s.present++; } });
      att[aid] = { present: pr, counted: ct };
    }
  }
  out.attendance = { sessions: sessions.length, rate: pct(sessions.reduce((x, s) => x + s.present, 0), sessions.reduce((x, s) => x + s.counted, 0)), bySession: sessions.map((s) => ({ label: s.label, present: s.present, counted: s.counted, rate: pct(s.present, s.counted) })) };
  const latest = {};
  body(store, RESPONSES, 14).forEach((r) => {
    const id = normalizeId(r[2]), code = up(r[3]); if (!id || !code || r[9] === "") return;
    const wk = Number(r[13]) || 0, k = id + "|" + (wk ? "W" + wk : code), rnd = Number(r[10]) || 0;
    if (!latest[k] || rnd >= latest[k].rnd) latest[k] = { id, quiz: wk ? "Week " + wk : "Quiz " + code, wk, rnd, score: Number(r[9]) || 0, n: Number(r[11]) || 5 };
  });
  const byQuiz = {}, byStudentQuiz = {};
  Object.keys(latest).forEach((k) => {
    const x = latest[k], q = byQuiz[x.quiz] || (byQuiz[x.quiz] = { quiz: x.quiz, wk: x.wk, sum: 0, out: 0, n: 0 }); q.sum += x.score; q.out += x.n; q.n++;
    const s = byStudentQuiz[x.id] || (byStudentQuiz[x.id] = { sum: 0, out: 0, taken: 0 }); s.sum += x.score; s.out += x.n; s.taken++;
  });
  out.quizzes = Object.keys(byQuiz).map((k) => { const q = byQuiz[k]; return { quiz: q.quiz, week: q.wk, students: q.n, average: pct(q.sum, q.out) }; }).sort((a, b) => (a.week || 99) - (b.week || 99));
  const qs = Object.keys(byQuiz).reduce((o, k) => { o.sum += byQuiz[k].sum; o.out += byQuiz[k].out; return o; }, { sum: 0, out: 0 }); out.quizAverage = pct(qs.sum, qs.out);
  const attempts = attemptRows(store), lastPractice = {}, week = 7 * 864e5, recentIds = {}; let recent = 0;
  attempts.forEach((a) => { if (!lastPractice[a.id] || a.ts > lastPractice[a.id]) lastPractice[a.id] = a.ts; if (now - a.ts <= week) { recent++; recentIds[a.id] = true; } });
  out.practice = { attempts: attempts.length, last7Days: recent, studentsLast7Days: Object.keys(recentIds).filter((x) => !roster.length || inRoster[x]).length };
  const stats = questionStats(body(store, ITEMS, 11), attempts); out.questions = stats;
  const lecs = {};
  stats.forEach((s) => { if (s.lecture < 0) return; const l = lecs[s.lecture] || (lecs[s.lecture] = { lecture: s.lecture, right: 0, n: 0 }); l.n += s.answers; l.right += s.pct === null ? 0 : s.pct * s.answers / 100; });
  out.lectures = Object.keys(lecs).map((k) => { const l = lecs[k]; return { lecture: l.lecture, answers: l.n, pct: l.n ? Math.round(1000 * l.right / l.n) / 10 : null }; }).sort((a, b) => a.lecture - b.lecture);
  const flags = [];
  roster.forEach((r) => {
    const why = [], a = att[r.id], s = byStudentQuiz[r.id], lp = lastPractice[r.id], ar = a && a.counted ? pct(a.present, a.counted) : null, qa = s && s.out ? pct(s.sum, s.out) : null;
    if (ar !== null && ar < attMin) why.push("attendance " + ar + "%");
    if (qa !== null && qa < quizMin) why.push("quiz average " + qa + "%");
    if (out.quizzes.length && (!s || s.taken < out.quizzes.length)) why.push("missed " + (out.quizzes.length - (s ? s.taken : 0)) + " of " + out.quizzes.length + " quizzes");
    if (!lp) { if (why.length) why.push("no practice recorded"); } else if (now - lp > idleDays * 864e5) why.push("no practice for " + Math.floor((now - lp) / 864e5) + " days");
    if (why.length) flags.push({ id: r.id, name: r.name, attendance: ar, quizAverage: qa, quizzesTaken: s ? s.taken : 0, lastPractice: lp ? dmy(new Date(lp)) : "", reasons: why });
  });
  flags.sort((a, b) => b.reasons.length - a.reasons.length || (a.quizAverage === null ? 101 : a.quizAverage) - (b.quizAverage === null ? 101 : b.quizAverage));
  out.attention = flags;
  try {
    const stamp = store.now();
    store.setRows(QSTATS, [QSTATS_HEADER.slice()].concat(stats.map((s) => [s.id, s.lecture, s.answers, s.pct === null ? "" : s.pct, s.label, s.live, s.livePct === null ? "" : s.livePct, s.key, s.wrongTop ? s.wrongTop + " (" + s.wrongTopN + ")" : "", s.discrimination === null ? "" : s.discrimination, s.confidentWrong, s.practice, s.practicePct === null ? "" : s.practicePct, stamp])));
  } catch (e) { out.statsTabError = String(e).slice(0, 120); }
  return out;
}

// ---- Student records and notes ----
function studentRecords(store, id) {
  const out = { records: [], notes: [] };
  body(store, RECORDS, 7).forEach((r) => {
    if (normalizeId(r[1]) !== id) return;
    out.records.push({ date: r[0] instanceof Date ? ymd(r[0]) : String(r[0] || ""), category: String(r[2]), assessment: String(r[3]), score: r[4] === "" ? null : Number(r[4]), outOf: r[5] === "" ? null : Number(r[5]), lecture: String(r[6] || "") });
  });
  body(store, NOTES, 4).forEach((r) => { if (normalizeId(r[1]) === id) out.notes.push({ time: r[0] instanceof Date ? r[0].toISOString() : String(r[0] || ""), text: String(r[2]), by: String(r[3] || "") }); });
  out.notes.reverse(); return out;
}
function noteAdd(store, id, text) {
  id = normalizeId(id); text = String(text || "").trim().slice(0, 1000);
  if (!id || !text) return { ok: false, why: "a student and a note are needed" };
  if (!AC.rosterRows(store).some((r) => normalizeId(r[0]) === id)) return { ok: false, why: "that ID is not on the class list" };
  append(store, NOTES, NOTES_HEAD, [store.now(), id, text, "lecturer"]); return { ok: true };
}

module.exports = { practiceLecture, attemptRows, studentLearning, questionStats, insights, studentRecords, noteAdd, releasedSet, lectureOfQid, splitIds, pct, RECORDS_HEAD };
