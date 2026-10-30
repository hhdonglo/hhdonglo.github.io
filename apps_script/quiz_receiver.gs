// PHYS 143 quiz receiver. Bound to the "PHYS 143 Quizzes (Responses)" Sheet.
//
// Tabs: Form Responses 1 (Timestamp, First Name, ID, Join Code, Q1 to Q5, Score), Key (private), Quiz_Control (private),
//       Presence, Log, Reports, Attempts.
// Key: Join Code | Q1 to Q5 (correct letters) | Ranking (Hidden hides it) | State (legacy: Waiting, Started, Stopped) ... J2 = host key.
// Quiz_Control (one row per lecturer-controlled quiz, written by the host dashboard; the server is the authority):
//   join_code | status | duration_min | end_time_ms | remaining_ms | allow_late_join | show_score | show_leaderboard | message | title | updated
//   (student records are never deleted: each quiz run is a round; the ranking, first-attempt rule and results use the current round)
//   + current_q | q_seconds (0 = no question timer) | q_deadline_ms | q_remaining_ms | mode (paced or timed) | round (a new round archives the old responses) | review_q (0 = off; 1 to 5 = the lecturer is going over that question)
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
  return !!hk && String(p.hostkey || '').trim() === hk;
}

function keyRow_(code) {
  var ks = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(KEY_TAB);
  if (!ks || ks.getLastRow() < 2) return null;
  var rows = ks.getRange(2, 1, ks.getLastRow() - 1, 8).getValues();
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i][0]).trim().toUpperCase() === code) return rows[i];
  }
  return null;
}

function mark_(key, row) { // row = [Q1..Q5]; returns [1,0,...] without revealing the key
  var out = [];
  for (var q = 0; q < 5; q++) {
    var k = String(key[1 + q]).trim().toUpperCase();
    out.push(k && String(row[q]).trim().toUpperCase() === k ? 1 : 0);
  }
  return out;
}

// The responses tab: by name, else the first tab whose header row starts Timestamp, First Name; else created.
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
  sh.appendRow(['Timestamp', 'First Name', 'ID', 'Join Code', 'Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'Score', 'Round']);
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
  controlSheet_();
  var xs = ss.getSheetByName(EXPL_TAB) || ss.insertSheet(EXPL_TAB);
  if (xs.getLastRow() === 0) xs.appendRow(['Join Code', 'Question', 'Explanation']);
  var rs = responses_();
  if (!rs.getRange(1, 10).getValue()) rs.getRange(1, 10).setValue('Score');
  rs.getRange(1, 11).setValue('Round');
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

var CTL_HEADER = ['join_code', 'status', 'duration_min', 'end_time_ms', 'remaining_ms', 'allow_late_join', 'show_score', 'show_leaderboard', 'message', 'title', 'updated', 'current_q', 'q_seconds', 'q_deadline_ms', 'q_remaining_ms', 'mode', 'round', 'review_q'];

function controlSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(CONTROL_TAB) || ss.insertSheet(CONTROL_TAB);
  if (sh.getLastRow() === 0) sh.appendRow(CTL_HEADER);
  return sh;
}

// Returns {sh, row, v} for a code, or null when the quiz has no control row (older behaviour).
function ctl_(code) {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONTROL_TAB);
  if (!sh || sh.getLastRow() < 2) return null;
  var rows = sh.getRange(2, 1, sh.getLastRow() - 1, CTL_HEADER.length).getValues();
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i][0]).trim().toUpperCase() === code) return { sh: sh, row: i + 2, v: rows[i] };
  }
  return null;
}

function ctlSave_(c) {
  c.v[10] = new Date().toISOString();
  c.sh.getRange(c.row, 1, 1, CTL_HEADER.length).setValues([c.v]);
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
  if (paced_(c)) { o.currentQ = Number(c.v[11]) || 0; o.totalQ = 5; o.qSeconds = Number(c.v[12]) || 0; o.qDeadline = Number(c.v[13]) || 0; }
  return o;
}

