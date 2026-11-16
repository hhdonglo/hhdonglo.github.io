/* Quiz results: the answers given during a paced quiz, their compilation into held results when it ends, the lecturer's release or discard, the item
   log and presence. A port of latestAnswers_, finalize_, commitQuiz_, discardQuiz_, logItems_, dropItems_, presence_ and answerCounts_
   (apps_script/src/10-assessment.gs), with the same answers. The control rules (rules/quiz-control.js) are used for the quiz's round and questions.
   o = {site, random} as in quiz-control; o.master(entries) and o.totals() are the score tables (rules/score-tables.js), none when not passed. */
"use strict";
const C = require("./quiz-control");
const { append, logLine } = require("./store");

const ANSWERS = "Answers", STAGED = "Staged_Quiz", RESPONSES = "Form Responses 1", PRESENCE = "Presence", ITEMS = "Item_Log";
const RESP_HEADER = ["Timestamp", "First Name", "ID", "Join Code", "Q1", "Q2", "Q3", "Q4", "Q5", "Score", "Round", "Questions", "Answers", "Week"];
const ITEMS_HEADER = ["Timestamp", "Join Code", "Round", "Week", "Student ID", "Q", "Question ID", "Answer", "Correct answer", "Correct", "Confidence", "First answer", "Discussed"];
const ANSWERS_HEADER = ["Timestamp", "ID", "First Name", "Join Code", "Q", "Answer", "Round", "Confidence", "Vote"];
const PRESENCE_HEADER = ["Timestamp", "ID", "First Name", "Join Code", "Status"];
const up = (v) => String(v).trim().toUpperCase();
const blanks = (n) => new Array(n).fill("");
// A sheet ends at its last row with something in it: rows a release emptied do not count (the script reads them the same way).
const body = (store, tab, w) => { const r = store.rows(tab); if (!r || r.length < 2) return []; const rows = r.slice(1).map((x) => x.slice(0, w)); while (rows.length && !rows[rows.length - 1].some((c) => c !== "" && c != null)) rows.pop(); return rows; };
const putBody = (store, tab, header, rows) => store.setRows(tab, [header.slice()].concat(rows));
const roundOf = (store, code) => { const c = C.ctl(store, code); return c ? Number(c.v[16]) || 0 : 0; };

// One stored response: the first five answers sit in Q1 to Q5; Answers holds all N letters ('-' = blank).
function rowFor(ts, name, id, code, ans, score, rnd, n, week) {
  const f = []; for (let i = 0; i < 5; i++) f.push(ans[i] || "");
  return [ts, name, id, code].concat(f, [score, rnd, n, ans.map((a) => a || "-").join(""), week || ""]);
}

// ---------- answers ----------
function addAnswer(store, row) { append(store, ANSWERS, ANSWERS_HEADER, row); }

// {id: {name, ans, conf, first, second}} for the current round; the last answer to each question wins.
function latestAnswers(store, code) {
  const out = {}, rows = body(store, ANSWERS, 9), cc = C.ctl(store, code), round = cc ? Number(cc.v[16]) || 0 : 0, N = cc ? C.quizN(cc) : 5;
  rows.forEach((r) => {
    const x = r.slice(1); // ID, First Name, Join Code, Q, Answer, Round, Confidence, Vote
    if (up(x[2]) !== code || (Number(x[5]) || 0) !== round) return;
    const id = String(x[0]).trim(), q = Number(x[3]);
    if (!out[id]) out[id] = { name: String(x[1]), ans: blanks(N), conf: blanks(N), first: blanks(N), second: [] };
    if (q >= 1 && q <= N) {
      out[id].ans[q - 1] = String(x[4]); out[id].conf[q - 1] = String(x[6] || "");
      if (Number(x[7]) !== 2) out[id].first[q - 1] = String(x[4]); else out[id].second[q - 1] = true;
    }
  });
  return out;
}
const spread = () => ({ A: 0, B: 0, C: 0, D: 0, E: 0 });
function answerCounts(store, code, q) { // how many have answered question q, and the spread of A to E; with the first vote when there was a second
  const got = latestAnswers(store, code), dist = spread(), fdist = spread(); let n = 0, fn = 0, again = 0;
  Object.keys(got).forEach((id) => {
    const a = got[id].ans[q - 1], f = got[id].first[q - 1];
    if (a) { n++; if (dist[a] !== undefined) dist[a]++; }
    if (f) { fn++; if (fdist[f] !== undefined) fdist[f]++; }
    if (got[id].second[q - 1]) again++;
  });
  return { answered: n, dist, first: { answered: fn, dist: fdist }, changed: again };
}

// Rows of Form Responses 1 followed by the held rows (14 columns each).
const respRows = (store) => body(store, RESPONSES, 14).concat(body(store, STAGED, 14));
const addHeld = (store, row) => { const r = store.rows(STAGED) || [RESP_HEADER.slice()]; store.setRows(STAGED, r.concat([row])); };

// ---------- presence ----------
function presence(store, code, id, name, status) {
  const rows = store.rows(PRESENCE) || [PRESENCE_HEADER.slice()], now = store.now();
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][1]).trim() === id && up(rows[i][3]) === code) {
      if (String(rows[i][4]) !== "submitted") { const m = rows.slice(); m[i] = [now, id, name, code, status]; store.setRows(PRESENCE, m); }
      return true;
    }
  }
  store.setRows(PRESENCE, rows.concat([[now, id, name, code, status]]));
  return true;
}
function hasPresence(store, code, id) {
  const rows = body(store, PRESENCE, 5);
  return rows.some((r) => String(r[1]).trim() === id && up(r[3]) === code);
}

