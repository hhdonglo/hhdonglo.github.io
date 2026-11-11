// Module analytics. Analytics: a student's own record, teaching insights, class statistics, the learning verdict, areas to target, objectives and learning progress.
// Edit the files in apps_script/src/; apps_script/quiz_receiver.gs is built from them (node apps_script/build.js).

// ---- The student's own record ----
function practiceLecture_(quiz) { // 'Lecture 5 ...' -> 5, 'Introduction ...' -> 0, mock -> null
  var q = String(quiz || '');
  if (/mock/i.test(q)) return null;
  var m = /^Lecture\s+(\d+)/i.exec(q); if (m) return Number(m[1]);
  return /^Introduction/i.test(q) ? 0 : null;
}
function attemptRows_() { // [{ts, id, quiz, score, total, secs, wrong[], asked[], missed, mock, lec}]
  var at = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Attempts');
  return bodyRows_(at, 9).map(function (r) {
    var quiz = String(r[2]);
    return { ts: new Date(r[0]).getTime() || 0, id: normId_(r[1]), quiz: quiz, score: Number(r[4]) || 0, total: Number(r[5]) || 0, secs: Number(r[6]) || 0,
      wrong: splitIds_(r[7]), asked: splitIds_(r[8]), missed: /\(missed/i.test(quiz), mock: /mock/i.test(quiz), lec: practiceLecture_(quiz) };
  }).filter(function (x) { return x.id; });
}
// Per lecture: right and asked, from the latest full practice attempt, the latest mock exam and every released live quiz question.
// Questions to revisit: wrong in the latest practice attempt (unless put right in a later missed-questions run), the latest mock exam, or a released live quiz.
function studentLearning_(id) {
  var mine = attemptRows_().filter(function (a) { return a.id === id; }).sort(function (a, b) { return a.ts - b.ts; });
  var lec = {}, revisit = [], seen = {}, practice = {};
  function add(l, right, asked) { if (l < 0 || !asked) return; if (!lec[l]) lec[l] = { right: 0, asked: 0 }; lec[l].right += right; lec[l].asked += asked; }
  function want(qid, from) { if (qid && !seen[qid]) { seen[qid] = true; revisit.push({ id: qid, from: from }); } }
  var latestFull = {}, mock = null;
  mine.forEach(function (a) {
    var label = a.mock ? 'Mock exam' : (a.lec === null ? '' : (a.lec === 0 ? 'Introduction' : 'Lecture ' + a.lec));
    if (label) {
      var pr = practice[label] || (practice[label] = { label: label, attempts: 0, best: null, last: null });
      pr.attempts++; pr.lastTs = a.ts;
      if (!a.missed && a.total) {
        pr.last = { score: a.score, total: a.total };
        if (!pr.best || a.score / a.total > pr.best.score / pr.best.total) pr.best = { score: a.score, total: a.total };
      }
    }
    if (a.mock) { if (!a.missed) mock = a; return; }
    if (a.lec === null) return;
    if (!a.missed) latestFull[a.lec] = { a: a, still: a.wrong.slice() };
    else if (latestFull[a.lec]) { // a missed-questions run: drop the ones now answered correctly
      var lf = latestFull[a.lec];
      lf.still = lf.still.filter(function (q) { return a.wrong.indexOf(q) >= 0 || (a.asked.length && a.asked.indexOf(q) < 0); });
    }
  });
  Object.keys(latestFull).forEach(function (k) {
    var a = latestFull[k].a;
    if (a.asked.length) a.asked.forEach(function (q) { add(lectureOfQid_(q), a.wrong.indexOf(q) < 0 ? 1 : 0, 1); });
    else add(Number(k), a.score, a.total);
    latestFull[k].still.forEach(function (q) { want(q, a.lec === 0 ? 'Introduction practice' : 'Lecture ' + a.lec + ' practice'); });
  });
  if (mock) {
    mock.asked.forEach(function (q) { add(lectureOfQid_(q), mock.wrong.indexOf(q) < 0 ? 1 : 0, 1); });
    mock.wrong.forEach(function (q) { want(q, 'Mock exam'); });
  }
  var rel = releasedSet_(), items = bodyRows_(SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ITEMS_TAB), 11);
  items.forEach(function (r) {
    if (normId_(r[4]) !== id) return;
    var code = String(r[1]).trim().toUpperCase(), rnd = Number(r[2]) || 0;
    if (!rel[String(r[4]).trim() + '|' + code + '|' + rnd]) return; // held results stay hidden until released
    var qid = String(r[6]).trim(), ok = Number(r[9]) ? 1 : 0;
    add(lectureOfQid_(qid), ok, 1);
    if (!ok) want(qid, r[3] ? 'Week ' + r[3] + ' live quiz' : 'Live quiz');
  });
  var mastery = Object.keys(lec).map(function (k) { return { lecture: Number(k), right: lec[k].right, asked: lec[k].asked, pct: pct_(lec[k].right, lec[k].asked) }; })
    .sort(function (a, b) { return a.lecture - b.lecture; });
  return { mastery: mastery, revisit: revisit.slice(0, 60), practice: Object.keys(practice).map(function (k) { return practice[k]; }) };
}

// Per question: proportion correct (live, practice and mock), the spread of A to E, blanks, the most chosen wrong option,
// the discrimination index (upper and lower 27 per cent by the rest of the quiz) and confidence counts. Used by Teaching insights and Class statistics.
function questionStats_(items, attempts) {
  var Q = {};
  function q_(qid) { return Q[qid] || (Q[qid] = { id: qid, lecture: lectureOfQid_(qid), live: 0, liveRight: 0, dist: { A: 0, B: 0, C: 0, D: 0, E: 0 }, key: '', confWrong: 0, confAnswered: 0, lowRight: 0, pr: 0, prRight: 0, resp: [], blank: 0 }); }
  var attemptTotals = {};
  items.forEach(function (r) { var k = String(r[4]).trim() + '|' + String(r[1]).trim().toUpperCase() + '|' + (Number(r[2]) || 0); var t = attemptTotals[k] || (attemptTotals[k] = { right: 0, n: 0 }); t.n++; if (Number(r[9])) t.right++; });
  items.forEach(function (r) {
    var qid = String(r[6]).trim(); if (!qid) return;
    var x = q_(qid), ok = Number(r[9]) ? 1 : 0, ans = String(r[7]).trim().toUpperCase(), cf = String(r[10]).trim().toUpperCase().charAt(0);
    x.live++; x.liveRight += ok; x.key = String(r[8]).trim().toUpperCase() || x.key;
    if (ans && x.dist[ans] !== undefined) x.dist[ans]++; else if (!ans) x.blank++;
    if (cf) { x.confAnswered++; if (!ok && cf === 'H') x.confWrong++; if (ok && cf === 'L') x.lowRight++; }
    var t = attemptTotals[String(r[4]).trim() + '|' + String(r[1]).trim().toUpperCase() + '|' + (Number(r[2]) || 0)];
    x.resp.push({ ok: ok, total: t && t.n > 1 ? (t.right - ok) / (t.n - 1) : 0 }); // the rest of the quiz, without this question
  });
  attempts.forEach(function (a) { a.asked.forEach(function (qid) { var x = q_(qid); x.pr++; if (a.wrong.indexOf(qid) < 0) x.prRight++; }); });
  var stats = Object.keys(Q).map(function (k) {
    var x = Q[k], d = null, n = x.resp.length;
    if (n >= 10) { // upper and lower 27 per cent by the rest of the quiz
      var s = x.resp.slice().sort(function (a, b) { return b.total - a.total; }), g = Math.max(1, Math.round(0.27 * n));
      var up = s.slice(0, g).reduce(function (t, v) { return t + v.ok; }, 0) / g, lo = s.slice(n - g).reduce(function (t, v) { return t + v.ok; }, 0) / g;
      d = Math.round(100 * (up - lo)) / 100;
    }
    var wrongTop = '', wrongN = 0;
    Object.keys(x.dist).forEach(function (L) { if (L !== x.key && x.dist[L] > wrongN) { wrongN = x.dist[L]; wrongTop = L; } });
    var n2 = x.live + x.pr, p2 = n2 ? (x.liveRight + x.prRight) / n2 : null;
    var label = n2 >= 10 ? (p2 >= 0.7 ? 'Easy' : p2 >= 0.3 ? 'Moderate' : 'Difficult') : '';
    return { id: x.id, lecture: x.lecture, live: x.live, livePct: pct_(x.liveRight, x.live), key: x.key, dist: x.dist, wrongTop: wrongTop, wrongTopN: wrongN,
      discrimination: d, confidentWrong: x.confWrong, unsureRight: x.lowRight, confAnswered: x.confAnswered, practice: x.pr, practicePct: pct_(x.prRight, x.pr),
      blank: x.blank, answers: n2, pct: p2 === null ? null : Math.round(1000 * p2) / 10, label: label };
  }).sort(function (a, b) { return a.lecture - b.lecture || (a.id < b.id ? -1 : 1); });
  return stats;
}

