/* Quiz views: what the quiz pages read. Student pages: status, questions, review, ranking, result, the portal and My results. Lecturer pages (after the
   router has checked the host key): the host view and the projector display. A port of the GET part of the router and of reviewData_, ranking_,
   counts_, portalStatus_ and portalResults_ (apps_script/src), with the same answers.
   o = {site, random} as in quiz-control. o.extras(store, id) gives My results the parts that other modules own (groups, learning, progress, group work). */
"use strict";
const C = require("./quiz-control");
const R = require("./quiz-results");
const A = require("./auth");
const AT = require("./attendance");
const { normalizeId } = require("../ids");

const EXPL = "Explanations", PRESENCE = "Presence", KEY = "Key", ATT = "Attendance", SCORES = "Scores";
const up = (v) => String(v).trim().toUpperCase();
const clean = (v, max) => { let s = String(v == null ? "" : v).trim().slice(0, max); if (/^[=+\-@]/.test(s)) s = "'" + s; return s; };
const plain = (t) => String(t || "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
const pct = (a, b) => (b ? Math.round(1000 * a / b) / 10 : null);
const spread = () => ({ A: 0, B: 0, C: 0, D: 0, E: 0 });
const keyCell = (store, col) => { const k = store.rows(KEY); return k && k.length > 1 ? k[1][col] : undefined; };

// ---------- counts, ranking, review ----------
function counts(store, code) {
  const out = { joined: 0, inprogress: 0, submitted: 0, notYet: [] };
  (store.rows(PRESENCE) || []).slice(1).forEach((r) => {
    if (up(r[3]) !== code) return; out.joined++;
    const st = String(r[4]);
    if (st === "submitted") out.submitted++; else { if (st === "inprogress") out.inprogress++; out.notYet.push(String(r[2]) + (st === "inprogress" ? " (working)" : " (joined)")); }
  });
  return out;
}
function ranking(store, code, me) { // held and released rows
  const rnd = R.roundOf(store, code), list = [];
  R.respRows(store).forEach((r) => {
    if (up(r[3]) === code && r[9] !== "" && (Number(r[10]) || 0) === rnd) list.push({ name: String(r[1]), score: Number(r[9]), n: Number(r[11]) || 5, me: !!me && String(r[2]).trim() === me });
  });
  list.sort((x, y) => y.score - x.score || x.name.localeCompare(y.name));
  return list.slice(0, 300);
}
function bankExplanation(store, code, q, o) { // {text, error}
  try {
    const c = C.ctl(store, code), e = C.liveEntry ? C.liveEntry(store, code, c, o) : null;
    const id = e.inline ? e.ids[q - 1] : (c ? C.qids(c)[q - 1] : "");
    if (!id) return { text: "", error: "no practice-bank question is listed for this question" };
    const bank = o.site("/quizzes/" + e.bank + ".json").questions, b = bank.find((x) => x.id === id);
    if (b) return { text: plain(b.exp) + (b.ref ? " Review: " + plain(b.ref) : ""), error: "" };
    return { text: "", error: "bank question " + id + " was not found" };
  } catch (err) { return { text: "", error: String(err).slice(0, 160) }; }
}
function discussionMoves(got, q, key) {
  const o = { before: spread(), after: spread(), beforeN: 0, afterN: 0, wrongToRight: 0, rightToWrong: 0, stayedRight: 0, stayedWrong: 0, pairs: 0 };
  Object.keys(got).forEach((id) => {
    const f = got[id].first[q - 1], a = got[id].ans[q - 1];
    if (f && o.before[f] !== undefined) { o.before[f]++; o.beforeN++; }
    if (a && o.after[a] !== undefined) { o.after[a]++; o.afterN++; }
    if (f && a && key) { o.pairs++; const fr = f === key, ar = a === key; if (fr && ar) o.stayedRight++; else if (fr) o.rightToWrong++; else if (ar) o.wrongToRight++; else o.stayedWrong++; }
  });
  o.beforePct = key ? pct(o.before[key] || 0, o.beforeN) : null; o.afterPct = key ? pct(o.after[key] || 0, o.afterN) : null;
  return o;
}
// What the class sees while the lecturer goes over a question; nothing unless review is switched on. id is set only for the student's own phone.
function review(store, code, id, o) {
  const c = C.ctl(store, code), key = C.keyRow(store, code, o), q = c ? Number(c.v[17]) || 0 : 0, st = c ? C.eff(c) : "";
  if (!c || !key || q < 1 || (st !== "ended" && st !== "released")) return { q: 0 };
  const got = R.latestAnswers(store, code), dist = spread(); let n = 0;
  Object.keys(got).forEach((k) => { const a = got[k].ans[q - 1]; if (a) { n++; if (dist[a] !== undefined) dist[a]++; } });
  let expl = "", err = "";
  const ex = (store.rows(EXPL) || []).slice(1); ex.forEach((r) => { if (up(r[0]) === code && Number(r[1]) === q) expl = String(r[2]); });
  if (!expl) { const bx = bankExplanation(store, code, q, o); expl = bx.text; err = bx.error; }
  const correct = C.lettersFor(store, code, c, o)[q - 1] || "", out = { q, correct, dist, answered: n, mine: id && got[id] ? got[id].ans[q - 1] : "", explanation: expl, explanationError: err };
  if (C.discussedOf(c).indexOf(q) >= 0) { out.discussion = discussionMoves(got, q, correct); if (id && got[id]) out.mineFirst = got[id].first[q - 1]; }
  return out;
}

// ---------- student pages ----------
function status(store, code, o) {
  const c = C.ctl(store, code);
  if (c) { const cs = C.status(c); cs.known = true; return cs; }
  const k = C.keyRow(store, code, o);
  if (k && C.weekFromCode(store, code, o)) return { paced: true, timed: false, known: true, state: "ready", allowLate: true };
  if (!k) { const ats = AT.sessions(store).filter((s) => s.code === code).pop(); if (ats) return { attendance: true, known: true, state: ats.status.toLowerCase() }; }
  const v = k ? String(k[6]).trim().toLowerCase() : "";
  return { timed: false, known: !!k, hidden: v === "hidden", closed: v === "closed", state: k ? (String(k[7]).trim().toLowerCase() || "started") : "" };
}
function questions(store, code, o) { // the quiz's question text (no answers), once it has started
  const cq = C.ctl(store, code);
  if (!cq || ["ready", "lobby", "draft"].indexOf(C.eff(cq)) >= 0) return { questions: [] };
  try {
    const le = C.liveEntry(store, code, cq, o); let qs;
    if (le.inline) qs = le.inline.map((x) => ({ stem: x.stem, opts: x.opts }));
    else { const bk = o.site("/quizzes/" + le.bank + ".json").questions; qs = C.qids(cq).map((qid) => { const b = bk.find((x) => x.id === qid); return b ? { stem: b.q, opts: b.options } : { stem: "(question missing)", opts: [] }; }); }
    return { questions: qs };
  } catch (err) { return { questions: [], error: String(err).slice(0, 160) }; }
}
function rankingView(store, code, p, o) { // live class ranking for one join code: first names and scores only
  const rk = C.keyRow(store, code, o), me = clean(p.id, 20), cr = C.ctl(store, code);
  if (!rk) return { hidden: false, rows: [] };
  if (cr) {
    if (!C.visible(cr, "show_leaderboard")) return { hidden: true, waitRelease: true, rows: [] };
    return { hidden: false, closed: C.eff(cr) === "released", rows: ranking(store, code, me) };
  }
  const v = String(rk[6]).trim().toLowerCase();
  if (v === "hidden") return { hidden: true, rows: [] };
  return { hidden: false, closed: v === "closed", rows: ranking(store, code, me) };
}
function lastOutcome(store, id, code) {
  const rows = (store.rows("Log") || []).slice(1);
  for (let i = rows.length - 1; i >= 0; i--) if (String(rows[i][3]).trim() === id && up(rows[i][4]) === code) return String(rows[i][1]);
  return "";
}
function parseAnswers(r) { const s = String(r[10] || ""); return s ? s.split("").map((ch) => (ch === "-" ? "" : ch)) : r.slice(2, 7); } // r: ID, Join Code, Q1..Q5, Score, Round, Questions, Answers
function result(store, code, p, o) { // a student's own result; only the phone that took part (the receipt)
  const id = clean(p.id, 20), key = C.keyRow(store, code, o), cx = C.ctl(store, code);
  if (id && !A.receiptOk(store, o, code, id, p.rc)) return { found: false, receipt: false, outcome: lastOutcome(store, id, code), keyMissing: !key };
  if (key && id) {
    const rnd = R.roundOf(store, code), rows = R.respRows(store).map((r) => r.slice(2, 14));
    for (let i = 0; i < rows.length; i++) {
      if (String(rows[i][0]).trim() === id && up(rows[i][1]) === code && (Number(rows[i][8]) || 0) === rnd) {
        if (cx && !C.visible(cx, "show_score")) return { found: true, scoreHidden: true, outcome: lastOutcome(store, id, code) };
        const flags = C.mark(C.lettersFor(store, code, cx, o), parseAnswers(rows[i]));
        return { found: true, score: flags.reduce((x, y) => x + y, 0), total: flags.length, flags, outcome: lastOutcome(store, id, code) };
      }
    }
  }
  return { found: false, outcome: lastOutcome(store, id, code), keyMissing: !key };
}

// ---------- lecturer pages (the router has checked the host key) ----------
function hostView(store, code, o) {
  let hk = C.keyRow(store, code, o), unreg = false;
  if (!hk && C.codeWeek(store, code)) { hk = [code, "", "", "", "", "", "Open", ""]; unreg = true; }
  if (!hk) return { ok: false, why: "join code" };
  let ch = C.ctl(store, code);
  if (!ch && C.weekFromCode(store, code, o)) { C.act(store, { act: "init" }, code, o); ch = C.ctl(store, code); }
  const cn = counts(store, code), out = { ok: true, note: unreg && !ch ? "Week " + C.codeWeek(store, code) + " has no question bank in this course yet. Add its questions under Quizzes and Questions." : "", review: ch ? review(store, code, "", o) : { q: 0 }, controlled: !!ch, joined: cn.joined, inprogress: cn.inprogress, submitted: cn.submitted, notYet: cn.notYet, rows: ranking(store, code, "") };
  if (ch && C.paced(ch) && Number(ch.v[11]) > 0) {
    const ac = R.answerCounts(store, code, Number(ch.v[11])); out.answered = ac.answered; out.dist = ac.dist;
    if (C.voteOf(ch) === 2 || C.discussedOf(ch).indexOf(Number(ch.v[11])) >= 0) { out.firstVote = ac.first; out.changed = ac.changed; }
  }
  if (ch) {
    out.status = C.status(ch); out.state = out.status.state; let wks = {}; try { wks = o.site("/apps_script/live_quizzes.json").weeks || {}; } catch (e) { /* no list */ }
    let le = null; try { le = C.liveEntry(store, code, ch, o); } catch (e) { /* offline */ }
    out.weeks = wks; out.weekLocked = !!C.weekFromCode(store, code, o); out.week = C.weekFromCode(store, code, o) || (Number(ch.v[20]) || 1); out.maxN = C.maxN(store, code, ch, o); out.fixed = !!(le && le.inline);
    out.settings = { n: C.quizN(ch), duration: Number(ch.v[2]), allowLate: ch.v[5], showScore: ch.v[6], showBoard: ch.v[7] };
  } else out.state = String(hk[7]).trim().toLowerCase() || "started";
  return out;
}
function display(store, code, o) { // projector: no host key; counts, state, countdown, and results only once released
  const cd = C.ctl(store, code); if (!C.keyRow(store, code, o)) return { ok: false };
  const dn = counts(store, code), dr = { ok: true, controlled: !!cd, joined: dn.joined, inprogress: dn.inprogress, submitted: dn.submitted, rows: [] };
  if (cd) {
    dr.review = review(store, code, "", o); dr.status = C.status(cd); if (C.visible(cd, "show_leaderboard")) dr.rows = ranking(store, code, "").slice(0, 20);
    if (C.paced(cd) && C.voteOf(cd) === 2 && Number(cd.v[11]) > 0) { const dac = R.answerCounts(store, code, Number(cd.v[11])); dr.revote = { q: Number(cd.v[11]), firstAnswered: dac.first.answered, answered: dac.changed }; }
  }
  return dr;
}

// ---------- the portal ----------
const resultsOn = (store) => String(keyCell(store, 12) == null ? "" : keyCell(store, 12)).trim().toLowerCase() !== "off";
function weekChoice(store) { const v = Number(keyCell(store, 13)); return v >= 1 && v <= 12 ? v : 0; }
function setWeek(store, p) { // host only; w=0 clears the choice
  const w = Number(String(p.w || "").replace(/\D/g, "").slice(0, 2));
  if (isNaN(w) || w < 0 || w > 12) return { ok: false, why: "week must be 0 to 12" };
  const k = store.rows(KEY); if (!k) return { ok: false, why: "no Key tab" };
  const rows = k.map((r) => r.slice()); while (rows.length < 2) rows.push([]); while (rows[1].length < 14) rows[1].push(""); rows[1][13] = w || ""; store.setRows(KEY, rows);
  return { ok: true, week: w };
}
function portalStatus(store, version) { // public, no secrets: is attendance open, is a live quiz open, is "My results" on
  const att = AT.sessions(store).some((s) => s.status === "Open") ? "open" : "closed";
  let quiz = "none";
  (store.rows(C.TAB) || []).slice(1).forEach((v) => { const st = C.eff({ store, v: v.slice(), row: 0 }); if (st === "lobby" || st === "running" || st === "paused") quiz = st; });
  return { portal: 1, attendance: att, quiz, results: resultsOn(store), version, week: weekChoice(store) };
}
// A student's own attendance and quiz scores, found by ID: the ID with its access code or a session, both required. req = {post, session}.
function portalResults(store, p, req, o) {
  if (!resultsOn(store)) return { ok: false, why: "results off" };
  const who = A.studentCheck(store, p.id, p.code, "r", req, o); if (!who.id) return { ok: false, why: who.why };
  const id = who.id, out = { ok: true, attendance: [], quizzes: [] };
  const at = store.rows(ATT);
  if (at && at.length > 1 && at[0].length > 1) {
    const row = at.slice(1).find((r) => normalizeId(r[0]) === id);
    if (row) for (let c = 1; c < at[0].length; c++) if (row[c] !== "" && row[c] != null && String(at[0][c]).trim()) out.attendance.push([String(at[0][c]).trim(), Number(row[c]) ? 1 : 0]);
  }
  const sc = store.rows(SCORES);
  if (sc && sc.length > 3 && sc[0].length > 4) {
    const row = sc.slice(3).find((r) => normalizeId(r[0]) === id);
    if (row) for (let k = 4; k < sc[0].length; k++) if (row[k] !== "" && row[k] != null && String(sc[0][k]).trim()) out.quizzes.push([String(sc[0][k]).trim(), row[k] + (sc[2][k] !== "" && sc[2][k] != null ? " / " + sc[2][k] : "")]);
  }
  Object.assign(out, o.extras ? o.extras(store, id) : { groups: [], groupWork: 0 });
  return out;
}

module.exports = { counts, ranking, review, status, questions, rankingView, result, hostView, display, portalStatus, portalResults, setWeek, resultsOn, weekChoice, lastOutcome, bankExplanation };
