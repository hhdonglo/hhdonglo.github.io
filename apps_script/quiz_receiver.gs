// PHYS 143 quiz receiver. Bound to the "PHYS 143 Quizzes (Responses)" Sheet.
//
// Tabs: Form Responses 1 (Timestamp, First Name, ID, Join Code, Q1 to Q5, Score), Key (private), Quiz_Control (private),
//       Presence, Log, Reports, Attempts, Roster, Attendance_Control, Attendance_Log, Attendance, Not_On_List (attendance check-in, see the Attendance section), Master (one row per student, one column per quiz; a new try replaces that cell; switch Key!L2 = On or Off).
// Key: Join Code | Q1 to Q5 (correct letters) | Ranking (Hidden hides it) | State (legacy: Waiting, Started, Stopped) ... J2 = host key.
// Quiz_Control (one row per lecturer-controlled quiz, written by the host dashboard; the server is the authority):
//   join_code | status | duration_min | end_time_ms | remaining_ms | allow_late_join | show_score | show_leaderboard | message | title | updated
//   (student records are never deleted: each quiz run is a round; the ranking, first-attempt rule and results use the current round)
//   + current_q | q_seconds (0 = no question timer) | q_deadline_ms | q_remaining_ms | mode (paced or timed) | round (a new round archives the old responses) | review_q (0 = off; 1 to N = the lecturer is going over that question) | n_questions (5 to 20) | question_ids (chosen when the quiz starts) | week (which week's practice bank to draw from)
//   status: Draft, Ready, Lobby, Running, Paused, Ended, Released.
//   paced (default): the lecturer moves the whole class from question to question; answers go to the Answers tab as they are given
//   and are compiled into Form Responses 1 (with the Score) when the quiz ends. timed: one clock for all five questions.
//   show_score and show_leaderboard: Immediate, OnRelease (default) or Never.
// A join code with no Quiz_Control row keeps the older behaviour (Key columns G and H).

var RESPONSES_TAB = 'Form Responses 1';
var KEY_TAB = 'Key';
var CONTROL_TAB = 'Quiz_Control';
var PRESENCE_TAB = 'Presence';
var ANSWERS_TAB = 'Answers';
var TOTALS_TAB = 'Totals'; // private: one row per student ID, rebuilt automatically
var EXPL_TAB = 'Explanations'; // optional override: join code | question number | explanation. Normally empty.
var SITE = 'https://hhdonglo.github.io'; // explanations come from the practice bank listed in apps_script/live_quizzes.json
var LETTERS = ['A', 'B', 'C', 'D', 'E'];
var NOTIFY_EMAIL = 'hkdonglo@gmail.com'; // new reports are emailed here
var GRACE_MS = 15000; // a submission may arrive this long after the deadline (network delay)

function clean_(v, max) {
  var s = String(v == null ? '' : v).trim().slice(0, max);
  if (/^[=+\-@]/.test(s)) s = "'" + s; // keep a typed value from running as a formula
  return s;
}

function append_(tab, header, row) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(tab) || ss.insertSheet(tab);
  if (sh.getLastRow() === 0) sh.appendRow(header);
  sh.appendRow(row);
  return sh;
}

function mailReport_(sh, r) {
  var row = sh.getLastRow(), status;
  try {
    var link = SpreadsheetApp.getActiveSpreadsheet().getUrl() + '#gid=' + sh.getSheetId() + '&range=A' + row;
    MailApp.sendEmail(NOTIFY_EMAIL, 'PHYS 143 report: ' + r.lecture + ', ' + r.qid,
      'A student reported a problem.\n\nTime: ' + r.time + '\nPage: ' + r.page + '\nLecture: ' + r.lecture + '\nQuestion id: ' + r.qid +
      '\nQuestion: ' + r.question + '\nAnswer shown: ' + r.answer + '\n\nComment:\n' + r.comment + '\n\nOpen the row: ' + link);
    status = 'email sent';
  } catch (err) {
    status = 'email failed: ' + String(err).slice(0, 200); // the row is already saved; show why the email failed
  }
  sh.getRange(1, 8).setValue('Email');
  sh.getRange(row, 8).setValue(status);
}

// Run this once from the editor (choose testEmail, press Run) to grant the email permission and check delivery.
function testEmail() {
  MailApp.sendEmail(NOTIFY_EMAIL, 'PHYS 143 test email', 'If you can read this, report emails will reach you. Remaining daily quota: ' + MailApp.getRemainingDailyQuota());
}

function log_(outcome, name, id, code) {
  try { append_('Log', ['Timestamp', 'Outcome', 'First Name', 'ID', 'Join Code'], [new Date(), outcome, name, id, code]); } catch (err) { /* logging must never stop a submission */ }
}

function lastOutcome_(id, code) {
  var ls = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Log');
  if (!ls || ls.getLastRow() < 2) return '';
  var rows = ls.getRange(2, 2, ls.getLastRow() - 1, 4).getValues(); // Outcome, First Name, ID, Join Code
  for (var i = rows.length - 1; i >= 0; i--) {
    if (String(rows[i][2]).trim() === id && String(rows[i][3]).trim().toUpperCase() === code) return String(rows[i][0]);
  }
  return '';
}

// ---------- Key, responses, host key ----------

function state_(key) { return String(key[7]).trim().toLowerCase() || 'started'; }

function hostOk_(p) {
  var ks = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(KEY_TAB);
  var hk = ks ? String(ks.getRange(2, 10).getValue()).trim() : '';
  if (!hk) return false;
  var cache = CacheService.getScriptCache();
  var fails = Number(cache.get('hostfails') || 0);
  if (fails >= 30) return false; // locked for 10 minutes after 30 wrong keys
  var given = String(p.hostkey || '').trim();
  var ok;
  if (hk.indexOf('sha256:') === 0) { // hashed form: sha256:salt:hex
    var parts = hk.split(':');
    ok = parts.length === 3 && hashKey_(parts[1], given) === parts[2];
  } else { // legacy plain key typed in the Sheet
    ok = given === hk;
  }
  if (!ok) cache.put('hostfails', String(fails + 1), 600);
  return ok;
}

function hashKey_(salt, key) {
  var d = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, salt + ':' + key, Utilities.Charset.UTF_8);
  return d.map(function (b) { return ('0' + (b & 0xff).toString(16)).slice(-2); }).join('');
}