// ---- Teaching insights (host only) ----
function insights_(p) {
  var ss = SpreadsheetApp.getActiveSpreadsheet(), now = Date.now();
  var attMin = Math.max(0, Math.min(100, Number(p.att) || 70)), quizMin = Math.max(0, Math.min(100, Number(p.quiz) || 50)), idleDays = Math.max(1, Math.min(120, Number(p.idle) || 14));
  var roster = rosterRows_().map(function (r) { return { id: normId_(r[0]), name: cleanName_(r[1]) }; }).filter(function (r) { return r.id; });
  var inRoster = {}; roster.forEach(function (r) { inRoster[r.id] = true; });
  var out = { ok: true, version: SCRIPT_VERSION, rosterSize: roster.length, thresholds: { att: attMin, quiz: quizMin, idle: idleDays } };

  // Attendance: the submitted grid.
  var at = ss.getSheetByName(ATT_TAB), grid = at && at.getLastRow() > 1 && at.getLastColumn() > 1 ? at.getRange(1, 1, at.getLastRow(), at.getLastColumn()).getValues() : null;
  var att = {}, sessions = [];
  if (grid) {
    for (var c = 1; c < grid[0].length; c++) if (String(grid[0][c]).trim()) sessions.push({ col: c, label: String(grid[0][c]).trim(), present: 0, counted: 0 });
    for (var i = 1; i < grid.length; i++) {
      var aid = normId_(grid[i][0]); if (!aid) continue;
      var pr = 0, ct = 0;
      sessions.forEach(function (s) { var v = grid[i][s.col]; if (v === '' || v === null) return; ct++; s.counted++; if (Number(v)) { pr++; s.present++; } });
      att[aid] = { present: pr, counted: ct };
    }
  }
  out.attendance = { sessions: sessions.length, rate: pct_(sessions.reduce(function (x, s) { return x + s.present; }, 0), sessions.reduce(function (x, s) { return x + s.counted; }, 0)),
    bySession: sessions.map(function (s) { return { label: s.label, present: s.present, counted: s.counted, rate: pct_(s.present, s.counted) }; }) };

  // Live quizzes: released results, the latest round per student and week.
  var rs = responses_(), rn = rs.getLastRow(), latest = {};
  (rn > 1 ? rs.getRange(2, 1, rn - 1, 14).getValues() : []).forEach(function (r) {
    var id = normId_(r[2]), code = String(r[3]).trim().toUpperCase(); if (!id || !code || r[9] === '') return;
    var wk = Number(r[13]) || 0, k = id + '|' + (wk ? 'W' + wk : code), rnd = Number(r[10]) || 0;
    if (!latest[k] || rnd >= latest[k].rnd) latest[k] = { id: id, quiz: wk ? 'Week ' + wk : 'Quiz ' + code, wk: wk, rnd: rnd, score: Number(r[9]) || 0, n: Number(r[11]) || 5 };
  });
  var byQuiz = {}, byStudentQuiz = {};
  Object.keys(latest).forEach(function (k) {
    var x = latest[k], q = byQuiz[x.quiz] || (byQuiz[x.quiz] = { quiz: x.quiz, wk: x.wk, sum: 0, out: 0, n: 0 });
    q.sum += x.score; q.out += x.n; q.n++;
    var s = byStudentQuiz[x.id] || (byStudentQuiz[x.id] = { sum: 0, out: 0, taken: 0 }); s.sum += x.score; s.out += x.n; s.taken++;
  });
  out.quizzes = Object.keys(byQuiz).map(function (k) { var q = byQuiz[k]; return { quiz: q.quiz, week: q.wk, students: q.n, average: pct_(q.sum, q.out) }; })
    .sort(function (a, b) { return (a.week || 99) - (b.week || 99); });
  var qs = Object.keys(byQuiz).reduce(function (o, k) { o.sum += byQuiz[k].sum; o.out += byQuiz[k].out; return o; }, { sum: 0, out: 0 });
  out.quizAverage = pct_(qs.sum, qs.out);

  // Practice activity.
  var attempts = attemptRows_(), lastPractice = {}, week = 7 * 864e5, recent = 0, recentIds = {};
  attempts.forEach(function (a) {
    if (!lastPractice[a.id] || a.ts > lastPractice[a.id]) lastPractice[a.id] = a.ts;
    if (now - a.ts <= week) { recent++; recentIds[a.id] = true; }
  });
  out.practice = { attempts: attempts.length, last7Days: recent, studentsLast7Days: Object.keys(recentIds).filter(function (x) { return !roster.length || inRoster[x]; }).length };

  // Question statistics.
  var stats = questionStats_(bodyRows_(ss.getSheetByName(ITEMS_TAB), 11), attempts);
  out.questions = stats;
  var lecs = {};
  stats.forEach(function (s) { if (s.lecture < 0) return; var l = lecs[s.lecture] || (lecs[s.lecture] = { lecture: s.lecture, right: 0, n: 0 }); l.n += s.answers; l.right += s.pct === null ? 0 : s.pct * s.answers / 100; });
  out.lectures = Object.keys(lecs).map(function (k) { var l = lecs[k]; return { lecture: l.lecture, answers: l.n, pct: l.n ? Math.round(1000 * l.right / l.n) / 10 : null }; }).sort(function (a, b) { return a.lecture - b.lecture; });

  // Students who may need attention: below a threshold, or no practice for a while. Rostered students only.
  var flags = [];
  roster.forEach(function (r) {
    var why = [], a = att[r.id], s = byStudentQuiz[r.id], lp = lastPractice[r.id];
    var ar = a && a.counted ? pct_(a.present, a.counted) : null, qa = s && s.out ? pct_(s.sum, s.out) : null;
    if (ar !== null && ar < attMin) why.push('attendance ' + ar + '%');
    if (qa !== null && qa < quizMin) why.push('quiz average ' + qa + '%');
    if (out.quizzes.length && (!s || s.taken < out.quizzes.length)) why.push('missed ' + (out.quizzes.length - (s ? s.taken : 0)) + ' of ' + out.quizzes.length + ' quizzes');
    if (!lp) why.push('no practice recorded'); else if (now - lp > idleDays * 864e5) why.push('no practice for ' + Math.floor((now - lp) / 864e5) + ' days');
    if (why.length) flags.push({ id: r.id, name: r.name, attendance: ar, quizAverage: qa, quizzesTaken: s ? s.taken : 0, lastPractice: lp ? Utilities.formatDate(new Date(lp), Session.getScriptTimeZone(), 'dd/MM/yyyy') : '', reasons: why });
  });
  flags.sort(function (a, b) { return b.reasons.length - a.reasons.length || (a.quizAverage === null ? 101 : a.quizAverage) - (b.quizAverage === null ? 101 : b.quizAverage); });
  out.attention = flags;

  // The private Question_Stats tab, for export or the Google copy.
  try {
    var qsh = sheetWith_(QSTATS_TAB, ['Question ID', 'Lecture', 'Answers', '% correct', 'Label', 'Live answers', 'Live % correct', 'Correct option', 'Most chosen wrong option', 'Discrimination', 'Confident and wrong', 'Practice answers', 'Practice % correct', 'Updated']);
    var stamp = new Date();
    rewriteBody_(qsh, 14, stats.map(function (s) {
      return [s.id, s.lecture, s.answers, s.pct === null ? '' : s.pct, s.label, s.live, s.livePct === null ? '' : s.livePct, s.key, s.wrongTop ? s.wrongTop + ' (' + s.wrongTopN + ')' : '',
        s.discrimination === null ? '' : s.discrimination, s.confidentWrong, s.practice, s.practicePct === null ? '' : s.practicePct, stamp];
    }));
  } catch (err) { out.statsTabError = String(err).slice(0, 120); }
  return out;
}

// ---------- Class statistics (host only): attendance, quizzes, each student's progress and suggested engagement groups ----------
// Everything is computed here from the tabs the app already keeps; nothing is estimated. The engagement groups are a suggestion
// for the lecturer to review, never shown to students. Thresholds come from the request so the lecturer can adjust them:
//   effort (default 70): the effort score at or above which effort counts as high;
//   perf (default 50): the quiz average at or above which performance counts as good;
//   idle (default 14): days without practice before practice no longer counts as recent;
//   misses (default 2): consecutive missed sessions that mark a student in the attendance list.
var STATS_GROUPS = ['On track', 'Working hard but struggling', 'Disengaged', 'Needs a check-in', 'Not enough data'];

function statNums_(xs) { // mean, median, sample standard deviation, quartiles, range and a 10-band histogram of percentages
  var v = xs.filter(function (x) { return typeof x === 'number' && !isNaN(x); }).slice().sort(function (a, b) { return a - b; }), n = v.length;
  var hist = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  if (!n) return { n: 0, mean: null, median: null, sd: null, q1: null, q3: null, min: null, max: null, hist: hist };
  var q = function (p) { var h = (n - 1) * p, lo = Math.floor(h), hi = Math.ceil(h); return v[lo] + (v[hi] - v[lo]) * (h - lo); };
  var mean = v.reduce(function (a, b) { return a + b; }, 0) / n;
  var sd = n > 1 ? Math.sqrt(v.reduce(function (a, b) { return a + (b - mean) * (b - mean); }, 0) / (n - 1)) : 0;
  v.forEach(function (x) { hist[Math.max(0, Math.min(9, Math.floor(x / 10)))]++; }); // 100 joins the top band
  var r1 = function (x) { return Math.round(x * 10) / 10; };
  return { n: n, mean: r1(mean), median: r1(q(0.5)), sd: r1(sd), q1: r1(q(0.25)), q3: r1(q(0.75)), min: r1(v[0]), max: r1(v[n - 1]), hist: hist };
}

function statThresholds_(p) {
  var num = function (v, d, lo, hi) { var x = Number(v); return isNaN(x) || v === '' || v === undefined ? d : Math.max(lo, Math.min(hi, x)); };
  return { effort: num(p.effort, 70, 0, 100), perf: num(p.perf, 50, 0, 100), idle: num(p.idle, 14, 1, 120), misses: num(p.misses, 2, 1, 20) };
}

