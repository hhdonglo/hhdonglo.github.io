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
  if (fails >= 30) return false; // locked for 10 minutes after 30 wrong keys
  var ok;
  if (hk.indexOf('sha256:') === 0) { // hashed form: sha256:salt:hex
    var parts = hk.split(':');
    ok = parts.length === 3 && hashKey_(parts[1], given) === parts[2];
  } else { // legacy plain key typed in the Sheet
    ok = !!given && given === hk;
  }
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
