// GENERATED FILE: do not edit. Built by apps_script/build.js from apps_script/src/ (00-core.gs, 05-auth.gs, 06-password.gs, 10-assessment.gs, 20-attendance.gs, 30-analytics.gs, 40-collaboration.gs, 50-communication.gs, 60-portal.gs, 90-router.gs).
// To deploy in Google Apps Script, paste this whole file into the script editor.

// ===== 00-core.gs =====
// Module core. Core: configuration, shared helpers, the host key, personal access codes, the class list, setup and the sheet menu.
// Edit the files in apps_script/src/; apps_script/quiz_receiver.gs is built from them (node apps_script/build.js).

// Class Manager quiz receiver. Bound to the course's results Sheet.
//
// Tabs: Form Responses 1 (Timestamp, First Name, ID, Join Code, Q1 to Q5, Score), Key (private), Quiz_Control (private),
//       Presence, Log, Reports, Attempts, Roster, Attendance_Control, Attendance_Log, Attendance, Not_On_List (attendance check-in, see the Attendance section), Scores (clean grid: Student ID, Total, then one column per quiz, IDs only), Master (one row per student, one column per quiz; a new try replaces that cell; switch Key!L2 = On or Off).
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
// HELD UNTIL RELEASED: nothing a student sends reaches Form Responses 1, Master, Scores, Totals or Attendance until the lecturer says so.
//   Quiz results wait in the private Staged_Quiz tab; Release results (or "Release held quiz results" in the Control Centre) copies them into
//   Form Responses 1 and updates Master, Scores and Totals; Discard clears them. Practice tries wait in the Attempts log and join Master/Scores at release
//   (only IDs on the Roster). Attendance check-ins wait in Attendance_Log; Close stops the session, Submit attendance writes the Attendance grid, Discard drops the session.

var RESPONSES_TAB = 'Form Responses 1';
var KEY_TAB = 'Key';
var CONTROL_TAB = 'Quiz_Control';
var PRESENCE_TAB = 'Presence';
var ANSWERS_TAB = 'Answers';
var STAGED_TAB = 'Staged_Quiz'; // private: results held until released
var RESP_HEADER = ['Timestamp', 'First Name', 'ID', 'Join Code', 'Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'Score', 'Round', 'Questions', 'Answers', 'Week'];
var TOTALS_TAB = 'Totals'; // private: one row per student ID, rebuilt automatically
var EXPL_TAB = 'Explanations'; // optional override: join code | question number | explanation. Normally empty.
var SITE = ''; // CONFIG: the web address this package is served from, without a final slash. The script reads quizzes/ and apps_script/live_quizzes.json from here. // explanations come from the practice bank listed in apps_script/live_quizzes.json
var LETTERS = ['A', 'B', 'C', 'D', 'E'];
var NOTIFY_EMAIL = ''; // CONFIG (optional): where new reports are emailed. Left empty, they go to the Google account that deployed the script.

function notifyTo_() {
  if (NOTIFY_EMAIL) return NOTIFY_EMAIL;
  try { return Session.getEffectiveUser().getEmail() || ''; } catch (err) { return ''; }
}
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
  var row = sh.getLastRow(), status, to = notifyTo_();
  if (!to) return; // no address: the report is saved in the tab only
  try {
    var where = 'tab "' + sh.getName() + '", row ' + row; // no sheet link in the email, so a forwarded or quoted copy never carries it
    MailApp.sendEmail(to, 'Class Manager report: ' + r.lecture + ', ' + r.qid,
      'A student reported a problem.\n\nTime: ' + r.time + '\nPage: ' + r.page + '\nLecture: ' + r.lecture + '\nQuestion id: ' + r.qid +
      '\nQuestion: ' + r.question + '\nAnswer shown: ' + r.answer + '\n\nComment:\n' + r.comment + '\n\nWhere to find it: ' + where + ' (open your Sheet from Google Drive).');
    status = 'email sent';
  } catch (err) {
    status = 'email failed: ' + String(err).slice(0, 200); // the row is already saved; show why the email failed
  }
  sh.getRange(1, 8).setValue('Email');
  sh.getRange(row, 8).setValue(status);
}

// Run this once from the editor (choose testEmail, press Run) to grant the email permission and check delivery.
function testEmail() {
  MailApp.sendEmail(notifyTo_(), 'Class Manager test email', 'If you can read this, report emails will reach you. Remaining daily quota: ' + MailApp.getRemainingDailyQuota());
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

function hashKey_(salt, key) {
  var d = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, salt + ':' + key, Utilities.Charset.UTF_8);
  return d.map(function (b) { return ('0' + (b & 0xff).toString(16)).slice(-2); }).join('');
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

// Run once from the editor: makes sure the Key, Quiz_Control, responses and Log tabs exist and tells you what it found.
function setup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var ks = ss.getSheetByName(KEY_TAB) || ss.insertSheet(KEY_TAB);
  if (ks.getLastRow() === 0) ks.appendRow(['Join Code', 'Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'Ranking']);
  ks.getRange(1, 8).setValue('State');
  ks.getRange(1, 10).setValue('Host key');
  if (!String(ks.getRange(2, 10).getValue()).trim()) ks.getRange(2, 10).setValue(Utilities.getUuid().replace(/-/g, '').slice(0, 16)); // 16 hex characters from a random UUID
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
  if (REQ_.session && obj && typeof obj === 'object' && !Array.isArray(obj) && obj.ok !== false) obj._session = REQ_.session; // a key or code was sent: the session to keep instead
  var body = JSON.stringify(obj);
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(cb)) return ContentService.createTextOutput(body).setMimeType(ContentService.MimeType.JSON);
  return ContentService.createTextOutput(cb + '(' + body + ')').setMimeType(ContentService.MimeType.JAVASCRIPT);
}

function out_(t) { return ContentService.createTextOutput(t); }

function onOpen() { // a Class Manager menu in the sheet
  try { SpreadsheetApp.getUi().createMenu('Class Manager').addItem('Refresh totals', 'refreshTotals').addItem('Release held quiz results', 'releaseHeldQuiz').addItem('Discard held quiz results', 'discardHeldQuiz').addItem('Submit attendance', 'submitAttendance').addItem('Named attendance view', 'buildNamedAttendance').addItem('Tidy to class list', 'tidyToClassList').addItem('Discard unsubmitted attendance', 'discardAttendance').addToUi(); } catch (err) { /* not opened from the sheet */ }
}

function totalsSafe_() { try { refreshTotals(); } catch (err) { log_('totals failed', String(err).slice(0, 150), '', ''); } }

function normId_(s) { return String(s == null ? '' : s).replace(/\D/g, ''); }

function cleanName_(s) { // a name for the lecturer's private view: trimmed, at most 80 characters, no control characters
  return ' ' + String(s == null ? '' : s).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);
}

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

// Roster sync (used by attendance_tools/roster_sync.sh): adds the uploaded Student IDs (and names, when sent) to the Roster tab: ID in column A, name in
// column B. Students need only their ID to check in; names are for the lecturer's private view only and are never returned to any page, reply or email.
// Nothing from the Roster is ever returned. By default nothing is deleted (IDs missing from the upload are only counted).
// Class section: the Roster must hold only the lecturer's own section. Upload the section's own export (for example COURSE_GROUP_E.csv) with
// replace=yes and mode=apply: the Roster then becomes exactly that list (other IDs are removed from the Roster only; Attendance, Scores and Master rows are left alone).
// kind=roster_sync, hostkey, mode=dry|apply, replace=yes (optional), rows = JSON list of [Student ID, name] pairs (or plain IDs).
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
    if (!up[id]) { up[id] = Array.isArray(r) ? cleanName_(r[1]) : ' '; order.push(id); } // ' ' = no name sent
  });
  if (!order.length) return { ok: false, why: 'no valid student IDs in the list' };
  var apply = String(p.mode || '') === 'apply', lk = LockService.getScriptLock();
  lk.waitLock(30000);
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet(), sh = ss.getSheetByName(ROSTER_TAB) || ss.insertSheet(ROSTER_TAB);
    if (sh.getLastRow() === 0) sh.getRange(1, 1, 1, 2).setValues([['Student ID', 'Name']]);
    var have = {}, nameAt = {};
    sh.getRange(1, 1, sh.getLastRow(), 2).getValues().forEach(function (r, i) { var id = normId_(r[0]); if (id.length >= 4) { have[id] = 1; if (!String(r[1] || '').trim()) nameAt[id] = i + 1; } });
    var added = order.filter(function (id) { return !have[id]; }).map(function (id) { return [id, up[id].trim()]; });
    var named = 0; Object.keys(nameAt).forEach(function (id) { if (up[id] && up[id].trim()) named++; }); // existing rows with no name that the upload can fill
    var missing = Object.keys(have).filter(function (id) { return !up[id]; }).length;
    var replace = String(p.replace || '') === 'yes', removed = 0;
    if (replace && apply && missing) { // keep the header and the rows whose ID is in the upload (names in column B, if any, stay with their row)
      var all = sh.getRange(1, 1, sh.getLastRow(), Math.max(2, sh.getLastColumn())).getValues(), keep = [];
      all.forEach(function (r, i) { var id = normId_(r[0]); if (i === 0 && id.length < 4) keep.push(r); else if (id.length >= 4 && up[id]) keep.push(r); else removed++; });
      sh.getRange(1, 1, all.length, all[0].length).clearContent();
      if (keep.length) { sh.getRange(1, 1, keep.length, 1).setNumberFormat('@'); sh.getRange(1, 1, keep.length, keep[0].length).setValues(keep); }
    }
    if (apply && added.length) {
      var r0 = sh.getLastRow() + 1;
      sh.getRange(r0, 1, added.length, 2).setNumberFormat('@');
      sh.getRange(r0, 1, added.length, 2).setValues(added);
    }
    if (apply && named) { // fill blank names of IDs already on the Roster; a name that is already there is never overwritten
      if (!String(sh.getRange(1, 2).getValue()).trim()) sh.getRange(1, 2).setValue('Name');
      Object.keys(nameAt).forEach(function (id) { if (up[id] && up[id].trim()) sh.getRange(nameAt[id], 2).setNumberFormat('@').setValue(up[id].trim()); });
    }
    if (apply) { try { CacheService.getScriptCache().remove('roster'); } catch (err) { /* cache only */ } log_('roster:sync', added.length + ' added', '', ''); }
    return { ok: true, mode: apply ? 'apply' : 'dry', replace: replace, added: added.length, namesFilled: named, unchanged: order.length - added.length, missing: missing, removed: replace ? (apply ? removed : missing) : 0, skipped: bad, total: order.length };
  } finally { lk.releaseLock(); }
}

// Tidy to class list (host action roster_tidy, or Class Manager > Tidy to class list): after the Roster was replaced with one section, the Attendance, Scores and Master
// tabs still list every earlier ID. This removes the rows of IDs that are NOT on the Roster, but only rows with no marks at all: Attendance rows with no 1,
// Scores and Master rows with every quiz cell blank. A row with any real mark stays. mode=dry only counts. Nothing is returned except counts.
function tidyTab_(sh, firstRow, markFrom, isMark, onRoster, apply) {
  var out = { rows: 0, kept: 0 };
  if (!sh || sh.getLastRow() < firstRow) return out;
  var n = sh.getLastRow() - firstRow + 1, w = Math.max(markFrom + 1, sh.getLastColumn());
  var vals = sh.getRange(firstRow, 1, n, w).getValues(), del = [];
  vals.forEach(function (r, i) {
    var id = normId_(r[0]);
    if (id.length < 4 || onRoster[id]) return;
    var marked = false; for (var j = markFrom; j < r.length; j++) if (isMark(r[j])) { marked = true; break; }
    if (marked) out.kept++; else del.push(firstRow + i);
  });
  out.rows = del.length;
  if (apply && del.length) { // delete runs of rows from the bottom up, so formatting of the other rows is untouched
    var runs = [], start = del[0], prev = del[0];
    for (var k = 1; k < del.length; k++) { if (del[k] === prev + 1) { prev = del[k]; continue; } runs.push([start, prev]); start = prev = del[k]; }
    runs.push([start, prev]);
    for (var m = runs.length - 1; m >= 0; m--) sh.deleteRows(runs[m][0], runs[m][1] - runs[m][0] + 1);
  }
  return out;
}

function rosterTidy_(p) {
  var apply = String(p.mode || '') === 'apply', roster = rosterSet_();
  if (!Object.keys(roster).length) return { ok: false, why: 'the Roster is empty, so nothing is tidied' };
  var lk = LockService.getScriptLock(); lk.waitLock(30000);
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var nonZero = function (v) { return v !== '' && v !== 0 && String(v).trim() !== '0'; }, nonBlank = function (v) { return String(v).trim() !== ''; };
    var a = tidyTab_(ss.getSheetByName(ATT_TAB), 2, 1, nonZero, roster, apply);
    var s = tidyTab_(ss.getSheetByName(SCORES_TAB), 4, 4, nonBlank, roster, apply);
    var m = tidyTab_(ss.getSheetByName(MASTER_TAB), 2, 3, nonBlank, roster, apply);
    if (apply) log_('roster:tidy', (a.rows + s.rows + m.rows) + ' rows', '', '');
    return { ok: true, mode: apply ? 'apply' : 'dry', attendance: a.rows, scores: s.rows, master: m.rows, keptWithMarks: a.kept + s.kept + m.kept, rosterSize: Object.keys(roster).length };
  } finally { lk.releaseLock(); }
}

function tidyToClassList() { // sheet menu: shows the counts first and asks
  var ui = SpreadsheetApp.getUi(), d = rosterTidy_({ mode: 'dry' });
  if (!d.ok) { ui.alert(d.why); return; }
  if (ui.alert('Remove rows of IDs not on the class list?', 'Attendance ' + d.attendance + ', Scores ' + d.scores + ', Master ' + d.master + ' row(s) with no marks will be deleted. ' + d.keptWithMarks + ' row(s) with marks stay. This cannot be undone.', ui.ButtonSet.YES_NO) !== ui.Button.YES) return;
  var r = rosterTidy_({ mode: 'apply' });
  ui.alert(r.ok ? 'Done. Removed Attendance ' + r.attendance + ', Scores ' + r.scores + ', Master ' + r.master + ' row(s).' : r.why);
}

// Roster edit (host only, from the Control Centre): add, remove or check ONE Student ID without the Mac. Only a yes/no and the roster size come back, never an ID list.
// Removing an ID takes it off the Roster only (a leaver): the Attendance, Scores and Master rows it already has are kept, and future sessions no longer count it.
function rosterEdit_(p) {
  var id = normId_(p.id), op = String(p.op || '');
  if (id.length < 4 || id.length > 12) return { ok: false, why: 'a Student ID has 4 to 12 digits' };
  if (op !== 'add' && op !== 'remove' && op !== 'check') return { ok: false, why: 'unknown operation' };
  var lk = LockService.getScriptLock(); lk.waitLock(30000);
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet(), sh = ss.getSheetByName(ROSTER_TAB) || ss.insertSheet(ROSTER_TAB);
    if (sh.getLastRow() === 0) sh.getRange(1, 1).setValue('Student ID');
    var col = sh.getRange(1, 1, sh.getLastRow(), 1).getValues(), at = -1, n = 0;
    col.forEach(function (r, i) { var x = normId_(r[0]); if (x.length >= 4) { n++; if (x === id && at < 0) at = i + 1; } });
    if (op === 'check') return { ok: true, onRoster: at > 0, rosterSize: n };
    if (op === 'add') {
      if (at > 0) return { ok: true, changed: false, rosterSize: n };
      var r0 = sh.getLastRow() + 1; sh.getRange(r0, 1, 1, 2).setNumberFormat('@').setValues([[id, cleanName_(p.name).trim()]]);
      n++;
    } else {
      if (at < 0) return { ok: true, changed: false, rosterSize: n };
      sh.deleteRow(at); n--;
    }
    try { CacheService.getScriptCache().remove('roster'); } catch (err) { /* cache only */ }
    log_('roster:' + op, '1', '', '');
    return { ok: true, changed: true, rosterSize: n };
  } finally { lk.releaseLock(); }
}

// The explanation for question q of a live quiz: the Explanations tab if it has a row, else the practice bank
// (quizzes/lecture1.json, matched through apps_script/live_quizzes.json), so there is one source and nothing to paste.
function siteJson_(path) {
  var cache = CacheService.getScriptCache(), raw = cache.get('site:' + path);
  if (!raw) { raw = UrlFetchApp.fetch(SITE + path + '?t=' + Date.now(), { muteHttpExceptions: true }).getContentText(); if (raw.length < 95000) cache.put('site:' + path, raw, 300); }
  return JSON.parse(raw);
}