// The suggested group for one student, with the reasons in plain words. Effort is the mean of the parts that exist:
// attendance rate, the share of live quizzes taken, and recent practice (100 if practised in the last `idle` days, else 0).
function engagementOf_(s, th, have) {
  var parts = [];
  if (have.sessions && s.attendance !== null) parts.push(s.attendance);
  if (have.quizzes) parts.push(100 * s.quizzesTaken / have.quizzes);
  if (have.practice) parts.push(s.practiceRecent ? 100 : 0);
  var effort = parts.length ? Math.round(parts.reduce(function (a, b) { return a + b; }, 0) / parts.length) : null;
  var perf = s.quizAverage !== null ? s.quizAverage : s.practiceAverage;
  var hiE = effort !== null && effort >= th.effort, hiP = perf !== null && perf >= th.perf, group;
  if (effort === null || (!have.sessions && !have.quizzes)) group = 'Not enough data';
  else if (perf === null) group = hiE ? 'Not enough data' : 'Needs a check-in';
  else group = hiE ? (hiP ? 'On track' : 'Working hard but struggling') : (hiP ? 'Disengaged' : 'Needs a check-in');
  var why = [];
  if (have.sessions && s.attendance !== null) why.push('attendance ' + s.attendance + '%');
  if (have.quizzes) why.push(s.quizzesTaken + ' of ' + have.quizzes + ' quizzes taken');
  if (have.practice) why.push(s.practiceRecent ? 'practised in the last ' + th.idle + ' days' : 'no practice in the last ' + th.idle + ' days');
  if (perf !== null) why.push((s.quizAverage !== null ? 'quiz average ' : 'practice average ') + perf + '%');
  return { effort: effort, performance: perf, group: group, why: why };
}

