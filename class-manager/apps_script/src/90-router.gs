// Module router. Router: doPost and doGet, the only entry points. Each action checks its credentials here and then calls one module.
// Edit the files in apps_script/src/; apps_script/quiz_receiver.gs is built from them (node apps_script/build.js).

// ---------- POST: answers, joins, progress, reports, attempts ----------

function doPost(e) {
  var p = (e && e.parameter) || {};
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
  function fin_(o) { log_(o, name, id, code); return out_(o); }

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
    if (!name || !id || !keyRow_(code)) return out_('ok');
    var lj = LockService.getScriptLock();
    lj.waitLock(60000); // a whole class joining at once queues here
    try {
      var cj = ctl_(code), sj = cj ? eff_(cj) : 'running';
      if (cj && !allowLate_(cj) && (sj === 'running' || sj === 'paused') && !hasPresence_(code, id)) return out_('late');
      presence_(code, id, name, p.kind === 'progress' ? 'inprogress' : 'joined');
    } finally {
      lj.releaseLock();
    }
    return out_('ok');
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

function doGet(e) {
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
  if (p.action === 'hostcheck') return jsonp_(e, { ok: hostOk_(p) }); // the lecturer menu: is this key right?
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

  if (p.action === 'review') return jsonp_(e, reviewData_(code, clean_(p.id, 20)));

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
    if (!hostOk_(p)) return jsonp_(e, { ok: false, why: 'current key not accepted' });
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