function plainText_(t) { return String(t || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim(); }

function sheetWith_(name, header) {
  var ss = SpreadsheetApp.getActiveSpreadsheet(), sh = ss.getSheetByName(name);
  if (!sh) { sh = ss.insertSheet(name); sh.appendRow(header); sh.setFrozenRows(1); }
  else if (sh.getLastRow() === 0) sh.appendRow(header);
  return sh;
}
function bodyRows_(sh, nc) { var n = sh ? sh.getLastRow() : 0; return n > 1 ? sh.getRange(2, 1, n - 1, nc).getValues() : []; }
function rewriteBody_(sh, nc, rows) {
  var n = sh.getLastRow();
  if (n > 1) sh.getRange(2, 1, n - 1, nc).clearContent();
  if (rows.length) sh.getRange(2, 1, rows.length, nc).setValues(rows);
}
function splitIds_(s) { return String(s || '').split(/[\s,]+/).map(function (x) { return x.replace(/^'/, '').trim(); }).filter(String); }
function pct_(a, b) { return b ? Math.round(1000 * a / b) / 10 : null; }

function newAccessCode_() {
  var h = (Utilities.getUuid() + Utilities.getUuid()).replace(/[^0-9a-f]/gi, ''), s = '';
  for (var i = 0; i < 8; i++) s += CODE_ALPHA.charAt(parseInt(h.substr(i * 3, 3), 16) % CODE_ALPHA.length);
  return s.slice(0, 4) + '-' + s.slice(4);
}
function codesMap_() {
  var out = {}, sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CODES_TAB);
  bodyRows_(sh, 3).forEach(function (r) { var id = normId_(r[0]), c = normCode_(r[1]); if (id && c) out[id] = { code: c, issued: r[2] }; });
  return out;
}
// Host only. op = list (default), generate (a code for every rostered ID that has none), reset (a new code for one ID).
function accessCodes_(p) {
  var op = String(p.op || 'list').toLowerCase(), sh = sheetWith_(CODES_TAB, ['Student ID', 'Access code', 'Issued']);
  var map = codesMap_(), roster = rosterRows_(), made = 0, now = new Date();
  if (op === 'generate') {
    var add = [];
    roster.forEach(function (r) { var id = normId_(r[0]); if (id && !map[id]) { map[id] = { code: newAccessCode_(), issued: now }; add.push([id, map[id].code, now]); made++; } });
    if (add.length) sh.getRange(sh.getLastRow() + 1, 1, add.length, 3).setNumberFormat('@').setValues(add);
    if (made) log_('access codes created', String(made), '', '');
  } else if (op === 'expiry') { // days a code stays valid after it is issued; 0 = no expiry
    var dd = Math.max(0, Math.min(3650, Math.round(Number(p.days) || 0)));
    PropertiesService.getScriptProperties().setProperty('code_days', String(dd));
    log_('access codes expiry', String(dd) + ' days', '', '');
  } else if (op === 'renew') { // new codes for every student whose code has expired
    var keep = [];
    bodyRows_(sh, 3).forEach(function (r) { var id0 = normId_(r[0]); if (codeExpired_(map[id0])) { map[id0] = { code: newAccessCode_(), issued: now }; made++; keep.push([id0, map[id0].code, now]); } else keep.push(r); });
    if (made) { rewriteBody_(sh, 3, keep); log_('access codes renewed', String(made), '', ''); }
  } else if (op === 'reset') {
    var rid = normId_(p.id);
    if (!rid || !rosterSet_()[rid]) return { ok: false, why: 'not on list' };
    map[rid] = { code: newAccessCode_(), issued: now };
    var rows = bodyRows_(sh, 3).filter(function (r) { return normId_(r[0]) !== rid; });
    rows.push([rid, map[rid].code, now]);
    rewriteBody_(sh, 3, rows);
    log_('access code replaced', '', rid, '');
    made = 1;
  }
  var list = roster.map(function (r) { var id = normId_(r[0]); return { id: id, name: cleanName_(r[1]), code: map[id] ? map[id].code : '', expired: codeExpired_(map[id]) }; }).filter(function (x) { return x.id; });
  return { ok: true, made: made, rows: list, missing: list.filter(function (x) { return !x.code; }).length, days: codeDays_(), expired: list.filter(function (x) { return x.expired; }).length };
}

function fmtDay_(t) { return t ? Utilities.formatDate(new Date(t), Session.getScriptTimeZone(), 'dd/MM/yyyy') : ''; }
function safeLink_(s) { var t = String(s || '').trim().slice(0, 300); return /^https?:\/\/[^\s<>"']+$/i.test(t) ? t : ''; }

// Students: their groups' assignments, submit the group's work, record their own part, rate their group-mates (seen by the lecturer only).
function studentAuth_(p) { return studentCheck_(p.id, p.access, 'r'); }

// ===== 05-auth.gs =====
// Module auth. Credentials and sessions.
// Edit the files in apps_script/src/; apps_script/quiz_receiver.gs is built from them (node apps_script/build.js).
//
// - Credentials never travel in a web address. A request that carries the host key, an access code or a session is
//   accepted only by POST (the pages send every request by POST through CM.call in config.js). A GET that carries one is refused.
// - The host key or an access code is sent once. When it is right, the answer carries "_session": a signed session that
//   expires (SESSION_HOST_HOURS for the lecturer, SESSION_STUDENT_DAYS for a student). The pages keep the session, not the key.
// - A session is an HMAC-SHA256 signature over (role, subject, expiry, binding) with a secret kept in the script properties.
//   The binding is the stored host key for the lecturer and the student's current access code for a student, so changing
//   the host key or replacing a student's code ends every session made with the old one. "Sign everyone out" replaces the secret.
// - Access codes can expire (a number of days set on the Access codes page; 0 = they do not expire), and failed student
//   sign-ins are limited per ID (ATT_MAX_FAILS in ten minutes) and across the whole class (SIGNIN_GLOBAL_MAX in ten minutes).
// - A live quiz result is shown only with the receipt the student's phone received when it joined or submitted.

var SESSION_HOST_HOURS = 8, SESSION_STUDENT_DAYS = 14, SIGNIN_GLOBAL_MAX = 200;
var REQ_ = { post: false, session: '' }; // set by the router for each request

function reqStart_(post) { REQ_ = { post: !!post, session: '' }; }

function hex_(bytes) { return bytes.map(function (b) { return ('0' + (b & 0xff).toString(16)).slice(-2); }).join(''); }
function sessSecret_() {
  var pr = PropertiesService.getScriptProperties(), s = pr.getProperty('sess_secret');
  if (!s) { s = Utilities.getUuid() + Utilities.getUuid(); pr.setProperty('sess_secret', s); }
  return s;
}
function sessSign_(role, subj, exp, bind) { return hex_(Utilities.computeHmacSha256Signature(role + '|' + subj + '|' + exp + '|' + bind, sessSecret_())).slice(0, 40); }
function sessMake_(role, subj, bind, ms) { var exp = (Date.now() + ms).toString(36); return 's1.' + role + '.' + subj + '.' + exp + '.' + sessSign_(role, subj, exp, bind); }
function isSession_(s) { return /^s1\./.test(String(s || '')); }
function sessRead_(tok) { // {role, subj, exp, sig} or {expired: true} or null
  var m = /^s1\.([hs])\.([0-9A-Za-z]{1,20})\.([0-9a-z]{1,12})\.([0-9a-f]{40})$/.exec(String(tok || '').trim());
  if (!m) return null;
  if (parseInt(m[3], 36) < Date.now()) return { expired: true };
  return { role: m[1], subj: m[2], exp: m[3], sig: m[4] };
}
function sessValid_(t, bind) { return !!(t && !t.expired && bind && sessSign_(t.role, t.subj, t.exp, bind) === t.sig); }
function signOutEveryone_() { PropertiesService.getScriptProperties().setProperty('sess_secret', Utilities.getUuid() + Utilities.getUuid()); log_('sessions ended', 'all', '', ''); return { ok: true }; }

function hostStored_() {
  var ks = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(KEY_TAB);
  return ks ? String(ks.getRange(2, 10).getValue()).trim() : '';
}
// The lecturer: a session made from the host key, or the host key itself (by POST only, and then a session is returned).
function hostOk_(p) {
  var hk = hostStored_();
  if (!hk || !REQ_.post) return false;
  var given = String(p.hostkey || '').trim();
  if (isSession_(given)) { var t = sessRead_(given); return !!(t && t.role === 'h' && t.subj === 'host' && sessValid_(t, hk)); }
  var cache = CacheService.getScriptCache();
  var fails = Number(cache.get('hostfails') || 0);
  if (fails >= HOST_MAX_FAILS) return false; // locked for 10 minutes after HOST_MAX_FAILS wrong passwords (06-password.gs)
  var ok = pwCheck_(hk, given); // 06-password.gs: slow hash, or the temporary key of a new Sheet
  if (!ok) cache.put('hostfails', String(fails + 1), 600);
  else REQ_.session = sessMake_('h', 'host', hk, SESSION_HOST_HOURS * 3600000);
  return ok;
}

// ---- Access codes: expiry and sign-in limits ----
function codeDays_() { return Math.max(0, Number(PropertiesService.getScriptProperties().getProperty('code_days')) || 0); }
function codeExpired_(mine) {
  var days = codeDays_(); if (!days || !mine || !mine.issued) return false;
  var t = new Date(mine.issued).getTime();
  return !isNaN(t) && Date.now() - t > days * 86400000;
}
function signinPaused_() { try { return Number(CacheService.getScriptCache().get('signin_fails') || 0) >= SIGNIN_GLOBAL_MAX; } catch (err) { return false; } }
function signinFail_() { try { var c = CacheService.getScriptCache(); c.put('signin_fails', String(Number(c.get('signin_fails') || 0) + 1), 600); } catch (err) { /* cache only */ } }

// A student: their Student ID with a session or their personal access code. Returns {id} or {why}.
// tag keeps a separate failure count per page ('r' results and group work, 'c' messages).
function studentCheck_(rawId, given, tag) {
  var id = normId_(rawId); given = String(given || '').trim();
  if (id.length < 4 || id.length > 12) return { why: 'bad id' };
  if (!REQ_.post) return { why: 'not recognised' };
  if (attFails_(tag + id) >= ATT_MAX_FAILS) return { why: 'slow down' };
  var mine = rosterSet_()[id] ? codesMap_()[id] : null;
  if (isSession_(given)) {
    var t = sessRead_(given);
    if (t && t.expired) return { why: 'session expired' };
    if (t && t.role === 's' && t.subj === id && mine && sessValid_(t, mine.code)) return { id: id };
    attFailAdd_(tag + id); return { why: 'not recognised' };
  }
  if (signinPaused_()) return { why: 'slow down' };
  var code = normCode_(given);
  if (!mine || !code || mine.code !== code) { attFailAdd_(tag + id); signinFail_(); return { why: 'not recognised' }; }
  if (codeExpired_(mine)) return { why: 'code expired' };
  REQ_.session = sessMake_('s', id, mine.code, SESSION_STUDENT_DAYS * 86400000);
  return { id: id };
}

// ---- Live quiz receipts: a student sees their own result only from the phone that took part ----
function quizReceipt_(code, id) { return hex_(Utilities.computeHmacSha256Signature('q|' + String(code).toUpperCase() + '|' + id, sessSecret_())).slice(0, 24); }
function receiptOk_(code, id, rc) { return !!id && !!rc && quizReceipt_(code, id) === String(rc).trim(); }

// ===== 06-password.gs =====
// Module password. The lecturer's own password: choose it, change it, recover it.
// Edit the files in apps_script/src/; apps_script/quiz_receiver.gs is built from them (node apps_script/build.js).
//
// - The password is kept in Key!J2 only as a salted, deliberately slow hash: "pw1:<rounds>:<salt>:<hash>". Never as text.
//   (A new Sheet or app starts with a temporary key in plain text; it counts as "not yet chosen" until the lecturer sets a password.)
// - A recovery code is made whenever a password is set or changed. It is shown once and kept only as a hash in the script
//   property "pw_recovery". With the code, the lecturer chooses a new password without the old one.
// - If both are lost, the Sheet owner runs resetHostKey() from the script editor (or the desktop app's "Reset" button).
// - Wrong passwords: HOST_MAX_FAILS in ten minutes locks sign-in for the rest of that time. Wrong recovery codes:
//   RECOVERY_MAX_FAILS in an hour.

var PW_ROUNDS = 4000, HOST_MAX_FAILS = 10, RECOVERY_MAX_FAILS = 5, PW_MIN = 10, PW_MAX = 100;

// Slow hash: a chain of HMAC-SHA256 rounds, each keyed by the password, XOR-folded (the PBKDF2 pattern, on text so it runs
// both in Google Apps Script and in the desktop app). The number of rounds is stored with the hash and can be raised later.
function pwHash_(secret, salt, rounds) {
  var u = salt + '|1', acc = null;
  for (var i = 0; i < rounds; i++) {
    var sig = Utilities.computeHmacSha256Signature(u, secret);
    acc = acc ? acc.map(function (b, j) { return (b ^ sig[j]) & 0xff; }) : sig.map(function (b) { return b & 0xff; });
    u = hex_(sig);
  }
  return hex_(acc);
}
function pwMake_(secret) {
  var salt = Utilities.getUuid();
  return 'pw1:' + PW_ROUNDS + ':' + salt + ':' + pwHash_(secret, salt, PW_ROUNDS);
}
function sameText_(a, b) { // no early exit, so timing does not reveal how much matched
  a = String(a); b = String(b);
  var d = a.length ^ b.length;
  for (var i = 0; i < Math.min(a.length, b.length); i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}
function pwCheck_(stored, given) { // stored is a pw1 hash, a legacy "sha256:salt:hash", or (new Sheet) the temporary plain key
  stored = String(stored || ''); given = String(given || '');
  if (!stored || !given) return false;
  var parts = stored.split(':');
  if (parts[0] === 'pw1' && parts.length === 4) return sameText_(pwHash_(given, parts[2], Number(parts[1])), parts[3]);
  if (parts[0] === 'sha256' && parts.length === 3) return sameText_(hashKey_(parts[1], given), parts[2]);
  return sameText_(stored, given);
}
function pwChosen_(stored) { return /^(pw1|sha256):/.test(String(stored || '')); }

function pwProblem_(pw, current) { // why this password is refused, or ''
  if (pw !== pw.trim()) return 'The password must not start or end with a space.';
  if (pw.length < PW_MIN || pw.length > PW_MAX) return 'The password must be ' + PW_MIN + ' to ' + PW_MAX + ' characters. A few words make a good one.';
  if (/^(.)\1+$/.test(pw)) return 'The password must not be one repeated character.';
  if (current && pw === current) return 'The new password must differ from the current one.';
  return '';
}

// Recovery code: 20 characters from an alphabet without look-alikes (about 100 bits), shown as XXXXX-XXXXX-XXXXX-XXXXX.
function recoveryNew_() {
  var A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', h = (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, ''), s = '';
  for (var i = 0; i < 20; i++) s += A.charAt(parseInt(h.substr(i * 2, 2), 16) % 32);
  return s;
}
function recoveryShow_(c) { return c.replace(/(.{5})(?=.)/g, '$1-'); }
function recoveryNorm_(t) { return String(t || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); }
function recoveryStore_() { return PropertiesService.getScriptProperties().getProperty('pw_recovery') || ''; }

function pwStore_(newPw) { // saves the password and a fresh recovery code; ends every sign-in made with the old password
  var ks = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(KEY_TAB);
  ks.getRange(2, 10).setNumberFormat('@').setValue(pwMake_(newPw));
  var code = recoveryNew_();
  PropertiesService.getScriptProperties().setProperty('pw_recovery', pwMake_(code));
  var c = CacheService.getScriptCache(); c.remove('hostfails'); c.remove('recfails');
  return recoveryShow_(code);
}

// Public: is a password chosen, and is there a recovery code? (Nothing secret.)
function passwordStatus_() {
  return { ok: true, chosen: pwChosen_(hostStored_()), recovery: !!recoveryStore_(), minLength: PW_MIN, maxLength: PW_MAX };
}

// Host only (current password or session needed, checked by the router): choose or change the password.
function setHostKey_(p) {
  var nk = String(p.newkey || ''), cur = String(p.hostkey || '').trim();
  var why = pwProblem_(nk, isSession_(cur) ? '' : cur);
  if (!why && pwCheck_(hostStored_(), nk)) why = 'The new password must differ from the current one.';
  if (why) return { ok: false, why: why };
  var code = pwStore_(nk);
  REQ_.session = '';
  log_('host password changed', '', '', '');
  return { ok: true, recovery: code };
}

// Public, rate limited: a new password with the recovery code instead of the old password.
function recoverHostKey_(p) {
  var cache = CacheService.getScriptCache(), fails = Number(cache.get('recfails') || 0);
  if (fails >= RECOVERY_MAX_FAILS) return { ok: false, why: 'Too many wrong recovery codes. Try again in an hour, or use the reset in the script editor.' };
  var stored = recoveryStore_(), given = recoveryNorm_(p.recovery), nk = String(p.newkey || '');
  if (!stored || !given || !pwCheck_(stored, given)) {
    cache.put('recfails', String(fails + 1), 3600);
    log_('recovery code refused', '', '', '');
    return { ok: false, why: 'That recovery code was not accepted.' };
  }
  var why = pwProblem_(nk, '');
  if (why) return { ok: false, why: why };
  var code = pwStore_(nk);
  log_('host password recovered', '', '', '');
  return { ok: true, recovery: code };
}

// Run by hand in the script editor by the Sheet's owner (or by the desktop app's Reset button): both password and
// recovery code lost. Makes a temporary key, removes the recovery code and ends every sign-in.
function resetHostKey() {
  var ks = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(KEY_TAB);
  var tmp = Utilities.getUuid().replace(/-/g, '').slice(0, 16);
  ks.getRange(2, 10).setNumberFormat('@').setValue(tmp);
  PropertiesService.getScriptProperties().deleteProperty('pw_recovery');
  signOutEveryone_();
  var c = CacheService.getScriptCache(); c.remove('hostfails'); c.remove('recfails');
  log_('host password reset', 'by the owner', '', '');
  var msg = 'Temporary key: ' + tmp + ' . Sign in with it, then choose your own password at once.';
  try { Logger.log(msg); } catch (err) { /* no log */ }
  return msg;
}

// Desktop app only (never in the router): the person at this computer chooses the password without the old one.
// The app's own screens are reachable from this computer only, so physical access is the proof, as for resetHostKey().
function ownerSetPassword_(pw) {
  pw = String(pw || '');
  var why = pwProblem_(pw, '');
  if (why) return { ok: false, why: why };
  var code = pwStore_(pw);
  signOutEveryone_();
  log_('host password set by the owner', '', '', '');
  return { ok: true, recovery: code };
}

// ===== 10-assessment.gs =====
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

// ===== 20-attendance.gs =====
// Module attendance. Attendance: sessions, the rotating QR check-in, device and location checks, review after class and the attendance grid.
// Edit the files in apps_script/src/; apps_script/quiz_receiver.gs is built from them (node apps_script/build.js).

function submitAttendance() { return attSubmit_(); }
function discardAttendance() { return attDiscard_(); }

// ---------- Attendance: a check-in code, the student enters an ID, 1 if present, 0 when the session is closed ----------
// Tabs (all private): Roster (Student IDs only, filled by attendance_tools/roster_sync.sh), Attendance_Control (one row per session:
// Code | Label | Status | Opened | Closed), Attendance_Log (every check-in), Attendance (one row per rostered student, one column per session,
// "Attendance Wk N [1]" = 1 present, 0 absent, the format a learning platform gradebook imports), Not_On_List (IDs that checked in but are not on the roster).
// The lecturer opens a session from the host page with a code to announce in class; students enter that code and their ID on the quiz page.
var ROSTER_TAB = 'Roster', ATT_CTL_TAB = 'Attendance_Control', ATT_LOG_TAB = 'Attendance_Log', ATT_TAB = 'Attendance', NOTLIST_TAB = 'Not_On_List';

// Named attendance view (lecturer only, from the sheet's Class Manager menu): writes a private tab Attendance_Named with Name, Student ID and a copy of every
// Attendance column, so the lecturer can see who was present. The Attendance tab itself stays IDs only (the format a gradebook imports). Run again to refresh.
function buildNamedAttendance() {
  var ss = SpreadsheetApp.getActiveSpreadsheet(), at = ss.getSheetByName(ATT_TAB), ui = SpreadsheetApp.getUi();
  if (!at || at.getLastRow() < 1) { ui.alert('The Attendance tab is empty. Submit attendance first.'); return; }
  var names = {}; rosterRows_().forEach(function (r) { names[r[0]] = r[1]; });
  var data = at.getRange(1, 1, at.getLastRow(), at.getLastColumn()).getDisplayValues();
  var out = data.map(function (r, i) { return [i === 0 ? 'Name' : (names[normId_(r[0])] || '')].concat(r); });
  var nv = ss.getSheetByName('Attendance_Named') || ss.insertSheet('Attendance_Named');
  nv.clear();
  nv.getRange(1, 1, out.length, out[0].length).setNumberFormat('@').setValues(out);
  nv.setFrozenRows(1); nv.setFrozenColumns(2);
  ui.alert('Attendance_Named is up to date (' + (out.length - 1) + ' students). It is private: never publish it.');
}

function attSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet(), sh = ss.getSheetByName(ATT_CTL_TAB);
  if (!sh) { sh = ss.insertSheet(ATT_CTL_TAB); sh.appendRow(['Code', 'Label', 'Status', 'Opened', 'Closed', 'Secret', 'Lat', 'Lon', 'Radius m']); }
  if (!String(sh.getRange(1, 6).getValue()).trim()) sh.getRange(1, 6).setValue('Secret'); // the per-session secret that makes the QR token change: keep this tab private
  return sh;
}

function attRows_() { // [{row, code, label, status}]
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ATT_CTL_TAB);
  if (!sh || sh.getLastRow() < 2) return [];
  return sh.getRange(2, 1, sh.getLastRow() - 1, 9).getValues().map(function (r, i) { return { row: i + 2, code: String(r[0]).trim().toUpperCase(), label: String(r[1]), status: String(r[2]).trim(), secret: String(r[5] || ''), lat: r[6] === '' ? null : Number(r[6]), lon: r[7] === '' ? null : Number(r[7]), radius: Number(r[8]) || 0 }; });
}

function attByCode_(code) { // the session with this code, or null; cached a few seconds (also caches "none", since every unknown code asks)
  if (!code) return null;
  var cache = null, k = 'att:' + code;
  try { cache = CacheService.getScriptCache(); var h = cache.get(k); if (h) return h === '0' ? null : JSON.parse(h); } catch (err) { cache = null; }
  var found = null; attRows_().forEach(function (r) { if (r.code === code) found = r; });
  if (cache) { try { cache.put(k, found ? JSON.stringify(found) : '0', 5); } catch (err) { /* cache only */ } }
  return found;
}

// ---------- Attendance hardening: a QR code that changes, location check, one device per ID, a rate limit, a Flags tab ----------
// There is no typed code. The projector shows a QR code whose link carries a token that changes every ATT_SLOT_SEC seconds (HMAC of the session secret
// and the clock); the check-in accepts this cycle's token and the ATT_LINK_GRACE_SLOTS before it (60 to 90 s), so a slow connection is forgiven, and a
// forwarded link goes stale. The second control is the location check (next block). Rejected attempts go to the Flags tab and never reach the log that
// counts presence. Device token: a random value the check-in page keeps in the phone's browser; one token may check in only one Student ID per session.
var ATT_FLAGS_TAB = 'Attendance_Flags', ATT_SLOT_SEC = 30, ATT_LINK_GRACE_SLOTS = 2, ATT_REQUIRE_LINK = true, ATT_DEVICE_IDS = 1, ATT_MAX_FAILS = 6;

function attSlot_(t) { return Math.floor((t || Date.now()) / (ATT_SLOT_SEC * 1000)); }

function attLinkFor_(secret, slot) { // the token in the QR link: eight hex characters from HMAC-SHA256(secret, 'qr:' + slot)
  var b = Utilities.computeHmacSha256Signature('qr:' + slot, secret), h = '';
  for (var i = 0; i < 4; i++) h += ('0' + (b[i] & 255).toString(16)).slice(-2);
  return h;
}

function attLinkOk_(ses, tok) { // this cycle's token or one of the ATT_LINK_GRACE_SLOTS before it
  if (!ses || !ses.secret || !tok) return false;
  var slot = attSlot_();
  for (var d = 0; d <= ATT_LINK_GRACE_SLOTS; d++) if (attLinkFor_(ses.secret, slot - d) === tok) return true;
  return false;
}

function attOpenSession_() { // the open session, cached a few seconds because every student asks at once
  var cache = null; try { cache = CacheService.getScriptCache(); var h = cache.get('att:open'); if (h) return h === '0' ? null : JSON.parse(h); } catch (err) { cache = null; }
  var cur = null; attRows_().forEach(function (r) { if (r.status === 'Open') cur = r; });
  if (cache) { try { cache.put('att:open', cur ? JSON.stringify(cur) : '0', 5); } catch (err) { /* cache only */ } }
  return cur;
}

// ---------- Attendance privacy ----------
// The phone's device token is never stored as sent: only a salted hash (16 hex characters) goes into the sheet, so the sheet cannot be used to follow a phone
// across sessions once the salt is deleted. The salt is a random value kept in the script's private properties.
function attDevHash_(dev) {
  var props = PropertiesService.getScriptProperties(), salt = props.getProperty('att_salt');
  if (!salt) { salt = Utilities.getUuid() + Utilities.getUuid(); props.setProperty('att_salt', salt); }
  var b = Utilities.computeHmacSha256Signature(String(dev), salt), h = '';
  for (var i = 0; i < 8; i++) h += ('0' + (b[i] & 255).toString(16)).slice(-2);
  return h;
}

// End-of-semester clean-up: run attPurgeSemester from the editor (choose it, press Run, answer Yes). It empties the Device column of Attendance_Log,
// deletes every row of Attendance_Flags, clears the classroom position and session secrets in Attendance_Control, and deletes the hash salt. The attendance
// marks (Attendance tab) and the Student ID and time rows of Attendance_Log are NOT touched: they are the course record.
function attPurgeSemester() {
  var ui = SpreadsheetApp.getUi();
  if (ui.alert('Delete device codes, registered phones, flags, classroom positions and session secrets?', 'Attendance marks are kept.', ui.ButtonSet.YES_NO) !== ui.Button.YES) return;
  var ss = SpreadsheetApp.getActiveSpreadsheet(), n = 0, lg = ss.getSheetByName(ATT_LOG_TAB), fl = ss.getSheetByName(ATT_FLAGS_TAB), ct = ss.getSheetByName(ATT_CTL_TAB);
  if (lg && lg.getLastRow() > 1 && lg.getLastColumn() >= 5) { lg.getRange(2, 5, lg.getLastRow() - 1, 1).clearContent(); n++; }
  if (fl && fl.getLastRow() > 1) { fl.deleteRows(2, fl.getLastRow() - 1); n++; }
  var phs = ss.getSheetByName(ATT_PHONES_TAB); if (phs && phs.getLastRow() > 1) { phs.deleteRows(2, phs.getLastRow() - 1); n++; }
  if (ct && ct.getLastRow() > 1) { ct.getRange(2, 6, ct.getLastRow() - 1, 4).clearContent(); n++; } // Secret, Lat, Lon, Radius m
  PropertiesService.getScriptProperties().deleteProperty('att_salt');
  try { CacheService.getScriptCache().removeAll(['att:open', 'roster']); } catch (err) { /* cache only */ }
  ui.alert('Done. Cleared ' + n + ' place(s) and the hash salt.');
}

// End-of-semester clean-up of student records that are not the course record: run clearSemesterRecords from the editor (answer Yes). It deletes every row
// (not the header) of Attendance_Log, Not_On_List, Reports, Attempts, Staged_Quiz, Item_Log, Question_Stats and Access_Codes (new codes are issued for the new class). The Attendance, Scores and Master tabs and the Roster are NOT touched:
// export what you need first. Replace the Roster at the start of the next term with a new section sync (replace=yes).
function clearSemesterRecords() {
  var ui = SpreadsheetApp.getUi();
  if (ui.alert('Delete all rows of Attendance_Log, Not_On_List, Reports, Attempts, Staged_Quiz, Item_Log, Question_Stats and Access_Codes?', 'Attendance, Scores, Master and Roster are kept. This cannot be undone.', ui.ButtonSet.YES_NO) !== ui.Button.YES) return;
  var ss = SpreadsheetApp.getActiveSpreadsheet(), n = 0;
  [ATT_LOG_TAB, NOTLIST_TAB, 'Reports', 'Attempts', STAGED_TAB, 'Item_Log', 'Question_Stats', 'Access_Codes'].forEach(function (name) {
    var sh = ss.getSheetByName(name);
    if (sh && sh.getLastRow() > 1) { sh.deleteRows(2, sh.getLastRow() - 1); n++; }
  });
  ui.alert('Done. Cleared ' + n + ' tab(s).');
}

function attFlag_(label, id, dev, why) {
  try { append_(ATT_FLAGS_TAB, ['Timestamp', 'Session', 'Student ID', 'Device', 'Reason'], [new Date(), label, id, String(dev || '').slice(0, 8), why]); } catch (err) { /* flags must never stop a check-in */ }
}

function attFails_(key) { try { return Number(CacheService.getScriptCache().get('attf:' + key) || 0); } catch (err) { return 0; } }
function attFailAdd_(key) { try { var c = CacheService.getScriptCache(); c.put('attf:' + key, String(Number(c.get('attf:' + key) || 0) + 1), 600); } catch (err) { /* cache only */ } }

function attDeviceIds_(label, dev) { // the IDs this device token has already checked in this session, from the log
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ATT_LOG_TAB), got = {};
  if (!sh || sh.getLastRow() < 2 || sh.getLastColumn() < 5) return got;
  sh.getRange(2, 2, sh.getLastRow() - 1, 4).getValues().forEach(function (r) { if (String(r[0]) === label && String(r[3]) === dev) got[normId_(r[1])] = true; });
  return got;
}

function attCheckIn_(p, code) { // the student side of the check-in: the QR token, the ID, the personal access code and the device token
  var ses = attOpenSession_();
  if (!ses) return { ok: false, why: 'closed' };
  var aid = normId_(p.id), dev = String(p.dev || '').replace(/[^A-Za-z0-9]/g, '').slice(0, 40);
  if (aid.length < 4 || aid.length > 12) return { ok: false, why: 'bad id' };
  if (dev.length < 16) return { ok: false, why: 'update page' }; // an old cached page without a device token: reload
  dev = attDevHash_(dev); // only the salted hash is ever stored
  if (attFails_('d' + dev) >= ATT_MAX_FAILS || attFails_('i' + aid) >= ATT_MAX_FAILS) return { ok: false, why: 'slow down' };
  if (ATT_REQUIRE_LINK && !attLinkOk_(ses, String(p.t || '').replace(/[^0-9a-f]/g, '').slice(0, 8))) { attFailAdd_('d' + dev); attFailAdd_('i' + aid); return { ok: false, why: 'old link' }; } // scan the live QR code again
  var onl = !!rosterSet_()[aid], day = attDayKey_(); // the student is told only whether their own ID was found; nothing else about the roster
  var phone = null;
  if (onl && ATT_REQUIRE_CODE) { // a classmate's ID is not enough: the personal access code must match too
    var mine = codesMap_()[aid];
    if (!mine) return { ok: false, why: 'no access code' };
    var given = String(p.code || '').trim(), st = isSession_(given) ? sessRead_(given) : null;
    var codeOk = st ? (st.role === 's' && st.subj === aid && sessValid_(st, mine.code)) : (REQ_.post && normCode_(given) === mine.code && !codeExpired_(mine));
    if (!codeOk) { attFailAdd_('d' + dev); attFailAdd_('i' + aid); attFlag_(ses.label, aid, dev, 'wrong access code (refused)'); return { ok: false, why: st && st.expired ? 'session expired' : 'not recognised' }; }
    if (!st) REQ_.session = sessMake_('s', aid, mine.code, SESSION_STUDENT_DAYS * 86400000);
  }
  if (attDayHas_(day, aid)) return { ok: true, id: aid, onList: onl, already: true }; // one mark per ID per day: nothing is added
  if (onl && ATT_PHONE_BIND) { // one phone per student for the term
    phone = attPhoneCheck_(aid, dev);
    if (phone.refuse || phone.changed) { // a borrowed or new phone (a flat battery, a broken phone): held for the lecturer to confirm, never counted on its own
      var geo0 = attGeo_(ses, p);
      if (geo0.state === 'far' || geo0.state === 'none') { if (ATT_GEO_MODE === 'enforce') return { ok: false, why: geo0.state === 'far' ? 'too far' : 'no location' }; }
      if (!attPendingHas_(ses.label, aid)) attFlag_(ses.label, aid, dev, ATT_PENDING + (phone.refuse ? 'used the phone registered to ' + phone.owner : 'used a phone other than the one registered'));
      return { ok: true, id: aid, onList: true, pending: true };
    }
  }
  var geo = attGeo_(ses, p);
  if (geo.state === 'far' || geo.state === 'none') {
    attFlag_(ses.label, aid, dev, 'location: ' + attGeoText_(geo) + (ATT_GEO_MODE === 'enforce' ? ' (refused)' : ' (accepted)'));
    if (ATT_GEO_MODE === 'enforce') return { ok: false, why: geo.state === 'far' ? 'too far' : 'no location' };
  }
  var others = attDeviceIds_(ses.label, dev), n = Object.keys(others).length;
  if (n >= ATT_DEVICE_IDS) { attFlag_(ses.label, aid, dev, 'device already used for ' + Object.keys(others).join(', ')); return { ok: false, why: 'device used' }; }
  append_(ATT_LOG_TAB, ['Timestamp', 'Session', 'Student ID', 'On roster', 'Device', 'Location'], [new Date(), ses.label, aid, onl ? 'Yes' : 'No', dev, attGeoText_(geo)]); // appendRow is atomic: no lock for 200 students at once
  attDayAdd_(day, aid);
  if (phone && phone.bind) attPhoneBind_(aid, dev);
  return { ok: true, id: aid, onList: onl };
}

// ---------- One phone per student for the term ----------
// The first accepted check-in registers the phone (its salted device hash) to the Student ID in Attendance_Phones. After that, a registered phone
// cannot check in any other student, and a check-in from a different phone is accepted but listed for review. A student with a new phone asks the
// lecturer, who presses "Reset phone" on the review list; the next check-in registers the new one. Rows are deleted by attPurgeSemester.
var ATT_PHONES_TAB = 'Attendance_Phones', ATT_REQUIRE_CODE = true, ATT_PHONE_BIND = true, ATT_PENDING = 'waiting for approval: ';
function attPendingHas_(label, id) {
  return bodyRows_(SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ATT_FLAGS_TAB), 5).some(function (r) { return String(r[1]) === label && normId_(r[2]) === id && String(r[4]).indexOf(ATT_PENDING) === 0; });
}
function attPhones_() { // {byId: {id: dev}, byDev: {dev: id}}
  var out = { byId: {}, byDev: {} };
  bodyRows_(SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ATT_PHONES_TAB), 2).forEach(function (r) { var id = normId_(r[0]), d = String(r[1] || ''); if (id && d) { out.byId[id] = d; out.byDev[d] = id; } });
  return out;
}
function attPhoneCheck_(id, dev) { // {refuse, owner} or {bind} or {changed} or {}
  var ph = attPhones_(), owner = ph.byDev[dev];
  if (owner && owner !== id) return { refuse: true, owner: owner };
  if (!ph.byId[id]) return { bind: true };
  return ph.byId[id] === dev ? {} : { changed: true };
}
function attPhoneBind_(id, dev) {
  try { append_(ATT_PHONES_TAB, ['Student ID', 'Device', 'Registered'], [id, dev, new Date()]); } catch (err) { /* the check-in is already recorded */ }
}
function attPhoneReset_(id) { // host only: forget a student's phone, so the next check-in registers the new one
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ATT_PHONES_TAB);
  if (!sh) return { ok: true, removed: 0 };
  var rows = bodyRows_(sh, 3), keep = rows.filter(function (r) { return normId_(r[0]) !== id; });
  if (keep.length !== rows.length) rewriteBody_(sh, 3, keep);
  log_('attendance:phone reset', '', id, '');
  return { ok: true, removed: rows.length - keep.length };
}

// ---------- Review after class: the flagged check-ins of one session, and what the lecturer can do about them ----------
function attReview_(p) { // the latest session (or p.label): its flags, each with whether the ID is still counted present
  var rows = attRows_(), cur = null;
  if (p.label) rows.forEach(function (r) { if (attColumn_(r.label) === String(p.label)) cur = r; });
  if (!cur) { rows.forEach(function (r) { if (r.status === 'Open') cur = r; }); if (!cur && rows.length) cur = rows[rows.length - 1]; }
  if (!cur) return { ok: true, session: null, items: [] };
  var present = attPresent_(cur.label), ph = attPhones_(), names = {}; rosterRows_().forEach(function (r) { names[r[0]] = r[1] || ''; });
  var fl = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ATT_FLAGS_TAB), items = [];
  bodyRows_(fl, 5).forEach(function (r) {
    if (String(r[1]) !== cur.label) return;
    var ids = splitIds_(r[2]).map(normId_).filter(String);
    items.push({ time: r[0] instanceof Date ? r[0].toISOString() : String(r[0]), ids: ids, names: ids.map(function (i) { return names[i] || ''; }), reason: String(r[4]), pending: String(r[4]).indexOf(ATT_PENDING) === 0, present: ids.filter(function (i) { return present[i]; }), phone: ids.filter(function (i) { return ph.byId[i]; }) });
  });
  return { ok: true, session: { label: attColumn_(cur.label), status: cur.status }, items: items, canRemove: cur.status === 'Open' || cur.status === 'Closed' };
}
function attRemove_(p) { // host only: take one check-in out of a session that is not yet submitted
  var id = normId_(p.id), rows = attRows_(), cur = null;
  rows.forEach(function (r) { if (attColumn_(r.label) === String(p.label || '')) cur = r; });
  if (!cur || !id) return { ok: false, why: 'session not found' };
  if (cur.status === 'Submitted') return { ok: false, why: 'this session is already submitted: change the mark in the Attendance tab' };
  var lg = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ATT_LOG_TAB), gone = 0;
  if (lg && lg.getLastRow() > 1) {
    var vals = lg.getRange(2, 2, lg.getLastRow() - 1, 2).getValues();
    for (var i = vals.length - 1; i >= 0; i--) if (String(vals[i][0]) === cur.label && normId_(vals[i][1]) === id) { lg.deleteRow(i + 2); gone++; }
  }
  try { CacheService.getScriptCache().remove('attd:' + attDayKey_()); } catch (err) { /* cache only */ }
  if (gone) { attFlag_(cur.label, id, '', 'check-in removed by the lecturer'); log_('attendance:remove', attColumn_(cur.label), id, ''); }
  return { ok: true, removed: gone };
}

