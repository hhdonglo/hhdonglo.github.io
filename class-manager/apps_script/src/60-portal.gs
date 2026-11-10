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
