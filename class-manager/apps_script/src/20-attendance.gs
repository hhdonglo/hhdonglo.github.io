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
