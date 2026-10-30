// PHYS 143 try-questions receiver. Bound to the "PHYS 143 Quizzes (Responses)" Sheet.
// Appends one row per first attempt to "Form Responses 1":
// Timestamp, First Name, ID, Join Code, Q1, Q2, Q3, Q4, Q5.
// Also records practice-page reports ("Reports" tab) and optional-ID attempts ("Attempts" tab), chosen by the kind field.
// Each quiz is one row of the private "Key" tab: Join Code, Q1 to Q5 (the correct letters), Ranking (Open or Closed).
// Score is worked out here from the Key, never in the page. The page asks for its own result and for the ranking switch.
// Form Responses 1 columns: Timestamp, First Name, ID, Join Code, Q1 to Q5, Score.

var RESPONSES_TAB = 'Form Responses 1';
var KEY_TAB = 'Key'; // private: Join Code | Q1 | Q2 | Q3 | Q4 | Q5 | Ranking (Open or Closed), one row per quiz
var LETTERS = ['A', 'B', 'C', 'D', 'E'];
var NOTIFY_EMAIL = 'hkdonglo@gmail.com'; // new reports are emailed here

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

function keyRow_(code) {
  var ks = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(KEY_TAB);
  if (!ks || ks.getLastRow() < 2) return null;
  var rows = ks.getRange(2, 1, ks.getLastRow() - 1, 7).getValues();
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
  sh.appendRow(['Timestamp', 'First Name', 'ID', 'Join Code', 'Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'Score']);
  return sh;
}

// Run once from the editor: makes sure the Key, responses and Log tabs exist and tells you what it found.
function setup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var ks = ss.getSheetByName(KEY_TAB) || ss.insertSheet(KEY_TAB);
  if (ks.getLastRow() === 0) ks.appendRow(['Join Code', 'Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'Ranking']);
  if (ks.getLastRow() < 2) ks.appendRow(['2627', '', '', '', '', '', 'Open']);
  var rs = responses_();
  if (!rs.getRange(1, 10).getValue()) rs.getRange(1, 10).setValue('Score');
  var names = ss.getSheets().map(function (x) { return x.getName(); });
  var msg = 'Setup finished. Key tab: ' + KEY_TAB + ' (type the correct letters in row 2). Responses tab: ' + rs.getName() + '. Tabs in this file: ' + names.join(', ') + '.';
  log_('setup', msg, '', '');
  try { SpreadsheetApp.getUi().alert(msg); } catch (err) { /* not run from the sheet */ }
  return msg;
}

function jsonp_(e, obj) {
  var cb = String((e && e.parameter && e.parameter.callback) || '');
  var body = JSON.stringify(obj);
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(cb)) return ContentService.createTextOutput(body).setMimeType(ContentService.MimeType.JSON);
  return ContentService.createTextOutput(cb + '(' + body + ')').setMimeType(ContentService.MimeType.JAVASCRIPT);
}

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
  function fin_(o) { log_(o, name, id, code); return out_(o); }
  var name = clean_(p.name, 40), id = clean_(p.id, 20), code = clean_(p.code, 30).toUpperCase();
  if (!name || !id || !code) return fin_('missing');

  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var key = keyRow_(code);
    if (!key) return fin_('bad code');

    var sh = responses_();
    var n = sh.getLastRow();
    if (n > 1) { // first attempt per ID and join code only
      var seen = sh.getRange(2, 3, n - 1, 2).getValues();
      for (var j = 0; j < seen.length; j++) {
        if (String(seen[j][0]).trim() === id && String(seen[j][1]).trim().toUpperCase() === code) return fin_('duplicate');
      }
    }
    var ans = [];
    for (var q = 1; q <= 5; q++) {
      var a = String(p['q' + q] || '').trim().toUpperCase();
      ans.push(LETTERS.indexOf(a) >= 0 ? a : '');
    }
    var score = mark_(key, ans).reduce(function (x, y) { return x + y; }, 0);
    if (n === 0) sh.appendRow(['Timestamp', 'First Name', 'ID', 'Join Code', 'Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'Score']);
    else if (!sh.getRange(1, 10).getValue()) sh.getRange(1, 10).setValue('Score');
    sh.appendRow([new Date(), name, id, code].concat(ans, [score]));
    return fin_('ok');
  } finally {
    lock.releaseLock();
  }
}

// GET: ?action=result&id=..&code=.. gives that student's own score and right/wrong flags;
//      ?action=ranking&code=..&id=.. gives the live class ranking (first names and scores; Key column G = Hidden turns it off);
//      ?action=status&code=.. says whether the ranking is hidden or final. Both answer as JSONP (callback=...).
function doGet(e) {
  var p = (e && e.parameter) || {};
  var code = clean_(p.code, 30).toUpperCase();
  if (p.action === 'status') {
    var k = keyRow_(code);
    var v = k ? String(k[6]).trim().toLowerCase() : '';
    return jsonp_(e, { hidden: v === 'hidden', closed: v === 'closed' });
  }
  if (p.action === 'ranking') { // live class ranking for one join code: first names and scores only
    var rk = keyRow_(code), me = clean_(p.id, 20);
    if (!rk) return jsonp_(e, { hidden: false, rows: [] });
    if (String(rk[6]).trim().toLowerCase() === 'hidden') return jsonp_(e, { hidden: true, rows: [] });
    var rsh = responses_(), list = [];
    if (rsh.getLastRow() > 1) {
      var data = rsh.getRange(2, 1, rsh.getLastRow() - 1, 10).getValues(); // Timestamp, First Name, ID, Join Code, Q1 to Q5, Score
      for (var r = 0; r < data.length; r++) {
        if (String(data[r][3]).trim().toUpperCase() === code && data[r][9] !== '') {
          list.push({ name: String(data[r][1]), score: Number(data[r][9]), me: String(data[r][2]).trim() === me });
        }
      }
    }
    list.sort(function (x, y) { return y.score - x.score || x.name.localeCompare(y.name); });
    return jsonp_(e, { hidden: false, closed: String(rk[6]).trim().toLowerCase() === 'closed', rows: list.slice(0, 300) });
  }
  if (p.action === 'result') {
    var id = clean_(p.id, 20), key = keyRow_(code);
    var sh = responses_();
    if (key && id && sh && sh.getLastRow() > 1) {
      var rows = sh.getRange(2, 3, sh.getLastRow() - 1, 7).getValues(); // ID, Join Code, Q1 to Q5
      for (var i = 0; i < rows.length; i++) {
        if (String(rows[i][0]).trim() === id && String(rows[i][1]).trim().toUpperCase() === code) {
          var flags = mark_(key, rows[i].slice(2, 7));
          return jsonp_(e, { found: true, score: flags.reduce(function (x, y) { return x + y; }, 0), total: 5, flags: flags, outcome: lastOutcome_(id, code) });
        }
      }
    }
    return jsonp_(e, { found: false, outcome: lastOutcome_(id, code), keyMissing: !key });
  }
  return out_('PHYS 143 quiz receiver is running');
}

function out_(t) { return ContentService.createTextOutput(t); }