function classStats_(p) {
  var ss = SpreadsheetApp.getActiveSpreadsheet(), now = Date.now(), th = statThresholds_(p || {});
  var roster = rosterRows_().map(function (r) { return { id: normId_(r[0]), name: cleanName_(r[1]).trim() }; }).filter(function (r) { return r.id; });
  var inRoster = {}; roster.forEach(function (r) { inRoster[r.id] = true; });
  var out = { ok: true, version: SCRIPT_VERSION, generated: new Date(now).toISOString(), thresholds: th, rosterSize: roster.length, groupNames: STATS_GROUPS };

  // ---- Attendance: the submitted grid (one column per session, in the order taken) ----
  var at = ss.getSheetByName(ATT_TAB), grid = at && at.getLastRow() > 1 && at.getLastColumn() > 1 ? at.getRange(1, 1, at.getLastRow(), at.getLastColumn()).getValues() : null;
  var sessions = [], attOf = {};
  if (grid) {
    for (var c = 1; c < grid[0].length; c++) if (String(grid[0][c]).trim()) sessions.push({ col: c, label: String(grid[0][c]).trim(), present: 0, counted: 0 });
    for (var i = 1; i < grid.length; i++) {
      var aid = normId_(grid[i][0]); if (!aid || (roster.length && !inRoster[aid])) continue;
      var marks = [];
      sessions.forEach(function (s) { var v = grid[i][s.col]; if (v === '' || v === null) { marks.push(null); return; } var on = Number(v) ? 1 : 0; marks.push(on); s.counted++; s.present += on; });
      attOf[aid] = marks;
    }
  }
  // Arrival: minutes from opening the check-in to each student's first check-in. Check-ins added or approved by the lecturer are left out.
  var opened = {}; bodyRows_(ss.getSheetByName(ATT_CTL_TAB), 4).forEach(function (r) { var t = new Date(r[3]).getTime(); if (t) opened[attColumn_(String(r[1]))] = t; });
  var firstIn = {}, lg = ss.getSheetByName(ATT_LOG_TAB);
  bodyRows_(lg, 6).forEach(function (r) {
    if (/lecturer/i.test(String(r[5]))) return;
    var col = attColumn_(String(r[1])), id = normId_(r[2]), t = new Date(r[0]).getTime(); if (!id || !t || !opened[col]) return;
    var k = col + '|' + id; if (!firstIn[k] || t < firstIn[k]) firstIn[k] = t;
  });
  var arrBySession = {}, arrByStudent = {};
  Object.keys(firstIn).forEach(function (k) {
    var col = k.split('|')[0], id = k.split('|')[1], m = Math.max(0, (firstIn[k] - opened[col]) / 60000);
    (arrBySession[col] = arrBySession[col] || []).push(m); (arrByStudent[id] = arrByStudent[id] || []).push(m);
  });
  var ARR_BANDS = [[0, 2, 'Under 2 min'], [2, 5, '2 to 5 min'], [5, 10, '5 to 10 min'], [10, 15, '10 to 15 min'], [15, 1e9, '15 min or more']];
  var band = function (xs) { return ARR_BANDS.map(function (b) { return { label: b[2], n: xs.filter(function (m) { return m >= b[0] && m < b[1]; }).length }; }); };
  var allArr = []; Object.keys(arrBySession).forEach(function (k) { allArr = allArr.concat(arrBySession[k]); });
  var bySession = sessions.map(function (s) { var a = statNums_(arrBySession[s.label] || []); return { label: s.label, present: s.present, counted: s.counted, rate: pct_(s.present, s.counted), arrivalMedian: a.median, arrivals: a.n }; });
  var recent = bySession.slice(-3), earlier = bySession.slice(0, -3), avgRate = function (xs) { var p2 = 0, c2 = 0; xs.forEach(function (x) { p2 += x.present; c2 += x.counted; }); return pct_(p2, c2); };
  out.attendance = { sessions: sessions.length, rate: avgRate(bySession), lastRate: bySession.length ? bySession[bySession.length - 1].rate : null,
    recentRate: avgRate(recent), earlierRate: earlier.length ? avgRate(earlier) : null, bySession: bySession,
    arrival: { median: statNums_(allArr).median, bands: band(allArr), latest: sessions.length ? band(arrBySession[sessions[sessions.length - 1].label] || []) : [] } };

  // ---- Live quizzes: released results, the latest round per student and quiz ----
  var rs = responses_(), rn = rs.getLastRow(), latest = {}, quizMeta = {};
  (rn > 1 ? rs.getRange(2, 1, rn - 1, 14).getValues() : []).forEach(function (r) {
    var id = normId_(r[2]), code = String(r[3]).trim().toUpperCase(); if (!id || !code || r[9] === '') return;
    var wk = Number(r[13]) || 0, qk = wk ? 'Week ' + wk : 'Quiz ' + code, k = id + '|' + qk, rnd = Number(r[10]) || 0, ts = new Date(r[0]).getTime() || 0;
    var m = quizMeta[qk] || (quizMeta[qk] = { quiz: qk, week: wk, first: ts, codes: {} }); m.codes[code] = true; if (ts && (!m.first || ts < m.first)) m.first = ts;
    if (!latest[k] || rnd >= latest[k].rnd) latest[k] = { id: id, quiz: qk, rnd: rnd, score: Number(r[9]) || 0, n: Number(r[11]) || 5, code: code };
  });
  var order = Object.keys(quizMeta).sort(function (a, b) { var x = quizMeta[a], y = quizMeta[b]; return (x.first || 0) - (y.first || 0) || (x.week || 99) - (y.week || 99); });
  var joined = {}; bodyRows_(ss.getSheetByName(PRESENCE_TAB), 5).forEach(function (r) { var code = String(r[3]).trim().toUpperCase(), id = normId_(r[1]); if (code && id) (joined[code] = joined[code] || {})[id] = true; });
  var blanks = {}; bodyRows_(ss.getSheetByName(ITEMS_TAB), 11).forEach(function (r) { if (!String(r[7]).trim()) { var code = String(r[1]).trim().toUpperCase(); blanks[code] = (blanks[code] || 0) + 1; } });
  var perStudentQuiz = {}; // id -> {quiz: pct}
  Object.keys(latest).forEach(function (k) { var x = latest[k]; (perStudentQuiz[x.id] = perStudentQuiz[x.id] || {})[x.quiz] = x.n ? Math.round(1000 * x.score / x.n) / 10 : 0; });
  out.quizzes = order.map(function (qk) {
    var m = quizMeta[qk], ids = Object.keys(perStudentQuiz).filter(function (id) { return perStudentQuiz[id][qk] !== undefined && (!roster.length || inRoster[id]); });
    var st = statNums_(ids.map(function (id) { return perStudentQuiz[id][qk]; })), j = {}, bl = 0, items = 0;
    Object.keys(m.codes).forEach(function (code) { Object.keys(joined[code] || {}).forEach(function (id) { j[id] = true; }); bl += blanks[code] || 0; });
    Object.keys(latest).forEach(function (k) { if (latest[k].quiz === qk) items += latest[k].n; });
    var nj = Object.keys(j).length;
    return { quiz: qk, week: m.week, date: m.first ? Utilities.formatDate(new Date(m.first), Session.getScriptTimeZone(), 'dd/MM/yyyy') : '', students: ids.length,
      joined: nj, completion: nj ? pct_(Math.min(ids.length, nj), nj) : null, participation: roster.length ? pct_(ids.length, roster.length) : null,
      unanswered: items ? pct_(bl, items) : null, stats: st };
  });

  // ---- Questions: difficulty, distractors and discrimination ----
  var attempts = attemptRows_();
  var itemRows = bodyRows_(ss.getSheetByName(ITEMS_TAB), 11), rep = repeatPairs_(itemRows, attempts);
  out.questions = questionStats_(itemRows, attempts);
  out.questions.forEach(function (q) { // a shared wrong answer: one wrong option chosen by a third or more of the live answers (10 or more)
    var tot = 0; Object.keys(q.dist).forEach(function (L) { tot += q.dist[L]; });
    var share = tot ? Math.round(100 * q.wrongTopN / (tot + q.blank)) : 0, again = rep.byQuestion[q.id];
    q.misconception = q.wrongTop && q.live >= 10 && share >= 33 ? { option: q.wrongTop, share: share, of: tot + q.blank, persists: !!(again && again.pairs >= 5 && again.laterWrong / again.pairs >= 1 / 3) } : null;
  });

  // ---- Practice ----
  var prac = {};
  attempts.forEach(function (a) {
    var x = prac[a.id] || (prac[a.id] = { n: 0, recent: 0, secs: 0, last: 0, best: {} });
    x.n++; x.secs += a.secs; if (a.ts > x.last) x.last = a.ts; if (now - a.ts <= th.idle * 864e5) x.recent++;
    if (!a.missed && a.total) { var key = a.quiz.replace(/\s*\(.*$/, ''), pc = 100 * a.score / a.total; if (!(key in x.best) || pc > x.best[key]) x.best[key] = pc; }
  });

  // ---- Each student ----
  var have = { sessions: sessions.length, quizzes: order.length, practice: attempts.length > 0 };
  var students = roster.map(function (r) {
    var marks = attOf[r.id] || [], pres = 0, cnt = 0, run = 0, longest = 0;
    marks.forEach(function (v) { if (v === null) return; cnt++; pres += v; if (v) run = 0; else { run++; longest = Math.max(longest, run); } });
    var qs = perStudentQuiz[r.id] || {}, traj = order.filter(function (k) { return qs[k] !== undefined; }).map(function (k) { return { quiz: k, pct: qs[k] }; });
    var sum = 0, outOf = 0; Object.keys(latest).forEach(function (k) { var x = latest[k]; if (x.id === r.id) { sum += x.score; outOf += x.n; } });
    var pr = prac[r.id], bests = pr ? Object.keys(pr.best).map(function (k) { return pr.best[k]; }) : [];
    var arr = statNums_(arrByStudent[r.id] || []);
    return { id: r.id, name: r.name, attendance: cnt ? pct_(pres, cnt) : null, present: pres, sessions: cnt, missedInARow: run, longestMissed: longest,
      marks: marks, arrivalMedian: arr.median, quizzesTaken: traj.length, quizAverage: outOf ? pct_(sum, outOf) : null, trajectory: traj,
      change: traj.length > 1 ? Math.round(10 * (traj[traj.length - 1].pct - traj[traj.length - 2].pct)) / 10 : null,
      practiceAttempts: pr ? pr.n : 0, practiceRecent: pr ? pr.recent : 0, practiceMinutes: pr ? Math.round(pr.secs / 60) : 0,
      practiceAverage: bests.length ? Math.round(10 * bests.reduce(function (a, b) { return a + b; }, 0) / bests.length) / 10 : null,
      lastPractice: pr && pr.last ? Utilities.formatDate(new Date(pr.last), Session.getScriptTimeZone(), 'dd/MM/yyyy') : '' };
  });
  // Percentile rank of the quiz average among students who have one: the share below, with ties counted as half.
  var avgs = students.filter(function (s) { return s.quizAverage !== null; }).map(function (s) { return s.quizAverage; });
  students.forEach(function (s) {
    if (s.quizAverage === null || avgs.length < 2) { s.percentile = null; } else {
      var below = avgs.filter(function (a) { return a < s.quizAverage; }).length, same = avgs.filter(function (a) { return a === s.quizAverage; }).length - 1;
      s.percentile = Math.round(100 * (below + same / 2) / (avgs.length - 1));
    }
    var e = engagementOf_(s, th, have); s.effort = e.effort; s.performance = e.performance; s.group = e.group; s.why = e.why;
  });
  out.students = students;
  var counts = {}; STATS_GROUPS.forEach(function (g) { counts[g] = 0; }); students.forEach(function (s) { counts[s.group]++; });
  out.groups = counts;

  // ---- Is the class learning, and where to target ----
  out.learning = learningVerdict_(out, rep, th);
  out.targets = targets_(out, out.learning, th);

  // ---- The summary for the overview ----
  var lastQ = out.quizzes.length ? out.quizzes[out.quizzes.length - 1] : null;
  out.summary = {
    attendanceRate: out.attendance.rate, lastSessionRate: out.attendance.lastRate, recentRate: out.attendance.recentRate, earlierRate: out.attendance.earlierRate,
    missedInARow: students.filter(function (s) { return s.missedInARow >= th.misses; }).length,
    quizzes: out.quizzes.length, quizAverage: statNums_(students.map(function (s) { return s.quizAverage; })).mean, lastQuiz: lastQ,
    review: out.questions.filter(function (q) { return q.answers >= 5 && q.pct !== null; }).sort(function (a, b) { return a.pct - b.pct; }).slice(0, 3)
      .map(function (q) { return { id: q.id, pct: q.pct, wrongTop: q.wrongTop, wrongTopN: q.wrongTopN, answers: q.answers }; })
  };
  return out;
}

// ---- Is the class learning? ----
// A verdict from several kinds of evidence, never from one quiz. Each signal is +1 (improving), 0 (no clear change) or -1 (worse),
// with its sample size. Direct evidence of learning counts twice: the change in answers to the same questions over time, and the
// trend of the class's quiz scores. Attendance and participation can support a verdict but cannot make one on their own.
// Minimum data: two released live quizzes with at least LEARN_MIN_STUDENTS students each, or LEARN_MIN_PAIRS repeated answers.
var LEARN_MIN_STUDENTS = 10, LEARN_MIN_PAIRS = 30, LEARN_VERDICTS = ['Learning', 'Mixed', 'Not yet learning', 'Not enough data'];

// Each student's first and latest answer to the same question (a live quiz, then practice, a mock exam or a later quiz).
function repeatPairs_(items, attempts) {
  var seen = {}; // id|qid -> [{t, ok}]
  var add = function (id, qid, t, ok) { if (!id || !qid || !t) return; (seen[id + '|' + qid] = seen[id + '|' + qid] || []).push({ t: t, ok: ok }); };
  items.forEach(function (r) { add(normId_(r[4]), String(r[6]).trim(), new Date(r[0]).getTime(), Number(r[9]) ? 1 : 0); });
  attempts.forEach(function (a) { a.asked.forEach(function (q) { add(a.id, q, a.ts, a.wrong.indexOf(q) < 0 ? 1 : 0); }); });
  var byLec = {}, byQ = {}, all = { n: 0, first: 0, last: 0 };
  Object.keys(seen).forEach(function (k) {
    var xs = seen[k]; if (xs.length < 2) return;
    xs.sort(function (a, b) { return a.t - b.t; });
    var l = lectureOfQid_(k.split('|')[1]), f = xs[0].ok, z = xs[xs.length - 1].ok;
    var bq = byQ[k.split('|')[1]] || (byQ[k.split('|')[1]] = { pairs: 0, laterWrong: 0 }); bq.pairs++; bq.laterWrong += 1 - z;
    var b = byLec[l] || (byLec[l] = { n: 0, first: 0, last: 0 }); b.n++; b.first += f; b.last += z; all.n++; all.first += f; all.last += z;
  });
  var fin = function (b) { return { pairs: b.n, firstPct: pct_(b.first, b.n), laterPct: pct_(b.last, b.n), gain: b.n ? Math.round(1000 * (b.last - b.first) / b.n) / 10 : null }; };
  var out = { all: fin(all), byLecture: {}, byQuestion: byQ };
  Object.keys(byLec).forEach(function (l) { out.byLecture[l] = fin(byLec[l]); });
  return out;
}

function slope_(ys) { // least-squares change per step
  var n = ys.length; if (n < 2) return null;
  var mx = (n - 1) / 2, my = ys.reduce(function (a, b) { return a + b; }, 0) / n, sxy = 0, sxx = 0;
  ys.forEach(function (y, i) { sxy += (i - mx) * (y - my); sxx += (i - mx) * (i - mx); });
  return Math.round(10 * sxy / sxx) / 10;
}

function mixedAction_(sig, out) { // the evidence in a sentence: what improves, and what falls or persists
  var UP = { repeat: 'answers improve when the same questions come back', scores: 'quiz scores are rising', participation: 'more students are taking the quizzes', attendance: 'attendance is rising' };
  var DOWN = { repeat: 'answers do not improve when questions come back', scores: 'quiz scores are falling', misconceptions: 'some wrong answers persist', participation: 'fewer students are taking the quizzes', attendance: 'attendance is falling' };
  var list = function (xs) { return xs.length < 2 ? xs.join('') : xs.slice(0, -1).join(', ') + ' and ' + xs[xs.length - 1]; };
  var up = sig.filter(function (s) { return s.value > 0 && UP[s.key]; }).map(function (s) { return UP[s.key]; });
  var down = sig.filter(function (s) { return s.value < 0 && DOWN[s.key]; }).map(function (s) { return DOWN[s.key]; });
  var t = up.length && down.length ? list(up) + ', but ' + list(down) + '. ' : up.length ? list(up) + ', while other signs are flat. ' : down.length ? list(down) + '. ' : '';
  return (t ? t.charAt(0).toUpperCase() + t.slice(1) : '') + 'Work through the areas to target, then check the weakest topic with a short follow-up quiz.';
}
function learningVerdict_(out, rep, th) {
  var sig = [], small = [];
  // 1. The same questions answered again later.
  var ra = rep.all;
  if (ra.pairs) {
    var g = ra.gain, v = ra.pairs < LEARN_MIN_PAIRS ? 0 : g >= 10 ? 1 : g <= -5 ? -1 : 0;
    if (ra.pairs < LEARN_MIN_PAIRS) small.push('only ' + ra.pairs + ' repeated answers to the same questions');
    sig.push({ key: 'repeat', direct: true, value: v, n: ra.pairs, title: 'Same questions answered again',
      text: 'Correct the first time ' + ra.firstPct + '%, the latest time ' + ra.laterPct + '% (' + (g >= 0 ? '+' : '') + g + ' points, ' + ra.pairs + ' repeated answers).' });
  }
  // 2. The class's quiz scores over time. Quizzes cover different lectures, so this is weaker evidence than the item above.
  var qz = out.quizzes.filter(function (q) { return q.students >= LEARN_MIN_STUDENTS; });
  if (qz.length >= 2) {
    var sl = slope_(qz.map(function (q) { return q.stats.mean; })), v2 = qz.length < 3 ? 0 : sl >= 3 ? 1 : sl <= -3 ? -1 : 0;
    if (qz.length < 3) small.push('only two quizzes, so the score trend is not used yet');
    sig.push({ key: 'scores', direct: true, value: v2, n: qz.length, title: 'Quiz scores over time',
      text: 'Class mean ' + qz.map(function (q) { return q.stats.mean + '%'; }).join(', ') + ' (' + (sl >= 0 ? '+' : '') + sl + ' points per quiz). Each quiz covers a different lecture, so a change in difficulty also moves this.' });
  } else if (out.quizzes.length) small.push('fewer than two quizzes with ' + LEARN_MIN_STUDENTS + ' or more students');
  // 3. Misconceptions that persist: the same wrong option chosen by a third or more of the class, in live answers and again later.
  var persist = out.questions.filter(function (q) { return q.misconception && q.misconception.persists; });
  var mis = out.questions.filter(function (q) { return q.misconception; });
  if (mis.length) sig.push({ key: 'misconceptions', direct: false, value: persist.length >= 2 ? -1 : 0, n: mis.length, title: 'Shared wrong answers',
    text: mis.length + ' question' + (mis.length === 1 ? '' : 's') + ' with one wrong option chosen by a third or more of the answers; ' + persist.length + ' still answered wrongly by a third or more of the class when asked again.' });
  // 4. Participation and attendance, recent against earlier.
  if (out.quizzes.length >= 4 && out.rosterSize) {
    var half = Math.floor(out.quizzes.length / 2), part = function (xs) { return Math.round(xs.reduce(function (a, q) { return a + (q.participation || 0); }, 0) / xs.length); };
    var pe = part(out.quizzes.slice(0, half)), pr2 = part(out.quizzes.slice(half)), d = pr2 - pe;
    sig.push({ key: 'participation', direct: false, value: d <= -10 ? -1 : d >= 5 ? 1 : 0, n: out.quizzes.length, title: 'Quiz participation', text: 'Earlier quizzes ' + pe + '% of the class, recent quizzes ' + pr2 + '%.' });
  }
  var at = out.attendance;
  if (at.sessions >= 6 && at.earlierRate !== null) {
    var d2 = Math.round(10 * (at.recentRate - at.earlierRate)) / 10;
    sig.push({ key: 'attendance', direct: false, value: d2 <= -10 ? -1 : d2 >= 5 ? 1 : 0, n: at.sessions, title: 'Attendance',
      text: 'Earlier sessions ' + at.earlierRate + '%, the last three ' + at.recentRate + '%.' });
  }
  var direct = sig.filter(function (s) { return (s.key === 'repeat' && s.n >= LEARN_MIN_PAIRS) || (s.key === 'scores' && s.n >= 3); }); // enough for a verdict
  var score = sig.reduce(function (a, s) { return a + s.value * (s.direct ? 2 : 1); }, 0), directNeg = sig.some(function (s) { return s.direct && s.value < 0; });
  var verdict = !direct.length ? 'Not enough data' : score >= 2 && !directNeg ? 'Learning' : score <= -2 ? 'Not yet learning' : 'Mixed';
  var confidence = verdict === 'Not enough data' ? '' : direct.length >= 2 && !small.length ? 'moderate' : 'low';
  var action = {
    'Learning': 'Keep the pace. Revisit the weakest topic below with a short follow-up quiz.',
    'Mixed': mixedAction_(sig, out),
    'Not yet learning': 'Slow down: re-teach the last topics with worked examples, and check with a short follow-up quiz on the same questions.',
    'Not enough data': 'Run at least two live quizzes, and ask some of the same questions again later (practice or a follow-up quiz), to see whether answers improve.'
  }[verdict];

  // Per topic (lecture): proportion correct, change on repeated questions and shared wrong answers.
  var lecs = {};
  out.questions.forEach(function (q) { if (q.lecture < 0) return; var l = lecs[q.lecture] || (lecs[q.lecture] = { lecture: q.lecture, answers: 0, right: 0, mis: 0 }); l.answers += q.answers; l.right += (q.pct || 0) * q.answers / 100; if (q.misconception) l.mis++; });
  var topics = Object.keys(lecs).map(function (k) {
    var l = lecs[k], r = rep.byLecture[k] || { pairs: 0, gain: null }, pc = l.answers ? Math.round(1000 * l.right / l.answers) / 10 : null, v;
    if (l.answers < 10) v = 'Not enough data';
    else if (r.pairs >= 10 && r.gain >= 10) v = 'Learning';
    else if (pc < 50 && (r.pairs < 10 || r.gain < 5)) v = 'Not yet learning';
    else if (pc >= 70 && (r.pairs < 10 || r.gain > -5)) v = 'Learning';
    else v = 'Mixed';
    var ev = pc + '% correct from ' + l.answers + ' answers';
    if (r.pairs) ev += '; repeated questions ' + r.firstPct + '% then ' + r.laterPct + '% (' + r.pairs + ' pairs)';
    if (l.mis) ev += '; ' + l.mis + ' shared wrong answer' + (l.mis === 1 ? '' : 's');
    return { lecture: l.lecture, label: l.lecture === 0 ? 'Introduction' : 'Lecture ' + l.lecture, verdict: v, pct: pc, answers: l.answers, pairs: r.pairs, gain: r.gain, misconceptions: l.mis, evidence: ev, small: l.answers < 20 || (r.pairs > 0 && r.pairs < 10) };
  }).sort(function (a, b) { return a.lecture - b.lecture; });

  return { verdict: verdict, verdicts: LEARN_VERDICTS, confidence: confidence, action: action, signals: sig, smallSample: small, topics: topics,
    minimum: 'At least two released live quizzes with ' + LEARN_MIN_STUDENTS + ' or more students each, or ' + LEARN_MIN_PAIRS + ' repeated answers to the same questions. Three quizzes are needed before the score trend counts.',
    notMeasured: 'The app has no separate pre-test or concept inventory, so learning is judged from repeated questions and quiz results only.' };
}

// ---- Areas to target: ranked, each with its evidence, sample size and a suggested action ----
function targets_(out, learning, th) {
  var t = [];
  learning.topics.forEach(function (x) {
    if (x.verdict === 'Not yet learning') t.push({ kind: 'Topic', title: x.label, weight: 90 - x.pct / 2, evidence: x.evidence, n: x.answers, action: 'Re-teach ' + x.label + ' with worked examples, then a short follow-up quiz on the same ideas.' });
    else if (x.verdict === 'Mixed' && x.pct < 60) t.push({ kind: 'Topic', title: x.label, weight: 60 - x.pct / 2, evidence: x.evidence, n: x.answers, action: 'Revisit ' + x.label + ' briefly at the start of the next lecture.' });
  });
  out.questions.forEach(function (q) {
    if (q.misconception) t.push({ kind: 'Question', title: q.id + ': option ' + q.misconception.option, weight: 50 + q.misconception.share / 2 + (q.misconception.persists ? 20 : 0),
      evidence: q.misconception.share + '% of ' + q.misconception.of + ' live answers chose ' + q.misconception.option + ' (correct: ' + q.key + ')' + (q.confidentWrong ? '; ' + q.confidentWrong + ' were confident' : '') + (q.misconception.persists ? '; still wrong for a third or more when asked again' : ''),
      n: q.misconception.of, action: 'Ask the class why ' + q.misconception.option + ' looks right, let them discuss in pairs, then ask a similar question.' });
    else if (q.discrimination !== null && q.discrimination < 0.2 && q.pct !== null && q.pct < 50 && q.live >= 10)
      t.push({ kind: 'Question', title: q.id, weight: 35, evidence: q.pct + '% correct; stronger and weaker students did about equally well (discrimination ' + q.discrimination + ')', n: q.live, action: 'Check the wording and the answer key.' });
  });
  var g = function (name) { return out.students.filter(function (s) { return s.group === name; }); };
  var need = g('Needs a check-in'), hard = g('Working hard but struggling'), dis = g('Disengaged');
  if (need.length) t.push({ kind: 'Students', title: need.length + ' to check in with', weight: 70, evidence: 'Low effort and low or no results: ' + need.slice(0, 4).map(function (s) { return s.name || s.id; }).join(', ') + (need.length > 4 ? ' and ' + (need.length - 4) + ' more' : ''), n: need.length, action: 'A short personal check-in. Look first at absences in a row.', group: 'Needs a check-in' });
  if (hard.length) t.push({ kind: 'Students', title: hard.length + ' working hard but struggling', weight: 65, evidence: 'Attending and taking part, quiz average below ' + th.perf + '%', n: hard.length, action: 'Offer a tutorial or a study group; pair them with students who are on track.', group: 'Working hard but struggling' });
  if (dis.length) t.push({ kind: 'Students', title: dis.length + ' doing well but less engaged', weight: 40, evidence: 'Results at or above ' + th.perf + '% with low attendance or participation', n: dis.length, action: 'Give them harder problems or a role as peer helpers.', group: 'Disengaged' });
  var rate = out.attendance.rate;
  out.attendance.bySession.forEach(function (s) {
    if (s.rate !== null && rate !== null && s.counted >= 5 && (s.rate < rate - 15 || s.rate < 50)) t.push({ kind: 'Session', title: s.label, weight: 45 + (rate - s.rate) / 2, evidence: s.rate + '% present against ' + rate + '% for the term', n: s.counted, action: 'Check what happened that day (a clash, a deadline, the time slot) and repeat its key points.' });
  });
  out.quizzes.forEach(function (q) {
    if (q.participation !== null && q.participation < 60) t.push({ kind: 'Quiz', title: q.quiz, weight: 40 + (60 - q.participation) / 2, evidence: q.participation + '% of the class took part' + (q.completion !== null ? ', ' + q.completion + '% of those who joined finished' : ''), n: q.students, action: 'Reopen it as practice, and remind the class when the next quiz runs.' });
  });
  t.forEach(function (x) { x.small = x.kind !== 'Students' && x.n < 10; }); // for students, n is how many, not a sample
  return t.sort(function (a, b) { return b.weight - a.weight; }).slice(0, 12).map(function (x) { x.weight = Math.round(x.weight); return x; });
}

// Host only: one student in full, for the Class statistics student view: the row above plus mastery by lecture and questions to revisit.
function studentStats_(p) {
  var id = normId_(p.id); if (!id) return { ok: false, why: 'no student ID' };
  var all = classStats_(p), me = null;
  all.students.forEach(function (s) { if (s.id === id) me = s; });
  if (!me) return { ok: false, why: 'that ID is not on the class list' };
  var ln = { mastery: [], revisit: [], practice: [] }; try { ln = studentLearning_(id); } catch (err) { /* shown without it */ }
  var prof = null; try { prof = studentProfile_(id, all, me); } catch (err) { prof = { error: String(err).slice(0, 160) }; }
  return { ok: true, student: me, sessions: all.attendance.bySession.map(function (s) { return s.label; }), mastery: ln.mastery, revisit: ln.revisit.slice(0, 15), practice: ln.practice, thresholds: all.thresholds, profile: prof };
}

// ---------- Teaching for learning: outcomes, progress by outcome, ask-discuss-revise evidence, group assignments ----------
// Each question can be linked to one of its lecture's learning objectives (Question_Outcomes tab, set by the lecturer; a question's own
// "outcome" field in the bank is used when the tab has no entry). Answers are then read as evidence for that outcome, in time order:
// released live quiz answers (Item_Log) and practice and mock exam questions (Attempts). Untagged questions count for their lecture.
// Levels need at least PROG_MIN answers; with fewer the outcome reads "Not enough evidence". Nothing here is shown to students
// except their own progress, behind their ID and access code.
var QOUT_TAB = 'Question_Outcomes', QOUT_HEAD = ['Question ID', 'Lecture', 'Outcome', 'Set'];
var PROG_MIN = 3, PROG_SECURE = 70, PROG_DEVELOPING = 50; // the same bands as the student's Progress by lecture
var PROG_LEVELS = ['Secure', 'Developing', 'Beginning', 'Not enough evidence'];

function lecturesInfo_() { // {number: {title, outcomes: [text]}} from data/lectures.json
  var out = {};
  try {
    var d = siteJson_('/data/lectures.json');
    (d.groups || []).forEach(function (g) { (g.lectures || []).forEach(function (l) { var n = Number(l.number); if (!isNaN(n)) out[n] = { title: String(l.title || ''), outcomes: (l.outcomes || []).map(function (x) { return plainText_(x); }) }; }); });
  } catch (err) { /* no lecture list */ }
  return out;
}
function bankFor_(n) { try { return bankList_('lecture' + n) || []; } catch (err) { return []; } }
function outcomeTagRows_() { return bodyRows_(SpreadsheetApp.getActiveSpreadsheet().getSheetByName(QOUT_TAB), 4); }
// {qid: {lec, n}}: the lecturer's tags first, then the bank's own field.
function outcomeMap_(lects) {
  var map = {};
  Object.keys(lects).forEach(function (k) {
    bankFor_(k).forEach(function (q) { var n = Number(q.outcome); if (q.id && n >= 1 && n <= lects[k].outcomes.length) map[q.id] = { lec: Number(k), n: n, from: 'bank' }; });
  });
  outcomeTagRows_().forEach(function (r) { var id = String(r[0]).trim(), n = Number(r[2]); if (!id) return; if (n > 0) map[id] = { lec: Number(r[1]), n: n, from: 'lecturer' }; else delete map[id]; });
  return map;
}
function outcomeKey_(qid, map) { var t = map[qid]; if (t) return 'L' + t.lec + '.' + t.n; var l = lectureOfQid_(qid); return l >= 0 ? 'L' + l : ''; }
function outcomeLabel_(key, lects) {
  var m = /^L(\d+)(?:\.(\d+))?$/.exec(key); if (!m) return key;
  var l = lects[Number(m[1])], lname = Number(m[1]) === 0 ? 'Introduction' : 'Lecture ' + m[1];
  if (!m[2]) return lname + ' (not linked to an objective)';
  var t = l && l.outcomes[Number(m[2]) - 1];
  return lname + ', objective ' + m[2] + (t ? ': ' + t : '');
}
var STOP_ = { the: 1, and: 1, for: 1, are: 1, how: 1, its: 1, has: 1, was: 1, why: 1, who: 1, use: 1, one: 1, two: 1, with: 1, that: 1, this: 1, from: 1, into: 1, which: 1, what: 1, when: 1, their: 1, there: 1, these: 1, those: 1, will: 1, able: 1, students: 1, student: 1, should: 1, using: 1, between: 1, given: 1, value: 1, following: 1, correct: 1, answer: 1 };
function stems_(t) { return plainText_(t).toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).filter(function (w) { return w.length > 2 && !STOP_[w]; }).map(function (w) { return w.replace(/ies$/, 'y').replace(/(ing|ed|es|s)$/, ''); }).filter(function (w) { return w.length > 2; }); }
function suggestOutcome_(q, outcomes) { // the objective whose words the question shares most, or 0
  var qs = {}; stems_(q.q + ' ' + (q.exp || '') + ' ' + (q.options || []).join(' ')).forEach(function (w) { qs[w] = 1; });
  var best = 0, bestScore = 0;
  outcomes.forEach(function (o, i) { var sc = 0, seen = {}; stems_(o).forEach(function (w) { if (qs[w] && !seen[w]) { seen[w] = 1; sc++; } }); if (sc > bestScore) { bestScore = sc; best = i + 1; } });
  return best;
}