// Host only: change the host key. Needs the current key; stores salt and hash in Key!J2, never the plain key.
function setHostKey_(p) {
  var nk = String(p.newkey || '').trim();
  if (nk.length < 12 || nk.length > 40) return { ok: false, why: 'new key must be 12 to 40 characters' };
  if (nk === String(p.hostkey || '').trim()) return { ok: false, why: 'new key must differ from the current key' };
  var ks = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(KEY_TAB);
  var salt = Utilities.getUuid();
  ks.getRange(2, 10).setNumberFormat('@').setValue('sha256:' + salt + ':' + hashKey_(salt, nk));
  CacheService.getScriptCache().remove('hostfails');
  log_('host key changed', '', '', '');
  return { ok: true };
}

// A join code of the form 2627 + week number (26271 = Week 1, 26272 = Week 2, ..., 262710 = Week 10) is valid
// for any week that has a practice bank, with no Key row to add. The week comes from the code.
function weekFromCode_(code) {
  var m = /^2627(\d{1,2})$/.exec(String(code));
  if (!m) return 0;
  try { var wk = siteJson_('/apps_script/live_quizzes.json').weeks || {}; return wk[String(Number(m[1]))] ? Number(m[1]) : 0; } catch (err) { return 0; }
}

function keyRow_(code) {
  var kc = null, kk = 'key:' + code;
  try { kc = CacheService.getScriptCache(); var kh = kc.get(kk); if (kh) return JSON.parse(kh); } catch (err) { kc = null; }
  var ks = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(KEY_TAB);
  if (!ks || ks.getLastRow() < 2) return null;
  var rows = ks.getRange(2, 1, ks.getLastRow() - 1, 8).getValues(), found = null;
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i][0]).trim().toUpperCase() === code) { found = rows[i]; break; }
  }
  if (!found && weekFromCode_(code)) found = [code, '', '', '', '', '', 'Open', ''];
  if (found && kc) { try { kc.put(kk, JSON.stringify(found), 20); } catch (err) { /* cache only */ } } // a Key edit shows within 20 s
  return found;
}

// The responses tab: by name, else the first tab whose header row starts Timestamp, First Name; else created.
// One stored response: the first five answers sit in Q1 to Q5 as before; Answers holds all N letters ('-' = blank).
function rowFor_(ts, name, id, code, ans, score, rnd, n, week) {
  var f = []; for (var i = 0; i < 5; i++) f.push(ans[i] || '');
  return [ts, name, id, code].concat(f, [score, rnd, n, ans.map(function (a) { return a || '-'; }).join(''), week || '']);
}

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
  } catch (err) { /* the master sheet must never stop a submission */ }
}