function attFlagDevices_(label) { // at closing: devices that checked in more than one ID (catches two phones' taps that raced), added to the Flags tab
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ATT_LOG_TAB), by = {}, n = 0;
  if (!sh || sh.getLastRow() < 2 || sh.getLastColumn() < 5) return 0;
  sh.getRange(2, 2, sh.getLastRow() - 1, 4).getValues().forEach(function (r) { var d = String(r[3]); if (String(r[0]) === label && d) (by[d] = by[d] || []).push(normId_(r[1])); });
  Object.keys(by).forEach(function (d) { if (by[d].length > ATT_DEVICE_IDS) { n++; attFlag_(label, by[d].join(', '), d, 'one device, ' + by[d].length + ' IDs (check in the log)'); } });
  return n;
}

// ---------- Attendance location check (optional): is the phone near the classroom? ----------
// The host page sends the classroom position when a session starts (the browser asks the lecturer once). The check-in page sends the student's position;
// the script keeps only the distance in metres and ok/far/none, never the student's coordinates. The classroom position stays in the private
// Attendance_Control tab (columns G to I). ATT_GEO_MODE: 'off' = ignore location; 'flag' = accept everyone, record the result (log column F) and list far or
// missing ones in Attendance_Flags; 'enforce' (the default) = refuse a check-in that is too far or has no location (the lecturer marks those students by hand). The phone's reported accuracy is subtracted from
// the distance (at most ATT_GEO_ACC_CAP metres), so a weak indoor GPS fix is not punished.
var ATT_GEO_MODE = 'enforce', ATT_GEO_RADIUS_M = 500, ATT_GEO_ACC_CAP = 150;

