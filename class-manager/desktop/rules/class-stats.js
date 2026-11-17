/* Class statistics: attendance, quizzes, each student's progress, the suggested engagement groups, whether the class is learning, and the areas to
   target. A port of classStats_, statNums_, engagementOf_, repeatPairs_, learningVerdict_ and targets_ (apps_script/src/30-analytics.gs), with the
   same answers. Computed only from the tabs CM keeps; nothing is estimated. version is the script version the pages compare. */
"use strict";
const SL = require("./session-label");
const AC = require("./access-codes");
const AT = require("./attendance");
const L = require("./learning");
const { normalizeId } = require("../ids");

const ATT = "Attendance", ATT_CTL = "Attendance_Control", ATT_LOG = "Attendance_Log", PRESENCE = "Presence", ITEMS = "Item_Log", RESPONSES = "Form Responses 1";
const STATS_GROUPS = ["On track", "Working hard but struggling", "Disengaged", "Needs a check-in", "Not enough data"];
const LEARN_MIN_STUDENTS = 10, LEARN_MIN_PAIRS = 30, LEARN_VERDICTS = ["Learning", "Mixed", "Not yet learning", "Not enough data"];
const pct = L.pct, up = (v) => String(v).trim().toUpperCase();
const body = (store, tab, w) => { const r = store.rows(tab); return r && r.length > 1 ? r.slice(1).map((x) => x.slice(0, w)) : []; };
const dmy = (d) => { const p = (n) => String(n).padStart(2, "0"); return p(d.getDate()) + "/" + p(d.getMonth() + 1) + "/" + d.getFullYear(); };

function statNums(xs) { // mean, median, sample standard deviation, quartiles, range and a 10-band histogram of percentages
  const v = xs.filter((x) => typeof x === "number" && !isNaN(x)).slice().sort((a, b) => a - b), n = v.length, hist = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  if (!n) return { n: 0, mean: null, median: null, sd: null, q1: null, q3: null, min: null, max: null, hist };
  const q = (p) => { const h = (n - 1) * p, lo = Math.floor(h), hi = Math.ceil(h); return v[lo] + (v[hi] - v[lo]) * (h - lo); };
  const mean = v.reduce((a, b) => a + b, 0) / n, sd = n > 1 ? Math.sqrt(v.reduce((a, b) => a + (b - mean) * (b - mean), 0) / (n - 1)) : 0;
  v.forEach((x) => { hist[Math.max(0, Math.min(9, Math.floor(x / 10)))]++; });
  const r1 = (x) => Math.round(x * 10) / 10;
  return { n, mean: r1(mean), median: r1(q(0.5)), sd: r1(sd), q1: r1(q(0.25)), q3: r1(q(0.75)), min: r1(v[0]), max: r1(v[n - 1]), hist };
}
function thresholds(p) {
  const num = (v, d, lo, hi) => { const x = Number(v); return isNaN(x) || v === "" || v === undefined ? d : Math.max(lo, Math.min(hi, x)); };
  return { effort: num(p.effort, 70, 0, 100), perf: num(p.perf, 50, 0, 100), idle: num(p.idle, 14, 1, 120), misses: num(p.misses, 2, 1, 20) };
}
function engagementOf(s, th, have) {
  const parts = [];
  if (have.sessions && s.attendance !== null) parts.push(s.attendance);
  if (have.quizzes) parts.push(100 * s.quizzesTaken / have.quizzes);
  if (have.practice && s.practiceRecent) parts.push(100); // practice can raise a student's effort, never lower it
  const effort = parts.length ? Math.round(parts.reduce((a, b) => a + b, 0) / parts.length) : null, perf = s.quizAverage !== null ? s.quizAverage : s.practiceAverage;
  const hiE = effort !== null && effort >= th.effort, hiP = perf !== null && perf >= th.perf; let group;
  if (effort === null || (!have.sessions && !have.quizzes)) group = "Not enough data";
  else if (perf === null) group = hiE ? "Not enough data" : "Needs a check-in";
  else group = hiE ? (hiP ? "On track" : "Working hard but struggling") : (hiP ? "Disengaged" : "Needs a check-in");
  const why = [];
  if (have.sessions && s.attendance !== null) why.push("attendance " + s.attendance + "%");
  if (have.quizzes) why.push(s.quizzesTaken + " of " + have.quizzes + " quizzes taken");
  if (have.practice) why.push(s.practiceRecent ? "practised in the last " + th.idle + " days" : "no practice in the last " + th.idle + " days");
  if (perf !== null) why.push((s.quizAverage !== null ? "quiz average " : "practice average ") + perf + "%");
  return { effort, performance: perf, group, why };
}

