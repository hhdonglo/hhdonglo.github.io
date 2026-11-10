// Module assessment. Assessment: join codes, the live quiz and its question draw, held results, Master, Scores and Totals, presence, review, ranking and the item log.
// Edit the files in apps_script/src/; apps_script/quiz_receiver.gs is built from them (node apps_script/build.js).

// ---------- Master: one sheet for all quizzes, one row per student, one column per quiz ----------
// Tab "Master": Student ID | Name | Last updated | then one column per quiz, added automatically the first time that quiz is seen:
//   live quizzes "Week N" (or "Quiz <code>" for a code with no week), practice pages "Practice N" ("Practice Intro" for the introduction),
//   and "Mock exam". A new try by the same student replaces that quiz's cell ("score / out of"); students are matched by ID.
// Switch: Key!L2 = On (default) or Off.
var MASTER_TAB = 'Master';

function masterOn_() {
  try {
    var ks = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(KEY_TAB);
    return !ks || String(ks.getRange(2, 12).getValue()).trim().toLowerCase() !== 'off';
  } catch (err) { return true; }
}

function masterLabel_(quiz) { // a practice or mock quiz name from the pages -> its column, or '' when it should not be recorded
  var q = String(quiz || '').trim();
  if (/mock/i.test(q)) return 'Mock exam';
  if (/\(missed/i.test(q)) return ''; // a run of only the missed questions is not a full attempt
  var m = /^Lecture\s+(\d+)/i.exec(q);
  if (m) return 'Practice ' + Number(m[1]);
  if (/^Introduction/i.test(q)) return 'Practice Intro';
  return q ? 'Practice ' + q : '';
}

// entries: [{id, name, label, score, n}]. Rows are matched by ID, columns by header text (created when missing), the cell is overwritten.
function updateMaster_(entries) {
  try {
    if (!entries.length || !masterOn_()) return;
    var ss = SpreadsheetApp.getActiveSpreadsheet(), sh = ss.getSheetByName(MASTER_TAB) || ss.insertSheet(MASTER_TAB);
    if (sh.getLastRow() === 0) { sh.getRange(1, 1, 1, 3).setValues([['Student ID', 'Name', 'Last updated']]); sh.setFrozenRows(1); sh.setFrozenColumns(2); }
    entries.forEach(function (e) {
      var id = String(e.id || '').trim(), label = String(e.label || '').trim();
      if (!id || !label) return;
      var lastCol = Math.max(3, sh.getLastColumn()), head = sh.getRange(1, 1, 1, lastCol).getValues()[0].map(function (h) { return String(h).trim(); });
      var col = head.indexOf(label) + 1;
      if (col < 4) { col = lastCol + 1; sh.getRange(1, col).setValue(label); } // never matches the three fixed columns
      var n = sh.getLastRow(), row = 0;
      if (n > 1) {
        var ids = sh.getRange(2, 1, n - 1, 1).getValues();
        for (var i = 0; i < ids.length; i++) if (String(ids[i][0]).trim() === id) { row = i + 2; break; }
      }
      if (!row) { row = n + 1; sh.getRange(row, 1).setNumberFormat('@').setValue(id); }
      if (e.name) sh.getRange(row, 2).setValue(e.name);
      sh.getRange(row, 3).setValue(new Date());
      sh.getRange(row, col).setValue(e.score + ' / ' + e.n);
    });
    updateScores_(entries);
  } catch (err) { /* the master sheet must never stop a submission */ }
}

// ---------- Scores: the clean grid, Student ID in column A and one column per quiz, IDs only ----------
// Tab "Scores": Student ID | Total | Out of | Average % | then one column per quiz, added automatically the first time that quiz is seen.
// Rows 1 to 3 are the header: the heading (date and quiz name for a live quiz, e.g. "03/11/2026 Week 1 Vectors"; "Practice 1 Vectors"; "Mock exam"),
// a short key used to match the column, and the "out of" for that quiz. Every rostered ID has a row from the start; a blank cell means not taken.
// A new try by the same student replaces that cell. Total, Out of and Average % count the live quizzes only (practice and mock are for practice). No names are stored here. Same switch as Master (Key!L2).
var SCORES_TAB = 'Scores';

function scoreKey_(label) {
  var m;
  if ((m = /^Week (\d+)$/.exec(label))) return 'W' + m[1];
  if ((m = /^Practice (\d+)$/.exec(label))) return 'P' + m[1];
  if (label === 'Practice Intro') return 'P0';
  if (label === 'Mock exam') return 'MOCK';
  if ((m = /^Quiz (.+)$/.exec(label))) return 'Q:' + m[1];
  return label;
}

function scoreHeader_(label, live, weeks, today) {
  var m, t;
  if ((m = /^Week (\d+)$/.exec(label))) { t = weeks[String(Number(m[1]))]; return today + ' ' + label + (t ? ' ' + t : ''); }
  if ((m = /^Practice (\d+)$/.exec(label))) { t = weeks[String(Number(m[1]))]; return label + (t ? ' ' + t : ''); }
  return live ? today + ' ' + label : label;
}

// entries: [{id, label, score, n}]. The grid is read once, changed in memory and written back: a few rows for a single result, the whole grid for a class.
function updateScores_(entries) {
  try {
    if (!entries.length || !masterOn_()) return;
    var ss = SpreadsheetApp.getActiveSpreadsheet(), sh = ss.getSheetByName(SCORES_TAB) || ss.insertSheet(SCORES_TAB);
    var weeks = {}; try { weeks = siteJson_('/apps_script/live_quizzes.json').weeks || {}; } catch (err) { /* headings are a nicety */ }
    var grid, whole = false;
    if (sh.getLastRow() < 3) {
      grid = [['Student ID', 'Total', 'Out of', 'Average %'], ['key', '', '', ''], ['Out of', '', '', '']];
      rosterRows_().forEach(function (r) { grid.push([r[0], '', '', '']); });
      whole = true;
    } else grid = sh.getRange(1, 1, sh.getLastRow(), Math.max(4, sh.getLastColumn())).getValues();
    var W = 4; grid.forEach(function (r) { W = Math.max(W, r.length); });
    var pad = function (r) { while (r.length < W) r.push(''); };
    var today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd/MM/yyyy');
    var rowOf = {}, touched = {}, headChanged = false, firstNew = grid.length;
    grid.forEach(function (r, i) { pad(r); if (i >= 3) rowOf[normId_(r[0])] = i; });
    entries.forEach(function (e) {
      var id = normId_(e.id), label = String(e.label || '').trim();
      if (!id || !label || isNaN(Number(e.score))) return;
      var key = scoreKey_(label), live = /^(Week \d|Quiz )/.test(label), head = scoreHeader_(label, live, weeks, today), c = -1;
      for (var j = 4; j < W; j++) if (String(grid[1][j]) === key) { c = j; break; }
      if (c < 0) { c = W; W++; grid.forEach(pad); grid[0][c] = head; grid[1][c] = key; grid[2][c] = Number(e.n) || ''; headChanged = true; }
      else {
        if (live && grid[0][c] !== head) { grid[0][c] = head; headChanged = true; }
        if ((Number(grid[2][c]) || 0) < Number(e.n)) { grid[2][c] = Number(e.n); headChanged = true; }
      }
      var r = rowOf[id];
      if (r === undefined) { var nr = []; pad(nr); nr[0] = id; grid.push(nr); r = grid.length - 1; rowOf[id] = r; }
      grid[r][c] = Number(e.score); touched[r] = true;
    });
    var total = function (r) {
      var tot = 0, out = 0, any = false;
      for (var j = 4; j < W; j++) { var v = grid[r][j], kk = String(grid[1][j]); if (kk.charAt(0) !== 'W' && kk.indexOf('Q:') !== 0) continue; /* only live quizzes count towards the total; practice and mock are for practice */ if (v !== '' && !isNaN(Number(v))) { tot += Number(v); out += Number(grid[2][j]) || 0; any = true; } }
      grid[r][1] = any ? tot : ''; grid[r][2] = any ? out : ''; grid[r][3] = any && out ? Math.round(tot / out * 1000) / 10 : '';
    };
    var rows = headChanged ? grid.map(function (r, i) { return i; }).slice(3) : Object.keys(touched).map(Number);
    rows.forEach(total);
    if (sh.getMaxColumns() < W) sh.insertColumnsAfter(sh.getMaxColumns(), W - sh.getMaxColumns());
    if (sh.getMaxRows() < grid.length) sh.insertRowsAfter(sh.getMaxRows(), grid.length - sh.getMaxRows());
    if (whole || headChanged || Object.keys(touched).length > 20) {
      sh.getRange(4, 1, Math.max(1, grid.length - 3), 1).setNumberFormat('@');
      sh.getRange(1, 1, grid.length, W).setValues(grid);
      sh.setFrozenRows(3); sh.setFrozenColumns(1);
    } else {
      Object.keys(touched).map(Number).forEach(function (r) {
        sh.getRange(r + 1, 1).setNumberFormat('@');
        sh.getRange(r + 1, 1, 1, W).setValues([grid[r]]);
      });
    }
  } catch (err) { /* the scores sheet must never stop a submission */ }
}

// Every student's latest live result (the latest round wins) and latest practice or mock result (those sent with a student ID).
function collectResults_() {
  var rs = responses_(), n = rs.getLastRow(), entries = [], latest = {};
  (n > 1 ? rs.getRange(2, 1, n - 1, 14).getValues() : []).forEach(function (r) { // Timestamp, Name, ID, Code, Q1 to Q5, Score, Round, Questions, Answers, Week
    var id = String(r[2]).trim(), code = String(r[3]).trim().toUpperCase();
    if (!id || !code || r[9] === '') return;
    var week = Number(r[13]) || 0, k = id + '|' + (week ? 'W' + week : code), rnd = Number(r[10]) || 0, ts = new Date(r[0]).getTime() || 0;
    var cur = latest[k];
    if (!cur || rnd > cur.rnd || (rnd === cur.rnd && ts >= cur.ts)) latest[k] = { rnd: rnd, ts: ts, id: id, name: String(r[1]), label: week ? 'Week ' + week : 'Quiz ' + code, score: Number(r[9]), n: Number(r[11]) || 5 };
  });
  Object.keys(latest).forEach(function (k) { var x = latest[k]; entries.push({ id: x.id, name: x.name, label: x.label, score: x.score, n: x.n }); });
  var at = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Attempts');
  if (at && at.getLastRow() > 1) {
    var best = {};
    at.getRange(2, 1, at.getLastRow() - 1, 6).getValues().forEach(function (r) { // Timestamp, Student ID, Quiz, Attempt, Score, Total
      var id = normId_(r[1]), lab = masterLabel_(String(r[2])), ts = new Date(r[0]).getTime() || 0;
      if (!id || !lab || r[4] === '') return;
      var k = id + '|' + lab; if (!best[k] || ts >= best[k].ts) best[k] = { ts: ts, id: id, label: lab, score: Number(r[4]), n: Number(r[5]) || 0 };
    });
    Object.keys(best).forEach(function (k) { var x = best[k]; entries.push({ id: x.id, name: '', label: x.label, score: x.score, n: x.n }); });
  }
  return entries;
}

// Run once from the editor: fills the Scores grid from everything already recorded (fast, one write).
function rebuildScores() {
  var entries = collectResults_();
  if (!entries.length) return 'No results yet.';
  updateScores_(entries);
  return 'Scores updated with ' + entries.length + ' results.';
}

// Run once from the editor to fill Master (and Scores) from the results already recorded; slower than rebuildScores.
function rebuildMaster() {
  var entries = collectResults_();
  if (!entries.length) return 'No results yet.';
  updateMaster_(entries);
  return 'Master and Scores updated with ' + entries.length + ' results.';
}

function parseAnswers_(row) { // from a stored row [ID, Join Code, Q1..Q5, Score, Round, N, Answers]
  var str = String(row[10] || '');
  if (str) return str.split('').map(function (ch) { return ch === '-' ? '' : ch; });
  return row.slice(2, 7);
}

function roundOf_(code) { var c = ctl_(code); return c ? Number(c.v[16]) || 0 : 0; }

function responses_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(RESPONSES_TAB);
  if (sh) return sh;
  var all = ss.getSheets();
  for (var i = 0; i < all.length; i++) {
    if (all[i].getLastColumn() >= 2) {
      var h = all[i].getRange(1, 1, 1, 2).getValues()[0];
      if (String(h[0]).trim() === 'Timestamp' && String(h[1]).trim() === 'First Name') return all[i];
    }
  }
  sh = ss.insertSheet(RESPONSES_TAB);
  sh.appendRow(['Timestamp', 'First Name', 'ID', 'Join Code', 'Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'Score', 'Round', 'Questions', 'Answers', 'Week']);
  return sh;
}

// ---------- Quiz_Control: the server decides what state a quiz is in ----------

var CTL_HEADER = ['join_code', 'status', 'duration_min', 'end_time_ms', 'remaining_ms', 'allow_late_join', 'show_score', 'show_leaderboard', 'message', 'title', 'updated', 'current_q', 'q_seconds', 'q_deadline_ms', 'q_remaining_ms', 'mode', 'round', 'review_q', 'n_questions', 'question_ids', 'week', 'vote', 'discussed'];

function controlSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(CONTROL_TAB) || ss.insertSheet(CONTROL_TAB);
  if (sh.getLastRow() === 0) sh.appendRow(CTL_HEADER);
  else if (!String(sh.getRange(1, 22).getValue()).trim()) sh.getRange(1, 22, 1, 2).setValues([['vote', 'discussed']]); // tabs made before the second vote
  return sh;
}

// Returns {sh, row, v} for a code, or null when the quiz has no control row (older behaviour).
// Reads are cached for a few seconds so that hundreds of students polling at once do not each read the sheet. Every ctlSave_ clears the cache,
// so lecturer actions take effect at once. ctl_(code, true) skips the cache (used by lecturer actions that change state).
function ctl_(code, fresh) {
  var cache = null, ck = 'ctl:' + code;
  try { cache = CacheService.getScriptCache(); } catch (err) { cache = null; }
  if (cache && !fresh) {
    var raw = cache.get(ck);
    if (raw) {
      try {
        var o = JSON.parse(raw);
        Object.defineProperty(o, 'sh', { get: function () { return SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONTROL_TAB); } });
        return o;
      } catch (err) { /* fall through to the sheet */ }
    }
  }
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONTROL_TAB);
  if (!sh || sh.getLastRow() < 2) return null;
  var rows = sh.getRange(2, 1, sh.getLastRow() - 1, CTL_HEADER.length).getValues();
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i][0]).trim().toUpperCase() === code) {
      if (cache) { try { cache.put(ck, JSON.stringify({ row: i + 2, v: rows[i] }), 8); } catch (err) { /* caching is an optimisation */ } }
      return { sh: sh, row: i + 2, v: rows[i] };
    }
  }
  return null;
}