// Run once from the editor to fill Master from the live quizzes already in Form Responses 1 (the latest round for each student and quiz wins).
function rebuildMaster() {
  var rs = responses_(), n = rs.getLastRow();
  if (n < 2) return 'No responses yet.';
  var data = rs.getRange(2, 1, n - 1, 14).getValues(), latest = {}, entries = [];
  data.forEach(function (r) { // Timestamp, Name, ID, Code, Q1 to Q5, Score, Round, Questions, Answers, Week
    var id = String(r[2]).trim(), code = String(r[3]).trim().toUpperCase();
    if (!id || !code || r[9] === '') return;
    var week = Number(r[13]) || 0, k = id + '|' + (week ? 'W' + week : code), rnd = Number(r[10]) || 0, ts = new Date(r[0]).getTime() || 0;
    var cur = latest[k];
    if (!cur || rnd > cur.rnd || (rnd === cur.rnd && ts >= cur.ts)) latest[k] = { rnd: rnd, ts: ts, id: id, name: String(r[1]), label: week ? 'Week ' + week : 'Quiz ' + code, score: Number(r[9]), n: Number(r[11]) || 5 };
  });
  Object.keys(latest).forEach(function (k) { var x = latest[k]; entries.push({ id: x.id, name: x.name, label: x.label, score: x.score, n: x.n }); });
  updateMaster_(entries);
  return 'Master updated with ' + entries.length + ' results.';
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

// Run once from the editor: makes sure the Key, Quiz_Control, responses and Log tabs exist and tells you what it found.
function setup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var ks = ss.getSheetByName(KEY_TAB) || ss.insertSheet(KEY_TAB);
  if (ks.getLastRow() === 0) ks.appendRow(['Join Code', 'Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'Ranking']);
  ks.getRange(1, 8).setValue('State');
  ks.getRange(1, 10).setValue('Host key');
  if (!String(ks.getRange(2, 10).getValue()).trim()) ks.getRange(2, 10).setValue(Math.random().toString(36).slice(2, 10));
  if (ks.getLastRow() < 2) ks.appendRow(['2627', '', '', '', '', '', 'Open']);
  ks.getRange(1, 11).setValue('Totals count (Best or Latest)');
  if (!String(ks.getRange(2, 11).getValue()).trim()) ks.getRange(2, 11).setValue('Best');
  ks.getRange(1, 12).setValue('Master sheet (On or Off)');
  if (!String(ks.getRange(2, 12).getValue()).trim()) ks.getRange(2, 12).setValue('On');
  var rost = ss.getSheetByName(ROSTER_TAB) || ss.insertSheet(ROSTER_TAB); // private: paste Student ID and Name here for attendance
  if (rost.getLastRow() === 0) rost.getRange(1, 1).setValue('Student ID'); // IDs only: attendance_tools/roster_sync.sh fills it
  attSheet_();
  controlSheet_();
  var xs = ss.getSheetByName(EXPL_TAB) || ss.insertSheet(EXPL_TAB);
  if (xs.getLastRow() === 0) xs.appendRow(['Join Code', 'Question', 'Explanation']);
  var rs = responses_();
  if (!rs.getRange(1, 10).getValue()) rs.getRange(1, 10).setValue('Score');
  rs.getRange(1, 11, 1, 4).setValues([['Round', 'Questions', 'Answers', 'Week']]);
  refreshTotals();
  var names = ss.getSheets().map(function (x) { return x.getName(); });
  var msg = 'Setup finished. Host key (also in Key!J2): ' + ks.getRange(2, 10).getValue() + '. Responses tab: ' + rs.getName() + '. Tabs in this file: ' + names.join(', ') + '.';
  log_('setup', msg.replace(/Host key[^.]*\./, 'Host key shown in Key!J2.'), '', '');
  try { SpreadsheetApp.getUi().alert(msg); } catch (err) { /* not run from the sheet */ }
  return msg;
}

function jsonp_(e, obj) {
  var cb = String((e && e.parameter && e.parameter.callback) || '');
  var body = JSON.stringify(obj);
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(cb)) return ContentService.createTextOutput(body).setMimeType(ContentService.MimeType.JSON);
  return ContentService.createTextOutput(cb + '(' + body + ')').setMimeType(ContentService.MimeType.JAVASCRIPT);
}

function out_(t) { return ContentService.createTextOutput(t); }

// ---------- Quiz_Control: the server decides what state a quiz is in ----------

var CTL_HEADER = ['join_code', 'status', 'duration_min', 'end_time_ms', 'remaining_ms', 'allow_late_join', 'show_score', 'show_leaderboard', 'message', 'title', 'updated', 'current_q', 'q_seconds', 'q_deadline_ms', 'q_remaining_ms', 'mode', 'round', 'review_q', 'n_questions', 'question_ids', 'week'];

function controlSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(CONTROL_TAB) || ss.insertSheet(CONTROL_TAB);
  if (sh.getLastRow() === 0) sh.appendRow(CTL_HEADER);
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
  if (paced_(c)) { o.currentQ = Number(c.v[11]) || 0; o.totalQ = quizN_(c); o.qids = qids_(c); o.qSeconds = Number(c.v[12]) || 0; o.qDeadline = Number(c.v[13]) || 0; }
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
  c.v[18] = n; c.v[19] = shuffle_(pool, code + ':' + (Number(c.v[16]) || 0)).slice(0, n).join(',');
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
    sh.appendRow([code, 'Ready', 10, 0, 10 * 60000, 'Yes', 'OnRelease', 'OnRelease', '', '', new Date().toISOString(), 0, 60, 0, 0, 'paced', 0, 0, 5, '', weekFromCode_(code) || 1]);
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
    if (pc) { if (!keepQs_(code, c)) chooseQuestions_(code, c); c.v[11] = 1; c.v[13] = qms ? now + qms : 0; detail = 'question 1'; }
  }
  else if (act === 'next') { // paced only: move the whole class on
    if (!pc || s !== 'running') return { ok: false, why: 'start the quiz first' };
    if ((Number(c.v[11]) || 0) >= quizN_(c)) { finalize_(code); c.v[1] = 'Ended'; detail = 'after question ' + quizN_(c); }
    else { c.v[11] = (Number(c.v[11]) || 0) + 1; c.v[13] = qms ? now + qms : 0; detail = 'question ' + c.v[11]; }
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
    c.v[1] = 'Released';
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
    c.v[16] = (Number(c.v[16]) || 0) + 1; c.v[1] = 'Lobby'; c.v[3] = 0; c.v[4] = dur; c.v[11] = 0; c.v[13] = 0; c.v[14] = 0; c.v[8] = ''; c.v[17] = 0;
    var props = PropertiesService.getScriptProperties();
    if (sameQs) props.setProperty('keep:' + code, String(c.v[16])); else props.deleteProperty('keep:' + code);
    detail = 'round ' + c.v[16] + (sameQs ? ', same questions' : ', new questions');
  }
  else if (act === 'newround') { // student records are kept; a new round starts the class ranking again from zero
    var ps = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(PRESENCE_TAB);
    if (ps) for (var pi = ps.getLastRow(); pi >= 2; pi--) if (String(ps.getRange(pi, 4).getValue()).trim().toUpperCase() === code) ps.deleteRow(pi);
    c.v[16] = (Number(c.v[16]) || 0) + 1; c.v[1] = 'Lobby'; c.v[3] = 0; c.v[4] = dur; c.v[11] = 0; c.v[13] = 0; c.v[14] = 0; c.v[8] = ''; c.v[17] = 0;
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

// ---------- Paced answers: stored as given, compiled into Form Responses 1 when the quiz ends ----------

function latestAnswers_(code) { // {id: {name, ans:[5]}} for the current round; the last answer to each question wins
  var out = {}, sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ANSWERS_TAB);
  if (!sh || sh.getLastRow() < 2) return out;
  var cc = ctl_(code), round = cc ? Number(cc.v[16]) || 0 : 0, N = cc ? quizN_(cc) : 5;
  var rows = sh.getRange(2, 2, sh.getLastRow() - 1, 6).getValues(); // ID, First Name, Join Code, Q, Answer, Round
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i][2]).trim().toUpperCase() !== code || (Number(rows[i][5]) || 0) !== round) continue;
    var id = String(rows[i][0]).trim(), q = Number(rows[i][3]);
    if (!out[id]) out[id] = { name: String(rows[i][1]), ans: new Array(N).join(',').split(',') };
    if (q >= 1 && q <= N) out[id].ans[q - 1] = String(rows[i][4]);
  }
  return out;
}