function attMetres_(la1, lo1, la2, lo2) { // haversine distance in metres
  var R = 6371000, r = Math.PI / 180, dLa = (la2 - la1) * r, dLo = (lo2 - lo1) * r;
  var a = Math.sin(dLa / 2) * Math.sin(dLa / 2) + Math.cos(la1 * r) * Math.cos(la2 * r) * Math.sin(dLo / 2) * Math.sin(dLo / 2);
  return Math.round(2 * R * Math.asin(Math.min(1, Math.sqrt(a))));
}

function attGeo_(ses, p) { // {state: 'off' | 'ok' | 'far' | 'none', dist}
  if (ATT_GEO_MODE === 'off' || ses.lat == null || ses.lon == null || isNaN(ses.lat) || isNaN(ses.lon)) return { state: 'off', dist: 0 };
  var la = Number(p.lat), lo = Number(p.lon), acc = Math.max(0, Math.min(Number(p.acc) || 0, ATT_GEO_ACC_CAP));
  if (p.lat === undefined || p.lat === '' || isNaN(la) || isNaN(lo) || Math.abs(la) > 90 || Math.abs(lo) > 180) return { state: 'none', dist: 0 };
  var d = attMetres_(ses.lat, ses.lon, la, lo), rad = ses.radius || ATT_GEO_RADIUS_M;
  return { state: d - acc <= rad ? 'ok' : 'far', dist: d };
}

function attGeoText_(g) { return g.state === 'off' ? '' : (g.state === 'none' ? 'no location' : g.state + ' ' + g.dist + ' m'); }

function attColumn_(label) { // the Attendance header: the date; a second session on the same day reads "03/11/2026 #2"
  var m = /^(.*) #(\d+)$/.exec(String(label || '').trim());
  return m ? (Number(m[2]) > 1 ? m[1] + ' #' + m[2] : m[1]) : String(label || '').trim();
}

// One mark per Student ID per day: has this ID already checked in during any session today? Today's IDs are kept in the cache for speed;
// on a cache miss the log is read, so a lost cache entry never lets a repeat through.
function attDayKey_() { return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd/MM/yyyy'); }

function attDayHas_(day, id) {
  var cache = null, ck = 'attd:' + day;
  try { cache = CacheService.getScriptCache(); var h = cache.get(ck); if (h && ('|' + h + '|').indexOf('|' + id + '|') >= 0) return true; } catch (err) { cache = null; }
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ATT_LOG_TAB);
  if (!sh || sh.getLastRow() < 2) return false;
  var found = false;
  sh.getRange(2, 2, sh.getLastRow() - 1, 2).getValues().forEach(function (r) { if (String(r[0]).indexOf(day + ' #') === 0 && normId_(r[1]) === id) found = true; });
  if (found && cache) { try { var cur = cache.get(ck); cache.put(ck, (cur ? cur + '|' : '') + id, 43200); } catch (err) { /* cache only */ } }
  return found;
}

function attDayAdd_(day, id) {
  try { var cache = CacheService.getScriptCache(), ck = 'attd:' + day, cur = cache.get(ck); cache.put(ck, (cur ? cur + '|' : '') + id, 43200); } catch (err) { /* the log is the record */ }
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
  if (!cur) { var m0 = ATT_REQUIRE_CODE ? codesMap_() : {}; return { ok: true, session: null, noCode: ATT_REQUIRE_CODE ? rosterRows_().filter(function (r) { return !m0[r[0]]; }).length : 0 }; }
  var present = attPresent_(cur.label), roster = {}; rosterRows_().forEach(function (r) { roster[r[0]] = 1; });
  var on = 0, off = 0; Object.keys(present).forEach(function (id) { if (roster[id]) on++; else off++; });
  var waiting = {}; bodyRows_(SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ATT_FLAGS_TAB), 5).forEach(function (r) { var i = normId_(r[2]); if (String(r[1]) === cur.label && String(r[4]).indexOf(ATT_PENDING) === 0 && !present[i]) waiting[i] = 1; });
  var live = cur.status === 'Open' && cur.secret, now = Date.now(), slot = attSlot_(now);
  return { ok: true, session: { link: live ? attLinkFor_(cur.secret, slot) : '', secondsLeft: live ? Math.max(1, Math.ceil(((slot + 1) * ATT_SLOT_SEC * 1000 - now) / 1000)) : 0, label: attColumn_(cur.label), status: cur.status, geo: cur.lat != null && ATT_GEO_MODE !== 'off' ? ATT_GEO_MODE : 'off', radius: cur.lat != null ? (cur.radius || ATT_GEO_RADIUS_M) : 0, present: on, notOnList: off, waiting: Object.keys(waiting).length, noCode: ATT_REQUIRE_CODE && cur.status !== 'Open' ? (function () { var m = codesMap_(); return Object.keys(roster).filter(function (i) { return !m[i]; }).length; })() : 0, rosterSize: Object.keys(roster).length, pending: rows.filter(function (r) { return r.status === 'Closed'; }).length } };
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
  try { var lg = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ATT_LOG_TAB); if (lg && lg.getLastRow() > 0 && !String(lg.getRange(1, 5).getValue()).trim()) lg.getRange(1, 5).setValue('Device'); if (lg && lg.getLastRow() > 0 && !String(lg.getRange(1, 6).getValue()).trim()) lg.getRange(1, 6).setValue('Location'); } catch (err) { /* header only */ }
  var secret = Utilities.getUuid() + Utilities.getUuid();
  var hla = p.lat === undefined || p.lat === '' ? NaN : Number(p.lat), hlo = Number(p.lon), hasGeo = !isNaN(hla) && !isNaN(hlo) && Math.abs(hla) <= 90 && Math.abs(hlo) <= 180;
  if (ATT_GEO_MODE === 'enforce' && !hasGeo && String(p.nogeo || '') !== '1') return { ok: false, why: 'location needed', needLocation: true }; // never start an unprotected session by accident
  var rad = Math.max(50, Math.min(Number(p.radius) || ATT_GEO_RADIUS_M, 5000));
  attSheet_().appendRow([code, label, 'Open', new Date().toISOString(), '', secret, hasGeo ? hla : '', hasGeo ? hlo : '', hasGeo ? rad : '']);
  try { var oc = CacheService.getScriptCache(); oc.remove('att:' + code); oc.remove('att:open'); } catch (err) { /* cache only */ }
  log_('attendance:open', label, '', 'rotating');
  var sl = attSlot_(), now0 = Date.now();
  return { ok: true, session: { link: attLinkFor_(secret, sl), secondsLeft: Math.max(1, Math.ceil(((sl + 1) * ATT_SLOT_SEC * 1000 - now0) / 1000)), label: attColumn_(label), status: 'Open', present: 0, notOnList: 0, geo: hasGeo && ATT_GEO_MODE !== 'off' ? ATT_GEO_MODE : 'off', radius: hasGeo ? rad : 0 } };
}

// Close stops the session and flags odd devices; the check-ins stay in Attendance_Log and the Attendance grid is NOT written until Submit attendance.
function attClose_() {
  var rows = attRows_(), cur = null; rows.forEach(function (r) { if (r.status === 'Open') cur = r; });
  if (!cur) return { ok: false, why: 'no attendance session is open' };
  var present = attPresent_(cur.label), roster = rosterRows_(), col = attColumn_(cur.label);
  var sh = attSheet_(); sh.getRange(cur.row, 3).setValue('Closed'); sh.getRange(cur.row, 5).setValue(new Date().toISOString());
  try { var cc = CacheService.getScriptCache(); cc.remove('att:' + cur.code); cc.remove('att:open'); } catch (err) { /* cache only */ }
  var flagged = attFlagDevices_(cur.label), pres = 0, onList = {}; roster.forEach(function (r) { onList[r[0]] = 1; if (present[r[0]]) pres++; });
  var offIds = Object.keys(present).filter(function (id) { return !onList[id]; });
  log_('attendance:close', col, '', 'rotating');
  return { ok: true, held: true, session: { code: cur.code, label: col, status: 'Closed', present: pres, absent: roster.length - pres, notOnList: offIds.length, flagged: flagged, column: col } };
}

// Submit attendance: write every Closed session (oldest first) into the Attendance grid and the Not_On_List tab, then mark it Submitted.
function attSubmit_() {
  var sessions = attRows_().filter(function (r) { return r.status === 'Closed'; });
  if (!sessions.length) return { ok: false, why: 'no closed session is waiting to be submitted' };
  var roster = rosterRows_(), ss = SpreadsheetApp.getActiveSpreadsheet(), done = [];
  sessions.forEach(function (cur) {
    var present = attPresent_(cur.label), col = attColumn_(cur.label);
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
    attSheet_().getRange(cur.row, 3).setValue('Submitted');
    done.push(col);
    log_('attendance:submit', col, '', 'rotating');
  });
  return { ok: true, submitted: done };
}

// Discard attendance: drop every Closed (not yet submitted) session and its check-ins, so a test run never counts and never blocks the real one that day.
function attDiscard_() {
  var sessions = attRows_().filter(function (r) { return r.status === 'Closed'; });
  if (!sessions.length) return { ok: false, why: 'no closed session is waiting' };
  var lg = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ATT_LOG_TAB), gone = 0, labels = {};
  sessions.forEach(function (r) { labels[r.label] = true; });
  if (lg && lg.getLastRow() > 1) {
    var vals = lg.getRange(2, 2, lg.getLastRow() - 1, 1).getValues();
    for (var i = vals.length - 1; i >= 0; i--) if (labels[String(vals[i][0])]) { lg.deleteRow(i + 2); gone++; }
  }
  sessions.forEach(function (r) { attSheet_().getRange(r.row, 3).setValue('Discarded'); });
  try { var cc = CacheService.getScriptCache(); cc.remove('attd:' + attDayKey_()); } catch (err) { /* cache only */ }
  log_('attendance:discard', String(sessions.length) + ' session(s)', '', 'rotating');
  return { ok: true, discarded: sessions.length, checkins: gone };
}

function attApprove_(p) { // host only: count a student present in a session that is not yet submitted (a borrowed phone, or added by hand)
  var id = normId_(p.id), rows = attRows_(), cur = null;
  rows.forEach(function (r) { if (attColumn_(r.label) === String(p.label || '')) cur = r; });
  if (!cur || !id) return { ok: false, why: 'session not found' };
  if (cur.status === 'Submitted') return { ok: false, why: 'this session is already submitted: change the mark in the Attendance tab' };
  if (!rosterSet_()[id]) return { ok: false, why: 'that ID is not on the class list' };
  if (attPresent_(cur.label)[id]) return { ok: true, added: 0 };
  append_(ATT_LOG_TAB, ['Timestamp', 'Session', 'Student ID', 'On roster', 'Device', 'Location'], [new Date(), cur.label, id, 'Yes', '', 'approved by the lecturer']);
  attFlag_(cur.label, id, '', p.manual ? 'added by the lecturer' : 'approved by the lecturer');
  log_('attendance:approve', attColumn_(cur.label), id, '');
  return { ok: true, added: 1 };
}

// ===== 30-analytics.gs =====
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

// ===== 40-collaboration.gs =====
// Module collaboration. Collaboration: student groups, group assignments, group work and peer ratings.
// Edit the files in apps_script/src/; apps_script/quiz_receiver.gs is built from them (node apps_script/build.js).

// ---------- Student groups: made automatically, adjusted by hand, marked per group ----------
// Groups (private): one row per student per group set. Set | Group | Student ID | Name | Group mark | Out of | Locked | Created.
//   A "set" is one grouping for one activity (for example "Lab 1"). The group mark is copied to every member, and to Master and Scores
//   as a column "Group: <set>" (not counted in the live quiz total).
// Modes: random; mixed by quiz results (each group gets a spread of stronger and weaker students); mixed by attendance.
// Earlier sets are remembered: among many candidate groupings the one that repeats the fewest earlier pairings is kept.
// Locked groups are kept as they are when the set is made again.
var GROUPS_TAB = 'Groups', GROUPS_HEADER = ['Set', 'Group', 'Student ID', 'Name', 'Group mark', 'Out of', 'Locked', 'Created'];

function groupsSheet_() { return sheetWith_(GROUPS_TAB, GROUPS_HEADER); }
function groupRows_() {
  return bodyRows_(SpreadsheetApp.getActiveSpreadsheet().getSheetByName(GROUPS_TAB), 8).map(function (r) {
    return { set: String(r[0]).trim(), group: Number(r[1]) || 0, id: normId_(r[2]), name: String(r[3] || ''), mark: r[4], outOf: r[5], locked: /^y/i.test(String(r[6])), created: r[7] };
  }).filter(function (r) { return r.set && r.group && r.id; });
}
function groupRowOut_(r) { return [r.set, r.group, r.id, r.name, r.mark === undefined ? '' : r.mark, r.outOf === undefined ? '' : r.outOf, r.locked ? 'Yes' : '', r.created || new Date()]; }
function saveGroupRows_(rows) {
  rows.sort(function (a, b) { return a.set < b.set ? -1 : a.set > b.set ? 1 : a.group - b.group || (a.name < b.name ? -1 : 1); });
  rewriteBody_(groupsSheet_(), 8, rows.map(groupRowOut_));
}
function randInt_(n) { var h = Utilities.getUuid().replace(/[^0-9a-f]/gi, ''); return parseInt(h.slice(0, 12), 16) % n; }
function shuffled_(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = randInt_(i + 1), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }

// How many times each pair of students has already shared a group, in sets other than `except`.
function pairCounts_(rows, except) {
  var bySetGroup = {}, pc = {};
  rows.forEach(function (r) { if (r.set === except) return; var k = r.set + '|' + r.group; (bySetGroup[k] = bySetGroup[k] || []).push(r.id); });
  Object.keys(bySetGroup).forEach(function (k) {
    var m = bySetGroup[k];
    for (var i = 0; i < m.length; i++) for (var j = i + 1; j < m.length; j++) { var p = m[i] < m[j] ? m[i] + '|' + m[j] : m[j] + '|' + m[i]; pc[p] = (pc[p] || 0) + 1; }
  });
  return pc;
}
function repeatCost_(groups, pc) {
  var c = 0;
  groups.forEach(function (g) { for (var i = 0; i < g.length; i++) for (var j = i + 1; j < g.length; j++) { var p = g[i] < g[j] ? g[i] + '|' + g[j] : g[j] + '|' + g[i]; c += pc[p] || 0; } });
  return c;
}

// Per-student measure for the mixed modes: live quiz average (released results), else attendance rate.
function studentMeasure_(mode) {
  var out = {};
  if (mode === 'attendance') {
    var at = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ATT_TAB);
    if (at && at.getLastRow() > 1 && at.getLastColumn() > 1) {
      var g = at.getRange(1, 1, at.getLastRow(), at.getLastColumn()).getValues();
      for (var i = 1; i < g.length; i++) { var id = normId_(g[i][0]), p = 0, n = 0; for (var c = 1; c < g[0].length; c++) if (g[i][c] !== '' && String(g[0][c]).trim()) { n++; if (Number(g[i][c])) p++; } if (id && n) out[id] = p / n; }
    }
    return out;
  }
  var sum = {};
  collectResults_().forEach(function (e) { if (!/^(Week |Quiz )/.test(e.label) || !e.n) return; var s = sum[normId_(e.id)] || (sum[normId_(e.id)] = { s: 0, n: 0 }); s.s += e.score; s.n += e.n; });
  Object.keys(sum).forEach(function (id) { out[id] = sum[id].s / sum[id].n; });
  return out;
}

// Deal students into k groups. Mixed modes: rank by the measure, cut into tiers of k, and give each group one from every tier (order
// within a tier is random, and students with no record sit in the middle). Random mode: one tier of everyone.
function dealGroups_(ids, k, mode, measure) {
  var order;
  if (mode === 'random') order = shuffled_(ids);
  else {
    var known = ids.filter(function (id) { return measure[id] !== undefined; }), vals = known.map(function (id) { return measure[id]; }).sort(function (a, b) { return a - b; });
    var mid = vals.length ? vals[Math.floor(vals.length / 2)] : 0;
    order = shuffled_(ids).sort(function (a, b) { return (measure[b] !== undefined ? measure[b] : mid) - (measure[a] !== undefined ? measure[a] : mid); });
  }
  var groups = []; for (var g = 0; g < k; g++) groups.push([]);
  for (var t = 0; t < order.length; t += k) {
    var tier = mode === 'random' ? order.slice(t, t + k) : shuffled_(order.slice(t, t + k));
    var slots = shuffled_(groups.map(function (x, i) { return i; })).sort(function (a, b) { return groups[a].length - groups[b].length; }); // the smallest groups first, so sizes differ by at most one
    tier.forEach(function (id, i) { groups[slots[i]].push(id); });
  }
  return groups;
}

// Swap students between groups while that lowers the number of repeated pairings; mixed modes swap only within the same tier.
function improveGroups_(groups, pc, tierOf) {
  function gc(g) { return repeatCost_([g], pc); }
  var best = repeatCost_(groups, pc), pass = 0, changed = true;
  while (changed && best > 0 && pass++ < 6) {
    changed = false;
    for (var a = 0; a < groups.length; a++) for (var b = a + 1; b < groups.length; b++) {
      var base = gc(groups[a]) + gc(groups[b]);
      if (!base) continue;
      for (var i = 0; i < groups[a].length; i++) for (var j = 0; j < groups[b].length; j++) {
        var x = groups[a][i], y = groups[b][j];
        if (tierOf && tierOf[x] !== tierOf[y]) continue;
        groups[a][i] = y; groups[b][j] = x;
        var now = gc(groups[a]) + gc(groups[b]);
        if (now < base) { best -= base - now; base = now; changed = true; } else { groups[a][i] = x; groups[b][j] = y; }
      }
    }
  }
  return best;
}