function ctlSave_(c) {
  c.v[10] = new Date().toISOString();
  c.sh.getRange(c.row, 1, 1, CTL_HEADER.length).setValues([c.v]);
  try { var k = String(c.v[0]).trim().toUpperCase(); CacheService.getScriptCache().removeAll(['ctl:' + k, 'st:' + k]); } catch (err) { /* cache only */ }
}

// ready, lobby, running, paused, ended, released, draft; a Running quiz past its deadline reads as ended.
function eff_(c) {
  var s = String(c.v[1]).trim().toLowerCase() || 'draft';
  if (s === 'running' && !paced_(c) && Date.now() >= Number(c.v[3])) return 'ended';
  return s;
}

function paced_(c) { return String(c.v[15]).trim().toLowerCase() !== 'timed'; }
function voteOf_(c) { return Number(c.v[21]) === 2 ? 2 : 1; } // 2 while the class answers the open question a second time, after discussing it
function discussedOf_(c) { return String(c.v[22] || '').split(',').map(Number).filter(function (x) { return x > 0; }); } // questions that had a second vote

function when_(c, name) { // 'immediate' | 'onrelease' | 'never'
  var m = { show_score: 6, show_leaderboard: 7 };
  return String(c.v[m[name]]).trim().toLowerCase() || 'onrelease';
}