function finalize_(code) {
  var key = keyRow_(code), got = latestAnswers_(code), cf = ctl_(code);
  if (!key) return;
  var letters = lettersFor_(code, cf), nq = cf ? quizN_(cf) : 5, wk = cf ? weekOf_(cf) : '';
  var sh = responses_(), n = sh.getLastRow(), have = {};
  if (n === 0) { sh.appendRow(['Timestamp', 'First Name', 'ID', 'Join Code', 'Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'Score', 'Round', 'Questions', 'Answers', 'Week']); n = 1; }
  else if (!sh.getRange(1, 10).getValue()) sh.getRange(1, 10).setValue('Score');
  var rnd = roundOf_(code);
  if (n > 1) {
    var seen = sh.getRange(2, 3, n - 1, 9).getValues(); // ID, Join Code, ..., Round
    for (var j = 0; j < seen.length; j++) if (String(seen[j][1]).trim().toUpperCase() === code && (Number(seen[j][8]) || 0) === rnd) have[String(seen[j][0]).trim()] = j + 2;
  }
  var logRows = []; // entries for the Master sheet
  Object.keys(got).forEach(function (id) {
    var a = got[id], marks = mark_(letters, a.ans), score = marks.reduce(function (x, y) { return x + y; }, 0), rw = rowFor_(new Date(), a.name, id, code, a.ans, score, rnd, nq, wk);
    logRows.push({ id: id, name: a.name, label: wk ? 'Week ' + wk : 'Quiz ' + code, score: score, n: nq });
    if (have[id]) sh.getRange(have[id], 5, 1, 10).setValues([rw.slice(4)]); // a reopened quiz is compiled again
    else sh.appendRow(rw);
    presence_(code, id, a.name, 'submitted');
  });
  updateMaster_(logRows);
  totalsSafe_();
}

function answerCounts_(code, q) { // how many have answered question q, and the spread of A to E
  var got = latestAnswers_(code), dist = { A: 0, B: 0, C: 0, D: 0, E: 0 }, n = 0;
  Object.keys(got).forEach(function (id) {
    var a = got[id].ans[q - 1];
    if (a) { n++; if (dist[a] !== undefined) dist[a]++; }
  });
  return { answered: n, dist: dist };
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

function onOpen() { // a PHYS 143 menu in the sheet
  try { SpreadsheetApp.getUi().createMenu('PHYS 143').addItem('Refresh totals', 'refreshTotals').addToUi(); } catch (err) { /* not opened from the sheet */ }
}

function totalsSafe_() { try { refreshTotals(); } catch (err) { log_('totals failed', String(err).slice(0, 150), '', ''); } }

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

// ---------- Attendance: a check-in code, the student enters an ID, 1 if present, 0 when the session is closed ----------
// Tabs (all private): Roster (Student IDs only, filled by attendance_tools/roster_sync.sh), Attendance_Control (one row per session:
// Code | Label | Status | Opened | Closed), Attendance_Log (every check-in), Attendance (one row per rostered student, one column per session,
// "Attendance Wk N [1]" = 1 present, 0 absent, the format the Sakai gradebook imports), Not_On_List (IDs that checked in but are not on the roster).
// The lecturer opens a session from the host page with a code to announce in class; students enter that code and their ID on the quiz page.
var ROSTER_TAB = 'Roster', ATT_CTL_TAB = 'Attendance_Control', ATT_LOG_TAB = 'Attendance_Log', ATT_TAB = 'Attendance', NOTLIST_TAB = 'Not_On_List';

function normId_(s) { return String(s == null ? '' : s).replace(/\D/g, ''); }

function rosterRows_() { // [[id, name], ...] straight from the Roster tab
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ROSTER_TAB);
  if (!sh || sh.getLastRow() < 1) return [];
  var v = sh.getRange(1, 1, sh.getLastRow(), 2).getValues(), out = [];
  v.forEach(function (r) { var id = normId_(r[0]); if (id.length >= 4) out.push([id, String(r[1] || '').trim()]); }); // the header row has no digits and is skipped
  return out;
}

function rosterSet_() { // {id: 1}, cached for five minutes
  var cache = null; try { cache = CacheService.getScriptCache(); var h = cache.get('roster'); if (h) return JSON.parse(h); } catch (err) { cache = null; }
  var set = {}; rosterRows_().forEach(function (r) { set[r[0]] = 1; });
  if (cache) { try { cache.put('roster', JSON.stringify(set), 300); } catch (err) { /* roster larger than the cache limit: read the sheet each time */ } }
  return set;
}

// Roster sync (used by attendance_tools/roster_sync.sh): adds the uploaded Student IDs to the Roster tab. Only IDs are stored (no names), IDs already
// there are left alone, nothing is ever deleted (IDs missing from the upload are only counted), and nothing from the Roster is ever returned.
// kind=roster_sync, hostkey, mode=dry|apply, rows = JSON list of Student IDs.
function rosterSync_(p) {
  if (!hostOk_(p)) return { ok: false, why: 'key not accepted' };
  var rows;
  try { rows = JSON.parse(String(p.rows || '[]')); } catch (err) { return { ok: false, why: 'could not read the list' }; }
  if (!Array.isArray(rows) || !rows.length) return { ok: false, why: 'the list is empty' };
  if (rows.length > 5000) return { ok: false, why: 'the list is too long (more than 5000 rows)' };
  var up = {}, order = [], bad = 0;
  rows.forEach(function (r) {
    var id = normId_(Array.isArray(r) ? r[0] : r);
    if (id.length < 4 || id.length > 12) { bad++; return; }
    if (!up[id]) { up[id] = 1; order.push(id); }
  });
  if (!order.length) return { ok: false, why: 'no valid student IDs in the list' };
  var apply = String(p.mode || '') === 'apply', lk = LockService.getScriptLock();
  lk.waitLock(30000);
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet(), sh = ss.getSheetByName(ROSTER_TAB) || ss.insertSheet(ROSTER_TAB);
    if (sh.getLastRow() === 0) sh.getRange(1, 1).setValue('Student ID');
    var have = {};
    sh.getRange(1, 1, sh.getLastRow(), 1).getValues().forEach(function (r) { var id = normId_(r[0]); if (id.length >= 4) have[id] = 1; });
    var added = order.filter(function (id) { return !have[id]; }).map(function (id) { return [id]; });
    var missing = Object.keys(have).filter(function (id) { return !up[id]; }).length;
    if (apply && added.length) {
      var r0 = sh.getLastRow() + 1;
      sh.getRange(r0, 1, added.length, 1).setNumberFormat('@');
      sh.getRange(r0, 1, added.length, 1).setValues(added);
    }
    if (apply) { try { CacheService.getScriptCache().remove('roster'); } catch (err) { /* cache only */ } log_('roster:sync', added.length + ' added', '', ''); }
    return { ok: true, mode: apply ? 'apply' : 'dry', added: added.length, unchanged: order.length - added.length, missing: missing, skipped: bad, total: order.length };
  } finally { lk.releaseLock(); }
}

function attSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet(), sh = ss.getSheetByName(ATT_CTL_TAB);
  if (!sh) { sh = ss.insertSheet(ATT_CTL_TAB); sh.appendRow(['Code', 'Label', 'Status', 'Opened', 'Closed']); }
  return sh;
}

function attRows_() { // [{row, code, label, status}]
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ATT_CTL_TAB);
  if (!sh || sh.getLastRow() < 2) return [];
  return sh.getRange(2, 1, sh.getLastRow() - 1, 3).getValues().map(function (r, i) { return { row: i + 2, code: String(r[0]).trim().toUpperCase(), label: String(r[1]), status: String(r[2]).trim() }; });
}

