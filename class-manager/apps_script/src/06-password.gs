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
