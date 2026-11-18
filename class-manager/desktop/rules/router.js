/* One router for every request the pages send (the Apps Script's doGet, doPost and route_): checks credentials, then calls one rules module.
   A port of apps_script/src/90-router.gs with the same answers. One responsibility: map an action to a rule and shape the reply.
   createRouter(env) with env = {store, site(path), version, random?, now?, geoMode?} gives {get(params), post(params)}, each returning {text, mime}. */
"use strict";
const crypto = require("crypto");
const AC = require("./access-codes");
const AN = require("./announcements");
const AS = require("./assignments");
const AT = require("./attendance");
const AR = require("./attendance-review");
const UL = require("./attendance-unlock");
const AU = require("./auth");
const C = require("./quiz-control");
const CA = require("./calendar");
const CH = require("./chat");
const CL = require("./class-list");
const CS = require("./class-stats");
const G = require("./groups");
const L = require("./learning");
const OC = require("./outcomes");
const P = require("./progress");
const H = require("./held");
const QR = require("./quiz-results");
const QS = require("./quiz-submit");
const SA = require("./signin-attempts");
const ST = require("./score-tables");
const V = require("./quiz-views");
const { normalizeId } = require("../ids");
const { logLine } = require("./store");

const NOKEY = { ok: false, why: "host key not accepted" };
const clean = (v, max) => { let s = String(v == null ? "" : v).trim().slice(0, max); if (/^[=+\-@]/.test(s)) s = "'" + s; return s; };
const MIME = { json: "application/json", js: "text/javascript", text: "text/plain", ics: "text/calendar" };

