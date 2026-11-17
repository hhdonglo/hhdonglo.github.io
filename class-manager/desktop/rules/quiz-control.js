/* Quiz control: the lecturer's actions on a live quiz and the state students see. A port of ctl_, ctlAct_, ctlStatus_, chooseQuestions_, lettersFor_
   and their helpers (apps_script/src/10-assessment.gs), with the same answers. One responsibility: the Quiz_Control tab and the questions of a run.
   What it needs from outside is passed in as o: site(path) gives the course's JSON files, random() gives a short random text, and the
   hooks finalize(code), commit(code, every) and discard(code, every) are the held-results rules (rules/quiz-results.js). */
"use strict";
const crypto = require("crypto");
const { logLine } = require("./store");

const TAB = "Quiz_Control", KEY = "Key", PRESENCE = "Presence", LETTERS = ["A", "B", "C", "D", "E"];
const HEADER = ["join_code", "status", "duration_min", "end_time_ms", "remaining_ms", "allow_late_join", "show_score", "show_leaderboard", "message", "title", "updated", "current_q", "q_seconds", "q_deadline_ms", "q_remaining_ms", "mode", "round", "review_q", "n_questions", "question_ids", "week", "vote", "discussed", "quiz_type"];
const JOIN_BASE_DEFAULT = "2627";

const num = (v) => Number(v);
const lower = (v) => String(v).trim().toLowerCase();
function clean(v, max) { let s = String(v == null ? "" : v).trim().slice(0, max); if (/^[=+\-@]/.test(s)) s = "'" + s; return s; } // a typed value never runs as a formula

// ---------- join codes and weeks ----------
function joinBase(store) { const b = String(store.prop("join_base") || "").replace(/\D/g, ""); return b.length >= 2 && b.length <= 8 ? b : JOIN_BASE_DEFAULT; }
function codeWeek(store, code) {
  const b = joinBase(store), c = String(code); if (c.indexOf(b) !== 0) return 0;
  const rest = c.slice(b.length); return /^\d{1,2}$/.test(rest) && Number(rest) > 0 ? Number(rest) : 0;
}
function weekFromCode(store, code, o) {
  const w = codeWeek(store, code); if (!w) return 0;
  try { const wk = o.site("/apps_script/live_quizzes.json").weeks || {}; return wk[String(w)] ? w : 0; } catch (e) { return 0; }
}
function keyRow(store, code, o) {
  const rows = store.rows(KEY);
  if (rows && rows.length > 1) for (let i = 1; i < rows.length; i++) if (String(rows[i][0]).trim().toUpperCase() === code) return rows[i].slice(0, 8);
  return weekFromCode(store, code, o) ? [code, "", "", "", "", "", "Open", ""] : null;
}

// ---------- the control row ----------
function ctl(store, code) {
  const rows = store.rows(TAB); if (!rows || rows.length < 2) return null;
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]).trim().toUpperCase() === code) { const v = rows[i].slice(); while (v.length < HEADER.length) v.push(""); return { store, row: i, v }; }
  }
  return null;
}
function ctlSave(c) {
  c.v[10] = c.store.now().toISOString();
  const rows = c.store.rows(TAB).slice(); rows[c.row] = c.v.slice(0, HEADER.length);
  if (rows[0] && rows[0].length < HEADER.length) rows[0] = HEADER.slice(); // a course made before a column existed gets the full heading
  c.store.setRows(TAB, rows);
}
const paced = (c) => lower(c.v[15]) !== "timed";
const voteOf = (c) => (num(c.v[21]) === 2 ? 2 : 1);
const discussedOf = (c) => String(c.v[22] || "").split(",").map(Number).filter((x) => x > 0);
const quizN = (c) => Math.max(1, Math.min(20, num(c.v[18]) || 5));
const qids = (c) => String(c.v[19] || "").split(",").filter(String);
const isConcept = (c) => !!c && lower(c.v[23] || "") === "concept"; // a diagnostic quiz (column quiz_type); anything else is exercises
const weekOf = (c) => (c ? num(c.v[20]) || 1 : 1);
const allowLate = (c) => lower(c.v[5]) !== "no";
const nowMs = (c) => c.store.now().getTime();