// Host only: list the lectures, their objectives and every question with its link; save links; accept suggestions.
function outcomesAct_(p) {
  var op = String(p.op || 'list').toLowerCase(), lects = lecturesInfo_();
  if (op === 'save' || op === 'accept') {
    var sh = sheetWith_(QOUT_TAB, QOUT_HEAD), rows = outcomeTagRows_(), byId = {}, now = new Date(), changes = [];
    rows.forEach(function (r, i) { byId[String(r[0]).trim()] = i; });
    if (op === 'save') { try { changes = JSON.parse(String(p.tags || '[]')); } catch (err) { return { ok: false, why: 'the links could not be read' }; } }
    else {
      var ln = Number(p.lecture), lo = lects[ln]; if (!lo) return { ok: false, why: 'no such lecture' };
      var cur = outcomeMap_(lects);
      bankFor_(ln).forEach(function (q) { if (q.id && !cur[q.id]) { var sg = suggestOutcome_(q, lo.outcomes); if (sg) changes.push({ id: q.id, lecture: ln, outcome: sg }); } });
    }
    changes.slice(0, 2000).forEach(function (c) {
      var id = clean_(c.id, 40).replace(/^'/, ''), l = Number(c.lecture), n = Math.max(0, Math.min(20, Number(c.outcome) || 0)); if (!id) return;
      if (isNaN(l) || l < 0) l = lectureOfQid_(id);
      var row = [id, l, n, now];
      if (byId[id] !== undefined) rows[byId[id]] = row; else { byId[id] = rows.length; rows.push(row); }
    });
    rewriteBody_(sh, 4, rows);
    log_('outcome links', op + ': ' + changes.length, '', '');
    var res = outcomesAct_({ op: 'list' }); res.saved = changes.length; return res;
  }
  // list
  var map = outcomeMap_(lects), ev = evidence_(), cls = classOutcomes_(ev, lects), byKey = {};
  cls.forEach(function (o) { byKey[o.key] = o; });
  var lectures = Object.keys(lects).map(Number).sort(function (a, b) { return a - b; }).map(function (n) {
    var l = lects[n], bank = bankFor_(n), count = {};
    var qs = bank.map(function (q) {
      var t = map[q.id], sg = l.outcomes.length ? suggestOutcome_(q, l.outcomes) : 0;
      if (t) count[t.n] = (count[t.n] || 0) + 1;
      return { id: q.id, text: plainText_(q.q).slice(0, 220), type: q.type || '', outcome: t ? t.n : 0, from: t ? t.from : '', suggested: sg };
    });
    return { number: n, title: l.title, questions: qs, untagged: qs.filter(function (q) { return !q.outcome; }).length,
      outcomes: l.outcomes.map(function (text, i) { var k = 'L' + n + '.' + (i + 1), c = byKey[k]; return { n: i + 1, text: text, questions: count[i + 1] || 0, answers: c ? c.answers : 0, pct: c ? c.pct : null, students: c ? c.students : 0, levels: c ? c.levels : null }; }) };
  });
  return { ok: true, lectures: lectures, levels: PROG_LEVELS, minimum: PROG_MIN };
}

// Every answer as evidence, by student, in time order: {id: [{t, qid, ok, src, key}]}
function evidence_() {
  var lects = lecturesInfo_(), map = outcomeMap_(lects), out = {}, rel = releasedSet_();
  function add(id, t, qid, ok, src) { if (!id || !qid) return; var k = outcomeKey_(qid, map); if (!k) return; (out[id] = out[id] || []).push({ t: t, qid: qid, ok: ok, src: src, key: k }); }
  bodyRows_(SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ITEMS_TAB), ITEMS_W).forEach(function (r) {
    var id = normId_(r[4]), code = String(r[1]).trim().toUpperCase(), rnd = Number(r[2]) || 0;
    if (!rel[String(r[4]).trim() + '|' + code + '|' + rnd] || !String(r[7]).trim()) return; // released and answered
    add(id, new Date(r[0]).getTime() || 0, String(r[6]).trim(), Number(r[9]) ? 1 : 0, 'live');
  });
  attemptRows_().forEach(function (a) { a.asked.forEach(function (q) { add(a.id, a.ts, q, a.wrong.indexOf(q) < 0 ? 1 : 0, a.mock ? 'mock' : 'practice'); }); });
  Object.keys(out).forEach(function (id) { out[id].sort(function (a, b) { return a.t - b.t; }); });
  out._lects = lects; out._map = map;
  return out;
}
function levelOf_(n, cur) { return n < PROG_MIN || cur === null ? 'Not enough evidence' : cur >= PROG_SECURE ? 'Secure' : cur >= PROG_DEVELOPING ? 'Developing' : 'Beginning'; }
// Starting level: the first answers; current level: the latest answers (three each once there are six, otherwise half each).
function progressOf_(evs) {
  var n = evs.length, k = n >= 6 ? 3 : Math.floor(n / 2), ok = evs.reduce(function (a, e) { return a + e.ok; }, 0);
  var start = k ? pct_(evs.slice(0, k).reduce(function (a, e) { return a + e.ok; }, 0), k) : null;
  var cur = k ? pct_(evs.slice(n - k).reduce(function (a, e) { return a + e.ok; }, 0), k) : (n ? pct_(ok, n) : null);
  return { answers: n, right: ok, pct: pct_(ok, n), start: start, current: cur, gain: start !== null && cur !== null ? Math.round(10 * (cur - start)) / 10 : null, level: levelOf_(n, cur),
    first: n ? evs[0].t : 0, last: n ? evs[n - 1].t : 0 };
}
// One student's progress: by outcome, and over time (proportion correct per calendar week of answers).
function studentProgress_(id, ev) {
  ev = ev || evidence_(); var mine = ev[id] || [], lects = ev._lects, by = {};
  mine.forEach(function (e) { (by[e.key] = by[e.key] || []).push(e); });
  var outcomes = Object.keys(by).map(function (k) { var p = progressOf_(by[k]); p.key = k; p.label = outcomeLabel_(k, lects); p.linked = /\./.test(k); return p; })
    .sort(function (a, b) { return a.key.localeCompare(b.key, undefined, { numeric: true }); });
  var weeks = {}, order = [];
  mine.forEach(function (e) { var d = new Date(e.t), monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7)).getTime(); if (!weeks[monday]) { weeks[monday] = { right: 0, n: 0 }; order.push(monday); } weeks[monday].right += e.ok; weeks[monday].n++; });
  var timeline = order.sort(function (a, b) { return a - b; }).map(function (w) { return { week: fmtDay_(w), n: weeks[w].n, pct: pct_(weeks[w].right, weeks[w].n) }; });
  var all = progressOf_(mine), lv = {}; PROG_LEVELS.forEach(function (l) { lv[l] = 0; }); outcomes.forEach(function (o) { lv[o.level]++; });
  return { overall: all, outcomes: outcomes, timeline: timeline, levels: lv, minimum: PROG_MIN };
}
// The class, outcome by outcome: who has evidence, the mean current level, the mean gain and how many students are at each level.
function classOutcomes_(ev, lects) {
  var roster = {}; rosterRows_().forEach(function (r) { var id = normId_(r[0]); if (id) roster[id] = true; });
  var keys = {};
  Object.keys(ev).forEach(function (id) {
    if (id.charAt(0) === '_' || (Object.keys(roster).length && !roster[id])) return;
    var by = {}; ev[id].forEach(function (e) { (by[e.key] = by[e.key] || []).push(e); });
    Object.keys(by).forEach(function (k) { var p = progressOf_(by[k]), o = keys[k] || (keys[k] = { key: k, students: 0, answers: 0, right: 0, cur: [], gain: [], levels: {} }); o.students++; o.answers += p.answers; o.right += p.right; if (p.answers >= PROG_MIN) o.cur.push(p.current); if (p.gain !== null && p.answers >= 4) o.gain.push(p.gain); o.levels[p.level] = (o.levels[p.level] || 0) + 1; });
  });
  var mean = function (xs) { return xs.length ? Math.round(10 * xs.reduce(function (a, b) { return a + b; }, 0) / xs.length) / 10 : null; };
  return Object.keys(keys).map(function (k) { var o = keys[k]; PROG_LEVELS.forEach(function (l) { o.levels[l] = o.levels[l] || 0; }); return { key: k, label: outcomeLabel_(k, lects), linked: /\./.test(k), students: o.students, answers: o.answers, pct: pct_(o.right, o.answers), current: mean(o.cur), gain: mean(o.gain), gainN: o.gain.length, levels: o.levels }; })
    .sort(function (a, b) { return a.key.localeCompare(b.key, undefined, { numeric: true }); });
}