function createRouter(env) {
  const store = env.store, counters = AU.memoryCounters(() => store.now()), failCounts = {};
  const fails = { get: (k) => failCounts[k] || 0, add: (k) => { failCounts[k] = (failCounts[k] || 0) + 1; } };
  const base = { site: env.site, random: env.random || (() => crypto.randomUUID()), counters, fails, version: env.version,
  };
  const out = (text, mime) => ({ text: String(text == null ? "" : text), mime: mime || MIME.text });
  const oFor = (req) => {
    const o = Object.assign({}, base, { geoMode: env.geoMode ? env.geoMode() : undefined });
    // The phone's access code, or the session it was given at its last check-in; a code that works gives a session to keep.
    o.verifyCode = (aid, given, mine, st) => {
      const t = AU.isSession(given) ? AU.sessRead(st, given) : null;
      const ok = t ? (t.role === "s" && t.subj === aid && AU.sessValid(st, o, t, mine.code)) : (req.post && AC.normCode(given) === mine.code && !AC.expired(st, mine));
      if (ok && !t) req.session = AU.sessMake(st, o, "s", aid, mine.code, AU.K.STUDENT_DAYS * 86400000);
      return { ok, expired: !!(t && t.expired) };
    };
    return o;
  };
  // The quiz rules need what the results and score tables add (finalise, release, discard, Master and Totals).
  const quizO = (o) => { const t = Object.assign({}, o, ST.hooks(store, o)); return Object.assign({}, t, QR.hooks(store, t)); };

  function json(req, p, obj) { // JSONP as jsonp_ does, with the session to keep when a key or code was sent
    if (req.session && obj && typeof obj === "object" && !Array.isArray(obj) && obj.ok !== false) obj._session = req.session;
    const body = JSON.stringify(obj), cb = String(p.callback || "");
    return /^[A-Za-z_][A-Za-z0-9_]*$/.test(cb) ? out(cb + "(" + body + ")", MIME.js) : out(body, MIME.json);
  }

  function post(p) {
    p = p || {}; const req = { post: true, session: "" }, o = oFor(req);
    if (p.action && !p.kind) return route(p, req, o);
    if (p.kind === "roster_sync") return out(JSON.stringify(AU.hostOk(store, p, req, o) ? CL.sync(store, p) : { ok: false, why: "key not accepted" }));
    if (p.kind === "report") return out(QS.report(store, p, o));
    if (p.kind === "attempt") return out(QS.attempt(store, p));
    const r = QS.handle(store, p, quizO(o));
    return r.json ? out(JSON.stringify(r.json), MIME.json) : out(r.outcome);
  }
  function get(p) { const req = { post: false, session: "" }; return route(p || {}, req, oFor(req)); }

  function route(p, req, o) {
    const code = clean(p.code, 30).toUpperCase(), host = () => AU.hostOk(store, p, req, o), J = (obj) => json(req, p, obj), hostJ = (fn) => J(host() ? fn() : NOKEY), qo = () => quizO(o);
    const a = p.action;
    switch (a) {
      case "status": return J(V.status(store, code, o));
      case "version": return J({ ok: true, version: env.version });
      case "join_base": if (!host()) return J(NOKEY); return J(p.base != null && p.base !== "" ? joinBaseSet(p.base) : { ok: true, base: C.joinBase(store) });
      case "set_week": return hostJ(() => V.setWeek(store, p));
      case "portal_status": return J(V.portalStatus(store, env.version));
      case "my_results": return J(V.portalResults(store, p, req, Object.assign({}, o, { extras: (s, id) => P.portalExtras(s, id, o) })));
      case "chat": return J(CH.chat(store, p, req, o));
      case "announcements": return J(AN.announcements(store, p, req, o));
      case "calendar": return J(CA.calendar(store, p, req, o));
      case "calendar_ics": return out(CA.ics(store, p, req, o), MIME.ics);
      case "calendar_edit": if (!host()) return J(NOKEY); return J(CA.act(store, p, req, o));
      case "groups": return hostJ(() => G.act(store, p, o));
      case "outcomes": return hostJ(() => OC.outcomesAct(store, p, o));
      case "assignments": return hostJ(() => AS.act(store, p, o));
      case "groups_display": return hostJ(() => G.display(store, p, o));
      case "learning_progress": return hostJ(() => P.learningProgress(store, p, o));
      case "group_work": return J(AS.groupWork(store, p, req, o));
      case "insights": return hostJ(() => L.insights(store, p, env.version));
      case "class_stats": return hostJ(() => CS.classStats(store, p, env.version, o));
      case "student_note": return hostJ(() => L.noteAdd(store, p.id, p.text));
      case "student_stats": return hostJ(() => P.studentStats(store, p, o, env.version));
      case "access_codes": return hostJ(() => AC.run(store, p, { random: o.random, log: (x, y, z) => logLine(store, x, y, z, "") }));
      case "preclass": return hostJ(() => preclass(p, o));
      case "attend": { // a refused check-in is also noted for the lecturer's Sign-in problems list (signin-attempts.js)
        const r = AT.checkIn(store, p, o);
        if (r && r.ok === false) SA.note(store, { id: p.id, where: "Attendance", reason: SA.FROM_ATTEND[r.why] });
        else if (r && r.ok) SA.noteOk(store, p.id, "Attendance");
        return J(r);
      }
      case "code_setup": { // a student makes their own 5-letter code (access-codes.js); only for an ID on the class list that has none
        if (!req.post) return J({ ok: false, why: "not recognised" });
        const key = "setup:" + normalizeId(p.id); if (AU.failsOf(o, key) >= AU.K.ATT_MAX_FAILS) return J({ ok: false, why: "slow down" });
        const r = AC.setup(store, p.id, p.code, { log: (x, y, z) => logLine(store, x, y, z, "") });
        if (!r.ok) AU.failAdd(o, key); else req.session = AU.sessMake(store, o, "s", r.id, r.code, AU.K.STUDENT_DAYS * 86400000);
        return J(r.ok ? { ok: true, id: r.id } : r);
      }
      case "password_status": return J(AU.passwordStatus(store));
      case "password_recover": if (!req.post) return J({ ok: false, why: "not accepted" }); return J(AU.recoverHostKey(store, p, o));
      case "hostcheck": return J({ ok: host(), post: req.post });
      case "sessions_end": if (!host()) return J(NOKEY); req.session = ""; return J(AU.signOutEveryone(store, o));
      case "held_status": return hostJ(() => heldStatus());
      case "held_items": return hostJ(() => H.items(store));
      case "held_release_quiz": case "held_discard_quiz": case "attend_submit": case "attend_discard": {
        if (!host()) return J(NOKEY);
        const one = clean(p.session, 12).toUpperCase(), qc = clean(p.code, 30).toUpperCase(), hasRound = p.round !== undefined && p.round !== "", rnd = Number(p.round) || 0; // one session or one quiz when named, otherwise every held one
        if (a === "attend_submit") return J(AT.submit(store, one));
        if (a === "attend_discard") return J(AT.discard(store, one));
        if (qc && hasRound) return J(a === "held_release_quiz" ? H.submitQuiz(store, qc, rnd, ST.hooks(store, o), qo()) : H.discardQuiz(store, qc, rnd));
        return J(Object.assign({ ok: true }, a === "held_release_quiz" ? QR.commit(store, "", true, ST.hooks(store, o)) : QR.discard(store, "", true)));
      }
      case "roster_tidy": return hostJ(() => CL.tidy(store, p));
      case "roster_edit": return hostJ(() => CL.edit(store, p));
      case "attend_review": return hostJ(() => AR.review(store, p));
      case "attend_remove": return hostJ(() => AR.remove(store, p));
      case "attend_approve": return hostJ(() => AR.approve(store, p));
      case "attend_phone_reset": return hostJ(() => AR.phoneReset(store, normalizeId(p.id)));
      case "attend_unlock": return hostJ(() => UL.issue(store, p, o));
      case "attend_status": return hostJ(() => AR.status(store, o));
      case "attend_open": return hostJ(() => AT.open(store, p, o));
      case "attend_close": return hostJ(() => AT.close(store));
      case "questions": return J(V.questions(store, code, o));
      case "review": { const id = clean(p.id, 20); return J(V.review(store, code, AU.receiptOk(store, o, code, id, p.rc) ? id : "", o)); }
      case "ranking": return J(V.rankingView(store, code, p, o));
      case "setkey": if (!host()) return J({ ok: false, why: "current password not accepted" }); return J(AU.setHostKey(store, p, req, o));
      case "control": {
        if (!host()) return J(NOKEY);
        const want = String(p.state || "").toLowerCase();
        if (want && !p.act) { // older host page: legacy state in Key column H
          if (["waiting", "started", "stopped"].indexOf(want) < 0) return J({ ok: false });
          const rows = store.rows("Key") || []; for (let i = 1; i < rows.length; i++) if (String(rows[i][0]).trim().toUpperCase() === code) { rows[i][7] = want.charAt(0).toUpperCase() + want.slice(1); store.setRows("Key", rows); return J({ ok: true, state: want }); }
          return J({ ok: false });
        }
        return J(C.act(store, p, code, qo()));
      }
      case "host": if (!host()) return J({ ok: false, why: "password" }); return J(V.hostView(store, code, qo()));
      case "display": return J(V.display(store, code, o));
      case "quiz_default": return hostJ(() => V.defaultCode(store, o)); // the join code for the lecturer's own quiz window; host key required
      case "result": return J(V.result(store, code, p, o));
      default: return out("Class Manager quiz receiver is running");
    }
  }

  function joinBaseSet(v) {
    const b = String(v == null ? "" : v).replace(/\D/g, ""); if (b.length < 2 || b.length > 8) return { ok: false, why: "The base must be 2 to 8 digits." };
    store.setProp("join_base", b); return { ok: true, base: b };
  }
  function heldStatus() {
    const st = (store.rows("Staged_Quiz") || []).slice(), outS = { ok: true, quiz: 0, sessions: [] };
    while (st.length && !st[st.length - 1].some((c) => c !== "" && c != null)) st.pop(); // a sheet's last row is the last one with something in it
    outS.quiz = st.length > 1 ? st.length - 1 : 0;
    AT.sessions(store).forEach((r) => { if (r.status === "Closed") outS.sessions.push({ label: AT.column(r.label), present: Object.keys(AT.present(store, r.label)).length }); });
    return outS;
  }
  function preclass(p, o) {
    const key = store.rows("Key"), res = { ok: true, version: env.version, serverNow: store.now().getTime() };
    res.rosterCount = AC.rosterRows(store).length; res.masterOn = !key || key.length < 2 || String(key[1][11] == null ? "" : key[1][11]).trim().toLowerCase() !== "off"; res.resultsOn = V.resultsOn(store);
    res.totalsMode = (key && key[1] && String(key[1][10] == null ? "" : key[1][10]).trim()) || "Best";
    const w = String(p.week || "").replace(/\D/g, "").slice(0, 2);
    if (w) {
      res.week = Number(w); res.weekListed = false; res.bankQuestions = 0;
      try { const weeks = o.site("/apps_script/live_quizzes.json").weeks || {}; res.weekListed = !!weeks[w]; if (res.weekListed) res.bankQuestions = (o.site("/quizzes/lecture" + w + ".json").questions || []).length; } catch (e) { res.bankError = true; }
    }
    const ps = V.portalStatus(store, env.version); res.attendance = ps.attendance; res.quiz = ps.quiz;
    return res;
  }
  return { get, post };
}

module.exports = { createRouter, quizHooks: (store, o) => { const t = Object.assign({}, o, ST.hooks(store, o)); return Object.assign({}, t, QR.hooks(store, t)); } };