function visible_(c, name) {
  var w = when_(c, name);
  return w === 'immediate' || (w === 'onrelease' && eff_(c) === 'released');
}

function allowLate_(c) { return String(c.v[5]).trim().toLowerCase() !== 'no'; }

function ctlStatus_(c) {
  var s = eff_(c), now = Date.now();
  var o = {
    timed: !paced_(c), paced: paced_(c), state: s, serverNow: now, endTime: Number(c.v[3]) || 0,
    remainingMs: s === 'paused' ? Number(paced_(c) ? c.v[14] : c.v[4]) || 0 : (s === 'running' && !paced_(c) ? Math.max(0, Number(c.v[3]) - now) : 0),
    duration: Number(c.v[2]) || 0, message: String(c.v[8] || ''), title: String(c.v[9] || ''),
    allowLate: allowLate_(c), showScore: visible_(c, 'show_score'), showBoard: visible_(c, 'show_leaderboard')
  };
  o.reviewQ = Number(c.v[17]) || 0;
  o.round = Number(c.v[16]) || 0; // changes on every reset or new round, so student pages know to start over
  if (paced_(c)) { o.currentQ = Number(c.v[11]) || 0; o.totalQ = quizN_(c); o.qids = qids_(c); o.qSeconds = Number(c.v[12]) || 0; o.qDeadline = Number(c.v[13]) || 0; o.vote = voteOf_(c); o.discussed = discussedOf_(c); }
  return o;
}

// ---------- How many questions, and which ----------
// apps_script/live_quizzes.json: "_default" draws from the practice bank; a code can list its own ids or carry
// its own inline questions (answers for those come from the Key tab). The lecturer sets 5 to 20 questions.

function quizN_(c) { return Math.max(1, Math.min(20, Number(c.v[18]) || 5)); }
function qids_(c) { return String(c.v[19] || '').split(',').filter(String); }
function weekOf_(c) { return c ? Number(c.v[20]) || 1 : 1; }
function liveEntry_(code, c) { // a code with its own entry (fixed questions) wins; otherwise the week's practice bank
  var m = siteJson_('/apps_script/live_quizzes.json');
  if (m[code]) return m[code];
  var w = weekFromCode_(code) || weekOf_(c);
  return { bank: 'lecture' + w, ids: 'all', week: w };
}
function bankList_(name) { return siteJson_('/quizzes/' + name + '.json').questions; }
function poolIds_(entry) { return Array.isArray(entry.ids) ? entry.ids : bankList_(entry.bank).map(function (q) { return q.id; }); }

function maxN_(code, c) {
  try { var e = liveEntry_(code, c); if (!e) return 5; return e.inline ? e.inline.length : Math.max(5, Math.min(20, poolIds_(e).length)); } catch (err) { return 5; }
}

