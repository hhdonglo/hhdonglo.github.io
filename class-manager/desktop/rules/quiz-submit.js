/* Quiz submissions: what a student's page sends. A port of the POST part of the router (apps_script/src/90-router.gs): an answer to the open question,
   joining and progress (presence), a whole-quiz submission for a timed quiz, a practice attempt and a question report. Same outcomes as the script.
   handle(store, p, o) returns {outcome, receipt?} for the quiz kinds; o = {site, random} as in quiz-control, and o.mailReport(row) when reports are mailed. */
"use strict";
const C = require("./quiz-control");
const R = require("./quiz-results");
const A = require("./auth");
const { append, logLine } = require("./store");

const GRACE_MS = 15000, LETTERS = ["A", "B", "C", "D", "E"];
const clean = (v, max) => { let s = String(v == null ? "" : v).trim().slice(0, max); if (/^[=+\-@]/.test(s)) s = "'" + s; return s; };
const up = (v) => String(v).trim().toUpperCase();

function keyState(key) { return String(key[7]).trim().toLowerCase() || "started"; } // older quizzes: the state sits in the Key tab

function handle(store, p, o) {
  const name = clean(p.name, 40), id = clean(p.id, 20), code = clean(p.code, 30).toUpperCase(), now = store.now().getTime();
  const done = (outcome) => { logLine(store, outcome, name, id, code); return withReceipt(outcome); };
  const withReceipt = (outcome) => {
    if (p.want !== "receipt") return { outcome };
    const r = { ok: outcome === "ok", outcome }; if (outcome === "ok" && id && code) r.receipt = A.quizReceipt(store, o, code, id);
    return { outcome, json: r };
  };
  if (p.kind === "answer") { // paced quiz: one answer to the question that is open right now
    const qn = Number(p.q), al = String(p.answer || "").trim().toUpperCase(), ca = C.ctl(store, code);
    if (!name || !id || !C.keyRow(store, code, o) || LETTERS.indexOf(al) < 0 || !(qn >= 1 && qn <= (ca ? C.quizN(ca) : 5))) return done("bad answer");
    if (!ca || !C.paced(ca)) return done("not paced");
    if (C.eff(ca) !== "running") return done("not open");
    if (Number(ca.v[11]) !== qn) return done("wrong question");
    if (Number(ca.v[13]) && now > Number(ca.v[13]) + GRACE_MS) return done("question closed");
    if (!C.allowLate(ca) && !R.hasPresence(store, code, id)) return done("not joined");
    let cf = String(p.conf || "").trim().toUpperCase().charAt(0); if ("HML".indexOf(cf) < 0) cf = "";
    R.addAnswer(store, [store.now(), id, name, code, qn, al, Number(ca.v[16]) || 0, cf, C.voteOf(ca)]);
    return withReceipt("ok");
  }
  if (p.kind === "join" || p.kind === "progress") { // lobby and live participation
    if (!name || !id || !C.keyRow(store, code, o)) return withReceipt("ok");
    const cj = C.ctl(store, code), sj = cj ? C.eff(cj) : "running";
    if (cj && !C.allowLate(cj) && (sj === "running" || sj === "paused") && !R.hasPresence(store, code, id)) return withReceipt("late");
    R.presence(store, code, id, name, p.kind === "progress" ? "inprogress" : "joined");
    return withReceipt("ok");
  }
  if (!name || !id || !code) return done("missing");
  const key = C.keyRow(store, code, o); if (!key) return done("bad code");
  const c = C.ctl(store, code);
  if (c && C.paced(c)) return done("use answers");
  if (c) { // lecturer-controlled: state and deadline are checked here, not in the browser
    const s = C.eff(c), left = Number(c.v[3]) + GRACE_MS - now;
    if (s === "draft" || s === "ready" || s === "lobby") return done("not started");
    if (s === "paused") return done("paused");
    if (s === "released") return done("quiz closed");
    if (s === "ended" && left < 0) return done("quiz closed");
    if (!C.allowLate(c) && !R.hasPresence(store, code, id)) return done("not joined");
  } else {
    const st = keyState(key);
    if (st === "waiting") return done("not started");
    if (st === "stopped") return done("quiz closed");
  }
  const rnd = R.roundOf(store, code), ans = [];
  for (let q = 1; q <= 5; q++) { const a = String(p["q" + q] || "").trim().toUpperCase(); ans.push(LETTERS.indexOf(a) >= 0 ? a : ""); }
  const score = C.mark(C.lettersFor(store, code, null, o), ans).reduce((x, y) => x + y, 0);
  const seen = R.respRows(store).some((r) => String(r[2]).trim() === id && up(r[3]) === code && (Number(r[10]) || 0) === rnd); // first attempt per ID and join code in this round only
  if (seen) return done("duplicate");
  R.addHeld(store, R.rowFor(store.now(), name, id, code, ans, score, rnd, 5, ""));
  R.presence(store, code, id, name, "submitted");
  return done("ok");
}

// A practice attempt: held in Attempts until a release (Master and Scores are not touched here). Returns "ok" or "missing".
function attempt(store, p) {
  if (!clean(p.id, 30)) return "missing";
  append(store, "Attempts", ["Timestamp", "Student ID", "Quiz", "Attempt", "Score", "Total", "Seconds", "Wrong question ids", "Question ids"],
    [store.now(), clean(p.id, 30), clean(p.quiz, 80), clean(p.attempt, 10), clean(p.score, 10), clean(p.total, 10), clean(p.seconds, 10), clean(p.wrong, 1200), clean(p.asked, 1500)]);
  return "ok";
}
// A question report from a page: kept in Reports; o.mailReport(row) sends it on when the course has a mailbox.
function report(store, p, o) {
  const r = { time: store.now().toString(), page: clean(p.page, 200), lecture: clean(p.lecture, 80), qid: clean(p.qid, 40), question: clean(p.question, 500), answer: clean(p.answer, 300), comment: clean(p.comment, 1000) };
  append(store, "Reports", ["Timestamp", "Lecture", "Question id", "Question", "Answer shown", "Comment", "Page"], [store.now(), r.lecture, r.qid, r.question, r.answer, r.comment, r.page]);
  if (o && o.mailReport) o.mailReport(r);
  return "ok";
}

module.exports = { handle, attempt, report, GRACE_MS };