// Each student's first and latest answer to the same question (a live quiz, then practice, a mock exam or a later quiz).
function repeatPairs(items, attempts) {
  const seen = {}, add = (id, qid, t, ok) => { if (!id || !qid || !t) return; (seen[id + "|" + qid] = seen[id + "|" + qid] || []).push({ t, ok }); };
  items.forEach((r) => add(normalizeId(r[4]), String(r[6]).trim(), new Date(r[0]).getTime(), Number(r[9]) ? 1 : 0));
  attempts.forEach((a) => a.asked.forEach((q) => add(a.id, q, a.ts, a.wrong.indexOf(q) < 0 ? 1 : 0)));
  const byLec = {}, byQ = {}, all = { n: 0, first: 0, last: 0 };
  Object.keys(seen).forEach((k) => {
    const xs = seen[k]; if (xs.length < 2) return; xs.sort((a, b) => a.t - b.t);
    const qid = k.split("|")[1], l = L.lectureOfQid(qid), f = xs[0].ok, z = xs[xs.length - 1].ok;
    const bq = byQ[qid] || (byQ[qid] = { pairs: 0, laterWrong: 0 }); bq.pairs++; bq.laterWrong += 1 - z;
    const b = byLec[l] || (byLec[l] = { n: 0, first: 0, last: 0 }); b.n++; b.first += f; b.last += z; all.n++; all.first += f; all.last += z;
  });
  const fin = (b) => ({ pairs: b.n, firstPct: pct(b.first, b.n), laterPct: pct(b.last, b.n), gain: b.n ? Math.round(1000 * (b.last - b.first) / b.n) / 10 : null });
  const out = { all: fin(all), byLecture: {}, byQuestion: byQ }; Object.keys(byLec).forEach((l) => { out.byLecture[l] = fin(byLec[l]); }); return out;
}
function slope(ys) { // least-squares change per step
  const n = ys.length; if (n < 2) return null;
  const mx = (n - 1) / 2, my = ys.reduce((a, b) => a + b, 0) / n; let sxy = 0, sxx = 0;
  ys.forEach((y, i) => { sxy += (i - mx) * (y - my); sxx += (i - mx) * (i - mx); });
  return Math.round(10 * sxy / sxx) / 10;
}
function mixedAction(sig) {
  const UP = { repeat: "answers improve when the same questions come back", scores: "quiz scores are rising", participation: "more students are taking the quizzes", attendance: "attendance is rising" };
  const DOWN = { repeat: "answers do not improve when questions come back", scores: "quiz scores are falling", misconceptions: "some wrong answers persist", participation: "fewer students are taking the quizzes", attendance: "attendance is falling" };
  const list = (xs) => (xs.length < 2 ? xs.join("") : xs.slice(0, -1).join(", ") + " and " + xs[xs.length - 1]);
  const up = sig.filter((s) => s.value > 0 && UP[s.key]).map((s) => UP[s.key]), down = sig.filter((s) => s.value < 0 && DOWN[s.key]).map((s) => DOWN[s.key]);
  const t = up.length && down.length ? list(up) + ", but " + list(down) + ". " : up.length ? list(up) + ", while other signs are flat. " : down.length ? list(down) + ". " : "";
  return (t ? t.charAt(0).toUpperCase() + t.slice(1) : "") + "Work through the areas to target, then check the weakest topic with a short follow-up quiz.";
}
function learningVerdict(out, rep) {
  const sig = [], small = [], ra = rep.all;
  if (ra.pairs) {
    const g = ra.gain, v = ra.pairs < LEARN_MIN_PAIRS ? 0 : g >= 10 ? 1 : g <= -5 ? -1 : 0;
    if (ra.pairs < LEARN_MIN_PAIRS) small.push("only " + ra.pairs + " repeated answers to the same questions");
    sig.push({ key: "repeat", direct: true, value: v, n: ra.pairs, title: "Same questions answered again", text: "Correct the first time " + ra.firstPct + "%, the latest time " + ra.laterPct + "% (" + (g >= 0 ? "+" : "") + g + " points, " + ra.pairs + " repeated answers)." });
  }
  const qz = out.quizzes.filter((q) => q.students >= LEARN_MIN_STUDENTS);
  if (qz.length >= 2) {
    const sl = slope(qz.map((q) => q.stats.mean)), v2 = qz.length < 3 ? 0 : sl >= 3 ? 1 : sl <= -3 ? -1 : 0;
    if (qz.length < 3) small.push("only two quizzes, so the score trend is not used yet");
    sig.push({ key: "scores", direct: true, value: v2, n: qz.length, title: "Quiz scores over time", text: "Class mean " + qz.map((q) => q.stats.mean + "%").join(", ") + " (" + (sl >= 0 ? "+" : "") + sl + " points per quiz). Each quiz covers a different lecture, so a change in difficulty also moves this." });
  } else if (out.quizzes.length) small.push("fewer than two quizzes with " + LEARN_MIN_STUDENTS + " or more students");
  const persist = out.questions.filter((q) => q.misconception && q.misconception.persists), mis = out.questions.filter((q) => q.misconception);
  if (mis.length) sig.push({ key: "misconceptions", direct: false, value: persist.length >= 2 ? -1 : 0, n: mis.length, title: "Shared wrong answers", text: mis.length + " question" + (mis.length === 1 ? "" : "s") + " with one wrong option chosen by a third or more of the answers; " + persist.length + " still answered wrongly by a third or more of the class when asked again." });
  if (out.quizzes.length >= 4 && out.rosterSize) {
    const half = Math.floor(out.quizzes.length / 2), part = (xs) => Math.round(xs.reduce((a, q) => a + (q.participation || 0), 0) / xs.length);
    const pe = part(out.quizzes.slice(0, half)), pr2 = part(out.quizzes.slice(half)), d = pr2 - pe;
    sig.push({ key: "participation", direct: false, value: d <= -10 ? -1 : d >= 5 ? 1 : 0, n: out.quizzes.length, title: "Quiz participation", text: "Earlier quizzes " + pe + "% of the class, recent quizzes " + pr2 + "%." });
  }
  const at = out.attendance;
  if (at.sessions >= 6 && at.earlierRate !== null) {
    const d2 = Math.round(10 * (at.recentRate - at.earlierRate)) / 10;
    sig.push({ key: "attendance", direct: false, value: d2 <= -10 ? -1 : d2 >= 5 ? 1 : 0, n: at.sessions, title: "Attendance", text: "Earlier sessions " + at.earlierRate + "%, the last three " + at.recentRate + "%." });
  }
  const direct = sig.filter((s) => (s.key === "repeat" && s.n >= LEARN_MIN_PAIRS) || (s.key === "scores" && s.n >= 3));
  const score = sig.reduce((a, s) => a + s.value * (s.direct ? 2 : 1), 0), directNeg = sig.some((s) => s.direct && s.value < 0);
  const verdict = !direct.length ? "Not enough data" : score >= 2 && !directNeg ? "Learning" : score <= -2 ? "Not yet learning" : "Mixed";
  const confidence = verdict === "Not enough data" ? "" : direct.length >= 2 && !small.length ? "moderate" : "low";
  const action = { "Learning": "Keep the pace. Revisit the weakest topic below with a short follow-up quiz.", "Mixed": mixedAction(sig), "Not yet learning": "Slow down: re-teach the last topics with worked examples, and check with a short follow-up quiz on the same questions.", "Not enough data": "Run at least two live quizzes, and ask some of the same questions again later (practice or a follow-up quiz), to see whether answers improve." }[verdict];
  const lecs = {};
  out.questions.forEach((q) => { if (q.lecture < 0) return; const l = lecs[q.lecture] || (lecs[q.lecture] = { lecture: q.lecture, answers: 0, right: 0, mis: 0 }); l.answers += q.answers; l.right += (q.pct || 0) * q.answers / 100; if (q.misconception) l.mis++; });
  const topics = Object.keys(lecs).map((k) => {
    const l = lecs[k], r = rep.byLecture[k] || { pairs: 0, gain: null }, pc = l.answers ? Math.round(1000 * l.right / l.answers) / 10 : null; let v;
    if (l.answers < 10) v = "Not enough data"; else if (r.pairs >= 10 && r.gain >= 10) v = "Learning"; else if (pc < 50 && (r.pairs < 10 || r.gain < 5)) v = "Not yet learning"; else if (pc >= 70 && (r.pairs < 10 || r.gain > -5)) v = "Learning"; else v = "Mixed";
    let ev = pc + "% correct from " + l.answers + " answers";
    if (r.pairs) ev += "; repeated questions " + r.firstPct + "% then " + r.laterPct + "% (" + r.pairs + " pairs)";
    if (l.mis) ev += "; " + l.mis + " shared wrong answer" + (l.mis === 1 ? "" : "s");
    return { lecture: l.lecture, label: l.lecture === 0 ? "Introduction" : "Lecture " + l.lecture, verdict: v, pct: pc, answers: l.answers, pairs: r.pairs, gain: r.gain, misconceptions: l.mis, evidence: ev, small: l.answers < 20 || (r.pairs > 0 && r.pairs < 10) };
  }).sort((a, b) => a.lecture - b.lecture);
  return { verdict, verdicts: LEARN_VERDICTS, confidence, action, signals: sig, smallSample: small, topics, minimum: "At least two released live quizzes with " + LEARN_MIN_STUDENTS + " or more students each, or " + LEARN_MIN_PAIRS + " repeated answers to the same questions. Three quizzes are needed before the score trend counts.", notMeasured: "The app has no separate pre-test or concept inventory, so learning is judged from repeated questions and quiz results only." };
}
function targets(out, learning, th) {
  const t = [];
  learning.topics.forEach((x) => {
    if (x.verdict === "Not yet learning") t.push({ kind: "Topic", title: x.label, weight: 90 - x.pct / 2, evidence: x.evidence, n: x.answers, action: "Re-teach " + x.label + " with worked examples, then a short follow-up quiz on the same ideas." });
    else if (x.verdict === "Mixed" && x.pct < 60) t.push({ kind: "Topic", title: x.label, weight: 60 - x.pct / 2, evidence: x.evidence, n: x.answers, action: "Revisit " + x.label + " briefly at the start of the next lecture." });
  });
  out.questions.forEach((q) => {
    if (q.misconception) t.push({ kind: "Question", title: q.id + ": option " + q.misconception.option, weight: 50 + q.misconception.share / 2 + (q.misconception.persists ? 20 : 0), evidence: q.misconception.share + "% of " + q.misconception.of + " live answers chose " + q.misconception.option + " (correct: " + q.key + ")" + (q.confidentWrong ? "; " + q.confidentWrong + " were confident" : "") + (q.misconception.persists ? "; still wrong for a third or more when asked again" : ""), n: q.misconception.of, action: "Ask the class why " + q.misconception.option + " looks right, let them discuss in pairs, then ask a similar question." });
    else if (q.discrimination !== null && q.discrimination < 0.2 && q.pct !== null && q.pct < 50 && q.live >= 10) t.push({ kind: "Question", title: q.id, weight: 35, evidence: q.pct + "% correct; stronger and weaker students did about equally well (discrimination " + q.discrimination + ")", n: q.live, action: "Check the wording and the answer key." });
  });
  const g = (name) => out.students.filter((s) => s.group === name), need = g("Needs a check-in"), hard = g("Working hard but struggling"), dis = g("Disengaged");
  if (need.length) t.push({ kind: "Students", title: need.length + " to check in with", weight: 70, evidence: "Low effort and low or no results: " + need.slice(0, 4).map((s) => s.name || s.id).join(", ") + (need.length > 4 ? " and " + (need.length - 4) + " more" : ""), n: need.length, action: "A short personal check-in. Look first at absences in a row.", group: "Needs a check-in" });
  if (hard.length) t.push({ kind: "Students", title: hard.length + " working hard but struggling", weight: 65, evidence: "Attending and taking part, quiz average below " + th.perf + "%", n: hard.length, action: "Offer a tutorial or a study group; pair them with students who are on track.", group: "Working hard but struggling" });
  if (dis.length) t.push({ kind: "Students", title: dis.length + " doing well but less engaged", weight: 40, evidence: "Results at or above " + th.perf + "% with low attendance or participation", n: dis.length, action: "Give them harder problems or a role as peer helpers.", group: "Disengaged" });
  const rate = out.attendance.rate;
  out.attendance.bySession.forEach((s) => { if (s.rate !== null && rate !== null && s.counted >= 5 && (s.rate < rate - 15 || s.rate < 50)) t.push({ kind: "Session", title: s.label, weight: 45 + (rate - s.rate) / 2, evidence: s.rate + "% present against " + rate + "% for the term", n: s.counted, action: "Check what happened that day (a clash, a deadline, the time slot) and repeat its key points." }); });
  out.quizzes.forEach((q) => { if (q.participation !== null && q.participation < 60) t.push({ kind: "Quiz", title: q.quiz, weight: 40 + (60 - q.participation) / 2, evidence: q.participation + "% of the class took part" + (q.completion !== null ? ", " + q.completion + "% of those who joined finished" : ""), n: q.students, action: "Reopen it as practice, and remind the class when the next quiz runs." }); });
  t.forEach((x) => { x.small = x.kind !== "Students" && x.n < 10; });
  return t.sort((a, b) => b.weight - a.weight).slice(0, 12).map((x) => { x.weight = Math.round(x.weight); return x; });
}