function shuffle_(arr, seedStr) { // the same seed always gives the same order
  var h = 1779033703 ^ seedStr.length;
  for (var i = 0; i < seedStr.length; i++) { h = Math.imul(h ^ seedStr.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
  function rnd() { h = Math.imul(h ^ (h >>> 16), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); return ((h ^= h >>> 16) >>> 0) / 4294967296; }
  var a = arr.slice();
  for (var k = a.length - 1; k > 0; k--) { var j = Math.floor(rnd() * (k + 1)), t = a[k]; a[k] = a[j]; a[j] = t; }
  return a;
}

// Choose the questions for this run: inline quizzes use their own list; others draw N from the pool, a fresh draw each round.
// After "reset, same questions" the next Start keeps the questions already chosen for this code (one use, tied to the round).
function keepQs_(code, c) {
  var props = PropertiesService.getScriptProperties(), k = 'keep:' + code;
  var ok = props.getProperty(k) === String(Number(c.v[16]) || 0) && qids_(c).length === quizN_(c);
  props.deleteProperty(k);
  return ok;
}

function chooseQuestions_(code, c) {
  var e = null; try { e = liveEntry_(code, c); } catch (err) { /* offline: fall back to five generic slots */ }
  if (!e) { c.v[18] = 5; c.v[19] = ''; return; }
  if (e.inline) { c.v[18] = e.inline.length; c.v[19] = e.ids.slice(0, e.inline.length).join(','); return; }
  var pool = poolIds_(e), n = Math.max(5, Math.min(maxN_(code, c), quizN_(c)));
  c.v[18] = n; c.v[19] = shuffle_(pool, code + ':' + (Number(c.v[16]) || 0) + drawSalt_()).slice(0, n).join(',');
}

// A random value made once per workbook and mixed into the draw, so a new workbook (a new class or year) does not repeat last year's questions.
function drawSalt_() {
  var pr = PropertiesService.getScriptProperties(), v = pr.getProperty('draw_salt');
  if (!v) { v = ':' + Utilities.getUuid().slice(0, 8); pr.setProperty('draw_salt', v); }
  return v;
}

// The correct letter for each of the quiz's N questions, never sent to students except during review.
function lettersFor_(code, c) {
  var n = c ? quizN_(c) : 5, key = keyRow_(code), keyL = [], out = [], i;
  for (i = 0; i < 5; i++) keyL.push(key ? String(key[1 + i]).trim().toUpperCase() : '');
  var e = null; try { e = c ? liveEntry_(code, c) : null; } catch (err) { e = null; }
  if (c && e && !e.inline) { // practice-bank questions carry their own correct answer
    var ids = qids_(c), bank = bankList_(e.bank);
    for (i = 0; i < n; i++) {
      var q = null; for (var b = 0; b < bank.length; b++) if (bank[b].id === ids[i]) { q = bank[b]; break; }
      out.push(q && q.answer != null ? LETTERS[q.answer] : '');
    }
    return out;
  }
  for (i = 0; i < n; i++) out.push(keyL[i] || '');
  return out;
}

function mark_(letters, row) { // [1,0,...] for each question, without revealing the letters
  var out = [];
  for (var q = 0; q < letters.length; q++) out.push(letters[q] && String(row[q] || '').trim().toUpperCase() === letters[q] ? 1 : 0);
  return out;
}

// Host-only changes. Every change is written to the audit log.
function ctlAct_(p, code) {
  var key = keyRow_(code);
  if (!key) return { ok: false, why: 'no such code' };
  var act = String(p.act || '').toLowerCase(), c = ctl_(code, true), now = Date.now();
  if (act === 'init') {
    if (c) return { ok: true, status: ctlStatus_(c) };
    var sh = controlSheet_();
    sh.appendRow([code, 'Ready', 10, 0, 10 * 60000, 'Yes', 'OnRelease', 'OnRelease', '', '', new Date().toISOString(), 0, 60, 0, 0, 'paced', 0, 0, 5, '', weekFromCode_(code) || 1, 1, '']);
    log_('control:init', 'host', '', code);
    return { ok: true, status: ctlStatus_(ctl_(code, true)) };
  }
  if (!c) return { ok: false, why: 'not lecturer-controlled yet' };
  var s = eff_(c), dur = (Number(c.v[2]) || 10) * 60000, min = Math.max(0, Math.min(60, Number(p.min) || 0)) * 60000, detail = '';
  var pc = paced_(c), qms = (Number(c.v[12]) || 0) * 1000;
  if (act === 'ready' || act === 'draft') { c.v[1] = act === 'ready' ? 'Ready' : 'Draft'; c.v[3] = 0; c.v[4] = dur; c.v[11] = 0; c.v[13] = 0; c.v[14] = 0; }
  else if (act === 'lobby') { c.v[1] = 'Lobby'; c.v[3] = 0; c.v[4] = dur; c.v[11] = 0; c.v[13] = 0; c.v[14] = 0; }
  else if (act === 'start') {
    if (['ready', 'lobby', 'draft'].indexOf(s) < 0) return { ok: false, why: 'can only start from Ready or Lobby (now ' + s + ')' };
    c.v[1] = 'Running'; c.v[3] = now + dur; c.v[4] = dur;
    if (pc) { if (!keepQs_(code, c)) chooseQuestions_(code, c); c.v[11] = 1; c.v[13] = qms ? now + qms : 0; c.v[21] = 1; c.v[22] = ''; detail = 'question 1'; }
  }
  else if (act === 'next') { // paced only: move the whole class on
    if (!pc || s !== 'running') return { ok: false, why: 'start the quiz first' };
    if ((Number(c.v[11]) || 0) >= quizN_(c)) { finalize_(code); c.v[1] = 'Ended'; detail = 'after question ' + quizN_(c); }
    else { c.v[11] = (Number(c.v[11]) || 0) + 1; c.v[13] = qms ? now + qms : 0; c.v[21] = 1; detail = 'question ' + c.v[11]; }
  }
  else if (act === 'revote') { // ask, discuss, revise: the class has voted on the open question, discussed it in pairs, and now answers it again
    if (!pc || s !== 'running') return { ok: false, why: 'only while a paced quiz is running' };
    var rq = Number(c.v[11]) || 0; if (!rq) return { ok: false, why: 'no question is open' };
    if (voteOf_(c) === 2) return { ok: false, why: 'the second vote is already open' };
    var dl = discussedOf_(c); if (dl.indexOf(rq) < 0) dl.push(rq);
    c.v[21] = 2; c.v[22] = dl.join(','); c.v[13] = qms ? now + qms : 0; detail = 'second vote on question ' + rq;
  }
  else if (act === 'pause') {
    if (s !== 'running') return { ok: false, why: 'not running' };
    if (pc) c.v[14] = Number(c.v[13]) ? Math.max(0, Number(c.v[13]) - now) : 0; else c.v[4] = Math.max(0, Number(c.v[3]) - now);
    c.v[1] = 'Paused';
  }
  else if (act === 'resume') {
    if (s !== 'paused') return { ok: false, why: 'not paused' };
    c.v[1] = 'Running';
    if (pc) c.v[13] = qms ? now + Number(c.v[14]) : 0; else c.v[3] = now + Number(c.v[4]);
  }
  else if (act === 'end') {
    if (s !== 'running' && s !== 'paused') return { ok: false, why: 'not running' };
    if (pc) finalize_(code);
    c.v[1] = 'Ended'; c.v[3] = Math.min(now, Number(c.v[3]) || now); c.v[4] = 0;
  }
  else if (act === 'extend') {
    if (pc) {
      if (!qms) return { ok: false, why: 'this quiz has no question timer' };
      if (s === 'running') c.v[13] = Math.max(Number(c.v[13]), now) + min; else if (s === 'paused') c.v[14] = Number(c.v[14]) + min; else return { ok: false, why: 'not running' };
    } else if (s === 'running') c.v[3] = Number(c.v[3]) + min;
    else if (s === 'paused') c.v[4] = Number(c.v[4]) + min;
    else return { ok: false, why: 'not running' };
    detail = String(min / 60000) + ' min';
  }
  else if (act === 'release') {
    if (s !== 'ended' && s !== 'released') return { ok: false, why: 'end the quiz first' };
    commitQuiz_(code, false); // the held results join Form Responses 1, Master, Scores and Totals now
    c.v[1] = 'Released';
  }
  else if (act === 'discard') { // drop this quiz's held results (tests, repeats); the answers stay in the Answers tab
    if (s !== 'ended') return { ok: false, why: 'only an ended quiz that is not yet released' };
    detail = String(discardQuiz_(code, false).discarded) + ' held result(s)';
  }
  else if (act === 'reopen') { // a genuine technical problem: back to Running, same question
    if (s !== 'ended' && s !== 'released') return { ok: false, why: 'quiz is not ended' };
    c.v[1] = 'Running'; c.v[3] = now + (min || 2 * 60000);
    if (pc) c.v[13] = qms ? now + (min || qms) : 0;
    detail = 'question ' + c.v[11];
  }
  else if (act === 'reset') { // before it starts only; submissions are never deleted
    if (['draft', 'ready', 'lobby'].indexOf(s) < 0) return { ok: false, why: 'cannot reset after it has started' };
    c.v[1] = 'Ready'; c.v[3] = 0; c.v[4] = dur; c.v[11] = 0; c.v[13] = 0;
  }
  else if (act === 'restart' || act === 'restartsame') { // stop and reset from any state: the answers so far are compiled, then a new round starts in the lobby
    if ((s === 'running' || s === 'paused') && pc) finalize_(code);
    var ps2 = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(PRESENCE_TAB);
    if (ps2) for (var pj = ps2.getLastRow(); pj >= 2; pj--) if (String(ps2.getRange(pj, 4).getValue()).trim().toUpperCase() === code) ps2.deleteRow(pj);
    var sameQs = act === 'restartsame' && qids_(c).length > 0 && qids_(c).length === quizN_(c);
    c.v[16] = (Number(c.v[16]) || 0) + 1; c.v[1] = 'Lobby'; c.v[3] = 0; c.v[4] = dur; c.v[11] = 0; c.v[13] = 0; c.v[14] = 0; c.v[8] = ''; c.v[17] = 0; c.v[21] = 1; c.v[22] = '';
    var props = PropertiesService.getScriptProperties();
    if (sameQs) props.setProperty('keep:' + code, String(c.v[16])); else props.deleteProperty('keep:' + code);
    detail = 'round ' + c.v[16] + (sameQs ? ', same questions' : ', new questions');
  }
  else if (act === 'newround') { // student records are kept; a new round starts the class ranking again from zero
    var ps = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(PRESENCE_TAB);
    if (ps) for (var pi = ps.getLastRow(); pi >= 2; pi--) if (String(ps.getRange(pi, 4).getValue()).trim().toUpperCase() === code) ps.deleteRow(pi);
    c.v[16] = (Number(c.v[16]) || 0) + 1; c.v[1] = 'Lobby'; c.v[3] = 0; c.v[4] = dur; c.v[11] = 0; c.v[13] = 0; c.v[14] = 0; c.v[8] = ''; c.v[17] = 0; c.v[21] = 1; c.v[22] = '';
    detail = 'round ' + c.v[16];
  }
  else if (act === 'review') { // go over the answers with the class: only after the quiz has ended
    if (s !== 'ended' && s !== 'released') return { ok: false, why: 'end the quiz first' };
    c.v[17] = 1; detail = 'question 1';
  }
  else if (act === 'reviewnext' || act === 'reviewprev') {
    if (!(Number(c.v[17]) > 0)) return { ok: false, why: 'review is not on' };
    c.v[17] = Math.max(1, Math.min(quizN_(c), Number(c.v[17]) + (act === 'reviewnext' ? 1 : -1))); detail = 'question ' + c.v[17];
  }
  else if (act === 'reviewoff') { c.v[17] = 0; }
  else if (act === 'message') { c.v[8] = clean_(p.text, 200); detail = c.v[8]; }
  else if (act === 'set') { // duration, late joining, when scores and ranking show
    var field = String(p.field || ''), val = clean_(p.value, 30);
    if (field === 'duration_min') { var d = Math.max(1, Math.min(120, Number(val) || 10)); c.v[2] = d; if (s === 'ready' || s === 'lobby' || s === 'draft') c.v[4] = d * 60000; val = String(d); }
    else if (field === 'allow_late_join') c.v[5] = /^y/i.test(val) ? 'Yes' : 'No';
    else if (field === 'show_score' || field === 'show_leaderboard') c.v[field === 'show_score' ? 6 : 7] = /^i/i.test(val) ? 'Immediate' : (/^n/i.test(val) ? 'Never' : 'OnRelease');
    else if (field === 'title') c.v[9] = val;
    else if (field === 'q_seconds') { var qs = Math.max(0, Math.min(600, Number(val) || 0)); c.v[12] = qs; val = String(qs); }
    else if (field === 'week' && weekFromCode_(code)) return { ok: false, why: 'the week is set by the join code' };
    else if (field === 'week') { var wk = Math.max(1, Number(val) || 1); var wl = siteJson_('/apps_script/live_quizzes.json').weeks || {}; if (!wl[String(wk)]) return { ok: false, why: 'no practice bank for that week' }; c.v[20] = wk; c.v[19] = ''; c.v[18] = Math.max(5, Math.min(maxN_(code, c), quizN_(c))); val = String(wk); }
    else if (field === 'n_questions') { var nn = Math.max(5, Math.min(maxN_(code, c), Number(val) || 5)); c.v[18] = nn; val = String(nn); }
    else if (field === 'mode') c.v[15] = /^t/i.test(val) ? 'timed' : 'paced';
    else return { ok: false, why: 'unknown setting' };
    detail = field + '=' + val;
  }
  else return { ok: false, why: 'unknown action' };
  ctlSave_(c);
  log_('control:' + act, detail, '', code);
  return { ok: true, status: ctlStatus_(c) };
}


// ---------- Held results: Staged_Quiz, released by the lecturer ----------

function stagedSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet(), sh = ss.getSheetByName(STAGED_TAB);
  if (!sh) { sh = ss.insertSheet(STAGED_TAB); sh.appendRow(RESP_HEADER); sh.setFrozenRows(1); }
  return sh;
}

// Rows of Form Responses 1 followed by the held rows (14 columns each); readers use this so a held result can still be shown when the lecturer chose "Immediate".
function respRows_() {
  var rs = responses_(), n = rs.getLastRow(), out = n > 1 ? rs.getRange(2, 1, n - 1, 14).getValues() : [];
  var st = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(STAGED_TAB);
  if (st && st.getLastRow() > 1) out = out.concat(st.getRange(2, 1, st.getLastRow() - 1, 14).getValues());
  return out;
}

function stagedCount_() { var st = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(STAGED_TAB); return st && st.getLastRow() > 1 ? st.getLastRow() - 1 : 0; }

// Copy held rows into Form Responses 1 (a re-release of the same ID, code and round updates that row), update Master, Scores and Totals,
// then remove them from staging. code = '' releases every held row. Earlier weeks in Master are never touched: a cell is replaced only for the same student and quiz.
function commitQuiz_(code, everyRound) {
  var st = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(STAGED_TAB);
  if (!st || st.getLastRow() < 2) return { released: 0 };
  var rs = responses_(), n = rs.getLastRow();
  if (n === 0) { rs.appendRow(RESP_HEADER); n = 1; }
  else if (!rs.getRange(1, 10).getValue()) rs.getRange(1, 10).setValue('Score');
  var have = {};
  if (n > 1) rs.getRange(2, 3, n - 1, 9).getValues().forEach(function (r, j) { have[String(r[0]).trim() + '|' + String(r[1]).trim().toUpperCase() + '|' + (Number(r[8]) || 0)] = j + 2; });
  var data = st.getRange(2, 1, st.getLastRow() - 1, 14).getValues(), keepRows = [], entries = [], released = 0, curRound = {};
  var fresh = [];
  data.forEach(function (r) {
    var c = String(r[3]).trim().toUpperCase(), rnd = Number(r[10]) || 0;
    if (curRound[c] === undefined) curRound[c] = roundOf_(c);
    var match = (!code || c === code) && (everyRound || rnd === curRound[c]);
    if (!match) { keepRows.push(r); return; }
    var id = String(r[2]).trim(), k = id + '|' + c + '|' + rnd, wk = Number(r[13]) || 0;
    if (have[k]) rs.getRange(have[k], 1, 1, 14).setValues([r]); else fresh.push(r);
    entries.push({ id: id, name: String(r[1]), label: wk ? 'Week ' + wk : 'Quiz ' + c, score: Number(r[9]), n: Number(r[11]) || 5 });
    released++;
  });
  if (fresh.length) rs.getRange(rs.getLastRow() + 1, 1, fresh.length, 14).setValues(fresh);
  st.getRange(2, 1, Math.max(1, st.getLastRow() - 1), 14).clearContent();
  if (keepRows.length) st.getRange(2, 1, keepRows.length, 14).setValues(keepRows);
  updateMaster_(entries.concat(practiceEntries_()));
  totalsSafe_();
  log_('quiz released', String(released) + ' result(s)', '', code);
  return { released: released };
}

function discardQuiz_(code, everyRound) {
  var st = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(STAGED_TAB);
  if (!st || st.getLastRow() < 2) return { discarded: 0 };
  var data = st.getRange(2, 1, st.getLastRow() - 1, 14).getValues(), keepRows = [], gone = 0, curRound = {}, dropped = {};
  data.forEach(function (r) {
    var c = String(r[3]).trim().toUpperCase(), rnd = Number(r[10]) || 0;
    if (curRound[c] === undefined) curRound[c] = roundOf_(c);
    if ((!code || c === code) && (everyRound || rnd === curRound[c])) { gone++; dropped[c + '|' + rnd] = true; } else keepRows.push(r);
  });
  try { dropItems_(dropped); } catch (err) { /* the item log only */ }
  st.getRange(2, 1, Math.max(1, st.getLastRow() - 1), 14).clearContent();
  if (keepRows.length) st.getRange(2, 1, keepRows.length, 14).setValues(keepRows);
  log_('quiz discarded', String(gone) + ' held result(s)', '', code);
  return { discarded: gone };
}

// Practice and mock tries sit in the Attempts log until a release; only IDs on the Roster join Master and Scores (test IDs stay out).
function practiceEntries_() {
  var at = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Attempts');
  if (!at || at.getLastRow() < 2) return [];
  var roster = rosterSet_(), hasRoster = Object.keys(roster).length > 0, best = {};
  at.getRange(2, 1, at.getLastRow() - 1, 6).getValues().forEach(function (r) { // Timestamp, Student ID, Quiz, Attempt, Score, Total
    var id = normId_(r[1]), lab = masterLabel_(String(r[2])), ts = new Date(r[0]).getTime() || 0;
    if (!id || !lab || r[4] === '' || (hasRoster && !roster[id])) return;
    var k = id + '|' + lab; if (!best[k] || ts >= best[k].ts) best[k] = { ts: ts, id: id, label: lab, score: Number(r[4]), n: Number(r[5]) || 0 };
  });
  return Object.keys(best).map(function (k) { var x = best[k]; return { id: x.id, name: '', label: x.label, score: x.score, n: x.n }; });
}

function heldStatus_() {
  var out = { ok: true, quiz: stagedCount_(), sessions: [] };
  try { attRows_().forEach(function (r) { if (r.status === 'Closed') out.sessions.push({ label: attColumn_(r.label), present: Object.keys(attPresent_(r.label)).length }); }); } catch (err) { /* none */ }
  return out;
}

// ---------- Paced answers: stored as given, compiled into Form Responses 1 when the quiz ends ----------

function latestAnswers_(code) { // {id: {name, ans:[5], conf, first}} for the current round; the last answer to each question wins
  // first: the answer given before a second vote (ask, discuss, revise); the same as ans when there was no second vote.
  var out = {}, sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ANSWERS_TAB);
  if (!sh || sh.getLastRow() < 2) return out;
  var cc = ctl_(code), round = cc ? Number(cc.v[16]) || 0 : 0, N = cc ? quizN_(cc) : 5;
  var rows = sh.getRange(2, 2, sh.getLastRow() - 1, 8).getValues(); // ID, First Name, Join Code, Q, Answer, Round, Confidence, Vote
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i][2]).trim().toUpperCase() !== code || (Number(rows[i][5]) || 0) !== round) continue;
    var id = String(rows[i][0]).trim(), q = Number(rows[i][3]);
    if (!out[id]) out[id] = { name: String(rows[i][1]), ans: new Array(N).join(',').split(','), conf: new Array(N).join(',').split(','), first: new Array(N).join(',').split(','), second: [] };
    if (q >= 1 && q <= N) {
      out[id].ans[q - 1] = String(rows[i][4]); out[id].conf[q - 1] = String(rows[i][6] || '');
      if (Number(rows[i][7]) !== 2) out[id].first[q - 1] = String(rows[i][4]); else out[id].second[q - 1] = true;
    }
  }
  return out;
}

