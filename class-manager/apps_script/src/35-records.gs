// Student records beyond attendance and quizzes: laboratory, assignment, practice and group assessment scores (Records tab, filed by
// category and assessment) and the lecturer's notes about a student (Student_Notes tab). Both are keyed by Student ID and only grow.
var RECORDS_TAB = 'Records', RECORDS_HEAD = ['Timestamp', 'Student ID', 'Category', 'Assessment', 'Score', 'Out of', 'Lecture'];
var NOTES_TAB = 'Student_Notes', NOTES_HEAD = ['Timestamp', 'Student ID', 'Note', 'By'];

// One student's records and notes, newest notes first.
function studentRecords_(id) {
  var ss = SpreadsheetApp.getActiveSpreadsheet(), out = { records: [], notes: [] };
  bodyRows_(ss.getSheetByName(RECORDS_TAB), 7).forEach(function (r) {
    if (normId_(r[1]) !== id) return;
    out.records.push({ date: r[0] instanceof Date ? Utilities.formatDate(r[0], Session.getScriptTimeZone(), 'yyyy-MM-dd') : String(r[0] || ''), category: String(r[2]), assessment: String(r[3]),
      score: r[4] === '' ? null : Number(r[4]), outOf: r[5] === '' ? null : Number(r[5]), lecture: String(r[6] || '') });
  });
  bodyRows_(ss.getSheetByName(NOTES_TAB), 4).forEach(function (r) {
    if (normId_(r[1]) === id) out.notes.push({ time: r[0] instanceof Date ? r[0].toISOString() : String(r[0] || ''), text: String(r[2]), by: String(r[3] || '') });
  });
  out.notes.reverse();
  return out;
}

// A note about a student. The ID must be on the class list; the text is limited and never shown to students.
function studentNoteAdd_(id, text) {
  id = normId_(id); text = String(text || '').trim().slice(0, 1000);
  if (!id || !text) return { ok: false, why: 'a student and a note are needed' };
  if (!rosterRows_().some(function (r) { return normId_(r[0]) === id; })) return { ok: false, why: 'that ID is not on the class list' };
  append_(NOTES_TAB, NOTES_HEAD, [new Date(), id, text, 'lecturer']);
  return { ok: true };
}