// ready, lobby, running, paused, ended, released, draft; a running timed quiz past its deadline reads as ended.
function eff(c) {
  const s = lower(c.v[1]) || "draft";
  if (s === "running" && !paced(c) && nowMs(c) >= num(c.v[3])) return "ended";
  return s;
}
const when = (c, name) => lower(c.v[{ show_score: 6, show_leaderboard: 7 }[name]]) || "onrelease";
const visible = (c, name) => { const w = when(c, name); return w === "immediate" || (w === "onrelease" && eff(c) === "released"); };

function status(c) {
  const s = eff(c), now = nowMs(c);
  const o = {
    timed: !paced(c), paced: paced(c), state: s, serverNow: now, endTime: num(c.v[3]) || 0,
    remainingMs: s === "paused" ? num(paced(c) ? c.v[14] : c.v[4]) || 0 : (s === "running" && !paced(c) ? Math.max(0, num(c.v[3]) - now) : 0),
    duration: num(c.v[2]) || 0, message: String(c.v[8] || ""), title: String(c.v[9] || ""),
    allowLate: allowLate(c), showScore: visible(c, "show_score"), showBoard: visible(c, "show_leaderboard")
  };
  o.reviewQ = num(c.v[17]) || 0;
  o.quizType = isConcept(c) ? "concept" : "standard"; // concept = diagnostic quiz (not for marks), standard = exercises
  o.round = num(c.v[16]) || 0; // changes on every reset or new round, so student pages know to start over
  if (paced(c)) { o.currentQ = num(c.v[11]) || 0; o.totalQ = quizN(c); o.qids = qids(c); o.qSeconds = num(c.v[12]) || 0; o.qDeadline = num(c.v[13]) || 0; o.vote = voteOf(c); o.discussed = discussedOf(c); }
  return o;
}