function attByCode_(code) { // the session with this code, or null; cached a few seconds (also caches "none", since every unknown code asks)
  if (!code) return null;
  var cache = null, k = 'att:' + code;
  try { cache = CacheService.getScriptCache(); var h = cache.get(k); if (h) return h === '0' ? null : JSON.parse(h); } catch (err) { cache = null; }
  var found = null; attRows_().forEach(function (r) { if (r.code === code) found = r; });
  if (cache) { try { cache.put(k, found ? JSON.stringify(found) : '0', 5); } catch (err) { /* cache only */ } }
  return found;
}

function attColumn_(label) { // the Attendance header: the date; a second session on the same day reads "03/11/2026 #2"
  var m = /^(.*) #(\d+)$/.exec(String(label || '').trim());
  return m ? (Number(m[2]) > 1 ? m[1] + ' #' + m[2] : m[1]) : String(label || '').trim();
}

function attPresent_(label) { // {id: true} for one session, from the log
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ATT_LOG_TAB), got = {};
  if (!sh || sh.getLastRow() < 2) return got;
  sh.getRange(2, 1, sh.getLastRow() - 1, 3).getValues().forEach(function (r) { if (String(r[1]) === label) got[normId_(r[2])] = true; });
  return got;
}

function attStatus_() { // the open session if there is one, else the latest, with live counts
  var rows = attRows_(), cur = null;
  rows.forEach(function (r) { if (r.status === 'Open') cur = r; });
  if (!cur && rows.length) cur = rows[rows.length - 1];
  if (!cur) return { ok: true, session: null };
  var present = attPresent_(cur.label), roster = {}; rosterRows_().forEach(function (r) { roster[r[0]] = 1; });
  var on = 0, off = 0; Object.keys(present).forEach(function (id) { if (roster[id]) on++; else off++; });
  return { ok: true, session: { code: cur.code, label: attColumn_(cur.label), status: cur.status, present: on, notOnList: off, rosterSize: Object.keys(roster).length } };
}