// The class by calendar week of answers: for each week, the spread of the students' proportion correct (mean, median, quartiles) and how many contributed.
// Only students on the roster count, and a student's week needs at least one answer; the first/last quartile is not shown below four students.
function classTimeline_(ev) {
  var roster = {}; rosterRows_().forEach(function (r) { var id = normId_(r[0]); if (id) roster[id] = true; });
  var hasRoster = Object.keys(roster).length > 0, weeks = {}, order = [];
  Object.keys(ev).forEach(function (id) {
    if (id.charAt(0) === '_' || (hasRoster && !roster[id])) return;
    var mine = {};
    ev[id].forEach(function (e) { var d = new Date(e.t), m = new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7)).getTime(); var w = mine[m] || (mine[m] = { r: 0, n: 0 }); w.r += e.ok; w.n++; });
    Object.keys(mine).forEach(function (m) { var w = weeks[m] || (weeks[m] = { pcts: [], answers: 0 }); if (order.indexOf(m) < 0) order.push(m); w.pcts.push(pct_(mine[m].r, mine[m].n)); w.answers += mine[m].n; });
  });
  var q = function (xs, f) { var i = (xs.length - 1) * f, lo = Math.floor(i), hi = Math.ceil(i); return Math.round(10 * (xs[lo] + (xs[hi] - xs[lo]) * (i - lo))) / 10; };
  return order.map(Number).sort(function (a, b) { return a - b; }).map(function (m) {
    var w = weeks[m], xs = w.pcts.slice().sort(function (a, b) { return a - b; });
    return { week: fmtDay_(m), students: xs.length, answers: w.answers, mean: Math.round(10 * xs.reduce(function (a, b) { return a + b; }, 0) / xs.length) / 10, median: q(xs, 0.5), q1: xs.length >= 4 ? q(xs, 0.25) : null, q3: xs.length >= 4 ? q(xs, 0.75) : null };
  });
}