// ---------- how many questions, and which ----------
function liveEntry(store, code, c, o) {
  const m = o.site("/apps_script/live_quizzes.json");
  if (m[code]) return m[code];
  const w = weekFromCode(store, code, o) || weekOf(c);
  return { bank: "lecture" + w + (isConcept(c) ? "_concept" : ""), ids: "all", week: w, concept: isConcept(c) };
}
// The weeks that have a diagnostic bank (quizzes/lectureN_concept.json): {week: title}. Listed in live_quizzes.json under concept_weeks.
function conceptWeeks(o) { try { return o.site("/apps_script/live_quizzes.json").concept_weeks || {}; } catch (e) { return {}; } }
const bankList = (o, name) => o.site("/quizzes/" + name + ".json").questions;
const poolIds = (o, e) => (Array.isArray(e.ids) ? e.ids : bankList(o, e.bank).map((q) => q.id));
function maxN(store, code, c, o) {
  try { const e = liveEntry(store, code, c, o); if (!e) return 5; return e.inline ? e.inline.length : Math.max(5, Math.min(20, poolIds(o, e).length)); } catch (e) { return 5; }
}
function shuffle(arr, seed) { // the same seed always gives the same order
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) { h = Math.imul(h ^ seed.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
  const rnd = () => { h = Math.imul(h ^ (h >>> 16), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); return ((h ^= h >>> 16) >>> 0) / 4294967296; };
  const a = arr.slice();
  for (let k = a.length - 1; k > 0; k--) { const j = Math.floor(rnd() * (k + 1)), t = a[k]; a[k] = a[j]; a[j] = t; }
  return a;
}
function drawSalt(store, o) { // made once per course and mixed into the draw, so a new class does not repeat last year's questions
  let v = store.prop("draw_salt");
  if (!v) { v = ":" + String(o.random()).slice(0, 8); store.setProp("draw_salt", v); }
  return v;
}
function keepQs(store, code, c) { // after "reset, same questions" the next Start keeps the questions already chosen (one use, tied to the round)
  const k = "keep:" + code, ok = store.prop(k) === String(num(c.v[16]) || 0) && qids(c).length === quizN(c);
  store.setProp(k, null);
  return ok;
}
function chooseQuestions(store, code, c, o) {
  let e = null; try { e = liveEntry(store, code, c, o); } catch (err) { /* offline: five generic slots */ }
  if (!e) { c.v[18] = 5; c.v[19] = ""; return ""; }
  if (e.inline) { c.v[18] = e.inline.length; c.v[19] = e.ids.slice(0, e.inline.length).join(","); return ""; }
  let pool; try { pool = poolIds(o, e); } catch (err) { return noBank(e); } // this week's question bank is not in the course: say so, never fail
  const n = Math.max(5, Math.min(maxN(store, code, c, o), quizN(c)));
  c.v[18] = n; c.v[19] = shuffle(pool, code + ":" + (num(c.v[16]) || 0) + drawSalt(store, o)).slice(0, n).join(",");
  return "";
}
// The plain sentence the lecturer reads when Start quiz finds no questions for the week (the page adds "Not done: ").
const noBank = (e) => "there are no " + (e.concept ? "diagnostic " : "") + "questions for " + String(e.bank || "this week").replace(/^lecture(\d+)(_concept)?$/, "lecture $1") + " yet. Add them in Course and Content, or choose another week, then press Start quiz again";
// The correct letter for each of the quiz's questions, never sent to students except during review.
function lettersFor(store, code, c, o) {
  const n = c ? quizN(c) : 5, key = keyRow(store, code, o), keyL = [], out = [];
  for (let i = 0; i < 5; i++) keyL.push(key ? String(key[1 + i]).trim().toUpperCase() : "");
  let e = null; try { e = c ? liveEntry(store, code, c, o) : null; } catch (err) { e = null; }
  if (c && e && !e.inline) { // practice-bank questions carry their own correct answer
    const ids = qids(c), bank = bankList(o, e.bank);
    for (let i = 0; i < n; i++) { const q = bank.find((b) => b.id === ids[i]); out.push(q && q.answer != null ? LETTERS[q.answer] : ""); }
    return out;
  }
  for (let i = 0; i < n; i++) out.push(keyL[i] || "");
  return out;
}
function mark(letters, row) { return letters.map((l, q) => (l && String(row[q] || "").trim().toUpperCase() === l ? 1 : 0)); }

// ---------- the lecturer's actions ----------
function dropPresence(store, code) {
  const rows = store.rows(PRESENCE); if (!rows) return;
  store.setRows(PRESENCE, rows.filter((r, i) => i === 0 || String(r[3]).trim().toUpperCase() !== code));
}
const none = { finalize() {}, commit() {}, discard: () => ({ discarded: 0 }) };

// Returns what the script returns: {ok, status} or {ok:false, why}. o = {site, random, finalize, commit, discard}.
function act(store, p, code, o) {
  o = Object.assign({}, none, o); const log = (a, b) => logLine(store, a, b, "", code);
  if (!keyRow(store, code, o) && !codeWeek(store, code)) return { ok: false, why: "no such code" }; // a week-shaped join code can be switched on before its question bank exists (script 2026-11-16-quizctl-1)
  const a = String(p.act || "").toLowerCase(); let c = ctl(store, code); const now = store.now().getTime();
  if (a === "init") {
    if (c) return { ok: true, status: status(c) };
    const rows = (store.rows(TAB) || [HEADER.slice()]).slice(); if (!rows.length) rows.push(HEADER.slice());
    rows.push([code, "Ready", 10, 0, 600000, "Yes", "OnRelease", "OnRelease", "", "", store.now().toISOString(), 0, 60, 0, 0, "paced", 0, 0, 5, "", weekFromCode(store, code, o) || 1, 1, "", ""]);
    store.setRows(TAB, rows); log("control:init", "host");
    return { ok: true, status: status(ctl(store, code)) };
  }
  if (!c) return { ok: false, why: "not lecturer-controlled yet" };
  const s = eff(c), dur = (num(c.v[2]) || 10) * 60000, min = Math.max(0, Math.min(60, num(p.min) || 0)) * 60000, pc = paced(c), qms = (num(c.v[12]) || 0) * 1000;
  let detail = "";
  const reset = (st) => { c.v[1] = st; c.v[3] = 0; c.v[4] = dur; c.v[11] = 0; c.v[13] = 0; };
  const newRound = () => { c.v[16] = (num(c.v[16]) || 0) + 1; c.v[1] = "Lobby"; c.v[3] = 0; c.v[4] = dur; c.v[11] = 0; c.v[13] = 0; c.v[14] = 0; c.v[8] = ""; c.v[17] = 0; c.v[21] = 1; c.v[22] = ""; };
  if (a === "ready" || a === "draft") { reset(a === "ready" ? "Ready" : "Draft"); c.v[14] = 0; }
  else if (a === "lobby") { reset("Lobby"); c.v[14] = 0; }
  else if (a === "start") {
    if (["ready", "lobby", "draft"].indexOf(s) < 0) return { ok: false, why: "can only start from Ready or Lobby (now " + s + ")" };
    if (pc && !keepQs(store, code, c)) { const missing = chooseQuestions(store, code, c, o); if (missing) return { ok: false, why: missing }; } // nothing is saved when there are no questions
    c.v[1] = "Running"; c.v[3] = now + dur; c.v[4] = dur;
    if (pc) { c.v[11] = 1; c.v[13] = qms ? now + qms : 0; c.v[21] = 1; c.v[22] = ""; detail = "question 1"; }
  } else if (a === "next") {
    if (!pc || s !== "running") return { ok: false, why: "start the quiz first" };
    if ((num(c.v[11]) || 0) >= quizN(c)) { o.finalize(code); c.v[1] = "Ended"; detail = "after question " + quizN(c); }
    else { c.v[11] = (num(c.v[11]) || 0) + 1; c.v[13] = qms ? now + qms : 0; c.v[21] = 1; detail = "question " + c.v[11]; }
  } else if (a === "revote") {
    if (!pc || s !== "running") return { ok: false, why: "only while a paced quiz is running" };
    const rq = num(c.v[11]) || 0; if (!rq) return { ok: false, why: "no question is open" };
    if (voteOf(c) === 2) return { ok: false, why: "the second vote is already open" };
    const dl = discussedOf(c); if (dl.indexOf(rq) < 0) dl.push(rq);
    c.v[21] = 2; c.v[22] = dl.join(","); c.v[13] = qms ? now + qms : 0; detail = "second vote on question " + rq;
  } else if (a === "pause") {
    if (s !== "running") return { ok: false, why: "not running" };
    if (pc) c.v[14] = num(c.v[13]) ? Math.max(0, num(c.v[13]) - now) : 0; else c.v[4] = Math.max(0, num(c.v[3]) - now);
    c.v[1] = "Paused";
  } else if (a === "resume") {
    if (s !== "paused") return { ok: false, why: "not paused" };
    c.v[1] = "Running";
    if (pc) c.v[13] = qms ? now + num(c.v[14]) : 0; else c.v[3] = now + num(c.v[4]);
  } else if (a === "end") {
    if (s !== "running" && s !== "paused") return { ok: false, why: "not running" };
    if (pc) o.finalize(code);
    c.v[1] = "Ended"; c.v[3] = Math.min(now, num(c.v[3]) || now); c.v[4] = 0;
  } else if (a === "extend") {
    if (pc) {
      if (!qms) return { ok: false, why: "this quiz has no question timer" };
      if (s === "running") c.v[13] = Math.max(num(c.v[13]), now) + min; else if (s === "paused") c.v[14] = num(c.v[14]) + min; else return { ok: false, why: "not running" };
    } else if (s === "running") c.v[3] = num(c.v[3]) + min;
    else if (s === "paused") c.v[4] = num(c.v[4]) + min;
    else return { ok: false, why: "not running" };
    detail = String(min / 60000) + " min";
  } else if (a === "release") {
    if (s !== "ended" && s !== "released") return { ok: false, why: "end the quiz first" };
    o.commit(code, false); c.v[1] = "Released";
  } else if (a === "discard") {
    if (s !== "ended") return { ok: false, why: "only an ended quiz that is not yet released" };
    detail = String(o.discard(code, false).discarded) + " held result(s)";
  } else if (a === "reopen") {
    if (s !== "ended" && s !== "released") return { ok: false, why: "quiz is not ended" };
    c.v[1] = "Running"; c.v[3] = now + (min || 2 * 60000);
    if (pc) c.v[13] = qms ? now + (min || qms) : 0;
    detail = "question " + c.v[11];
  } else if (a === "reset") {
    if (["draft", "ready", "lobby"].indexOf(s) < 0) return { ok: false, why: "cannot reset after it has started" };
    reset("Ready");
  } else if (a === "restart" || a === "restartsame") {
    if ((s === "running" || s === "paused") && pc) o.finalize(code);
    dropPresence(store, code);
    const same = a === "restartsame" && qids(c).length > 0 && qids(c).length === quizN(c);
    newRound(); store.setProp("keep:" + code, same ? String(c.v[16]) : null);
    detail = "round " + c.v[16] + (same ? ", same questions" : ", new questions");
  } else if (a === "newround") { dropPresence(store, code); newRound(); detail = "round " + c.v[16]; }
  else if (a === "review") { if (s !== "ended" && s !== "released") return { ok: false, why: "end the quiz first" }; c.v[17] = 1; detail = "question 1"; }
  else if (a === "reviewnext" || a === "reviewprev") {
    if (!(num(c.v[17]) > 0)) return { ok: false, why: "review is not on" };
    c.v[17] = Math.max(1, Math.min(quizN(c), num(c.v[17]) + (a === "reviewnext" ? 1 : -1))); detail = "question " + c.v[17];
  } else if (a === "reviewoff") c.v[17] = 0;
  else if (a === "message") { c.v[8] = clean(p.text, 200); detail = c.v[8]; }
  else if (a === "set") {
    const field = String(p.field || ""); let val = clean(p.value, 30);
    if (field === "duration_min") { const d = Math.max(1, Math.min(120, num(val) || 10)); c.v[2] = d; if (s === "ready" || s === "lobby" || s === "draft") c.v[4] = d * 60000; val = String(d); }
    else if (field === "allow_late_join") c.v[5] = /^y/i.test(val) ? "Yes" : "No";
    else if (field === "show_score" || field === "show_leaderboard") c.v[field === "show_score" ? 6 : 7] = /^i/i.test(val) ? "Immediate" : (/^n/i.test(val) ? "Never" : "OnRelease");
    else if (field === "title") c.v[9] = val;
    else if (field === "q_seconds") { const qs = Math.max(0, Math.min(600, num(val) || 0)); c.v[12] = qs; val = String(qs); }
    else if (field === "quiz_type") {
      const want = /^c|^d/i.test(val) ? "concept" : "standard";
      if (want === "concept" && !conceptWeeks(o)[String(weekFromCode(store, code, o) || weekOf(c))]) return { ok: false, why: "there is no diagnostic bank for that week yet" };
      c.v[23] = want === "concept" ? "concept" : ""; if (want === "concept") c.v[15] = "paced"; c.v[19] = ""; c.v[18] = Math.max(5, Math.min(maxN(store, code, c, o), quizN(c))); val = want;
    }
    else if (field === "week" && weekFromCode(store, code, o)) return { ok: false, why: "the week is set by the join code" };
    else if (field === "week") {
      const wk = Math.max(1, num(val) || 1), wl = o.site("/apps_script/live_quizzes.json").weeks || {};
      if (!wl[String(wk)]) return { ok: false, why: "no practice bank for that week" };
      if (isConcept(c) && !conceptWeeks(o)[String(wk)]) return { ok: false, why: "there is no diagnostic bank for that week yet" };
      c.v[20] = wk; c.v[19] = ""; c.v[18] = Math.max(5, Math.min(maxN(store, code, c, o), quizN(c))); val = String(wk);
    } else if (field === "n_questions") { const nn = Math.max(5, Math.min(maxN(store, code, c, o), num(val) || 5)); c.v[18] = nn; val = String(nn); }
    else if (field === "mode") { if (isConcept(c) && /^t/i.test(val)) return { ok: false, why: "a diagnostic quiz is always one question at a time" }; c.v[15] = /^t/i.test(val) ? "timed" : "paced"; }
    else return { ok: false, why: "unknown setting" };
    detail = field + "=" + val;
  } else return { ok: false, why: "unknown action" };
  ctlSave(c); log("control:" + a, detail);
  return { ok: true, status: status(c) };
}

module.exports = { isConcept, conceptWeeks, HEADER, TAB, liveEntry, maxN, act, ctl, ctlSave, status, eff, keyRow, weekFromCode, codeWeek, joinBase, chooseQuestions, lettersFor, mark, shuffle, quizN, qids, paced, voteOf, discussedOf, allowLate, visible, drawSalt, randomText: () => crypto.randomUUID() };
