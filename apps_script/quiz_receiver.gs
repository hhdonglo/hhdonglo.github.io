// PHYS 143 try-questions receiver. Bound to the "PHYS 143 Quizzes (Responses)" Sheet.
// Appends one row per first attempt to "Form Responses 1":
// Timestamp, First Name, ID, Join Code, Q1, Q2, Q3, Q4, Q5.
// Also records practice-page reports ("Reports" tab) and optional-ID attempts ("Attempts" tab), chosen by the kind field.
// Accepted join codes are listed in column A of a private tab named "Codes" (one per row, no header).

var RESPONSES_TAB = 'Form Responses 1';
var CODES_TAB = 'Codes';
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
  try {
    var link = SpreadsheetApp.getActiveSpreadsheet().getUrl() + '#gid=' + sh.getSheetId() + '&range=A' + sh.getLastRow();
    MailApp.sendEmail(NOTIFY_EMAIL, 'PHYS 143 report: ' + r.lecture + ', ' + r.qid,
      'A student reported a problem.\n\nTime: ' + r.time + '\nPage: ' + r.page + '\nLecture: ' + r.lecture + '\nQuestion id: ' + r.qid +
      '\nQuestion: ' + r.question + '\nAnswer shown: ' + r.answer + '\n\nComment:\n' + r.comment + '\n\nOpen the row: ' + link);
  } catch (err) { /* the row is already saved; a mail failure must not lose it */ }
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
  var name = clean_(p.name, 40), id = clean_(p.id, 20), code = clean_(p.code, 30).toUpperCase();
  if (!name || !id || !code) return out_('missing');

  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var codes = ss.getSheetByName(CODES_TAB);
    var ok = false;
    if (codes && codes.getLastRow() > 0) {
      var list = codes.getRange(1, 1, codes.getLastRow(), 1).getValues();
      for (var i = 0; i < list.length; i++) {
        if (String(list[i][0]).trim().toUpperCase() === code) { ok = true; break; }
      }
    }
    if (!ok) return out_('bad code');

    var sh = ss.getSheetByName(RESPONSES_TAB);
    var n = sh.getLastRow();
    if (n > 1) { // first attempt per ID and join code only
      var seen = sh.getRange(2, 3, n - 1, 2).getValues();
      for (var j = 0; j < seen.length; j++) {
        if (String(seen[j][0]).trim() === id && String(seen[j][1]).trim().toUpperCase() === code) return out_('duplicate');
      }
    }
    var row = [new Date(), name, id, code];
    for (var q = 1; q <= 5; q++) {
      var a = String(p['q' + q] || '').trim().toUpperCase();
      row.push(LETTERS.indexOf(a) >= 0 ? a : '');
    }
    sh.appendRow(row);
    return out_('ok');
  } finally {
    lock.releaseLock();
  }
}

function doGet() { return out_('PHYS 143 quiz receiver is running'); }

function out_(t) { return ContentService.createTextOutput(t); }