// Ask, discuss, revise: every question that had a second vote, from Item_Log (both answers kept).
// Normalised gain = (after - before) / (100 - before), the share of the possible improvement that discussion achieved.
function discussionStats_() {
  var rows = bodyRows_(SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ITEMS_TAB), ITEMS_W), qs = {}, order = [], byStudent = {};
  rows.forEach(function (r) {
    if (Number(r[12]) !== 1) return;
    var k = String(r[1]).trim().toUpperCase() + '|' + (Number(r[2]) || 0) + '|' + r[5], key = String(r[8]).trim(), f = String(r[11]).trim(), a = String(r[7]).trim(), id = normId_(r[4]);
    var q = qs[k] || (qs[k] = { code: String(r[1]).trim().toUpperCase(), round: Number(r[2]) || 0, q: Number(r[5]), qid: String(r[6]).trim(), week: r[3], date: fmtDay_(new Date(r[0]).getTime()), before: 0, beforeN: 0, after: 0, afterN: 0, wrongToRight: 0, rightToWrong: 0, pairs: 0 });
    if (order.indexOf(k) < 0) order.push(k);
    if (f) { q.beforeN++; if (f === key) q.before++; }
    if (a) { q.afterN++; if (a === key) q.after++; }
    if (f && a) { q.pairs++; var s = byStudent[id] || (byStudent[id] = { pairs: 0, wrongToRight: 0, rightToWrong: 0, stayedRight: 0, stayedWrong: 0 }); s.pairs++;
      if (f !== key && a === key) { q.wrongToRight++; s.wrongToRight++; } else if (f === key && a !== key) { q.rightToWrong++; s.rightToWrong++; } else if (f === key) s.stayedRight++; else s.stayedWrong++; }
  });
  var gainOf = function (b, a) { return b === null || a === null || b >= 100 ? null : Math.round(100 * (a - b) / (100 - b)) / 100; };
  var list = order.map(function (k) { var q = qs[k]; q.beforePct = pct_(q.before, q.beforeN); q.afterPct = pct_(q.after, q.afterN); q.gain = gainOf(q.beforePct, q.afterPct); return q; });
  var B = 0, BN = 0, A = 0, AN = 0, w2r = 0, r2w = 0, pairs = 0;
  list.forEach(function (q) { B += q.before; BN += q.beforeN; A += q.after; AN += q.afterN; w2r += q.wrongToRight; r2w += q.rightToWrong; pairs += q.pairs; });
  var bp = pct_(B, BN), ap = pct_(A, AN);
  return { questions: list, rounds: list.length, pairs: pairs, beforePct: bp, afterPct: ap, gain: gainOf(bp, ap), wrongToRight: w2r, rightToWrong: r2w, byStudent: byStudent,
    note: 'Normalised gain is the share of the possible improvement reached after discussion (0 none, 1 all). A question where most were right at first has little room to gain.' };
}