// Host-only changes. Every change is written to the audit log.
function ctlAct_(p, code) {
  var key = keyRow_(code);
  if (!key) return { ok: false, why: 'no such code' };
  var act = String(p.act || '').toLowerCase(), c = ctl_(code), now = Date.now();
  if (act === 'init') {
    if (c) return { ok: true, status: ctlStatus_(c) };
    var sh = controlSheet_();
    sh.appendRow([code, 'Ready', 10, 0, 10 * 60000, 'Yes', 'OnRelease', 'OnRelease', '', '', new Date().toISOString(), 0, 60, 0, 0, 'paced', 0, 0]);
    log_('control:init', 'host', '', code);
    return { ok: true, status: ctlStatus_(ctl_(code)) };
  }
  if (!c) return { ok: false, why: 'not lecturer-controlled yet' };
  var s = eff_(c), dur = (Number(c.v[2]) || 10) * 60000, min = Math.max(0, Math.min(60, Number(p.min) || 0)) * 60000, detail = '';
  var pc = paced_(c), qms = (Number(c.v[12]) || 0) * 1000;
  if (act === 'ready' || act === 'draft') { c.v[1] = act === 'ready' ? 'Ready' : 'Draft'; c.v[3] = 0; c.v[4] = dur; c.v[11] = 0; c.v[13] = 0; c.v[14] = 0; }
  else if (act === 'lobby') { c.v[1] = 'Lobby'; c.v[3] = 0; c.v[4] = dur; c.v[11] = 0; c.v[13] = 0; c.v[14] = 0; }
  else if (act === 'start') {
    if (['ready', 'lobby', 'draft'].indexOf(s) < 0) return { ok: false, why: 'can only start from Ready or Lobby (now ' + s + ')' };
    c.v[1] = 'Running'; c.v[3] = now + dur; c.v[4] = dur;
    if (pc) { c.v[11] = 1; c.v[13] = qms ? now + qms : 0; detail = 'question 1'; }
  }
  else if (act === 'next') { // paced only: move the whole class on
    if (!pc || s !== 'running') return { ok: false, why: 'start the quiz first' };
    if ((Number(c.v[11]) || 0) >= 5) { finalize_(code); c.v[1] = 'Ended'; detail = 'after question 5'; }
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
    c.v[17] = Math.max(1, Math.min(5, Number(c.v[17]) + (act === 'reviewnext' ? 1 : -1))); detail = 'question ' + c.v[17];
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
  var cc = ctl_(code), round = cc ? Number(cc.v[16]) || 0 : 0;
  var rows = sh.getRange(2, 2, sh.getLastRow() - 1, 6).getValues(); // ID, First Name, Join Code, Q, Answer, Round
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i][2]).trim().toUpperCase() !== code || (Number(rows[i][5]) || 0) !== round) continue;
    var id = String(rows[i][0]).trim(), q = Number(rows[i][3]);
    if (!out[id]) out[id] = { name: String(rows[i][1]), ans: ['', '', '', '', ''] };
    if (q >= 1 && q <= 5) out[id].ans[q - 1] = String(rows[i][4]);
  }
  return out;
}