function finalize_(code) {
  var key = keyRow_(code), got = latestAnswers_(code), cf = ctl_(code);
  if (!key) return;
  var letters = lettersFor_(code, cf), nq = cf ? quizN_(cf) : 5, wk = cf ? weekOf_(cf) : '';
  var sh = stagedSheet_(), n = sh.getLastRow(), have = {}; // held until Release results
  var rnd = roundOf_(code);
  if (n > 1) {
    var seen = sh.getRange(2, 3, n - 1, 9).getValues(); // ID, Join Code, ..., Round
    for (var j = 0; j < seen.length; j++) if (String(seen[j][1]).trim().toUpperCase() === code && (Number(seen[j][8]) || 0) === rnd) have[String(seen[j][0]).trim()] = j + 2;
  }
  Object.keys(got).forEach(function (id) {
    var a = got[id], marks = mark_(letters, a.ans), score = marks.reduce(function (x, y) { return x + y; }, 0), rw = rowFor_(new Date(), a.name, id, code, a.ans, score, rnd, nq, wk);
    if (have[id]) sh.getRange(have[id], 5, 1, 10).setValues([rw.slice(4)]); // a reopened quiz is compiled again
    else sh.appendRow(rw);
    presence_(code, id, a.name, 'submitted');
  });
  try { logItems_(code, rnd, wk, cf ? qids_(cf) : [], letters, got, cf ? discussedOf_(cf) : []); } catch (err) { log_('item log failed', String(err).slice(0, 120), '', code); }
}

