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