// Members' outcome evidence before the task was set and after it, for an assignment linked to an outcome.
function asgBeforeAfter_(a, ids, ev) {
  if (!a.outcome) return null;
  var b = { r: 0, n: 0 }, f = { r: 0, n: 0 };
  ids.forEach(function (id) { (ev[id] || []).forEach(function (e) { if (e.key !== a.outcome) return; var x = e.t < a.created ? b : f; x.n++; x.r += e.ok; }); });
  return { outcome: a.outcome, label: outcomeLabel_(a.outcome, ev._lects), before: pct_(b.r, b.n), beforeN: b.n, after: pct_(f.r, f.n), afterN: f.n, small: b.n < 10 || f.n < 10 };
}
// Host only: the Learning Progress screen: outcomes for the class, ask-discuss-revise evidence, group work, and each student's overall progress.
function learningProgress_(p) {
  var ev = evidence_(), lects = ev._lects, roster = rosterRows_().map(function (r) { return { id: normId_(r[0]), name: cleanName_(r[1]).trim() }; }).filter(function (r) { return r.id; });
  var disc = discussionStats_(), asg = assignmentsAct_({ op: 'list' });
  var students = roster.map(function (r) {
    var sp = studentProgress_(r.id, ev), d = disc.byStudent[r.id] || null;
    return { id: r.id, name: r.name, answers: sp.overall.answers, start: sp.overall.start, current: sp.overall.current, gain: sp.overall.gain, level: sp.overall.level, levels: sp.levels,
      outcomes: sp.outcomes.map(function (o) { return { key: o.key, current: o.current, level: o.level, answers: o.answers, gain: o.gain }; }), discussion: d };
  });
  var groups = groupRows_(), sets = {};
  groups.forEach(function (g) { var s = sets[g.set] || (sets[g.set] = {}); (s[g.group] = s[g.group] || []).push(g.id); });
  var byId = {}; students.forEach(function (s) { byId[s.id] = s; });
  var groupProgress = Object.keys(sets).map(function (name) {
    return { set: name, groups: Object.keys(sets[name]).map(Number).sort(function (a, b) { return a - b; }).map(function (g) {
      var m = sets[name][g].map(function (id) { return byId[id]; }).filter(Boolean), cur = m.filter(function (s) { return s.current !== null && s.answers >= PROG_MIN; }), gn = m.filter(function (s) { return s.gain !== null && s.answers >= 4; });
      var avg = function (xs, k) { return xs.length ? Math.round(10 * xs.reduce(function (a, s) { return a + s[k]; }, 0) / xs.length) / 10 : null; };
      return { group: g, members: m.length, current: avg(cur, 'current'), gain: avg(gn, 'gain'), withEvidence: cur.length };
    }) };
  });
  return { ok: true, generated: new Date().toISOString(), minimum: PROG_MIN, levelsNames: PROG_LEVELS, thresholds: { secure: PROG_SECURE, developing: PROG_DEVELOPING },
    outcomes: classOutcomes_(ev, lects), timeline: classTimeline_(ev), discussion: { rounds: disc.rounds, pairs: disc.pairs, beforePct: disc.beforePct, afterPct: disc.afterPct, gain: disc.gain, wrongToRight: disc.wrongToRight, rightToWrong: disc.rightToWrong, questions: disc.questions, note: disc.note },
    assignments: asg.assignments || [], students: students, groupProgress: groupProgress };
}

// The student profile for the lookup: the statistics record, progress by outcome, group work, and suggestions for the lecturer.
function studentProfile_(id, all, me) {
  var ev = evidence_(), sp = studentProgress_(id, ev), disc = discussionStats_().byStudent[id] || null, th = all.thresholds;
  var rows = groupRows_(), list = asgRows_(), work = gwRows_(), marks = amkRows_(), names = {};
  rosterRows_().forEach(function (r) { var x = normId_(r[0]); if (x) names[x] = cleanName_(r[1]); });
  var groupWork = [];
  list.forEach(function (a) {
    var g = rows.filter(function (r) { return r.id === id && r.set === a.set && asgFor_(a, r.group); })[0]; if (!g) return;
    var members = rows.filter(function (r) { return r.set === a.set && r.group === g.group; }).map(function (r) { return r.id; });
    var s = groupWorkOf_(a, g.group, members, work, marks, names), m = s.members.filter(function (x) { return x.id === id; })[0];
    groupWork.push({ title: a.title, set: a.set, group: g.group, due: a.due, submitted: s.submitted, late: s.late, mark: s.mark, outOf: a.outOf, part: m ? m.part : '', peerAvg: m ? m.peerAvg : null, peerN: m ? m.peerN : 0, peerFlag: m ? m.peerFlag : false });
  });
  var known = sp.outcomes.filter(function (o) { return o.answers >= PROG_MIN; });
  var strengths = known.filter(function (o) { return o.level === 'Secure'; }).sort(function (a, b) { return b.current - a.current || b.answers - a.answers; }).slice(0, 3);
  var weak = known.filter(function (o) { return o.level === 'Beginning' || (o.level === 'Developing' && o.current < 60); }).sort(function (a, b) { return a.current - b.current || b.answers - a.answers; }).slice(0, 3);
  // Classmates who are secure where this student is weakest: a possible partner for the next pair or group task.
  var partners = [];
  if (weak.length) {
    var k = weak[0].key;
    Object.keys(ev).forEach(function (x) { if (x === id || x.charAt(0) === '_' || !names[x]) return; var es = ev[x].filter(function (e) { return e.key === k; }); if (es.length < PROG_MIN) return; var pr = progressOf_(es); if (pr.level === 'Secure') partners.push({ id: x, name: names[x], current: pr.current }); });
    partners.sort(function (a, b) { return b.current - a.current; }); partners = partners.slice(0, 3);
  }
  var tips = [];
  if (sp.overall.answers < 2 * PROG_MIN && (me.quizzesTaken || 0) < 2) tips.push({ kind: 'Evidence', text: 'Too little evidence for a judgement: ' + sp.overall.answers + ' answers so far. Look again after the next quiz.' });
  if (me.missedInARow >= th.misses) tips.push({ kind: 'Check-in', text: 'Missed the last ' + me.missedInARow + ' sessions. A short, private check-in on how things are going.' });
  if (weak.length) tips.push({ kind: 'Revision', text: 'Revise ' + weak[0].label + ' (' + weak[0].current + '% in the latest answers, ' + weak[0].answers + ' answers). Point to the practice for that lecture and the questions to revisit.' });
  if (partners.length) tips.push({ kind: 'Pairing', text: 'For the next pair task, a partner secure on that objective: ' + partners.map(function (x) { return x.name; }).join(', ') + '.' });
  if (me.group === 'Working hard but struggling') tips.push({ kind: 'Support', text: 'Effort is high but results are low. Worked examples and a short feedback conversation are likely to help more than extra practice alone.' });
  if (!me.practiceRecent && me.practiceAttempts >= 0 && all.students.some(function (s) { return s.practiceAttempts; })) tips.push({ kind: 'Practice', text: 'No practice in the last ' + th.idle + ' days. Encourage short retrieval practice spread over the week.' });
  if (disc && disc.pairs >= 3 && disc.rightToWrong > disc.wrongToRight) tips.push({ kind: 'Discussion', text: 'After discussion this student changed from right to wrong more often (' + disc.rightToWrong + ') than from wrong to right (' + disc.wrongToRight + '). Ask them to explain their reasoning before they change.' });
  groupWork.filter(function (g) { return g.submitted && !g.part; }).slice(0, 1).forEach(function (g) { tips.push({ kind: 'Group work', text: 'Has not described their own part in "' + g.title + '". Ask what they contributed.' }); });
  groupWork.filter(function (g) { return g.peerFlag; }).slice(0, 1).forEach(function (g) { tips.push({ kind: 'Group work', text: 'Group-mates rated their contribution to "' + g.title + '" as low (' + g.peerN + ' ratings). Talk to the group before acting on it.' }); });
  if (!tips.length) tips.push({ kind: 'On track', text: 'Nothing calls for action. Keep the challenge up: an extension question or a peer-explainer role.' });
  var classNow = {}; classOutcomes_(ev, ev._lects).forEach(function (o) { classNow[o.key] = { current: o.current, students: o.students }; });
  return { progress: sp, classTimeline: classTimeline_(ev), classByKey: classNow, engagement: { attendance: me.attendance, quizzesTaken: me.quizzesTaken, practiceAttempts: me.practiceAttempts, missedInARow: me.missedInARow }, discussion: disc, groupWork: groupWork, groups: studentGroups_(id), strengths: strengths, weak: weak, partners: partners, suggestions: tips };
}