function classStats(store, p, version, o) {
  p = p || {}; const now = store.now().getTime(), th = thresholds(p);
  const roster = AC.rosterRows(store).map((r) => ({ id: normalizeId(r[0]), name: AC.cleanName(r[1]).trim() })).filter((r) => r.id), inRoster = {}; roster.forEach((r) => { inRoster[r.id] = true; });
  const out = { ok: true, version, generated: new Date(now).toISOString(), thresholds: th, rosterSize: roster.length, groupNames: STATS_GROUPS };
  const grid = (() => { const g = store.rows(ATT); return g && g.length > 1 && g[0].length > 1 ? g : null; })(), sessions = [], attOf = {};
  if (grid) {
    for (let c = 1; c < grid[0].length; c++) if (String(grid[0][c]).trim()) sessions.push({ col: c, raw: String(grid[0][c]).trim(), label: SL.sessionLabel(grid[0][c]), date: SL.sessionDate(grid[0][c]), present: 0, counted: 0 });
    for (let i = 1; i < grid.length; i++) {
      const aid = normalizeId(grid[i][0]); if (!aid || (roster.length && !inRoster[aid])) continue; const marks = [];
      sessions.forEach((s) => { const v = grid[i][s.col]; if (v === "" || v === null || v === undefined) { marks.push(null); return; } const on = Number(v) ? 1 : 0; marks.push(on); s.counted++; s.present += on; });
      attOf[aid] = marks;
    }
  }
  // A session where nobody checked in (a test, an empty or an abandoned session) was not held: it is not counted, so it cannot pull every rate down
  // or flag the whole class. The page lists these sessions as set aside (out.attendance.notHeld).
  const notHeld = sessions.filter((s) => s.counted > 0 && s.present === 0).map((s) => ({ label: s.label, date: s.date }));
  if (notHeld.length) {
    const keep = sessions.map((s) => !(s.counted > 0 && s.present === 0));
    Object.keys(attOf).forEach((k) => { attOf[k] = attOf[k].filter((_, i) => keep[i]); });
    for (let i = sessions.length - 1; i >= 0; i--) if (!keep[i]) sessions.splice(i, 1);
  }
  const opened = {}; body(store, ATT_CTL, 4).forEach((r) => { const t = new Date(r[3]).getTime(); if (t) opened[AT.column(String(r[1]))] = t; });
  const firstIn = {};
  body(store, ATT_LOG, 6).forEach((r) => {
    if (/lecturer/i.test(String(r[5]))) return;
    const col = AT.column(String(r[1])), id = normalizeId(r[2]), t = new Date(r[0]).getTime(); if (!id || !t || !opened[col]) return;
    const k = col + "|" + id; if (!firstIn[k] || t < firstIn[k]) firstIn[k] = t;
  });
  const arrBySession = {}, arrByStudent = {};
  Object.keys(firstIn).forEach((k) => { const col = k.split("|")[0], id = k.split("|")[1], m = Math.max(0, (firstIn[k] - opened[col]) / 60000); (arrBySession[col] = arrBySession[col] || []).push(m); (arrByStudent[id] = arrByStudent[id] || []).push(m); });
  const BANDS = [[0, 2, "Under 2 min"], [2, 5, "2 to 5 min"], [5, 10, "5 to 10 min"], [10, 15, "10 to 15 min"], [15, 1e9, "15 min or more"]];
  const band = (xs) => BANDS.map((b) => ({ label: b[2], n: xs.filter((m) => m >= b[0] && m < b[1]).length }));
  let allArr = []; Object.keys(arrBySession).forEach((k) => { allArr = allArr.concat(arrBySession[k]); });
  const bySession = sessions.map((s) => { const a = statNums(arrBySession[s.raw] || []); return { label: s.label, date: s.date, present: s.present, counted: s.counted, rate: pct(s.present, s.counted), arrivalMedian: a.median, arrivals: a.n }; });
  const recent = bySession.slice(-3), earlier = bySession.slice(0, -3), avgRate = (xs) => { let p2 = 0, c2 = 0; xs.forEach((x) => { p2 += x.present; c2 += x.counted; }); return pct(p2, c2); };
  out.attendance = { sessions: sessions.length, rate: avgRate(bySession), lastRate: bySession.length ? bySession[bySession.length - 1].rate : null, recentRate: avgRate(recent), earlierRate: earlier.length ? avgRate(earlier) : null, bySession, arrival: { median: statNums(allArr).median, bands: band(allArr), latest: sessions.length ? band(arrBySession[sessions[sessions.length - 1].raw] || []) : [] } };
  if (notHeld.length) out.attendance.notHeld = notHeld; // present only when a session was set aside, so the answer is the same as the script's otherwise

  const latest = {}, quizMeta = {};
  body(store, RESPONSES, 14).forEach((r) => {
    const id = normalizeId(r[2]), code = up(r[3]); if (!id || !code || r[9] === "") return;
    const wk = Number(r[13]) || 0, qk = wk ? "Week " + wk : "Quiz " + code, k = id + "|" + qk, rnd = Number(r[10]) || 0, ts = new Date(r[0]).getTime() || 0;
    const m = quizMeta[qk] || (quizMeta[qk] = { quiz: qk, week: wk, first: ts, codes: {} }); m.codes[code] = true; if (ts && (!m.first || ts < m.first)) m.first = ts;
    if (!latest[k] || rnd >= latest[k].rnd) latest[k] = { id, quiz: qk, rnd, score: Number(r[9]) || 0, n: Number(r[11]) || 5, code };
  });
  const order = Object.keys(quizMeta).sort((a, b) => { const x = quizMeta[a], y = quizMeta[b]; return (x.first || 0) - (y.first || 0) || (x.week || 99) - (y.week || 99); });
  const joined = {}; body(store, PRESENCE, 5).forEach((r) => { const code = up(r[3]), id = normalizeId(r[1]); if (code && id) (joined[code] = joined[code] || {})[id] = true; });
  const blanks = {}; body(store, ITEMS, 11).forEach((r) => { if (!String(r[7]).trim()) { const code = up(r[1]); blanks[code] = (blanks[code] || 0) + 1; } });
  const perStudentQuiz = {}; Object.keys(latest).forEach((k) => { const x = latest[k]; (perStudentQuiz[x.id] = perStudentQuiz[x.id] || {})[x.quiz] = x.n ? Math.round(1000 * x.score / x.n) / 10 : 0; });
  out.quizzes = order.map((qk) => {
    const m = quizMeta[qk], ids = Object.keys(perStudentQuiz).filter((id) => perStudentQuiz[id][qk] !== undefined && (!roster.length || inRoster[id]));
    const st = statNums(ids.map((id) => perStudentQuiz[id][qk])), j = {}; let bl = 0, items = 0;
    Object.keys(m.codes).forEach((code) => { Object.keys(joined[code] || {}).forEach((id) => { j[id] = true; }); bl += blanks[code] || 0; });
    Object.keys(latest).forEach((k) => { if (latest[k].quiz === qk) items += latest[k].n; });
    const nj = Object.keys(j).length;
    return { quiz: qk, week: m.week, date: m.first ? dmy(new Date(m.first)) : "", students: ids.length, joined: nj, completion: nj ? pct(Math.min(ids.length, nj), nj) : null, participation: roster.length ? pct(ids.length, roster.length) : null, unanswered: items ? pct(bl, items) : null, stats: st };
  });

  const attempts = L.attemptRows(store), itemRows = body(store, ITEMS, 11), rep = repeatPairs(itemRows, attempts);
  out.questions = L.questionStats(itemRows, attempts);
  out.questions.forEach((q) => {
    let tot = 0; Object.keys(q.dist).forEach((x) => { tot += q.dist[x]; });
    const share = tot ? Math.round(100 * q.wrongTopN / (tot + q.blank)) : 0, again = rep.byQuestion[q.id];
    q.misconception = q.wrongTop && q.live >= 10 && share >= 33 ? { option: q.wrongTop, share, of: tot + q.blank, persists: !!(again && again.pairs >= 5 && again.laterWrong / again.pairs >= 1 / 3) } : null;
  });
  const prac = {};
  attempts.forEach((a) => {
    const x = prac[a.id] || (prac[a.id] = { n: 0, recent: 0, secs: 0, last: 0, best: {} }); x.n++; x.secs += a.secs; if (a.ts > x.last) x.last = a.ts; if (now - a.ts <= th.idle * 864e5) x.recent++;
    if (!a.missed && a.total) { const key = a.quiz.replace(/\s*\(.*$/, ""), pc = 100 * a.score / a.total; if (!(key in x.best) || pc > x.best[key]) x.best[key] = pc; }
  });
  const have = { sessions: sessions.length, quizzes: order.length, practice: attempts.length > 0 };
  const students = roster.map((r) => {
    const marks = attOf[r.id] || []; let pres = 0, cnt = 0, run = 0, longest = 0;
    marks.forEach((v) => { if (v === null) return; cnt++; pres += v; if (v) run = 0; else { run++; longest = Math.max(longest, run); } });
    const qs = perStudentQuiz[r.id] || {}, traj = order.filter((k) => qs[k] !== undefined).map((k) => ({ quiz: k, pct: qs[k] }));
    let sum = 0, outOf = 0; Object.keys(latest).forEach((k) => { const x = latest[k]; if (x.id === r.id) { sum += x.score; outOf += x.n; } });
    const pr = prac[r.id], bests = pr ? Object.keys(pr.best).map((k) => pr.best[k]) : [], arr = statNums(arrByStudent[r.id] || []);
    return { id: r.id, name: r.name, attendance: cnt ? pct(pres, cnt) : null, present: pres, sessions: cnt, missedInARow: run, longestMissed: longest, marks, arrivalMedian: arr.median, quizzesTaken: traj.length, quizAverage: outOf ? pct(sum, outOf) : null, trajectory: traj, change: traj.length > 1 ? Math.round(10 * (traj[traj.length - 1].pct - traj[traj.length - 2].pct)) / 10 : null, practiceAttempts: pr ? pr.n : 0, practiceRecent: pr ? pr.recent : 0, practiceMinutes: pr ? Math.round(pr.secs / 60) : 0, practiceAverage: bests.length ? Math.round(10 * bests.reduce((a, b) => a + b, 0) / bests.length) / 10 : null, lastPractice: pr && pr.last ? dmy(new Date(pr.last)) : "" };
  });
  const avgs = students.filter((s) => s.quizAverage !== null).map((s) => s.quizAverage);
  students.forEach((s) => {
    if (s.quizAverage === null || avgs.length < 2) s.percentile = null;
    else { const below = avgs.filter((a) => a < s.quizAverage).length, same = avgs.filter((a) => a === s.quizAverage).length - 1; s.percentile = Math.round(100 * (below + same / 2) / (avgs.length - 1)); }
    const e = engagementOf(s, th, have); s.effort = e.effort; s.performance = e.performance; s.group = e.group; s.why = e.why;
  });
  out.students = students;
  out.attendance.people = require("./attendance-bands").attendanceBands(students); // who comes and who does not, by band
  const counts = {}; STATS_GROUPS.forEach((g) => { counts[g] = 0; }); students.forEach((s) => { counts[s.group]++; }); out.groups = counts;
  out.learning = learningVerdict(out, rep); out.targets = targets(out, out.learning, th);
  try { out.topics = require("./topics").classTopics(store, o, order); } catch (e) { out.topics = null; out.topicsError = String(e).slice(0, 120); } // topic mastery (rules/topics/README.md)
  const lastQ = out.quizzes.length ? out.quizzes[out.quizzes.length - 1] : null;
  out.summary = { attendanceRate: out.attendance.rate, lastSessionRate: out.attendance.lastRate, recentRate: out.attendance.recentRate, earlierRate: out.attendance.earlierRate, missedInARow: students.filter((s) => s.missedInARow >= th.misses).length, quizzes: out.quizzes.length, quizAverage: statNums(students.map((s) => s.quizAverage)).mean, lastQuiz: lastQ, review: out.questions.filter((q) => q.answers >= 5 && q.pct !== null).sort((a, b) => a.pct - b.pct).slice(0, 3).map((q) => ({ id: q.id, pct: q.pct, wrongTop: q.wrongTop, wrongTopN: q.wrongTopN, answers: q.answers })) };
  return out;
}

module.exports = { classStats, statNums, thresholds, engagementOf, repeatPairs, slope, learningVerdict, targets, STATS_GROUPS };