function answerCounts_(code, q) { // how many have answered question q, and the spread of A to E; with the first vote when there was a second
  var got = latestAnswers_(code), dist = { A: 0, B: 0, C: 0, D: 0, E: 0 }, n = 0, fdist = { A: 0, B: 0, C: 0, D: 0, E: 0 }, fn = 0, again = 0;
  Object.keys(got).forEach(function (id) {
    var a = got[id].ans[q - 1], f = got[id].first[q - 1];
    if (a) { n++; if (dist[a] !== undefined) dist[a]++; }
    if (f) { fn++; if (fdist[f] !== undefined) fdist[f]++; }
    if (got[id].second[q - 1]) again++;
  });
  return { answered: n, dist: dist, first: { answered: fn, dist: fdist }, changed: again };
}
// Before and after a second vote on question q: the two spreads and how answers moved, once the correct letter may be shown.
function discussionMoves_(got, q, key) {
  var o = { before: { A: 0, B: 0, C: 0, D: 0, E: 0 }, after: { A: 0, B: 0, C: 0, D: 0, E: 0 }, beforeN: 0, afterN: 0, wrongToRight: 0, rightToWrong: 0, stayedRight: 0, stayedWrong: 0, pairs: 0 };
  Object.keys(got).forEach(function (id) {
    var f = got[id].first[q - 1], a = got[id].ans[q - 1];
    if (f && o.before[f] !== undefined) { o.before[f]++; o.beforeN++; }
    if (a && o.after[a] !== undefined) { o.after[a]++; o.afterN++; }
    if (f && a && key) { o.pairs++; var fr = f === key, ar = a === key; if (fr && ar) o.stayedRight++; else if (fr) o.rightToWrong++; else if (ar) o.wrongToRight++; else o.stayedWrong++; }
  });
  o.beforePct = key ? pct_(o.before[key] || 0, o.beforeN) : null; o.afterPct = key ? pct_(o.after[key] || 0, o.afterN) : null;
  return o;
}