function attOpen_(p) {
  var rows = attRows_(), open = null; rows.forEach(function (r) { if (r.status === 'Open') open = r; });
  if (open) return { ok: false, why: 'a session is already open: close it first', session: { code: open.code, label: open.label } };
  if (!rosterRows_().length) return { ok: false, why: 'the Roster tab is empty: run roster_sync.sh to add the Student IDs first' };
  // A fresh random code for every session, never one used before (by any earlier session or by a quiz).
  var used = function (c) { return !!keyRow_(c) || rows.some(function (r) { return r.code === c; }); };
  var code = String(p.acode || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
  if (code && (code.length < 3 || used(code))) return { ok: false, why: 'that code is too short or was used before' };
  for (var t = 0; !code && t < 200; t++) { var c = String(1000 + Math.floor(Math.random() * 9000)); if (!used(c)) code = c; }
  for (var t2 = 0; !code && t2 < 200; t2++) { var c2 = String(10000 + Math.floor(Math.random() * 90000)); if (!used(c2)) code = c2; }
  if (!code) return { ok: false, why: 'could not find a free code' };
  // The session key is "dd/MM/yyyy #n": the "#n" keeps the sheet from turning it into a date, and n counts sessions on the same day.
  var base = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd/MM/yyyy'), n = 1;
  rows.forEach(function (r) { if (r.label.indexOf(base + ' #') === 0) n++; });
  var label = base + ' #' + n;
  attSheet_().appendRow([code, label, 'Open', new Date().toISOString(), '']);
  try { CacheService.getScriptCache().remove('att:' + code); } catch (err) { /* cache only */ }
  log_('attendance:open', label, '', code);
  return { ok: true, session: { code: code, label: attColumn_(label), status: 'Open', present: 0, notOnList: 0 } };
}

function attClose_() {
  var rows = attRows_(), cur = null; rows.forEach(function (r) { if (r.status === 'Open') cur = r; });
  if (!cur) return { ok: false, why: 'no attendance session is open' };
  var present = attPresent_(cur.label), roster = rosterRows_(), col = attColumn_(cur.label), ss = SpreadsheetApp.getActiveSpreadsheet();
  var as = ss.getSheetByName(ATT_TAB) || ss.insertSheet(ATT_TAB);
  if (as.getLastRow() === 0) { as.getRange(1, 1).setValue('Student ID'); as.setFrozenRows(1); as.setFrozenColumns(1); }
  var head = as.getRange(1, 1, 1, Math.max(1, as.getLastColumn())).getValues()[0].map(function (h) { return String(h).trim(); });
  if (head[1] === 'Name' && as.getLastRow() > 1 && as.getRange(2, 2, as.getLastRow() - 1, 1).getValues().every(function (r) { return !String(r[0]).trim(); })) { // an older tab with an empty Name column
    as.deleteColumn(2); head = as.getRange(1, 1, 1, Math.max(1, as.getLastColumn())).getValues()[0].map(function (h) { return String(h).trim(); });
  }
  var ci = head.indexOf(col) + 1; if (ci < 2) { ci = Math.max(2, head.length + 1); as.getRange(1, ci).setNumberFormat('@').setValue(col); }
  var have = {}, n = as.getLastRow();
  if (n > 1) as.getRange(2, 1, n - 1, 1).getValues().forEach(function (r, i) { have[normId_(r[0])] = i + 2; });
  var add = []; roster.forEach(function (r) { if (!have[r[0]]) { have[r[0]] = 1; add.push([r[0]]); } });
  if (add.length) { var a0 = as.getLastRow() + 1; as.getRange(a0, 1, add.length, 1).setNumberFormat('@'); as.getRange(a0, 1, add.length, 1).setValues(add); }
  n = as.getLastRow();
  var ids = n > 1 ? as.getRange(2, 1, n - 1, 1).getValues() : [], vals = ids.map(function (r) { return [present[normId_(r[0])] ? 1 : 0]; });
  if (vals.length) as.getRange(2, ci, vals.length, 1).setValues(vals); // every student in the list gets a 1 or a 0
  var onList = {}; roster.forEach(function (r) { onList[r[0]] = 1; });
  var offIds = Object.keys(present).filter(function (id) { return !onList[id]; }), nl = ss.getSheetByName(NOTLIST_TAB);
  if (offIds.length) {
    if (!nl) { nl = ss.insertSheet(NOTLIST_TAB); nl.appendRow(['Timestamp', 'Session', 'Student ID']); nl.setFrozenRows(1); }
    var seen = {}; if (nl.getLastRow() > 1) nl.getRange(2, 2, nl.getLastRow() - 1, 2).getValues().forEach(function (r) { seen[String(r[0]) + '|' + normId_(r[1])] = true; });
    var rowsNl = offIds.filter(function (id) { return !seen[col + '|' + id]; }).map(function (id) { return [new Date(), col, id]; });
    if (rowsNl.length) { var r0 = nl.getLastRow() + 1; nl.getRange(r0, 2, rowsNl.length, 2).setNumberFormat('@'); nl.getRange(r0, 1, rowsNl.length, 3).setValues(rowsNl).setBackground('#f4c7c3'); }
  }
  var sh = attSheet_(); sh.getRange(cur.row, 3).setValue('Closed'); sh.getRange(cur.row, 5).setValue(new Date().toISOString());
  try { CacheService.getScriptCache().remove('att:' + cur.code); } catch (err) { /* cache only */ }
  var pres = 0; roster.forEach(function (r) { if (present[r[0]]) pres++; });
  log_('attendance:close', col, '', cur.code);
  return { ok: true, session: { code: cur.code, label: col, status: 'Closed', present: pres, absent: roster.length - pres, notOnList: offIds.length, column: col } };
}

// ---------- POST: answers, joins, progress, reports, attempts ----------

function doPost(e) {
  var p = (e && e.parameter) || {};
  if (p.kind === 'roster_sync') return out_(JSON.stringify(rosterSync_(p)));
  if (p.kind === 'report' || p.kind === 'attempt') {
    var lk = LockService.getScriptLock();
    lk.waitLock(20000);
    try {
      if (p.kind === 'report') {
        var r = { time: new Date().toString(), page: clean_(p.page, 200), lecture: clean_(p.lecture, 80), qid: clean_(p.qid, 40),
          question: clean_(p.question, 500), answer: clean_(p.answer, 300), comment: clean_(p.comment, 1000) };
        var rs = append_('Reports', ['Timestamp', 'Lecture', 'Question id', 'Question', 'Answer shown', 'Comment', 'Page'],
          [new Date(), r.lecture, r.qid, r.question, r.answer, r.comment, r.page]);
        mailReport_(rs, r);
      } else {
        if (!clean_(p.id, 30)) return out_('missing');
        append_('Attempts', ['Timestamp', 'Student ID', 'Quiz', 'Attempt', 'Score', 'Total', 'Seconds', 'Wrong question ids'],
          [new Date(), clean_(p.id, 30), clean_(p.quiz, 80), clean_(p.attempt, 10), clean_(p.score, 10), clean_(p.total, 10), clean_(p.seconds, 10), clean_(p.wrong, 300)]);
        updateMaster_([{ id: clean_(p.id, 30), name: '', label: masterLabel_(clean_(p.quiz, 80)), score: Number(p.score) || 0, n: Number(p.total) || 0 }]);
      }
      return out_('ok');
    } finally {
      lk.releaseLock();
    }
  }
  var name = clean_(p.name, 40), id = clean_(p.id, 20), code = clean_(p.code, 30).toUpperCase();
  function fin_(o) { log_(o, name, id, code); return out_(o); }

  if (p.kind === 'answer') { // paced quiz: one answer to the question that is open right now
    var qn = Number(p.q), al = String(p.answer || '').trim().toUpperCase();
    var ca = ctl_(code);
    if (!name || !id || !keyRow_(code) || LETTERS.indexOf(al) < 0 || !(qn >= 1 && qn <= (ca ? quizN_(ca) : 5))) return fin_('bad answer');
    if (!ca || !paced_(ca)) return fin_('not paced');
    if (eff_(ca) !== 'running') return fin_('not open');
    if (Number(ca.v[11]) !== qn) return fin_('wrong question');
    if (Number(ca.v[13]) && Date.now() > Number(ca.v[13]) + GRACE_MS) return fin_('question closed');
    if (!allowLate_(ca) && !hasPresence_(code, id)) return fin_('not joined');
    append_(ANSWERS_TAB, ['Timestamp', 'ID', 'First Name', 'Join Code', 'Q', 'Answer', 'Round'], [new Date(), id, name, code, qn, al, Number(ca.v[16]) || 0]);
    return out_('ok');
  }
  if (p.kind === 'join' || p.kind === 'progress') { // lobby and live participation
    if (!name || !id || !keyRow_(code)) return out_('ok');
    var lj = LockService.getScriptLock();
    lj.waitLock(60000); // a whole class joining at once queues here
    try {
      var cj = ctl_(code), sj = cj ? eff_(cj) : 'running';
      if (cj && !allowLate_(cj) && (sj === 'running' || sj === 'paused') && !hasPresence_(code, id)) return out_('late');
      presence_(code, id, name, p.kind === 'progress' ? 'inprogress' : 'joined');
    } finally {
      lj.releaseLock();
    }
    return out_('ok');
  }

  if (!name || !id || !code) return fin_('missing');
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var key = keyRow_(code);
    if (!key) return fin_('bad code');
    var c = ctl_(code);
    if (c && paced_(c)) return fin_('use answers');
    if (c) { // lecturer-controlled: state and deadline are checked here, not in the browser
      var s = eff_(c), left = Number(c.v[3]) + GRACE_MS - Date.now();
      if (s === 'draft' || s === 'ready' || s === 'lobby') return fin_('not started');
      if (s === 'paused') return fin_('paused');
      if (s === 'released') return fin_('quiz closed');
      if (s === 'ended' && left < 0) return fin_('quiz closed');
      if (!allowLate_(c) && !hasPresence_(code, id)) return fin_('not joined');
    } else {
      var st = state_(key);
      if (st === 'waiting') return fin_('not started');
      if (st === 'stopped') return fin_('quiz closed');
    }

    var sh = responses_();
    var n = sh.getLastRow();
    var rnd = roundOf_(code);
    var ans = [];
    for (var q = 1; q <= 5; q++) {
      var a = String(p['q' + q] || '').trim().toUpperCase();
      ans.push(LETTERS.indexOf(a) >= 0 ? a : '');
    }
    var marks = mark_(lettersFor_(code, null), ans), score = marks.reduce(function (x, y) { return x + y; }, 0);
    if (n > 1) { // first attempt per ID and join code in this round only
      var seen = sh.getRange(2, 3, n - 1, 9).getValues();
      for (var j = 0; j < seen.length; j++) {
        if (String(seen[j][0]).trim() === id && String(seen[j][1]).trim().toUpperCase() === code && (Number(seen[j][8]) || 0) === rnd) {
          return fin_('duplicate');
        }
      }
    }
    if (n === 0) sh.appendRow(['Timestamp', 'First Name', 'ID', 'Join Code', 'Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'Score', 'Round', 'Questions', 'Answers', 'Week']);
    else if (!sh.getRange(1, 10).getValue()) sh.getRange(1, 10).setValue('Score');
    sh.appendRow(rowFor_(new Date(), name, id, code, ans, score, rnd, 5, ''));
    updateMaster_([{ id: id, name: name, label: 'Quiz ' + code, score: score, n: 5 }]);
    presence_(code, id, name, 'submitted');
    totalsSafe_();
    return fin_('ok');
  } finally {
    lock.releaseLock();
  }
}

// The explanation for question q of a live quiz: the Explanations tab if it has a row, else the practice bank
// (quizzes/lecture1.json, matched through apps_script/live_quizzes.json), so there is one source and nothing to paste.
function siteJson_(path) {
  var cache = CacheService.getScriptCache(), raw = cache.get('site:' + path);
  if (!raw) { raw = UrlFetchApp.fetch(SITE + path + '?t=' + Date.now(), { muteHttpExceptions: true }).getContentText(); if (raw.length < 95000) cache.put('site:' + path, raw, 300); }
  return JSON.parse(raw);
}

function plainText_(t) { return String(t || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim(); }

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
  return { q: q, correct: lettersFor_(code, c)[q - 1] || '', dist: dist, answered: n, mine: id && got[id] ? got[id].ans[q - 1] : '', explanation: expl, explanationError: err };
}

// ---------- GET (JSONP): status, own result, ranking, host and display data ----------

function ranking_(code, me) {
  var rsh = responses_(), list = [];
  if (rsh.getLastRow() > 1) {
    var rnd = roundOf_(code), data = rsh.getRange(2, 1, rsh.getLastRow() - 1, 14).getValues(); // Timestamp, First Name, ID, Join Code, Q1 to Q5, Score, Round, Questions, Answers, Week
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

function doGet(e) {
  var p = (e && e.parameter) || {};
  var code = clean_(p.code, 30).toUpperCase();

  if (p.action === 'status') {
    var stc = null; try { stc = CacheService.getScriptCache(); } catch (err) { stc = null; }
    var sthit = stc && code ? stc.get('st:' + code) : null; // a few seconds old at most; served without opening the spreadsheet
    if (sthit) {
      try {
        var so = JSON.parse(sthit), nw = Date.now(); so.serverNow = nw;
        if (so.state === 'running' && so.timed && so.endTime) so.remainingMs = Math.max(0, so.endTime - nw);
        return jsonp_(e, so);
      } catch (err) { /* recompute */ }
    }
    var c = ctl_(code);
    if (c) { var cs = ctlStatus_(c); cs.known = true; if (stc) { try { stc.put('st:' + code, JSON.stringify(cs), 3); } catch (err) { /* cache only */ } } return jsonp_(e, cs); }
    var k = keyRow_(code);
    if (k && weekFromCode_(code)) return jsonp_(e, { paced: true, timed: false, known: true, state: 'ready', allowLate: true });
    if (!k) { var ats = attByCode_(code); if (ats) return jsonp_(e, { attendance: true, known: true, state: ats.status.toLowerCase() }); }
    var v = k ? String(k[6]).trim().toLowerCase() : '';
    return jsonp_(e, { timed: false, known: !!k, hidden: v === 'hidden', closed: v === 'closed', state: k ? state_(k) : '' });
  }

  if (p.action === 'attend') { // a student checks in: the attendance code and the student ID
    var asn = attByCode_(code);
    if (!asn) return jsonp_(e, { ok: false, why: 'unknown' });
    if (asn.status !== 'Open') return jsonp_(e, { ok: false, why: 'closed' });
    var aid = normId_(p.id);
    if (aid.length < 4 || aid.length > 12) return jsonp_(e, { ok: false, why: 'bad id' });
    var onl = !!rosterSet_()[aid]; // the student is told only whether their own ID was found; nothing else about the roster
    append_(ATT_LOG_TAB, ['Timestamp', 'Session', 'Student ID', 'On roster'], [new Date(), asn.label, aid, onl ? 'Yes' : 'No']); // appendRow is atomic: no lock for 200 students at once
    return jsonp_(e, { ok: true, id: aid, onList: onl });
  }
  if (p.action === 'hostcheck') return jsonp_(e, { ok: hostOk_(p) }); // the lecturer menu: is this key right?
  if (p.action === 'attend_status' || p.action === 'attend_open' || p.action === 'attend_close') { // host only
    if (!hostOk_(p)) return jsonp_(e, { ok: false, why: 'host key not accepted' });
    if (p.action === 'attend_status') return jsonp_(e, attStatus_());
    var alk = LockService.getScriptLock(); alk.waitLock(20000);
    try { return jsonp_(e, p.action === 'attend_open' ? attOpen_(p) : attClose_()); } finally { alk.releaseLock(); }
  }

  if (p.action === 'questions') { // the quiz's question text (no answers), once it has started
    var cq = ctl_(code);
    if (!cq || (eff_(cq) === 'ready' || eff_(cq) === 'lobby' || eff_(cq) === 'draft')) return jsonp_(e, { questions: [] });
    var qcache = null, qck = 'qs:' + code + '|' + (Number(cq.v[16]) || 0) + '|' + qids_(cq).join(',') + '|' + (Number(cq.v[18]) || 0);
    try { qcache = CacheService.getScriptCache(); var qhit = qcache.get(qck); if (qhit) return jsonp_(e, { questions: JSON.parse(qhit) }); } catch (err) { /* compute below */ }
    try {
      var le = liveEntry_(code, cq), qs = [];
      if (le.inline) qs = le.inline.map(function (x) { return { stem: x.stem, opts: x.opts }; });
      else { var bk = bankList_(le.bank); qs = qids_(cq).map(function (qid) { for (var i = 0; i < bk.length; i++) if (bk[i].id === qid) return { stem: bk[i].q, opts: bk[i].options }; return { stem: '(question missing)', opts: [] }; }); }
      if (qcache) { try { qcache.put(qck, JSON.stringify(qs), 120); } catch (err) { /* cache only */ } } // 200 students ask at the same moment
      return jsonp_(e, { questions: qs });
    } catch (err) { return jsonp_(e, { questions: [], error: String(err).slice(0, 160) }); }
  }

  if (p.action === 'review') return jsonp_(e, reviewData_(code, clean_(p.id, 20)));

  if (p.action === 'ranking') { // live class ranking for one join code: first names and scores only
    var rk = keyRow_(code), me = clean_(p.id, 20), cr = ctl_(code);
    if (!rk) return jsonp_(e, { hidden: false, rows: [] });
    if (cr) {
      if (!visible_(cr, 'show_leaderboard')) return jsonp_(e, { hidden: true, waitRelease: true, rows: [] });
      return jsonp_(e, { hidden: false, closed: eff_(cr) === 'released', rows: ranking_(code, me) });
    }
    if (String(rk[6]).trim().toLowerCase() === 'hidden') return jsonp_(e, { hidden: true, rows: [] });
    return jsonp_(e, { hidden: false, closed: String(rk[6]).trim().toLowerCase() === 'closed', rows: ranking_(code, me) });
  }

  if (p.action === 'setkey') { // host only; current key required
    if (!hostOk_(p)) return jsonp_(e, { ok: false, why: 'current key not accepted' });
    var lk2 = LockService.getScriptLock();
    lk2.waitLock(20000);
    try { return jsonp_(e, setHostKey_(p)); } finally { lk2.releaseLock(); }
  }

  if (p.action === 'control') { // host only
    if (!hostOk_(p)) return jsonp_(e, { ok: false, why: 'host key not accepted' });
    var lc = LockService.getScriptLock();
    lc.waitLock(20000);
    try {
      var want = String(p.state || '').toLowerCase();
      if (want && !p.act) { // older host page: legacy state in Key column H
        if (['waiting', 'started', 'stopped'].indexOf(want) < 0) return jsonp_(e, { ok: false });
        var ks2 = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(KEY_TAB);
        var codes = ks2.getRange(2, 1, ks2.getLastRow() - 1, 1).getValues();
        for (var cc = 0; cc < codes.length; cc++) {
          if (String(codes[cc][0]).trim().toUpperCase() === code) {
            ks2.getRange(cc + 2, 8).setValue(want.charAt(0).toUpperCase() + want.slice(1));
            return jsonp_(e, { ok: true, state: want });
          }
        }
        return jsonp_(e, { ok: false });
      }
      return jsonp_(e, ctlAct_(p, code));
    } finally {
      lc.releaseLock();
    }
  }

  if (p.action === 'host') { // host only: control state, participation, ranking
    var hk = keyRow_(code);
    if (!hostOk_(p) || !hk) return jsonp_(e, { ok: false });
    var ch = ctl_(code);
    if (!ch && weekFromCode_(code)) { ctlAct_({ act: 'init' }, code); ch = ctl_(code); }
    var cn = counts_(code), rows2 = ranking_(code, '');
    var out = { ok: true, review: ch ? reviewData_(code, '') : { q: 0 }, controlled: !!ch, joined: cn.joined, inprogress: cn.inprogress, submitted: cn.submitted, notYet: cn.notYet, rows: rows2 };
    if (ch && paced_(ch) && Number(ch.v[11]) > 0) { var ac = answerCounts_(code, Number(ch.v[11])); out.answered = ac.answered; out.dist = ac.dist; }
    if (ch) { out.status = ctlStatus_(ch); out.state = out.status.state; var wks = {}; try { wks = siteJson_('/apps_script/live_quizzes.json').weeks || {}; } catch (er) { /* no list */ }
    var le2 = null; try { le2 = liveEntry_(code, ch); } catch (er) { /* offline */ }
    out.weeks = wks; out.weekLocked = !!weekFromCode_(code); out.week = weekFromCode_(code) || weekOf_(ch); out.maxN = maxN_(code, ch); out.fixed = !!(le2 && le2.inline); out.settings = { n: quizN_(ch), duration: Number(ch.v[2]), allowLate: ch.v[5], showScore: ch.v[6], showBoard: ch.v[7] }; }
    else out.state = state_(hk);
    return jsonp_(e, out);
  }

  if (p.action === 'display') { // projector: no host key; counts, state, countdown, and results only once released
    var cd = ctl_(code);
    if (!keyRow_(code)) return jsonp_(e, { ok: false });
    var dn = counts_(code), dr = { ok: true, controlled: !!cd, joined: dn.joined, inprogress: dn.inprogress, submitted: dn.submitted, rows: [] };
    if (cd) { dr.review = reviewData_(code, ''); dr.status = ctlStatus_(cd); if (visible_(cd, 'show_leaderboard')) dr.rows = ranking_(code, '').slice(0, 20); }
    return jsonp_(e, dr);
  }

  if (p.action === 'result') {
    var id = clean_(p.id, 20), key = keyRow_(code), cx = ctl_(code);
    var sh = responses_();
    if (key && id && sh && sh.getLastRow() > 1) {
      var rnd2 = roundOf_(code), rows = sh.getRange(2, 3, sh.getLastRow() - 1, 12).getValues(); // ID, Join Code, Q1 to Q5, Score, Round, Questions, Answers, Week
      for (var i = 0; i < rows.length; i++) {
        if (String(rows[i][0]).trim() === id && String(rows[i][1]).trim().toUpperCase() === code && (Number(rows[i][8]) || 0) === rnd2) {
          if (cx && !visible_(cx, 'show_score')) return jsonp_(e, { found: true, scoreHidden: true, outcome: lastOutcome_(id, code) });
          var flags = mark_(lettersFor_(code, cx), parseAnswers_(rows[i]));
          return jsonp_(e, { found: true, score: flags.reduce(function (x, y) { return x + y; }, 0), total: flags.length, flags: flags, outcome: lastOutcome_(id, code) });
        }
      }
    }
    return jsonp_(e, { found: false, outcome: lastOutcome_(id, code), keyMissing: !key });
  }
  return out_('PHYS 143 quiz receiver is running');
}