// ---------- item log ----------
function logItems(store, code, rnd, wk, ids, letters, got, discussed) {
  const now = store.now(), add = [], disc = {}; (discussed || []).forEach((q) => { disc[q] = true; });
  Object.keys(got).forEach((id) => {
    const a = got[id];
    for (let q = 0; q < letters.length; q++) {
      const ans = String(a.ans[q] || "");
      add.push([now, code, rnd, wk || "", id, q + 1, ids[q] || "", ans, letters[q] || "", letters[q] && ans === letters[q] ? 1 : 0, (a.conf && a.conf[q]) || "", disc[q + 1] ? String((a.first && a.first[q]) || "") : "", disc[q + 1] ? 1 : ""]);
    }
  });
  const rows = body(store, ITEMS, 13), same = (r) => up(r[1]) === code && (Number(r[2]) || 0) === rnd;
  putBody(store, ITEMS, ITEMS_HEADER, (rows.some(same) ? rows.filter((r) => !same(r)) : rows).concat(add)); // a reopened quiz is compiled again
}
function dropItems(store, pairs) { // pairs: {'CODE|round': true}, from a discard
  if (!store.rows(ITEMS) || !Object.keys(pairs).length) return;
  const rows = body(store, ITEMS, 13), keep = rows.filter((r) => !pairs[up(r[1]) + "|" + (Number(r[2]) || 0)]);
  if (keep.length !== rows.length) putBody(store, ITEMS, ITEMS_HEADER, keep);
}

// ---------- compile, release, discard ----------
function finalize(store, code, o) {
  const key = C.keyRow(store, code, o), got = latestAnswers(store, code), cf = C.ctl(store, code);
  if (!key) return;
  const letters = C.lettersFor(store, code, cf, o), nq = cf ? C.quizN(cf) : 5, wk = cf ? (Number(cf.v[20]) || 1) : "", rnd = roundOf(store, code);
  let rows = body(store, STAGED, 14); const have = {};
  rows.forEach((r, j) => { if (up(r[3]) === code && (Number(r[10]) || 0) === rnd) have[String(r[2]).trim()] = j; });
  Object.keys(got).forEach((id) => {
    const a = got[id], score = C.mark(letters, a.ans).reduce((x, y) => x + y, 0), rw = rowFor(store.now(), a.name, id, code, a.ans, score, rnd, nq, wk);
    if (have[id] !== undefined) rows[have[id]] = rw; else rows.push(rw);
    presence(store, code, id, a.name, "submitted");
  });
  putBody(store, STAGED, RESP_HEADER, rows);
  try { logItems(store, code, rnd, wk, cf ? C.qids(cf) : [], letters, got, cf ? C.discussedOf(cf) : []); } catch (e) { logLine(store, "item log failed", String(e).slice(0, 120), "", code); }
}

// Copy held rows into Form Responses 1 (a re-release of the same ID, code and round replaces that row), then the score tables. code '' releases every held row.
function commit(store, code, everyRound, o) {
  const held = body(store, STAGED, 14); if (!held.length) return { released: 0 };
  let resp = body(store, RESPONSES, 14); const have = {}, keep = [], entries = [], curRound = {}, fresh = []; let released = 0;
  resp.forEach((r, j) => { have[String(r[2]).trim() + "|" + up(r[3]) + "|" + (Number(r[10]) || 0)] = j; });
  held.forEach((r) => {
    const c = up(r[3]), rnd = Number(r[10]) || 0;
    if (curRound[c] === undefined) curRound[c] = roundOf(store, c);
    if (!((!code || c === code) && (everyRound || rnd === curRound[c]))) { keep.push(r); return; }
    const id = String(r[2]).trim(), k = id + "|" + c + "|" + rnd, wk = Number(r[13]) || 0;
    if (have[k] !== undefined) resp[have[k]] = r; else fresh.push(r);
    entries.push({ id, name: String(r[1]), label: wk ? "Week " + wk : "Quiz " + c, score: Number(r[9]), n: Number(r[11]) || 5 });
    released++;
  });
  putBody(store, RESPONSES, RESP_HEADER, resp.concat(fresh));
  putBody(store, STAGED, RESP_HEADER, keep);
  if (o && o.master) o.master(entries);
  if (o && o.totals) o.totals();
  logLine(store, "quiz released", String(released) + " result(s)", "", code);
  return { released };
}
function discard(store, code, everyRound) {
  const held = body(store, STAGED, 14); if (!held.length) return { discarded: 0 };
  const keep = [], curRound = {}, dropped = {}; let gone = 0;
  held.forEach((r) => {
    const c = up(r[3]), rnd = Number(r[10]) || 0;
    if (curRound[c] === undefined) curRound[c] = roundOf(store, c);
    if ((!code || c === code) && (everyRound || rnd === curRound[c])) { gone++; dropped[c + "|" + rnd] = true; } else keep.push(r);
  });
  try { dropItems(store, dropped); } catch (e) { /* the item log only */ }
  putBody(store, STAGED, RESP_HEADER, keep);
  logLine(store, "quiz discarded", String(gone) + " held result(s)", "", code);
  return { discarded: gone };
}
// The hooks quiz-control's act() needs, tied to a store and its options.
const hooks = (store, o) => ({ finalize: (code) => finalize(store, code, o), commit: (code, every) => commit(store, code, every, o), discard: (code, every) => discard(store, code, every) });

module.exports = { rowFor, respRows, addHeld, addAnswer, latestAnswers, answerCounts, presence, hasPresence, logItems, dropItems, finalize, commit, discard, hooks, roundOf, RESP_HEADER, ITEMS_HEADER, ANSWERS_HEADER };