function groupsAct_(p) {
  var op = String(p.op || 'list').toLowerCase(), set = clean_(p.set, 60).replace(/^'/, ''), rows = groupRows_();
  var names = {}; rosterRows_().forEach(function (r) { var id = normId_(r[0]); if (id) names[id] = cleanName_(r[1]); });
  if (op === 'make') {
    if (!set) return { ok: false, why: 'give the set a name' };
    var mode = /^mix/i.test(p.mode) ? 'mixed' : /^att/i.test(p.mode) ? 'attendance' : 'random';
    var pool = Object.keys(names);
    if (/^present/i.test(p.from)) { // only the students checked in at the latest attendance session
      var ses = attRows_(), last = ses.length ? ses[ses.length - 1] : null, here = last ? attPresent_(last.label) : {};
      pool = pool.filter(function (id) { return here[id]; });
      if (!last) return { ok: false, why: 'no attendance session yet' };
    }
    var keep = rows.filter(function (r) { return r.set === set && r.locked; }), lockedIds = {}, lockedGroups = {};
    keep.forEach(function (r) { lockedIds[r.id] = true; lockedGroups[r.group] = true; });
    pool = pool.filter(function (id) { return !lockedIds[id]; });
    if (!pool.length) return { ok: false, why: keep.length ? 'every student is in a locked group' : 'no students to group: load the class list first' };
    var size = Math.max(2, Math.min(50, Number(p.size) || 0)), count = Math.max(1, Math.min(200, Number(p.count) || 0));
    var k = Number(p.count) ? Math.min(count, pool.length) : Math.max(1, Math.ceil(pool.length / (size || 4)));
    var measure = mode === 'random' ? {} : studentMeasure_(mode === 'mixed' ? 'quiz' : 'attendance');
    var pc = /^n/i.test(String(p.avoid || 'yes')) ? {} : pairCounts_(rows, set), best = null, bestCost = Infinity;
    for (var tries = 0; tries < 120 && bestCost > 0; tries++) {
      var gs = dealGroups_(pool, k, mode, measure), c = repeatCost_(gs, pc);
      if (c < bestCost) { best = gs; bestCost = c; }
    }
    var tierOf = null;
    if (mode !== 'random') { tierOf = {}; best.forEach(function (g) { g.forEach(function (id, i) { tierOf[id] = i; }); }); }
    bestCost = improveGroups_(best, pc, tierOf);
    var numbers = [], nx = 1; while (numbers.length < best.length) { if (!lockedGroups[nx]) numbers.push(nx); nx++; }
    var now = new Date(), fresh = [];
    best.forEach(function (g, i) { g.forEach(function (id) { fresh.push({ set: set, group: numbers[i], id: id, name: names[id] || '', mark: '', outOf: '', locked: false, created: now }); }); });
    saveGroupRows_(rows.filter(function (r) { return r.set !== set; }).concat(keep, fresh));
    log_('groups made', set + ': ' + mode + ', ' + best.length + ' new group(s), repeats ' + bestCost, '', '');
    var res = groupsAct_({ op: 'list', set: set }); res.repeats = bestCost; res.mode = mode; return res;
  }
  if (op === 'move' || op === 'lock' || op === 'mark' || op === 'delete') {
    var inSet = rows.filter(function (r) { return r.set === set; });
    if (!inSet.length) return { ok: false, why: 'no such set' };
    var g = Number(p.group) || 0;
    if (op === 'move') {
      var id = normId_(p.id), to = Math.max(1, Math.min(200, Number(p.to) || 0)), who = inSet.filter(function (r) { return r.id === id; })[0];
      if (!who || !to) return { ok: false, why: 'student not in this set' };
      var target = inSet.filter(function (r) { return r.group === to; })[0];
      who.group = to; who.locked = target ? target.locked : false;
      if (target) { who.mark = target.mark; who.outOf = target.outOf; } else { who.mark = ''; who.outOf = ''; }
    } else if (op === 'lock') {
      inSet.forEach(function (r) { if (r.group === g) r.locked = !/^(0|no|false)$/i.test(String(p.value || 'yes')); });
    } else if (op === 'mark') {
      var mk = String(p.mark || '').trim(), oo = String(p.outof || '').trim();
      if (mk !== '' && isNaN(Number(mk))) return { ok: false, why: 'the mark must be a number' };
      if (oo !== '' && (isNaN(Number(oo)) || Number(oo) <= 0)) return { ok: false, why: 'out of must be a positive number' };
      var members = inSet.filter(function (r) { return r.group === g; });
      if (!members.length) return { ok: false, why: 'no such group' };
      members.forEach(function (r) { r.mark = mk === '' ? '' : Number(mk); r.outOf = oo === '' ? '' : Number(oo); });
      if (mk !== '' && oo !== '') updateMaster_(members.filter(function (r) { return names[r.id] !== undefined; }).map(function (r) { return { id: r.id, name: r.name, label: 'Group: ' + set, score: Number(mk), n: Number(oo) }; }));
      log_('group mark', set + ' group ' + g + ': ' + mk + (oo ? ' / ' + oo : ''), '', '');
    } else if (op === 'delete') {
      saveGroupRows_(rows.filter(function (r) { return r.set !== set; }));
      log_('groups deleted', set, '', '');
      return groupsAct_({ op: 'list' });
    }
    saveGroupRows_(rows);
    return groupsAct_({ op: 'list', set: set });
  }
  // list: the sets, and the groups of one set
  var sets = [], seenSet = {};
  rows.forEach(function (r) { if (!seenSet[r.set]) { seenSet[r.set] = { name: r.set, students: 0, groups: {}, created: r.created }; sets.push(seenSet[r.set]); } seenSet[r.set].students++; seenSet[r.set].groups[r.group] = 1; });
  var pick = set && seenSet[set] ? set : (sets.length ? sets[sets.length - 1].name : '');
  var pcAll = pairCounts_(rows, pick), groups = {};
  rows.filter(function (r) { return r.set === pick; }).forEach(function (r) {
    var gg = groups[r.group] || (groups[r.group] = { group: r.group, locked: r.locked, mark: r.mark, outOf: r.outOf, members: [] });
    gg.members.push({ id: r.id, name: r.name || names[r.id] || '', onList: names[r.id] !== undefined });
  });
  var list = Object.keys(groups).map(function (k) { return groups[k]; }).sort(function (a, b) { return a.group - b.group; });
  var inGroup = {}; list.forEach(function (gq) { gq.members.forEach(function (m) { inGroup[m.id] = true; }); });
  return { ok: true, sets: sets.map(function (s) { return { name: s.name, students: s.students, groups: Object.keys(s.groups).length }; }), set: pick, groups: list,
    repeats: repeatCost_(list.map(function (gq) { return gq.members.map(function (m) { return m.id; }); }), pcAll),
    notGrouped: Object.keys(names).filter(function (id) { return !inGroup[id]; }).map(function (id) { return { id: id, name: names[id] }; }) };
}

// A student's own groups, for My progress: the other members' names as on the class list, so the group can find each other.
function studentGroups_(id) {
  var rows = groupRows_(), mine = rows.filter(function (r) { return r.id === id; });
  return mine.map(function (m) {
    var others = rows.filter(function (r) { return r.set === m.set && r.group === m.group && r.id !== id; }).map(function (r) { return String(r.name || '').trim() || 'Classmate'; });
    return { set: m.set, group: m.group, members: others, mark: m.mark === '' ? null : m.mark, outOf: m.outOf === '' ? null : m.outOf };
  });
}

// ---- Group assignments: allocated to some or all groups of a set; one shared submission per group, each member's own part, and private peer ratings ----
var ASG_TAB = 'Assignments', ASG_HEAD = ['ID', 'Set', 'Groups', 'Title', 'Brief', 'Due', 'Outcome', 'Out of', 'Status', 'Created', 'Updated'];
var GW_TAB = 'Group_Work', GW_HEAD = ['Time', 'Assignment ID', 'Set', 'Group', 'Student ID', 'Kind', 'Text', 'Link', 'Rating'];
var AMK_TAB = 'Assignment_Marks', AMK_HEAD = ['Assignment ID', 'Group', 'Mark', 'Feedback', 'Marked'];
var PEER_WORD = { full: 'Contributed fully', part: 'Contributed partly', little: 'Contributed little' }, PEER_VAL = { full: 2, part: 1, little: 0 };

function asgRows_() {
  return bodyRows_(SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ASG_TAB), 11).map(function (r) {
    return { id: String(r[0]).trim(), set: String(r[1]).replace(/^'/, ''), groups: String(r[2] || 'all'), title: String(r[3]), brief: String(r[4]), due: String(r[5] || '').replace(/^'/, ''),
      outcome: String(r[6] || '').replace(/^'/, ''), outOf: r[7] === '' ? '' : Number(r[7]), status: String(r[8] || 'open'), created: new Date(r[9]).getTime() || 0, updated: r[10] };
  }).filter(function (a) { return a.id; });
}
function asgSave_(list) { rewriteBody_(sheetWith_(ASG_TAB, ASG_HEAD), 11, list.map(function (a) { return [a.id, "'" + a.set, a.groups, a.title, a.brief, a.due ? "'" + a.due : '', a.outcome ? "'" + a.outcome : '', a.outOf, a.status, new Date(a.created || Date.now()), new Date()]; })); }
function asgFor_(a, g) { return a.groups === 'all' || String(a.groups).split(',').map(Number).indexOf(Number(g)) >= 0; }
function gwRows_() {
  return bodyRows_(SpreadsheetApp.getActiveSpreadsheet().getSheetByName(GW_TAB), 9).map(function (r) {
    return { t: new Date(r[0]).getTime() || 0, aid: String(r[1]).trim(), set: String(r[2]).replace(/^'/, ''), group: Number(r[3]) || 0, id: normId_(r[4]), kind: String(r[5]), text: String(r[6] || ''), link: String(r[7] || ''), rating: String(r[8] || '') };
  });
}
function amkRows_() { var o = {}; bodyRows_(SpreadsheetApp.getActiveSpreadsheet().getSheetByName(AMK_TAB), 5).forEach(function (r) { o[String(r[0]).trim() + '|' + Number(r[1])] = { mark: r[2] === '' ? null : Number(r[2]), feedback: String(r[3] || ''), marked: r[4] }; }); return o; }
function dueMs_(due) { var d = calDate_(due); if (!d) return 0; if (!/T/.test(due)) d.setHours(23, 59, 0, 0); return d.getTime(); }
// How one group did on one assignment: the latest shared submission, each member's part, the peer ratings (lecturer only) and the mark.
function groupWorkOf_(a, g, members, work, marks, names) {
  var mine = work.filter(function (w) { return w.aid === a.id && w.group === g; }), due = dueMs_(a.due);
  var subs = mine.filter(function (w) { return w.kind === 'work'; }), last = subs.length ? subs[subs.length - 1] : null;
  var parts = {}, peers = {};
  mine.forEach(function (w) { if (w.kind === 'part') parts[w.id] = w; if (w.kind === 'peer') { var r = {}; try { r = JSON.parse(w.rating) || {}; } catch (err) { r = {}; } peers[w.id] = r; } });
  var mem = members.map(function (id) {
    var got = []; Object.keys(peers).forEach(function (rater) { if (rater !== id && peers[rater][id] && PEER_VAL[peers[rater][id]] !== undefined) got.push(PEER_VAL[peers[rater][id]]); });
    var avg = got.length ? Math.round(100 * got.reduce(function (x, y) { return x + y; }, 0) / got.length) / 100 : null;
    return { id: id, name: names[id] || '', part: parts[id] ? parts[id].text : '', partTime: parts[id] ? fmtDay_(parts[id].t) : '', rated: !!peers[id], peerAvg: avg, peerN: got.length,
      peerFlag: avg !== null && got.length >= 2 && avg < 1, submitted: subs.some(function (w) { return w.id === id; }) };
  });
  var mk = marks[a.id + '|' + g] || null;
  return { group: g, members: mem, submitted: !!last, text: last ? last.text : '', link: last ? last.link : '', by: last ? (names[last.id] || last.id) : '', time: last ? fmtDay_(last.t) : '', versions: subs.length,
    onTime: last ? (!due || last.t <= due) : null, late: !!(last && due && last.t > due), mark: mk ? mk.mark : null, feedback: mk ? mk.feedback : '',
    parts: mem.filter(function (m) { return m.part; }).length, ratedBy: mem.filter(function (m) { return m.rated; }).length };
}
function asgSummary_(a, rows, work, marks, names, ev) {
  var groups = {}; rows.filter(function (r) { return r.set === a.set && asgFor_(a, r.group); }).forEach(function (r) { (groups[r.group] = groups[r.group] || []).push(r.id); });
  var list = Object.keys(groups).map(Number).sort(function (x, y) { return x - y; }).map(function (g) { return groupWorkOf_(a, g, groups[g], work, marks, names); });
  var students = 0, parts = 0, flags = 0; list.forEach(function (g) { students += g.members.length; parts += g.parts; g.members.forEach(function (m) { if (m.peerFlag) flags++; }); });
  var allIds = []; Object.keys(groups).forEach(function (g) { allIds = allIds.concat(groups[g]); });
  return { id: a.id, set: a.set, title: a.title, brief: a.brief, due: a.due, outcome: a.outcome, outcomeLabel: a.outcome ? outcomeLabel_(a.outcome, ev._lects) : '', outOf: a.outOf, status: a.status, groupsAllocated: a.groups,
    created: fmtDay_(a.created), groups: list, measures: { allocated: list.length, submitted: list.filter(function (g) { return g.submitted; }).length, onTime: list.filter(function (g) { return g.onTime; }).length,
      marked: list.filter(function (g) { return g.mark !== null; }).length, contribution: pct_(parts, students), students: students, peerFlags: flags, beforeAfter: asgBeforeAfter_(a, allIds, ev) } };
}

// Host only: list, save, delete, close or reopen, and mark group assignments.
function assignmentsAct_(p) {
  var op = String(p.op || 'list').toLowerCase(), list = asgRows_(), rows = groupRows_();
  var names = {}; rosterRows_().forEach(function (r) { var id = normId_(r[0]); if (id) names[id] = cleanName_(r[1]); });
  if (op === 'save') {
    var set = clean_(p.set, 60).replace(/^'/, ''), title = clean_(p.title, 120), brief = String(p.brief || '').replace(/\r/g, '').slice(0, 4000).trim();
    if (!set || !rows.some(function (r) { return r.set === set; })) return { ok: false, why: 'choose a group set first' };
    if (!title) return { ok: false, why: 'give the assignment a title' };
    var gs = String(p.groups || 'all').toLowerCase() === 'all' ? 'all' : String(p.groups).split(/[\s,]+/).map(Number).filter(function (x) { return x > 0; }).join(',');
    if (!gs) return { ok: false, why: 'choose at least one group' };
    var due = String(p.due || '') ? calWhen_(p.due) : ''; if (p.due && !due) return { ok: false, why: 'the due date is not valid' };
    var oo = String(p.outof || '').trim(); if (oo !== '' && !(Number(oo) > 0)) return { ok: false, why: 'out of must be a positive number' };
    var outc = /^L\d+(\.\d+)?$/.test(String(p.outcome || '')) ? String(p.outcome) : '';
    var a = list.filter(function (x) { return x.id === String(p.id || ''); })[0];
    if (!a) { a = { id: 'A' + Utilities.getUuid().replace(/-/g, '').slice(0, 8).toUpperCase(), created: Date.now(), status: 'open' }; list.push(a); }
    a.set = set; a.groups = gs; a.title = title; a.brief = brief; a.due = due; a.outcome = outc; a.outOf = oo === '' ? '' : Number(oo);
    asgSave_(list); log_('assignment saved', a.title + ' (' + set + ', groups ' + gs + ')', '', '');
    var r1 = assignmentsAct_({ op: 'list' }); r1.saved = a.id; return r1;
  }
  var a2 = list.filter(function (x) { return x.id === String(p.id || ''); })[0];
  if (op === 'delete' || op === 'close' || op === 'open') {
    if (!a2) return { ok: false, why: 'no such assignment' };
    if (op === 'delete') { list = list.filter(function (x) { return x !== a2; }); log_('assignment deleted', a2.title, '', ''); }
    else a2.status = op === 'close' ? 'closed' : 'open';
    asgSave_(list); return assignmentsAct_({ op: 'list' });
  }
  if (op === 'mark') {
    if (!a2) return { ok: false, why: 'no such assignment' };
    var g = Number(p.group) || 0, mk = String(p.mark || '').trim(), fb = String(p.feedback || '').replace(/\r/g, '').slice(0, 2000).trim();
    if (mk !== '' && isNaN(Number(mk))) return { ok: false, why: 'the mark must be a number' };
    var members = rows.filter(function (r) { return r.set === a2.set && r.group === g; });
    if (!members.length || !asgFor_(a2, g)) return { ok: false, why: 'that group does not have this assignment' };
    var sh = sheetWith_(AMK_TAB, AMK_HEAD), mrows = bodyRows_(sh, 5).filter(function (r) { return !(String(r[0]).trim() === a2.id && Number(r[1]) === g); });
    mrows.push([a2.id, g, mk === '' ? '' : Number(mk), fb, new Date()]); rewriteBody_(sh, 5, mrows);
    if (mk !== '' && a2.outOf !== '') updateMaster_(members.filter(function (r) { return names[r.id] !== undefined; }).map(function (r) { return { id: r.id, name: r.name, label: 'Assignment: ' + a2.title, score: Number(mk), n: Number(a2.outOf) }; }));
    log_('assignment mark', a2.title + ' group ' + g + ': ' + mk, '', '');
    return assignmentsAct_({ op: 'view', id: a2.id });
  }
  var work = gwRows_(), marks = amkRows_(), ev = evidence_();
  if (op === 'view') { if (!a2) return { ok: false, why: 'no such assignment' }; return { ok: true, assignment: asgSummary_(a2, rows, work, marks, names, ev) }; }
  var sets = {}; rows.forEach(function (r) { (sets[r.set] = sets[r.set] || {})[r.group] = 1; });
  return { ok: true, assignments: list.map(function (a) { var s = asgSummary_(a, rows, work, marks, names, ev); delete s.groups; return s; }),
    sets: Object.keys(sets).map(function (k) { return { name: k, groups: Object.keys(sets[k]).map(Number).sort(function (x, y) { return x - y; }) }; }),
    outcomes: Object.keys(ev._lects).map(Number).sort(function (x, y) { return x - y; }).reduce(function (acc, n) { ev._lects[n].outcomes.forEach(function (t, i) { acc.push({ key: 'L' + n + '.' + (i + 1), label: outcomeLabel_('L' + n + '.' + (i + 1), ev._lects) }); }); return acc; }, []) };
}

function groupWork_(p) {
  var au = studentAuth_(p); if (!au.id) return { ok: false, why: au.why };
  var id = au.id, op = String(p.op || 'list').toLowerCase(), rows = groupRows_(), list = asgRows_();
  var names = {}; rosterRows_().forEach(function (r) { var x = normId_(r[0]); if (x) names[x] = cleanName_(r[1]); });
  var myGroups = rows.filter(function (r) { return r.id === id; });
  function mineFor(aid) { var a = list.filter(function (x) { return x.id === aid; })[0]; if (!a) return null; var g = myGroups.filter(function (r) { return r.set === a.set && asgFor_(a, r.group); })[0]; return g ? { a: a, g: g.group } : null; }
  if (op === 'submit' || op === 'part' || op === 'peer') {
    var m = mineFor(String(p.aid || '')); if (!m) return { ok: false, why: 'this assignment is not for your group' };
    if (m.a.status === 'closed') return { ok: false, why: 'this assignment is closed' };
    var row = null;
    if (op === 'submit') { var tx = chatTxt_(p.text, 8000), lk = safeLink_(p.link); if (!tx && !lk) return { ok: false, why: 'write the answer or give a link' }; if (p.link && !lk) return { ok: false, why: 'the link must start with https://' }; row = [new Date(), m.a.id, "'" + m.a.set, m.g, id, 'work', tx, lk, '']; }
    else if (op === 'part') { var pt = chatTxt_(p.text, 1000); if (!pt) return { ok: false, why: 'say what you did' }; row = [new Date(), m.a.id, "'" + m.a.set, m.g, id, 'part', pt, '', '']; }
    else {
      var r = {}; try { r = JSON.parse(String(p.ratings || '{}')) || {}; } catch (err) { return { ok: false, why: 'the ratings could not be read' }; }
      var mates = rows.filter(function (x) { return x.set === m.a.set && x.group === m.g && x.id !== id; }).map(function (x) { return x.id; }), clean = {};
      mates.forEach(function (x) { if (PEER_VAL[r[x]] !== undefined) clean[x] = r[x]; });
      if (!Object.keys(clean).length) return { ok: false, why: 'rate at least one group-mate' };
      row = [new Date(), m.a.id, "'" + m.a.set, m.g, id, 'peer', '', '', JSON.stringify(clean)];
    }
    var gl = LockService.getScriptLock(); gl.waitLock(20000);
    try { append_(GW_TAB, GW_HEAD, row); } finally { gl.releaseLock(); }
    log_('group work ' + op, m.a.title + ' group ' + m.g, id, '');
  }
  var work = gwRows_(), marks = amkRows_();
  var out = [];
  list.forEach(function (a) {
    var g = myGroups.filter(function (r) { return r.set === a.set && asgFor_(a, r.group); })[0]; if (!g) return;
    var members = rows.filter(function (r) { return r.set === a.set && r.group === g.group; }).map(function (r) { return r.id; });
    var s = groupWorkOf_(a, g.group, members, work, marks, names), me = s.members.filter(function (x) { return x.id === id; })[0] || {};
    var myPeer = work.filter(function (w) { return w.aid === a.id && w.id === id && w.kind === 'peer'; }).pop(), pr = {}; try { pr = myPeer ? JSON.parse(myPeer.rating) : {}; } catch (err) { pr = {}; }
    out.push({ id: a.id, set: a.set, group: g.group, title: a.title, brief: a.brief, due: a.due, status: a.status, outOf: a.outOf,
      mates: s.members.filter(function (x) { return x.id !== id; }).map(function (x) { return { id: x.id, name: String(x.name || '').trim() || 'Classmate', myRating: pr[x.id] || '' }; }),
      submitted: s.submitted, text: s.text, link: s.link, by: s.by, time: s.time, versions: s.versions, late: s.late, myPart: me.part || '', rated: !!myPeer,
      mark: s.mark, feedback: s.mark !== null || s.feedback ? s.feedback : '' });
  });
  return { ok: true, assignments: out, ratingWords: PEER_WORD };
}

// Host only: the groups of one set, laid out for the projector (first name and the initial of the last name).
function groupsDisplay_(p) {
  var r = groupsAct_({ op: 'list', set: p.set }); if (!r.ok) return r;
  var short = function (n) { var w = String(n || '').trim().split(/\s+/); return w.length > 1 ? w[0] + ' ' + w[w.length - 1].charAt(0) + '.' : (w[0] || 'Student'); };
  var asg = asgRows_().filter(function (a) { return a.set === r.set && a.status !== 'closed'; });
  return { ok: true, set: r.set, sets: r.sets, groups: r.groups.map(function (g) { return { group: g.group, members: g.members.map(function (m) { return short(m.name); }), tasks: asg.filter(function (a) { return asgFor_(a, g.group); }).map(function (a) { return a.title; }) }; }) };
}

// ===== 50-communication.gs =====
// Module communication. Communication: the course calendar, messages and announcements.
// Edit the files in apps_script/src/; apps_script/quiz_receiver.gs is built from them (node apps_script/build.js).

// ---------- Course calendar: lectures, tutorials, quizzes, examinations, deadlines and office hours, each with an agenda ----------
// One row per event in the Calendar tab. Times are local to the script's time zone and stored as text (YYYY-MM-DDTHH:MM)
// so that the sheet does not reformat them. Events marked "Lecturer only" never leave the server without the host key.
var CAL_TAB = 'Calendar';
var CAL_HEAD = ['Event ID', 'Title', 'Kind', 'Start', 'End', 'All day', 'Location', 'Agenda', 'Resources', 'Week', 'Linked session', 'Visibility', 'Series', 'Created', 'Updated'];
var CAL_KINDS = ['lecture', 'tutorial', 'lab', 'quiz', 'exam', 'deadline', 'office hours', 'other'];

function calTxt_(v, n) { return String(v == null ? '' : v).replace(/^'/, '').replace(/\r/g, '').slice(0, n || 200).trim(); }
function calWhen_(s) { // 'YYYY-MM-DD' or 'YYYY-MM-DDTHH:MM' -> the same text, or '' if invalid
  var m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?$/.exec(String(s || '').replace(/^'/, '').trim());
  if (!m || Number(m[2]) < 1 || Number(m[2]) > 12 || Number(m[3]) < 1 || Number(m[3]) > 31 || (m[4] && (Number(m[4]) > 23 || Number(m[5]) > 59))) return '';
  return m[1] + '-' + m[2] + '-' + m[3] + (m[4] ? 'T' + m[4] + ':' + m[5] : '');
}
function calDate_(s) { // local date from the stored text
  var m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?$/.exec(s);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4] || 0), Number(m[5] || 0)) : null;
}
function calLocal_(d, withTime) { var tz = Session.getScriptTimeZone(); return Utilities.formatDate(d, tz, 'yyyy-MM-dd') + (withTime ? 'T' + Utilities.formatDate(d, tz, 'HH:mm') : ''); }
function calUtc_(d) { return d.toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z'); }
function calRows_() {
  var sh = sheetWith_(CAL_TAB, CAL_HEAD);
  return bodyRows_(sh, CAL_HEAD.length).filter(function (r) { return calTxt_(r[0]); }).map(function (r) {
    return { id: calTxt_(r[0], 40), title: calTxt_(r[1], 200), kind: calTxt_(r[2], 30) || 'other', start: calWhen_(r[3]), end: calWhen_(r[4]),
      allDay: String(r[5]).toLowerCase() === 'yes', location: calTxt_(r[6], 200), agenda: calTxt_(r[7], 4000), resources: calTxt_(r[8], 2000),
      week: Number(r[9]) || 0, link: calTxt_(r[10], 30), visibility: calTxt_(r[11], 20) === 'lecturer' ? 'lecturer' : 'students',
      series: calTxt_(r[12], 40), created: calTxt_(r[13], 40), updated: calTxt_(r[14], 40) };
  }).filter(function (ev) { return ev.start; });
}
function calSave_(list) {
  var sh = sheetWith_(CAL_TAB, CAL_HEAD);
  list.sort(function (a, b) { return a.start < b.start ? -1 : a.start > b.start ? 1 : 0; });
  rewriteBody_(sh, CAL_HEAD.length, list.map(function (ev) {
    return [ev.id, ev.title, ev.kind, "'" + ev.start, ev.end ? "'" + ev.end : '', ev.allDay ? 'yes' : 'no', ev.location, ev.agenda, ev.resources, ev.week || '', ev.link, ev.visibility, ev.series, ev.created, ev.updated];
  }));
  try { CacheService.getScriptCache().remove('cal_pub'); } catch (err) { /* cache only */ }
}
// Start and end in UTC for calendar programs, and the end filled in when it was left out.
function calOut_(ev) {
  var o = JSON.parse(JSON.stringify(ev)), s = calDate_(ev.start), e = ev.end ? calDate_(ev.end) : null;
  if (ev.allDay) { e = e || new Date(s.getTime()); e = new Date(e.getFullYear(), e.getMonth(), e.getDate() + 1); o.utcStart = calLocal_(s, false).replace(/-/g, ''); o.utcEnd = calLocal_(e, false).replace(/-/g, ''); }
  else {
    if (!e || e <= s) e = new Date(s.getTime() + (ev.kind === 'deadline' ? 0 : 3600000));
    o.utcStart = calUtc_(s); o.utcEnd = calUtc_(e);
    if (!ev.end) o.end = calLocal_(e, true);
  }
  return o;
}
function calendar_(p) { // public: events for students; with the host key, every event
  var host = !!(p && p.hostkey) && hostOk_(p);
  var list = calRows_().filter(function (ev) { return host || ev.visibility === 'students'; }).map(calOut_);
  var weeks = {}; try { weeks = siteJson_('/apps_script/live_quizzes.json').weeks || {}; } catch (err) { /* titles are a nicety */ }
  return { ok: true, host: host, tz: Session.getScriptTimeZone(), kinds: CAL_KINDS, weeks: weeks, events: list };
}
function calendarAct_(p) { // host only: save, delete, delete_series, series (add a weekly series)
  var op = String(p.op || '');
  var list = calRows_(), now = new Date().toISOString();
  function fromParams(ev) {
    ev.title = calTxt_(p.title, 200); ev.kind = CAL_KINDS.indexOf(String(p.kind)) >= 0 ? String(p.kind) : 'other';
    ev.allDay = String(p.allday) === 'yes';
    ev.start = calWhen_(p.start); ev.end = calWhen_(p.end);
    if (ev.allDay) { ev.start = ev.start.slice(0, 10); ev.end = ev.end ? ev.end.slice(0, 10) : ''; }
    ev.location = calTxt_(p.location, 200); ev.agenda = calTxt_(p.agenda, 4000); ev.resources = calTxt_(p.resources, 2000);
    ev.week = Math.max(0, Math.min(99, Number(p.week) || 0)); ev.link = ['', 'attendance', 'quiz', 'both'].indexOf(String(p.link || '')) >= 0 ? String(p.link || '') : '';
    ev.visibility = String(p.visibility) === 'lecturer' ? 'lecturer' : 'students'; ev.updated = now;
    return ev;
  }
  function check(ev) {
    if (!ev.title) return 'give the event a title';
    if (!ev.start) return 'give a valid start date';
    if (ev.end && ev.end < ev.start) return 'the end is before the start';
    return '';
  }
  if (op === 'save') {
    var id = calTxt_(p.id, 40), ev = id ? list.filter(function (x) { return x.id === id; })[0] : null;
    if (id && !ev) return { ok: false, why: 'event not found' };
    var isNew = !ev; ev = fromParams(ev || { id: 'E' + Utilities.getUuid().replace(/-/g, '').slice(0, 10), series: '', created: now });
    var why = check(ev); if (why) return { ok: false, why: why };
    if (isNew) list.push(ev);
    calSave_(list); return calendar_(p);
  }
  if (op === 'series') { // the same event every week (or every n days) for a number of occurrences
    var base = fromParams({}), why2 = check(base); if (why2) return { ok: false, why: why2 };
    var n = Math.max(1, Math.min(30, Number(p.count) || 1)), every = Math.max(1, Math.min(31, Number(p.every) || 7));
    var s0 = calDate_(base.start), e0 = base.end ? calDate_(base.end) : null, sid = 'S' + Utilities.getUuid().replace(/-/g, '').slice(0, 10);
    var wk = base.week, titles = calTxt_(p.titles, 4000).split('\n');
    for (var i = 0; i < n; i++) {
      var ev2 = JSON.parse(JSON.stringify(base));
      ev2.id = 'E' + Utilities.getUuid().replace(/-/g, '').slice(0, 10); ev2.series = sid; ev2.created = now;
      var si = new Date(s0.getFullYear(), s0.getMonth(), s0.getDate() + i * every, s0.getHours(), s0.getMinutes());
      ev2.start = calLocal_(si, !base.allDay);
      if (e0) { var ei = new Date(si.getTime() + (e0.getTime() - s0.getTime())); ev2.end = calLocal_(ei, !base.allDay); }
      if (wk) ev2.week = wk + i;
      var t = (titles[i] || '').trim(); ev2.title = (t || base.title).replace(/\{n\}/g, String(wk ? wk + i : i + 1)).slice(0, 200);
      list.push(ev2);
    }
    calSave_(list); return calendar_(p);
  }
  if (op === 'delete' || op === 'delete_series') {
    var did = calTxt_(p.id, 40), hit = list.filter(function (x) { return x.id === did; })[0];
    if (!hit) return { ok: false, why: 'event not found' };
    list = list.filter(function (x) { return op === 'delete' ? x.id !== did : !(hit.series ? x.series === hit.series : x.id === did); });
    calSave_(list); return calendar_(p);
  }
  return calendar_(p);
}
// iCalendar (RFC 5545) for one event or the whole calendar, for calendar programs to import or subscribe to.
function calIcsText_(s) { return String(s || '').replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\n/g, '\\n'); }
function calFold_(line) { var out = [], i = 0; while (line.length - i > 73) { out.push((i ? ' ' : '') + line.slice(i, i + 73)); i += 73; } out.push((i ? ' ' : '') + line.slice(i)); return out.join('\r\n'); }
function calendarIcs_(p) {
  var host = !!(p && p.hostkey) && hostOk_(p);
  var course = String((p && p.course) || 'Course calendar').slice(0, 80);
  var list = calRows_().filter(function (ev) { return (host || ev.visibility === 'students') && (!p.id || ev.id === String(p.id)); }).map(calOut_);
  var stamp = calUtc_(new Date());
  var L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Class Manager//Course calendar//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:' + calIcsText_(course), 'X-WR-TIMEZONE:' + Session.getScriptTimeZone(), 'REFRESH-INTERVAL;VALUE=DURATION:PT6H', 'X-PUBLISHED-TTL:PT6H'];
  list.forEach(function (ev) {
    var desc = [];
    if (ev.agenda) desc.push('Agenda:\n' + ev.agenda);
    if (ev.resources) desc.push('Resources:\n' + ev.resources);
    if (ev.week) desc.push('Week ' + ev.week);
    L.push('BEGIN:VEVENT', 'UID:' + ev.id + '@class-manager', 'DTSTAMP:' + stamp, 'SEQUENCE:' + Math.floor(new Date(ev.updated || ev.created || 0).getTime() / 1000 || 0));
    if (ev.allDay) L.push('DTSTART;VALUE=DATE:' + ev.utcStart, 'DTEND;VALUE=DATE:' + ev.utcEnd);
    else L.push('DTSTART:' + ev.utcStart, 'DTEND:' + ev.utcEnd);
    L.push('SUMMARY:' + calIcsText_(ev.title), 'CATEGORIES:' + calIcsText_(ev.kind.toUpperCase()));
    if (ev.location) L.push('LOCATION:' + calIcsText_(ev.location));
    if (desc.length) L.push('DESCRIPTION:' + calIcsText_(desc.join('\n\n')));
    if (ev.kind === 'deadline' || ev.kind === 'exam' || ev.kind === 'quiz') L.push('BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + calIcsText_(ev.title), 'TRIGGER:-P1D', 'END:VALARM');
    L.push('END:VEVENT');
  });
  L.push('END:VCALENDAR');
  return ContentService.createTextOutput(L.map(calFold_).join('\r\n') + '\r\n').setMimeType(ContentService.MimeType.ICAL);
}

// ---------- Messages and announcements ----------
// Students sign in with their Student ID and personal access code; the lecturer with the host key. Messages are stored in
// the Messages tab and delivered when each person next opens the page (store and forward), with unread counts.
// Conversations: the whole class; each lecturer-made group (Groups tab); groups that students make themselves; a private
// conversation between each student and the lecturer; and, when the lecturer allows it, between two students.
// A student sees only conversations they belong to. The lecturer sees every conversation and can remove messages, mute a
// student, set the rules, make the class conversation announcement-only, or switch chat off. A sender's name (from the
// class list) is shown to the people in the conversation; Student IDs are shown only to the lecturer.
var MSG_TAB = 'Messages', MSG_HEAD = ['Message ID', 'Time', 'Conversation', 'From', 'Name', 'Text', 'Status', 'Removed by'];
var CHG_TAB = 'Chat_Groups', CHG_HEAD = ['Group ID', 'Name', 'Owner', 'Members', 'Created'];
var CHR_TAB = 'Chat_Read', CHR_HEAD = ['Who', 'Conversation', 'Last read'];
var ANN_TAB = 'Announcements', ANN_HEAD = ['ID', 'Title', 'Text', 'Audience', 'Pinned', 'Show from', 'Link', 'Event ID', 'Created', 'Updated', 'Status'];
var CHAT_MAX = 1000, CHAT_PER_MIN = 8, CHAT_GROUP_MAX = 12, CHAT_OWN_MAX = 5;

function chatCfg_() {
  var pr = PropertiesService.getScriptProperties();
  var muted = {}; try { muted = JSON.parse(pr.getProperty('chat_muted') || '{}'); } catch (err) { muted = {}; }
  return { mode: pr.getProperty('chat_mode') || 'on', dm: pr.getProperty('chat_dm') || 'no', groups: pr.getProperty('chat_groups') || 'yes', rules: pr.getProperty('chat_rules') || '', muted: muted };
}
function chatTxt_(s, n) { return String(s == null ? '' : s).replace(/\r/g, '').replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, '').slice(0, n).trim(); }
function chatNames_() { var o = {}; rosterRows_().forEach(function (r) { o[r[0]] = r[1] || ('Student …' + r[0].slice(-4)); }); return o; }
function chatWho_(p) { // 'LECTURER', a rostered Student ID, or an error text
  if (p.hostkey) return hostOk_(p) ? 'LECTURER' : { why: 'host key not accepted' };
  var who = studentCheck_(p.id, p.code, 'c');
  return who.id ? who.id : { why: who.why };
}
function chatGroups_() {
  return bodyRows_(sheetWith_(CHG_TAB, CHG_HEAD), CHG_HEAD.length).map(function (r) {
    return { id: String(r[0]).trim(), name: String(r[1]).trim(), owner: normId_(r[2]), members: splitIds_(r[3]).map(normId_).filter(String), created: r[4] };
  }).filter(function (g) { return g.id; });
}
// Every conversation this person may see, with its members.
function chatConvs_(who, cfg) {
  var names = chatNames_(), out = [];
  out.push({ id: 'CLASS', name: 'Whole class', kind: 'class', members: null });
  var lg = {}; groupRows_().forEach(function (r) { var k = 'L:' + r.set + '|' + r.group; (lg[k] = lg[k] || { id: k, name: r.set + ', group ' + r.group, kind: 'lecturer group', members: [] }).members.push(r.id); });
  Object.keys(lg).forEach(function (k) { out.push(lg[k]); });
  chatGroups_().forEach(function (g) { out.push({ id: 'S:' + g.id, name: g.name, kind: 'student group', owner: g.owner, members: [g.owner].concat(g.members.filter(function (m) { return m !== g.owner; })) }); });
  if (who === 'LECTURER') {
    var seen = {}; bodyRows_(sheetWith_(MSG_TAB, MSG_HEAD), 3).forEach(function (r) { var c = String(r[2]); if (/^(DM|P):/.test(c)) seen[c] = 1; });
    Object.keys(seen).forEach(function (c) {
      var ids = c.slice(c.indexOf(':') + 1).split(':');
      out.push({ id: c, name: c.indexOf('DM:') === 0 ? (names[ids[0]] || ids[0]) + ' and you' : ids.map(function (i) { return names[i] || i; }).join(' and '), kind: c.indexOf('DM:') === 0 ? 'private' : 'between students', members: ids });
    });
    return out;
  }
  var mine = out.filter(function (c) { return !c.members || c.members.indexOf(who) >= 0; });
  mine.push({ id: 'DM:' + who, name: 'The lecturer', kind: 'private', members: [who] });
  if (cfg.dm === 'yes') {
    var pc = {}; bodyRows_(sheetWith_(MSG_TAB, MSG_HEAD), 3).forEach(function (r) { var c = String(r[2]); if (c.indexOf('P:') === 0 && c.split(':').indexOf(who) > 0) pc[c] = 1; });
    Object.keys(pc).forEach(function (c) { var other = c.split(':').filter(function (x, i) { return i > 0 && x !== who; })[0]; mine.push({ id: c, name: names[other] || 'Classmate', kind: 'between students', members: c.split(':').slice(1) }); });
  }
  return mine;
}
function chatMsgs_() {
  return bodyRows_(sheetWith_(MSG_TAB, MSG_HEAD), MSG_HEAD.length).map(function (r) {
    return { id: String(r[0]), t: Number(r[1]) || 0, conv: String(r[2]), from: String(r[3]), name: String(r[4]), text: String(r[5]), status: String(r[6] || 'ok'), removedBy: String(r[7] || '') };
  }).filter(function (m) { return m.id; });
}
function chatReads_() { var o = {}; bodyRows_(sheetWith_(CHR_TAB, CHR_HEAD), 3).forEach(function (r) { o[String(r[0]) + '|' + String(r[1])] = Number(r[2]) || 0; }); return o; }
function chatMarkRead_(who, conv, t) {
  var sh = sheetWith_(CHR_TAB, CHR_HEAD), rows = bodyRows_(sh, 3);
  for (var i = 0; i < rows.length; i++) if (String(rows[i][0]) === who && String(rows[i][1]) === conv) { if ((Number(rows[i][2]) || 0) < t) { sh.getRange(i + 2, 3).setValue(t); chatBump_(); } return; }
  sh.appendRow([who, conv, t]); chatBump_();
}
function chatBump_() { try { CacheService.getScriptCache().put('chat_ver', String(Date.now()), 21600); } catch (err) { /* cache only */ } }
function chatVer_() { try { return CacheService.getScriptCache().get('chat_ver') || '0'; } catch (err) { return '0'; } }

// One request does everything a page needs: op = sync (default), send, read, group_make, group_add, group_remove, group_leave,
// and for the lecturer: remove, restore, mute, unmute, settings, group_delete, export.
function chat_(p) {
  var who = chatWho_(p);
  if (typeof who !== 'string') return { ok: false, why: who.why };
  var op = String(p.op || 'sync'), cfg = chatCfg_(), host = who === 'LECTURER';
  if (!host && cfg.mode === 'off' && op !== 'sync') return { ok: false, why: 'Chat is switched off by the lecturer.' };
  if (p.v && String(p.v) === chatVer_() && op === 'sync') return { ok: true, same: true, v: chatVer_() }; // nothing new: answer at once
  var convs = chatConvs_(who, cfg), byId = {}; convs.forEach(function (c) { byId[c.id] = c; });
  var sh = sheetWith_(MSG_TAB, MSG_HEAD), names = chatNames_();
  function can(conv) { return host || !!byId[conv] || (cfg.dm === 'yes' && /^P:\d+:\d+$/.test(conv) && conv.split(':').indexOf(who) > 0); }
  var conv = chatTxt_(p.conv, 80);
  if (op === 'send') {
    var text = chatTxt_(p.text, CHAT_MAX);
    if (!text) return { ok: false, why: 'The message is empty.' };
    if (!host) {
      if (cfg.muted[who]) return { ok: false, why: 'The lecturer has paused your messages.' };
      if (conv === 'CLASS' && cfg.mode === 'announce') return { ok: false, why: 'Only the lecturer posts in the whole-class conversation at present.' };
      var c = CacheService.getScriptCache(), k = 'chatn:' + who, n = Number(c.get(k) || 0);
      if (n >= CHAT_PER_MIN) return { ok: false, why: 'Too many messages in a short time. Wait a minute.' };
      if (/^P:/.test(conv)) { if (cfg.dm !== 'yes') return { ok: false, why: 'Messages between students are switched off.' }; var ids = conv.split(':').slice(1); if (ids.length !== 2 || ids.indexOf(who) < 0 || !rosterSet_()[ids[0]] || !rosterSet_()[ids[1]] || ids[0] === ids[1]) return { ok: false, why: 'No such classmate.' }; }
    }
    if (/^DM:/.test(conv) && host && !rosterSet_()[conv.slice(3)]) return { ok: false, why: 'That Student ID is not on the class list.' };
    if (!can(conv)) return { ok: false, why: 'You are not in that conversation.' };
    if (!host) { var c2 = CacheService.getScriptCache(); c2.put('chatn:' + who, String(Number(c2.get('chatn:' + who) || 0) + 1), 60); }
    var t = Date.now();
    sh.appendRow(['M' + t + Utilities.getUuid().slice(0, 4), t, conv, host ? 'LECTURER' : who, host ? 'Lecturer' : (names[who] || 'Student'), text, 'ok', '']);
    chatMarkRead_(who, conv, t); chatBump_();
  }
  if (op === 'dm_start' && !host) { // a private conversation with a classmate, by Student ID
    if (cfg.dm !== 'yes') return { ok: false, why: 'Messages between students are switched off.' };
    var other = normId_(p.other); if (!rosterSet_()[other] || other === who) return { ok: false, why: 'That Student ID is not on the class list.' };
    conv = 'P:' + [who, other].sort().join(':'); byId[conv] = { id: conv, name: names[other] || 'Classmate', kind: 'between students', members: [who, other] }; convs.push(byId[conv]);
  }
  if (/^group_/.test(op)) {
    var gs = sheetWith_(CHG_TAB, CHG_HEAD), list = chatGroups_(), gid = String(p.group || '').replace(/^S:/, '');
    var g = list.filter(function (x) { return x.id === gid; })[0];
    var save = function () { rewriteBody_(gs, CHG_HEAD.length, list.map(function (x) { return [x.id, x.name, x.owner, x.members.join(','), x.created]; })); chatBump_(); };
    if (op === 'group_make') {
      if (!host && cfg.groups !== 'yes') return { ok: false, why: 'Students cannot make groups at present.' };
      var nm = chatTxt_(p.name, 60); if (!nm) return { ok: false, why: 'Give the group a name.' };
      if (!host && list.filter(function (x) { return x.owner === who; }).length >= CHAT_OWN_MAX) return { ok: false, why: 'You already have ' + CHAT_OWN_MAX + ' groups.' };
      g = { id: 'G' + Utilities.getUuid().replace(/-/g, '').slice(0, 8), name: nm, owner: host ? '' : who, members: [], created: new Date() }; list.push(g); gid = g.id; conv = 'S:' + g.id;
    } else if (!g) return { ok: false, why: 'No such group.' };
    if (op === 'group_make' || op === 'group_add') {
      if (!host && g.owner !== who) return { ok: false, why: 'Only the person who made the group can add members.' };
      var add = splitIds_(p.ids).map(normId_).filter(function (i) { return i && i !== g.owner; }), bad = add.filter(function (i) { return !rosterSet_()[i]; });
      if (bad.length) return { ok: false, why: 'Not on the class list: ' + bad.join(', ') + '.' };
      add.forEach(function (i) { if (g.members.indexOf(i) < 0) g.members.push(i); });
      if (g.members.length + 1 > CHAT_GROUP_MAX) return { ok: false, why: 'A group can have at most ' + CHAT_GROUP_MAX + ' members.' };
      save();
    }
    if (op === 'group_remove') { if (!host && g.owner !== who) return { ok: false, why: 'Only the person who made the group can remove members.' }; g.members = g.members.filter(function (i) { return i !== normId_(p.other); }); save(); }
    if (op === 'group_leave') { if (g.owner === who) { if (!g.members.length) list = list.filter(function (x) { return x !== g; }); else { g.owner = g.members.shift(); } } else g.members = g.members.filter(function (i) { return i !== who; }); save(); conv = ''; }
    if (op === 'group_delete') { if (!host && g.owner !== who) return { ok: false, why: 'Only the person who made the group can close it.' }; list = list.filter(function (x) { return x !== g; }); save(); conv = ''; }
    convs = chatConvs_(who, cfg); byId = {}; convs.forEach(function (c2) { byId[c2.id] = c2; });
  }
  if (host && (op === 'remove' || op === 'restore')) {
    var rows = bodyRows_(sh, 1);
    for (var i = 0; i < rows.length; i++) if (String(rows[i][0]) === String(p.msg)) { sh.getRange(i + 2, 7, 1, 2).setValues([[op === 'remove' ? 'removed' : 'ok', op === 'remove' ? new Date().toISOString() : '']]); break; }
    chatBump_();
  }
  if (host && (op === 'mute' || op === 'unmute')) {
    var mid = normId_(p.other); if (op === 'mute') cfg.muted[mid] = 1; else delete cfg.muted[mid];
    PropertiesService.getScriptProperties().setProperty('chat_muted', JSON.stringify(cfg.muted)); chatBump_();
  }
  if (host && op === 'settings') {
    var pr = PropertiesService.getScriptProperties();
    if (['on', 'announce', 'off'].indexOf(String(p.mode)) >= 0) pr.setProperty('chat_mode', String(p.mode));
    if (['yes', 'no'].indexOf(String(p.dm)) >= 0) pr.setProperty('chat_dm', String(p.dm));
    if (['yes', 'no'].indexOf(String(p.groups)) >= 0) pr.setProperty('chat_groups', String(p.groups));
    if (p.rules !== undefined) pr.setProperty('chat_rules', chatTxt_(p.rules, 1500));
    cfg = chatCfg_(); chatBump_();
  }
  var msgs = chatMsgs_(), reads = chatReads_();
  if (host && op === 'export') return { ok: true, messages: msgs.map(function (m) { return [new Date(m.t).toISOString(), m.conv, (byId[m.conv] || {}).name || m.conv, m.from, m.name, m.text, m.status]; }) };
  if (op === 'read' && conv && can(conv)) { var last = 0; msgs.forEach(function (m) { if (m.conv === conv && m.t > last) last = m.t; }); if (last) { chatMarkRead_(who, conv, last); reads[who + '|' + conv] = last; } }
  // The list of conversations with unread counts, and the messages of the open one.
  var outConvs = convs.map(function (c) {
    var r = reads[who + '|' + c.id] || 0, unread = 0, lastT = 0, lastText = '';
    msgs.forEach(function (m) { if (m.conv !== c.id) return; if (m.t > lastT) { lastT = m.t; lastText = m.status === 'ok' ? m.text.slice(0, 80) : ''; } if (m.t > r && m.from !== who && m.status === 'ok') unread++; });
    var o = { id: c.id, name: c.name, kind: c.kind, unread: unread, last: lastT, preview: lastText };
    if (c.members) { o.count = c.members.length; if (host || c.kind === 'student group') o.members = c.members.map(function (i) { return { id: host || c.owner === who ? i : '', name: names[i] || 'Classmate', owner: i === c.owner, muted: host ? !!cfg.muted[i] : undefined }; }); }
    if (c.kind === 'student group') o.mine = c.owner === who;
    return o;
  }).sort(function (a, b) { return (a.id === 'CLASS' ? -1 : b.id === 'CLASS' ? 1 : b.last - a.last); });
  var out = { ok: true, v: chatVer_(), me: host ? 'LECTURER' : who, myName: host ? 'Lecturer' : names[who] || '', host: host, mode: cfg.mode, dm: cfg.dm, groups: cfg.groups, rules: cfg.rules, muted: !host && !!cfg.muted[who], conversations: outConvs, conv: '' };
  if (host) out.mutedIds = Object.keys(cfg.muted);
  if (conv && can(conv) && (host || cfg.mode !== 'off')) {
    var after = Number(p.after) || 0, inConv = msgs.filter(function (m) { return m.conv === conv; });
    var others = (byId[conv] && byId[conv].members || []).filter(function (i) { return i !== who; });
    var seenBy = function (t) { // delivery state for the sender's own messages: read by everyone else, by some, or not yet
      if (conv === 'CLASS') return '';
      var ids = /^DM:/.test(conv) ? (host ? [conv.slice(3)] : ['LECTURER']) : others;
      var n = ids.filter(function (i) { return (reads[i + '|' + conv] || 0) >= t; }).length;
      return n && n === ids.length ? 'read' : n ? 'read by ' + n : 'sent';
    };
    out.conv = conv;
    out.messages = inConv.filter(function (m) { return m.t > after; }).slice(after ? 0 : -150).map(function (m) {
      var o = { id: m.id, t: m.t, mine: m.from === who, name: m.name, text: m.status === 'ok' || host ? m.text : '', removed: m.status !== 'ok', lecturer: m.from === 'LECTURER' };
      if (host) o.from = m.from;
      if (o.mine) o.state = seenBy(m.t);
      return o;
    });
  }
  out.unread = outConvs.reduce(function (s, c) { return s + c.unread; }, 0);
  return out;
}

// ---------- Announcements: posted by the lecturer, read by students ----------
// Audience: 'all' (shown on the portal to anyone), 'class' (students signed in with their access code) or a list of
// conversations (lecturer-made or student-made groups). An announcement can be pinned, held until a date and time,
// carry a link and point to a calendar event.
function annRows_() {
  return bodyRows_(sheetWith_(ANN_TAB, ANN_HEAD), ANN_HEAD.length).map(function (r) {
    return { id: String(r[0]), title: String(r[1]), text: String(r[2]), audience: String(r[3] || 'all'), pinned: String(r[4]) === 'yes', from: calWhen_(r[5]), link: String(r[6] || ''), event: String(r[7] || ''), created: String(r[8] || ''), updated: String(r[9] || ''), status: String(r[10] || 'ok') };
  }).filter(function (a) { return a.id && a.status !== 'deleted'; });
}
function annSave_(list) { rewriteBody_(sheetWith_(ANN_TAB, ANN_HEAD), ANN_HEAD.length, list.map(function (a) { return [a.id, a.title, a.text, a.audience, a.pinned ? 'yes' : 'no', a.from ? "'" + a.from : '', a.link, a.event, a.created, a.updated, a.status || 'ok']; })); try { CacheService.getScriptCache().remove('ann_pub'); } catch (err) { /* cache only */ } }
function announcements_(p) { // public for audience 'all'; signed-in students also get their own; the lecturer gets all, with edit ops
  var who = (p.hostkey || p.code) ? chatWho_(p) : null;
  if (who && typeof who !== 'string') return { ok: false, why: who.why };
  var host = who === 'LECTURER', list = annRows_(), now = calLocal_(new Date(), true);
  if (host && p.op) {
    var a = p.ann ? list.filter(function (x) { return x.id === String(p.ann); })[0] : null, ts = new Date().toISOString();
    if (p.op === 'save') {
      var title = chatTxt_(p.title, 160), text = chatTxt_(p.text, 4000);
      if (!title) return { ok: false, why: 'Give the announcement a title.' };
      var aud = String(p.audience || 'all'); if (!/^(all|class|([LS]:[^,]+)(,[LS]:[^,]+)*)$/.test(aud)) aud = 'all';
      var link = chatTxt_(p.link, 400); if (link && !/^(https?:\/\/|[\w.-]+\.(html|pdf)([#?].*)?$)/i.test(link)) return { ok: false, why: 'The link must be a web address or a course page.' };
      if (!a) { a = { id: 'A' + Utilities.getUuid().replace(/-/g, '').slice(0, 10), created: ts }; list.unshift(a); }
      a.title = title; a.text = text; a.audience = aud; a.pinned = String(p.pinned) === 'yes'; a.from = calWhen_(p.from); a.link = link; a.event = chatTxt_(p.event, 40); a.updated = ts; a.status = 'ok';
      annSave_(list); chatBump_();
    } else if (p.op === 'delete' && a) { list = list.filter(function (x) { return x !== a; }); annSave_(list); chatBump_(); }
  }
  var groups = {};
  if (who && !host) { chatConvs_(who, chatCfg_()).forEach(function (c) { groups[c.id] = 1; }); }
  var reads = who ? chatReads_() : {}, lastRead = who ? (reads[who + '|ANN'] || 0) : 0;
  var events = {}; try { calRows_().forEach(function (ev) { events[ev.id] = ev; }); } catch (err) { /* no calendar */ }
  var visible = list.filter(function (a2) {
    if (host) return true;
    if (a2.from && a2.from > now) return false;
    if (a2.audience === 'all') return true;
    if (!who) return false;
    if (a2.audience === 'class') return true;
    return a2.audience.split(',').some(function (g) { return groups[g]; });
  }).map(function (a3) {
    var ev = events[a3.event], o = { id: a3.id, title: a3.title, text: a3.text, pinned: a3.pinned, link: a3.link, at: a3.from ? a3.from : a3.created.slice(0, 16), audience: host ? a3.audience : undefined, scheduled: host && a3.from > now ? a3.from : undefined, unread: !!who && !host && Date.parse(a3.updated) > lastRead };
    if (ev && (host || ev.visibility === 'students')) o.event = { id: ev.id, title: ev.title, start: ev.start };
    return o;
  }).sort(function (x, y) { return (y.pinned - x.pinned) || (x.at < y.at ? 1 : x.at > y.at ? -1 : 0); });
  if (who && !host && p.read === 'yes') chatMarkRead_(who, 'ANN', Date.now());
  return { ok: true, host: host, announcements: visible.slice(0, host ? 200 : 50), unread: visible.filter(function (a4) { return a4.unread; }).length };
}

// ===== 60-portal.gs =====
// Module portal. Student portal and Control Centre: portal status, My results, the live quiz week and the pre-class check.
// Edit the files in apps_script/src/; apps_script/quiz_receiver.gs is built from them (node apps_script/build.js).

// ---------- Portal and Control Centre support (additive: no existing action changes) ----------
// SCRIPT_VERSION: change it whenever the script is redeployed; the Control Centre compares it with the version its page expects.
// Key!M2 = Off hides "My results" from students (default On).
var SCRIPT_VERSION = '2026-11-11-security-1';

function resultsOn_() {
  try {
    var ks = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(KEY_TAB);
    return !ks || String(ks.getRange(2, 13).getValue()).trim().toLowerCase() !== 'off';
  } catch (err) { return true; }
}

// Key!N2 holds the week the lecturer chose in the Control Centre (1 to 12). Empty means: use data/portal.json.
function weekChoice_() {
  try {
    var v = Number(SpreadsheetApp.getActiveSpreadsheet().getSheetByName(KEY_TAB).getRange(2, 14).getValue());
    return v >= 1 && v <= 12 ? v : 0;
  } catch (err) { return 0; }
}

function setWeek_(p) { // host only; w=0 clears the choice
  var w = Number(String(p.w || '').replace(/\D/g, '').slice(0, 2));
  if (isNaN(w) || w < 0 || w > 12) return { ok: false, why: 'week must be 0 to 12' };
  var ks = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(KEY_TAB);
  if (!ks) return { ok: false, why: 'no Key tab' };
  ks.getRange(2, 14).setValue(w || '');
  try { CacheService.getScriptCache().remove('portal'); } catch (err) { /* cache only */ }
  return { ok: true, week: w };
}

function portalStatus_() { // public, no secrets: is attendance open, is a live quiz open, is "My results" on. Cached 5 s.
  var cache = null; try { cache = CacheService.getScriptCache(); var h = cache.get('portal'); if (h) return JSON.parse(h); } catch (err) { cache = null; }
  var att = 'closed';
  try { attRows_().forEach(function (r) { if (r.status === 'Open') att = 'open'; }); } catch (err) { /* leave closed */ }
  var quiz = 'none';
  try {
    var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONTROL_TAB);
    if (sh && sh.getLastRow() > 1) {
      sh.getRange(2, 1, sh.getLastRow() - 1, CTL_HEADER.length).getValues().forEach(function (v) {
        var st = eff_({ v: v }); // lobby, running or paused counts as open; the join code is never returned
        if (st === 'lobby' || st === 'running' || st === 'paused') quiz = st;
      });
    }
  } catch (err) { /* leave none */ }
  var o = { portal: 1, attendance: att, quiz: quiz, results: resultsOn_(), version: SCRIPT_VERSION, week: weekChoice_() };
  if (cache) { try { cache.put('portal', JSON.stringify(o), 5); } catch (err) { /* cache only */ } }
  return o;
}

// A student's own attendance and quiz scores, found by ID. Same failure limit as check-in. Returns nothing about any other student.
function portalResults_(p) {
  if (!resultsOn_()) return { ok: false, why: 'results off' };
  var who = studentCheck_(p.id, p.code, 'r'); // the ID with its personal access code or a session, both required
  if (!who.id) return { ok: false, why: who.why };
  var id = who.id;
  var ss = SpreadsheetApp.getActiveSpreadsheet(), out = { ok: true, attendance: [], quizzes: [] };
  var at = ss.getSheetByName(ATT_TAB);
  if (at && at.getLastRow() > 1 && at.getLastColumn() > 1) {
    var g = at.getRange(1, 1, at.getLastRow(), at.getLastColumn()).getValues();
    for (var i = 1; i < g.length; i++) if (normId_(g[i][0]) === id) {
      for (var c = 1; c < g[0].length; c++) if (g[i][c] !== '' && String(g[0][c]).trim()) out.attendance.push([String(g[0][c]).trim(), Number(g[i][c]) ? 1 : 0]);
      break;
    }
  }
  var sc = ss.getSheetByName(SCORES_TAB);
  if (sc && sc.getLastRow() > 3 && sc.getLastColumn() > 4) {
    var s = sc.getRange(1, 1, sc.getLastRow(), sc.getLastColumn()).getValues();
    for (var r = 3; r < s.length; r++) if (normId_(s[r][0]) === id) {
      for (var k = 4; k < s[0].length; k++) if (s[r][k] !== '' && String(s[0][k]).trim()) out.quizzes.push([String(s[0][k]).trim(), s[r][k] + (s[2][k] !== '' ? ' / ' + s[2][k] : '')]);
      break;
    }
  }
  try { out.groups = studentGroups_(id); } catch (err) { out.groups = []; }
  try { var ln = studentLearning_(id); out.mastery = ln.mastery; out.revisit = ln.revisit; out.practice = ln.practice; } catch (err) { out.learningError = true; }
  try { var sp = studentProgress_(id); out.progress = { outcomes: sp.outcomes.map(function (o) { return { label: o.label, answers: o.answers, start: o.start, current: o.current, gain: o.gain, level: o.level }; }), timeline: sp.timeline, overall: { answers: sp.overall.answers, start: sp.overall.start, current: sp.overall.current, gain: sp.overall.gain }, minimum: sp.minimum }; } catch (err) { out.progressError = true; }
  try { out.groupWork = asgRows_().filter(function (a) { return (out.groups || []).some(function (g) { return g.set === a.set && asgFor_(a, g.group); }); }).length; } catch (err) { out.groupWork = 0; }
  return out;
}

// Host only: the checks behind the Control Centre's "Run checks" button. Reads only; nothing is changed.
function preclass_(p) {
  var ss = SpreadsheetApp.getActiveSpreadsheet(), o = { ok: true, version: SCRIPT_VERSION, serverNow: Date.now() };
  try { o.rosterCount = rosterRows_().length; } catch (err) { o.rosterCount = -1; }
  o.masterOn = masterOn_(); o.resultsOn = resultsOn_();
  try { o.totalsMode = String(ss.getSheetByName(KEY_TAB).getRange(2, 11).getValue()).trim() || 'Best'; } catch (err) { o.totalsMode = 'Best'; }
  var w = String(p.week || '').replace(/\D/g, '').slice(0, 2);
  if (w) {
    o.week = Number(w); o.weekListed = false; o.bankQuestions = 0;
    try {
      var weeks = siteJson_('/apps_script/live_quizzes.json').weeks || {};
      o.weekListed = !!weeks[w];
      if (o.weekListed) { var b = siteJson_('/quizzes/lecture' + w + '.json'); o.bankQuestions = (b.questions || []).length; }
    } catch (err) { o.bankError = true; }
  }
  var ps = portalStatus_(); o.attendance = ps.attendance; o.quiz = ps.quiz;
  return o;
}

// ===== 90-router.gs =====
// Module router. Router: doPost and doGet, the only entry points. Each action checks its credentials here and then calls one module.
// Edit the files in apps_script/src/; apps_script/quiz_receiver.gs is built from them (node apps_script/build.js).

// ---------- POST: answers, joins, progress, reports, attempts ----------

function doPost(e) {
  var p = (e && e.parameter) || {};
  reqStart_(true);
  if (p.action && !p.kind) return route_(e); // every page request, sent by POST so that keys and codes stay out of web addresses
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
        var ats = append_('Attempts', ['Timestamp', 'Student ID', 'Quiz', 'Attempt', 'Score', 'Total', 'Seconds', 'Wrong question ids', 'Question ids'],
          [new Date(), clean_(p.id, 30), clean_(p.quiz, 80), clean_(p.attempt, 10), clean_(p.score, 10), clean_(p.total, 10), clean_(p.seconds, 10), clean_(p.wrong, 1200), clean_(p.asked, 1500)]);
        if (!String(ats.getRange(1, 9).getValue()).trim()) ats.getRange(1, 9).setValue('Question ids');
        // held in Attempts until a release: Master and Scores are not touched here
      }
      return out_('ok');
    } finally {
      lk.releaseLock();
    }
  }
  var name = clean_(p.name, 40), id = clean_(p.id, 20), code = clean_(p.code, 30).toUpperCase();
  function withReceipt_(o) { // the phone asks for a receipt: the answer is JSON and carries it, so the student alone can see the result later
    if (p.want !== 'receipt') return out_(o);
    var r = { ok: o === 'ok', outcome: o }; if (o === 'ok' && id && code) r.receipt = quizReceipt_(code, id);
    return ContentService.createTextOutput(JSON.stringify(r)).setMimeType(ContentService.MimeType.JSON);
  }
  function fin_(o) { log_(o, name, id, code); return withReceipt_(o); }

  if (p.kind === 'answer') { // paced quiz: one answer to the question that is open right now
    var qn = Number(p.q), al = String(p.answer || '').trim().toUpperCase();
    var ca = ctl_(code);
    if (!name || !id || !keyRow_(code) || LETTERS.indexOf(al) < 0 || !(qn >= 1 && qn <= (ca ? quizN_(ca) : 5))) return fin_('bad answer');
    if (!ca || !paced_(ca)) return fin_('not paced');
    if (eff_(ca) !== 'running') return fin_('not open');
    if (Number(ca.v[11]) !== qn) return fin_('wrong question');
    if (Number(ca.v[13]) && Date.now() > Number(ca.v[13]) + GRACE_MS) return fin_('question closed');
    if (!allowLate_(ca) && !hasPresence_(code, id)) return fin_('not joined');
    var cfv = String(p.conf || '').trim().toUpperCase().charAt(0); if ('HML'.indexOf(cfv) < 0) cfv = '';
    var ash = append_(ANSWERS_TAB, ['Timestamp', 'ID', 'First Name', 'Join Code', 'Q', 'Answer', 'Round', 'Confidence', 'Vote'], [new Date(), id, name, code, qn, al, Number(ca.v[16]) || 0, cfv, voteOf_(ca)]);
    try { var hc = CacheService.getScriptCache(); if (!hc.get('ansHdr2')) { if (!String(ash.getRange(1, 8).getValue()).trim()) ash.getRange(1, 8).setValue('Confidence'); if (!String(ash.getRange(1, 9).getValue()).trim()) ash.getRange(1, 9).setValue('Vote'); hc.put('ansHdr2', '1', 21600); } } catch (err) { /* header only */ }
    return out_('ok');
  }
  if (p.kind === 'join' || p.kind === 'progress') { // lobby and live participation
    if (!name || !id || !keyRow_(code)) return withReceipt_('ok');
    var lj = LockService.getScriptLock();
    lj.waitLock(60000); // a whole class joining at once queues here
    try {
      var cj = ctl_(code), sj = cj ? eff_(cj) : 'running';
      if (cj && !allowLate_(cj) && (sj === 'running' || sj === 'paused') && !hasPresence_(code, id)) return withReceipt_('late');
      presence_(code, id, name, p.kind === 'progress' ? 'inprogress' : 'joined');
    } finally {
      lj.releaseLock();
    }
    return withReceipt_('ok');
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

    var sh = stagedSheet_(); // held until released
    var rows0 = respRows_(), n = rows0.length + 1;
    var rnd = roundOf_(code);
    var ans = [];
    for (var q = 1; q <= 5; q++) {
      var a = String(p['q' + q] || '').trim().toUpperCase();
      ans.push(LETTERS.indexOf(a) >= 0 ? a : '');
    }
    var marks = mark_(lettersFor_(code, null), ans), score = marks.reduce(function (x, y) { return x + y; }, 0);
    if (n > 1) { // first attempt per ID and join code in this round only
      var seen = rows0.map(function (r) { return r.slice(2, 11); });
      for (var j = 0; j < seen.length; j++) {
        if (String(seen[j][0]).trim() === id && String(seen[j][1]).trim().toUpperCase() === code && (Number(seen[j][8]) || 0) === rnd) {
          return fin_('duplicate');
        }
      }
    }
    sh.appendRow(rowFor_(new Date(), name, id, code, ans, score, rnd, 5, ''));
    presence_(code, id, name, 'submitted');
    return fin_('ok');
  } finally {
    lock.releaseLock();
  }
}

function doGet(e) { // reads by GET (JSONP) still work for public data; anything that needs a key or a code must come by POST
  reqStart_(false);
  return route_(e);
}

function route_(e) {
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

  if (p.action === 'version') return jsonp_(e, { ok: true, version: SCRIPT_VERSION }); // the Control Centre: does the page match this script?
  if (p.action === 'set_week') return jsonp_(e, hostOk_(p) ? setWeek_(p) : { ok: false, why: 'host key not accepted' }); // the Control Centre week selector
  if (p.action === 'portal_status') return jsonp_(e, portalStatus_()); // the student portal banner
  if (p.action === 'my_results') return jsonp_(e, portalResults_(p)); // a student's own attendance and quiz scores
  if (p.action === 'chat') { // students (ID and access code) and the lecturer (host key): conversations and messages
    if (!p.op || p.op === 'sync') return jsonp_(e, chat_(p)); // reading needs no lock
    var ml = LockService.getScriptLock(); ml.waitLock(20000);
    try { return jsonp_(e, chat_(p)); } finally { ml.releaseLock(); }
  }
  if (p.action === 'announcements') { // public for whole-class announcements; signed-in students and the lecturer see more
    if (!p.op) return jsonp_(e, announcements_(p));
    var al = LockService.getScriptLock(); al.waitLock(20000);
    try { return jsonp_(e, announcements_(p)); } finally { al.releaseLock(); }
  }
  if (p.action === 'calendar') return jsonp_(e, calendar_(p)); // public: the course calendar (events for students; every event with the host key)
  if (p.action === 'calendar_ics') return calendarIcs_(p); // public: the calendar as an iCalendar file or feed
  if (p.action === 'calendar_edit') { // host only: add, change or delete events
    if (!hostOk_(p)) return jsonp_(e, { ok: false, why: 'host key not accepted' });
    var cl = LockService.getScriptLock(); cl.waitLock(30000);
    try { return jsonp_(e, calendarAct_(p)); } finally { cl.releaseLock(); }
  }
  if (p.action === 'groups') { // host only: make, list, move, lock, mark or delete student groups
    if (!hostOk_(p)) return jsonp_(e, { ok: false, why: 'host key not accepted' });
    var gl = LockService.getScriptLock(); gl.waitLock(30000);
    try { return jsonp_(e, groupsAct_(p)); } finally { gl.releaseLock(); }
  }
  if (p.action === 'outcomes' || p.action === 'assignments') { // host only: links from questions to objectives; group assignments
    if (!hostOk_(p)) return jsonp_(e, { ok: false, why: 'host key not accepted' });
    var rd = String(p.op || 'list').toLowerCase(), fn = p.action === 'outcomes' ? outcomesAct_ : assignmentsAct_;
    if (rd === 'list' || rd === 'view') return jsonp_(e, fn(p));
    var ol = LockService.getScriptLock(); ol.waitLock(30000);
    try { return jsonp_(e, fn(p)); } finally { ol.releaseLock(); }
  }
  if (p.action === 'groups_display') return jsonp_(e, hostOk_(p) ? groupsDisplay_(p) : { ok: false, why: 'host key not accepted' }); // host only: groups on the projector
  if (p.action === 'learning_progress') return jsonp_(e, hostOk_(p) ? learningProgress_(p) : { ok: false, why: 'host key not accepted' }); // host only: Learning Progress
  if (p.action === 'group_work') return jsonp_(e, groupWork_(p)); // a student: ID and access code; their group's assignments
  if (p.action === 'insights') return jsonp_(e, hostOk_(p) ? insights_(p) : { ok: false, why: 'host key not accepted' }); // host only: Teaching insights
  if (p.action === 'class_stats') return jsonp_(e, hostOk_(p) ? classStats_(p) : { ok: false, why: 'host key not accepted' }); // host only: Class statistics
  if (p.action === 'student_stats') return jsonp_(e, hostOk_(p) ? studentStats_(p) : { ok: false, why: 'host key not accepted' }); // host only: one student in Class statistics
  if (p.action === 'access_codes') { // host only: list, create or replace students' personal codes for My results
    if (!hostOk_(p)) return jsonp_(e, { ok: false, why: 'host key not accepted' });
    var cl = LockService.getScriptLock(); cl.waitLock(20000);
    try { return jsonp_(e, accessCodes_(p)); } finally { cl.releaseLock(); }
  }
  if (p.action === 'preclass') return jsonp_(e, hostOk_(p) ? preclass_(p) : { ok: false, why: 'host key not accepted' });

  if (p.action === 'attend') return jsonp_(e, attCheckIn_(p, code)); // a student checks in: the Student ID, the QR token, the device token and the phone's rounded location
  if (p.action === 'password_status') return jsonp_(e, passwordStatus_()); // public: whether a password is chosen and a recovery code exists
  if (p.action === 'password_recover') { // public, rate limited: new password with the recovery code
    if (!REQ_.post) return jsonp_(e, { ok: false, why: 'not accepted' });
    var lk3 = LockService.getScriptLock(); lk3.waitLock(20000);
    try { return jsonp_(e, recoverHostKey_(p)); } finally { lk3.releaseLock(); }
  }
  if (p.action === 'hostcheck') return jsonp_(e, { ok: hostOk_(p), post: REQ_.post }); // the lecturer menu: is this key right? (with a session when it is)
  if (p.action === 'sessions_end') { // host only: every signed-in phone and lecturer page must sign in again
    if (!hostOk_(p)) return jsonp_(e, { ok: false, why: 'host key not accepted' });
    REQ_.session = ''; return jsonp_(e, signOutEveryone_());
  }
  if (p.action === 'held_status') return jsonp_(e, hostOk_(p) ? heldStatus_() : { ok: false, why: 'host key not accepted' }); // host only: what is waiting for release
  if (p.action === 'held_release_quiz' || p.action === 'held_discard_quiz' || p.action === 'attend_submit' || p.action === 'attend_discard') { // host only
    if (!hostOk_(p)) return jsonp_(e, { ok: false, why: 'host key not accepted' });
    var hl = LockService.getScriptLock(); hl.waitLock(30000);
    try {
      if (p.action === 'attend_submit') return jsonp_(e, attSubmit_());
      if (p.action === 'attend_discard') return jsonp_(e, attDiscard_());
      return jsonp_(e, p.action === 'held_release_quiz' ? Object.assign({ ok: true }, commitQuiz_('', true)) : Object.assign({ ok: true }, discardQuiz_('', true)));
    } finally { hl.releaseLock(); }
  }
  if (p.action === 'roster_tidy') return jsonp_(e, hostOk_(p) ? rosterTidy_(p) : { ok: false, why: 'host key not accepted' }); // host only: counts only
  if (p.action === 'roster_edit') return jsonp_(e, hostOk_(p) ? rosterEdit_(p) : { ok: false, why: 'host key not accepted' }); // host only: one ID at a time
  if (p.action === 'attend_review') return jsonp_(e, hostOk_(p) ? attReview_(p) : { ok: false, why: 'host key not accepted' }); // host only: flagged check-ins
  if (p.action === 'attend_remove' || p.action === 'attend_approve' || p.action === 'attend_phone_reset') { // host only: take out or add one check-in, or forget a student's phone
    if (!hostOk_(p)) return jsonp_(e, { ok: false, why: 'host key not accepted' });
    var rlk = LockService.getScriptLock(); rlk.waitLock(20000);
    try { return jsonp_(e, p.action === 'attend_remove' ? attRemove_(p) : p.action === 'attend_approve' ? attApprove_(p) : attPhoneReset_(normId_(p.id))); } finally { rlk.releaseLock(); }
  }
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

  if (p.action === 'review') { var rid = clean_(p.id, 20); return jsonp_(e, reviewData_(code, receiptOk_(code, rid, p.rc) ? rid : '')); } // the student's own answer only with their receipt

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
    if (!hostOk_(p)) return jsonp_(e, { ok: false, why: 'current password not accepted' });
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
    if (ch && paced_(ch) && Number(ch.v[11]) > 0) { var ac = answerCounts_(code, Number(ch.v[11])); out.answered = ac.answered; out.dist = ac.dist; if (voteOf_(ch) === 2 || discussedOf_(ch).indexOf(Number(ch.v[11])) >= 0) { out.firstVote = ac.first; out.changed = ac.changed; } }
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
    if (cd) { dr.review = reviewData_(code, ''); dr.status = ctlStatus_(cd); if (visible_(cd, 'show_leaderboard')) dr.rows = ranking_(code, '').slice(0, 20);
      if (paced_(cd) && voteOf_(cd) === 2 && Number(cd.v[11]) > 0) { var dac = answerCounts_(code, Number(cd.v[11])); dr.revote = { q: Number(cd.v[11]), firstAnswered: dac.first.answered, answered: dac.changed }; } } // counts only: no spread before the question closes
    return jsonp_(e, dr);
  }

  if (p.action === 'result') {
    var id = clean_(p.id, 20), key = keyRow_(code), cx = ctl_(code);
    if (id && !receiptOk_(code, id, p.rc)) return jsonp_(e, { found: false, receipt: false, outcome: lastOutcome_(id, code), keyMissing: !key }); // only the phone that took part
    if (key && id) {
      var rnd2 = roundOf_(code), rows = respRows_().map(function (r) { return r.slice(2, 14); }); // ID, Join Code, Q1 to Q5, Score, Round, Questions, Answers, Week
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
  return out_('Class Manager quiz receiver is running');
}