// ---------- Totals: every student's quizzes, scores and average, rebuilt automatically ----------

// One row per student ID. A column per quiz code holds the counted score for that quiz. If a student has several
// rounds for the same code, Key!K2 chooses which counts: Best (default) or Latest.
function refreshTotals() {
  var ss = SpreadsheetApp.getActiveSpreadsheet(), rs = responses_(), n = rs.getLastRow();
  var ks = ss.getSheetByName(KEY_TAB), mode = ks ? String(ks.getRange(2, 11).getValue()).trim().toLowerCase() : '';
  var latest = mode === 'latest', weeks = {};
  try { weeks = siteJson_('/apps_script/live_quizzes.json').weeks || {}; } catch (err) { /* titles are a nicety */ }
  var data = n > 1 ? rs.getRange(2, 1, n - 1, 14).getValues() : []; // Timestamp, First Name, ID, Join Code, Q1 to Q5, Score, Round, Questions, Answers, Week
  var students = {}, cols = {};
  data.forEach(function (r) {
    var id = String(r[2]).trim(), code = String(r[3]).trim().toUpperCase();
    if (!id || !code || r[9] === '') return;
    var week = Number(r[13]) || 0, ck = (week ? 'W' + week + ':' : 'Q:') + code;
    var score = Number(r[9]), rnd = Number(r[10]) || 0, nq = Number(r[11]) || 5;
    cols[ck] = { week: week, code: code };
    var st = students[id] || (students[id] = { name: '', best: {} });
    st.name = String(r[1]) || st.name;
    var cur = st.best[ck];
    if (!cur || (latest ? rnd >= cur.rnd : score / nq > cur.score / cur.n)) st.best[ck] = { score: score, rnd: rnd, n: nq };
  });
  var keys = Object.keys(cols).sort(function (a, b) { return (cols[a].week - cols[b].week) || cols[a].code.localeCompare(cols[b].code); });
  var label = function (k) { var c = cols[k]; return c.week ? 'Week ' + c.week + (weeks[String(c.week)] ? ' ' + weeks[String(c.week)] : '') + ' (' + c.code + ')' : 'Quiz ' + c.code; };
  var header = ['Student ID', 'First name', 'Quizzes taken'].concat(keys.map(label), ['Total', 'Out of', 'Average %']);
  var rows = Object.keys(students).sort(function (a, b) { return a.localeCompare(b, undefined, { numeric: true }); }).map(function (id) {
    var st = students[id], taken = 0, total = 0, outOf = 0;
    var cells = keys.map(function (k) { var b = st.best[k]; if (!b) return ''; taken++; total += b.score; outOf += b.n; return b.score + ' / ' + b.n; });
    return [id, st.name, taken].concat(cells, [total, outOf, outOf ? Math.round(total / outOf * 1000) / 10 : '']);
  });
  var ts = ss.getSheetByName(TOTALS_TAB) || ss.insertSheet(TOTALS_TAB);
  ts.clearContents();
  ts.getRange(1, 1, 1, header.length).setValues([header]);
  if (rows.length) ts.getRange(2, 1, rows.length, header.length).setValues(rows);
  return rows.length;
}

function releaseHeldQuiz() { return commitQuiz_('', true); }
function discardHeldQuiz() { return discardQuiz_('', true); }
// ---------- Presence: who has joined, who is working, who has submitted ----------

function presence_(code, id, name, status) {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(PRESENCE_TAB);
  if (!sh) { sh = SpreadsheetApp.getActiveSpreadsheet().insertSheet(PRESENCE_TAB); sh.appendRow(['Timestamp', 'ID', 'First Name', 'Join Code', 'Status']); }
  var n = sh.getLastRow();
  if (n > 1) {
    var rows = sh.getRange(2, 2, n - 1, 3).getValues();
    for (var i = 0; i < rows.length; i++) {
      if (String(rows[i][0]).trim() === id && String(rows[i][2]).trim().toUpperCase() === code) {
        var cur = String(sh.getRange(i + 2, 5).getValue());
        if (cur !== 'submitted') sh.getRange(i + 2, 1, 1, 5).setValues([[new Date(), id, name, code, status]]);
        return true;
      }
    }
  }
  sh.appendRow([new Date(), id, name, code, status]);
  return true;
}

function hasPresence_(code, id) {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(PRESENCE_TAB);
  if (!sh || sh.getLastRow() < 2) return false;
  var rows = sh.getRange(2, 2, sh.getLastRow() - 1, 3).getValues();
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i][0]).trim() === id && String(rows[i][2]).trim().toUpperCase() === code) return true;
  }
  return false;
}

function bankExplanation_(code, q) { // {text, error}
  try {
    var c = ctl_(code), e = liveEntry_(code, c);
    var id = e.inline ? e.ids[q - 1] : (c ? qids_(c)[q - 1] : '');
    if (!id) return { text: '', error: 'no practice-bank question is listed for this question' };
    var bank = bankList_(e.bank);
    for (var i = 0; i < bank.length; i++) {
      if (bank[i].id === id) return { text: plainText_(bank[i].exp) + (bank[i].ref ? ' Review: ' + plainText_(bank[i].ref) : ''), error: '' };
    }
    return { text: '', error: 'bank question ' + id + ' was not found' };
  } catch (err) { return { text: '', error: String(err).slice(0, 160) }; }
}