function finalize_(code) {
  var key = keyRow_(code), got = latestAnswers_(code);
  if (!key) return;
  var sh = responses_(), n = sh.getLastRow(), have = {};
  if (n === 0) { sh.appendRow(['Timestamp', 'First Name', 'ID', 'Join Code', 'Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'Score', 'Round']); n = 1; }
  else if (!sh.getRange(1, 10).getValue()) sh.getRange(1, 10).setValue('Score');
  var rnd = roundOf_(code);
  if (n > 1) {
    var seen = sh.getRange(2, 3, n - 1, 9).getValues(); // ID, Join Code, ..., Round
    for (var j = 0; j < seen.length; j++) if (String(seen[j][1]).trim().toUpperCase() === code && (Number(seen[j][8]) || 0) === rnd) have[String(seen[j][0]).trim()] = j + 2;
  }
  Object.keys(got).forEach(function (id) {
    var a = got[id], score = mark_(key, a.ans).reduce(function (x, y) { return x + y; }, 0);
    if (have[id]) sh.getRange(have[id], 5, 1, 6).setValues([a.ans.concat([score])]); // a reopened quiz is compiled again
    else sh.appendRow([new Date(), a.name, id, code].concat(a.ans, [score, rnd]));
    presence_(code, id, a.name, 'submitted');
  });
}

function answerCounts_(code, q) { // how many have answered question q, and the spread of A to E
  var got = latestAnswers_(code), dist = { A: 0, B: 0, C: 0, D: 0, E: 0 }, n = 0;
  Object.keys(got).forEach(function (id) {
    var a = got[id].ans[q - 1];
    if (a) { n++; if (dist[a] !== undefined) dist[a]++; }
  });
  return { answered: n, dist: dist };
}

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

// ---------- POST: answers, joins, progress, reports, attempts ----------

function doPost(e) {
  var p = (e && e.parameter) || {};
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
    if (!name || !id || !keyRow_(code) || LETTERS.indexOf(al) < 0 || !(qn >= 1 && qn <= 5)) return fin_('bad answer');
    var ca = ctl_(code);
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
    lj.waitLock(20000);
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
    if (n > 1) { // first attempt per ID and join code in this round only
      var seen = sh.getRange(2, 3, n - 1, 9).getValues();
      for (var j = 0; j < seen.length; j++) {
        if (String(seen[j][0]).trim() === id && String(seen[j][1]).trim().toUpperCase() === code && (Number(seen[j][8]) || 0) === rnd) return fin_('duplicate');
      }
    }
    var ans = [];
    for (var q = 1; q <= 5; q++) {
      var a = String(p['q' + q] || '').trim().toUpperCase();
      ans.push(LETTERS.indexOf(a) >= 0 ? a : '');
    }
    var score = mark_(key, ans).reduce(function (x, y) { return x + y; }, 0);
    if (n === 0) sh.appendRow(['Timestamp', 'First Name', 'ID', 'Join Code', 'Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'Score', 'Round']);
    else if (!sh.getRange(1, 10).getValue()) sh.getRange(1, 10).setValue('Score');
    sh.appendRow([new Date(), name, id, code].concat(ans, [score, rnd]));
    presence_(code, id, name, 'submitted');
    return fin_('ok');
  } finally {
    lock.releaseLock();
  }
}

// The explanation for question q of a live quiz: the Explanations tab if it has a row, else the practice bank
// (quizzes/lecture1.json, matched through apps_script/live_quizzes.json), so there is one source and nothing to paste.
function siteJson_(path) {
  var cache = CacheService.getScriptCache(), raw = cache.get('site:' + path);
  if (!raw) { raw = UrlFetchApp.fetch(SITE + path + '?t=' + Date.now(), { muteHttpExceptions: true }).getContentText(); cache.put('site:' + path, raw.slice(0, 90000), 300); }
  return JSON.parse(raw);
}

function plainText_(t) { return String(t || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim(); }

function bankExplanation_(code, q) {
  try {
    var map = siteJson_('/apps_script/live_quizzes.json')[code];
    if (!map || !map.ids || !map.ids[q - 1]) return '';
    var bank = siteJson_('/quizzes/' + map.bank + '.json').questions;
    for (var i = 0; i < bank.length; i++) {
      if (bank[i].id === map.ids[q - 1]) return plainText_(bank[i].exp) + (bank[i].ref ? ' Review: ' + plainText_(bank[i].ref) : '');
    }
  } catch (err) { /* no explanation is better than an error in front of the class */ }
  return '';
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
  if (!expl) expl = bankExplanation_(code, q);
  return { q: q, correct: String(key[q]).trim().toUpperCase(), dist: dist, answered: n, mine: id && got[id] ? got[id].ans[q - 1] : '', explanation: expl };
}

// ---------- GET (JSONP): status, own result, ranking, host and display data ----------

function ranking_(code, me) {
  var rsh = responses_(), list = [];
  if (rsh.getLastRow() > 1) {
    var rnd = roundOf_(code), data = rsh.getRange(2, 1, rsh.getLastRow() - 1, 11).getValues(); // Timestamp, First Name, ID, Join Code, Q1 to Q5, Score, Round
    for (var r = 0; r < data.length; r++) {
      if (String(data[r][3]).trim().toUpperCase() === code && data[r][9] !== '' && (Number(data[r][10]) || 0) === rnd) {
        list.push({ name: String(data[r][1]), score: Number(data[r][9]), me: !!me && String(data[r][2]).trim() === me });
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
    var c = ctl_(code);
    if (c) return jsonp_(e, ctlStatus_(c));
    var k = keyRow_(code);
    var v = k ? String(k[6]).trim().toLowerCase() : '';
    return jsonp_(e, { timed: false, hidden: v === 'hidden', closed: v === 'closed', state: k ? state_(k) : '' });
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
    var ch = ctl_(code), cn = counts_(code), rows2 = ranking_(code, '');
    var out = { ok: true, controlled: !!ch, joined: cn.joined, inprogress: cn.inprogress, submitted: cn.submitted, notYet: cn.notYet, rows: rows2 };
    if (ch && paced_(ch) && Number(ch.v[11]) > 0) { var ac = answerCounts_(code, Number(ch.v[11])); out.answered = ac.answered; out.dist = ac.dist; }
    if (ch) { out.status = ctlStatus_(ch); out.state = out.status.state; out.settings = { duration: Number(ch.v[2]), allowLate: ch.v[5], showScore: ch.v[6], showBoard: ch.v[7] }; }
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
      var rnd2 = roundOf_(code), rows = sh.getRange(2, 3, sh.getLastRow() - 1, 9).getValues(); // ID, Join Code, Q1 to Q5, Score, Round
      for (var i = 0; i < rows.length; i++) {
        if (String(rows[i][0]).trim() === id && String(rows[i][1]).trim().toUpperCase() === code && (Number(rows[i][8]) || 0) === rnd2) {
          if (cx && !visible_(cx, 'show_score')) return jsonp_(e, { found: true, scoreHidden: true, outcome: lastOutcome_(id, code) });
          var flags = mark_(key, rows[i].slice(2, 7));
          return jsonp_(e, { found: true, score: flags.reduce(function (x, y) { return x + y; }, 0), total: 5, flags: flags, outcome: lastOutcome_(id, code) });
        }
      }
    }
    return jsonp_(e, { found: false, outcome: lastOutcome_(id, code), keyMissing: !key });
  }
  return out_('PHYS 143 quiz receiver is running');
}
