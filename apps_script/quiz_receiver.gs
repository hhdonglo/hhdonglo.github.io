// PHYS 143 try-questions receiver. Bound to the "PHYS 143 Quizzes (Responses)" Sheet.
// Appends one row per first attempt to "Form Responses 1":
// Timestamp, First Name, ID, Join Code, Q1, Q2, Q3, Q4, Q5.
// Accepted join codes are listed in column A of a private tab named "Codes" (one per row, no header).

var RESPONSES_TAB = 'Form Responses 1';
var CODES_TAB = 'Codes';
var LETTERS = ['A', 'B', 'C', 'D', 'E'];

function clean_(v, max) {
  var s = String(v == null ? '' : v).trim().slice(0, max);
  if (/^[=+\-@]/.test(s)) s = "'" + s; // keep a typed value from running as a formula
  return s;
}

function doPost(e) {
  var p = (e && e.parameter) || {};
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