// What the class sees while the lecturer goes over a question: the correct letter, the spread of answers,
// the viewer's own answer, and the explanation. Nothing here is sent unless review is switched on.
function reviewData_(code, id) {
  var c = ctl_(code), key = keyRow_(code);
  var q = c ? Number(c.v[17]) || 0 : 0, st = c ? eff_(c) : '';
  if (!c || !key || q < 1 || (st !== 'ended' && st !== 'released')) return { q: 0 };
  var got = latestAnswers_(code), dist = { A: 0, B: 0, C: 0, D: 0, E: 0 }, n = 0;
  Object.keys(got).forEach(function (k) { var a = got[k].ans[q - 1]; if (a) { n++; if (dist[a] !== undefined) dist[a]++; } });
  var expl = '', es = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(EXPL_TAB);
  if (es && es.getLastRow() > 1) {
    var rows = es.getRange(2, 1, es.getLastRow() - 1, 3).getValues();
    for (var i = 0; i < rows.length; i++) if (String(rows[i][0]).trim().toUpperCase() === code && Number(rows[i][1]) === q) expl = String(rows[i][2]);
  }
  var err = '';
  if (!expl) { var bx = bankExplanation_(code, q); expl = bx.text; err = bx.error; }
  var key = lettersFor_(code, c)[q - 1] || '', o = { q: q, correct: key, dist: dist, answered: n, mine: id && got[id] ? got[id].ans[q - 1] : '', explanation: expl, explanationError: err };
  if (discussedOf_(c).indexOf(q) >= 0) { o.discussion = discussionMoves_(got, q, key); if (id && got[id]) o.mineFirst = got[id].first[q - 1]; }
  return o;
}

// ---------- GET (JSONP): status, own result, ranking, host and display data ----------

function ranking_(code, me) {
  var list = [];
  {
    var rnd = roundOf_(code), data = respRows_(); // held and released rows. Timestamp, First Name, ID, Join Code, Q1 to Q5, Score, Round, Questions, Answers, Week
    for (var r = 0; r < data.length; r++) {
      if (String(data[r][3]).trim().toUpperCase() === code && data[r][9] !== '' && (Number(data[r][10]) || 0) === rnd) {
        list.push({ name: String(data[r][1]), score: Number(data[r][9]), n: Number(data[r][11]) || 5, me: !!me && String(data[r][2]).trim() === me });
      }
    }
  }
  list.sort(function (x, y) { return y.score - x.score || x.name.localeCompare(y.name); });
  return list.slice(0, 300);
}

function counts_(code) {
  var out = { joined: 0, inprogress: 0, submitted: 0, notYet: [] };
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(PRESENCE_TAB);
  if (sh && sh.getLastRow() > 1) {
    var rows = sh.getRange(2, 1, sh.getLastRow() - 1, 5).getValues();
    for (var i = 0; i < rows.length; i++) {
      if (String(rows[i][3]).trim().toUpperCase() !== code) continue;
      out.joined++;
      var st = String(rows[i][4]);
      if (st === 'submitted') out.submitted++;
      else { if (st === 'inprogress') out.inprogress++; out.notYet.push(String(rows[i][2]) + (st === 'inprogress' ? ' (working)' : ' (joined)')); }
    }
  }
  return out;
}

// ---------- Learning support: item log, access codes, the student dashboard and teaching insights ----------
// Item_Log (private): one row per student per live quiz question, written when a quiz ends and removed again if it is discarded.
//   It is what the question statistics and each student's "questions to revisit" are computed from.
// Access_Codes (private): one personal code per Student ID. "My results" needs the ID and this code, so knowing a classmate's ID is not enough.
//   The lecturer creates the codes and prints a slip per student from the Access codes page (codes.html).
// Question_Stats (private): rewritten each time the lecturer opens Teaching insights (insights.html), so it can be exported or copied.
var ITEMS_TAB = 'Item_Log', CODES_TAB = 'Access_Codes', QSTATS_TAB = 'Question_Stats';
var ITEMS_HEADER = ['Timestamp', 'Join Code', 'Round', 'Week', 'Student ID', 'Q', 'Question ID', 'Answer', 'Correct answer', 'Correct', 'Confidence', 'First answer', 'Discussed'];
var ITEMS_W = ITEMS_HEADER.length; // First answer and Discussed: the answer before a second vote, and 1 when the question had one
var CODE_ALPHA = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no 0, O, 1, I or L: easy to read from a printed slip
var CONF_WORD = { H: 'High', M: 'Medium', L: 'Low' };

function lectureOfQid_(qid) { var m = /^L(\d+)-/i.exec(String(qid || '')); return m ? Number(m[1]) : -1; }
// ---- Item_Log ----
function logItems_(code, rnd, wk, ids, letters, got, discussed) {
  var sh = sheetWith_(ITEMS_TAB, ITEMS_HEADER), now = new Date(), add = [], disc = {};
  (discussed || []).forEach(function (q) { disc[q] = true; });
  if (!String(sh.getRange(1, 12).getValue()).trim()) sh.getRange(1, 12, 1, 2).setValues([['First answer', 'Discussed']]);
  Object.keys(got).forEach(function (id) {
    var a = got[id];
    for (var q = 0; q < letters.length; q++) {
      var ans = String(a.ans[q] || '');
      add.push([now, code, rnd, wk || '', id, q + 1, ids[q] || '', ans, letters[q] || '', letters[q] && ans === letters[q] ? 1 : 0, (a.conf && a.conf[q]) || '',
        disc[q + 1] ? String((a.first && a.first[q]) || '') : '', disc[q + 1] ? 1 : '']);
    }
  });
  var rows = bodyRows_(sh, ITEMS_W), clash = rows.some(function (r) { return String(r[1]).trim().toUpperCase() === code && (Number(r[2]) || 0) === rnd; });
  if (clash) rewriteBody_(sh, ITEMS_W, rows.filter(function (r) { return !(String(r[1]).trim().toUpperCase() === code && (Number(r[2]) || 0) === rnd); }).concat(add)); // a reopened quiz is compiled again
  else if (add.length) sh.getRange(sh.getLastRow() + 1, 1, add.length, ITEMS_W).setValues(add);
}
function dropItems_(pairs) { // pairs: {'CODE|round': true}, from a discard
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ITEMS_TAB);
  if (!sh || !Object.keys(pairs).length) return;
  var rows = bodyRows_(sh, ITEMS_W), keep = rows.filter(function (r) { return !pairs[String(r[1]).trim().toUpperCase() + '|' + (Number(r[2]) || 0)]; });
  if (keep.length !== rows.length) rewriteBody_(sh, ITEMS_W, keep);
}
function releasedSet_() { // 'ID|CODE|round' of every released live result (Form Responses 1, not the held rows)
  var rs = responses_(), n = rs.getLastRow(), out = {};
  if (n > 1) rs.getRange(2, 3, n - 1, 9).getValues().forEach(function (r) { out[String(r[0]).trim() + '|' + String(r[1]).trim().toUpperCase() + '|' + (Number(r[8]) || 0)] = true; });
  return out;
}

// ---- Access codes ----
function normCode_(s) { var t = String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8); return t.length === 8 ? t.slice(0, 4) + '-' + t.slice(4) : ''; }
