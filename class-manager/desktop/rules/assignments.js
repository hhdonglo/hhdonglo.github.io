/* Group assignments: given to some or all groups of a set, one shared submission per group, each member's own part, private peer
   ratings, and the lecturer's mark. A port of assignmentsAct_, groupWork_, groupWorkOf_ and asgSummary_ (apps_script/src/40-collaboration.gs).
   o = {site, today?}: as score-tables and outcomes. Student calls pass req and the sign-in counters (o.counters) as auth.studentCheck does.
   Tabs: Assignments, Group_Work, Assignment_Marks. */
"use strict";
const AU = require("./auth");
const G = require("./groups");
const OC = require("./outcomes");
const ST = require("./score-tables");
const L = require("./learning");
const T = require("./text");
const { normalizeId } = require("../ids");
const { append, logLine } = require("./store");

const TAB = "Assignments", HEAD = ["ID", "Set", "Groups", "Title", "Brief", "Due", "Outcome", "Out of", "Status", "Created", "Updated"];
const GW = "Group_Work", GW_HEAD = ["Time", "Assignment ID", "Set", "Group", "Student ID", "Kind", "Text", "Link", "Rating"];
const AMK = "Assignment_Marks", AMK_HEAD = ["Assignment ID", "Group", "Mark", "Feedback", "Marked"];
const PEER_WORD = { full: "Contributed fully", part: "Contributed partly", little: "Contributed little" }, PEER_VAL = { full: 2, part: 1, little: 0 };
const clean = (v, max) => { let s = String(v == null ? "" : v).trim().slice(0, max); if (/^[=+\-@]/.test(s)) s = "'" + s; return s; };
const uuid = (o) => String(o.random()).replace(/-/g, "");

function rows(store) {
  return T.body(store, TAB, 11).map((r) => ({ id: String(r[0]).trim(), set: String(r[1]).replace(/^'/, ""), groups: String(r[2] || "all"), title: String(r[3]), brief: String(r[4]), due: String(r[5] || "").replace(/^'/, ""),
    outcome: String(r[6] || "").replace(/^'/, ""), outOf: r[7] === "" ? "" : Number(r[7]), status: String(r[8] || "open"), created: new Date(r[9]).getTime() || 0, updated: r[10] })).filter((a) => a.id);
}
function save(store, list) {
  T.rewrite(store, TAB, HEAD, list.map((a) => [a.id, "'" + a.set, a.groups, a.title, a.brief, a.due ? "'" + a.due : "", a.outcome ? "'" + a.outcome : "", a.outOf, a.status, new Date(a.created || store.now().getTime()), store.now()]));
}
const forGroup = (a, g) => a.groups === "all" || String(a.groups).split(",").map(Number).indexOf(Number(g)) >= 0;
function workRows(store) {
  return T.body(store, GW, 9).map((r) => ({ t: new Date(r[0]).getTime() || 0, aid: String(r[1]).trim(), set: String(r[2]).replace(/^'/, ""), group: Number(r[3]) || 0, id: normalizeId(r[4]), kind: String(r[5]), text: String(r[6] || ""), link: String(r[7] || ""), rating: String(r[8] || "") }));
}
function markRows(store) { const o = {}; T.body(store, AMK, 5).forEach((r) => { o[String(r[0]).trim() + "|" + Number(r[1])] = { mark: r[2] === "" ? null : Number(r[2]), feedback: String(r[3] || ""), marked: r[4] }; }); return o; }
function dueMs(due) { const d = T.calDate(due); if (!d) return 0; if (!/T/.test(due)) d.setHours(23, 59, 0, 0); return d.getTime(); }

// How one group did on one assignment: the latest shared submission, each member's part, the peer ratings (lecturer only) and the mark.
function groupWorkOf(a, g, members, work, marks, names) {
  const mine = work.filter((w) => w.aid === a.id && w.group === g), due = dueMs(a.due), subs = mine.filter((w) => w.kind === "work"), last = subs.length ? subs[subs.length - 1] : null, parts = {}, peers = {};
  mine.forEach((w) => { if (w.kind === "part") parts[w.id] = w; if (w.kind === "peer") { let r = {}; try { r = JSON.parse(w.rating) || {}; } catch (e) { r = {}; } peers[w.id] = r; } });
  const mem = members.map((id) => {
    const got = []; Object.keys(peers).forEach((rater) => { if (rater !== id && peers[rater][id] && PEER_VAL[peers[rater][id]] !== undefined) got.push(PEER_VAL[peers[rater][id]]); });
    const avg = got.length ? Math.round(100 * got.reduce((x, y) => x + y, 0) / got.length) / 100 : null;
    return { id, name: names[id] || "", part: parts[id] ? parts[id].text : "", partTime: parts[id] ? T.fmtDay(parts[id].t) : "", rated: !!peers[id], peerAvg: avg, peerN: got.length, peerFlag: avg !== null && got.length >= 2 && avg < 1, submitted: subs.some((w) => w.id === id) };
  });
  const mk = marks[a.id + "|" + g] || null;
  return { group: g, members: mem, submitted: !!last, text: last ? last.text : "", link: last ? last.link : "", by: last ? (names[last.id] || last.id) : "", time: last ? T.fmtDay(last.t) : "", versions: subs.length,
    onTime: last ? (!due || last.t <= due) : null, late: !!(last && due && last.t > due), mark: mk ? mk.mark : null, feedback: mk ? mk.feedback : "", parts: mem.filter((m) => m.part).length, ratedBy: mem.filter((m) => m.rated).length };
}
function summary(a, list, work, marks, names, ev) {
  const groups = {}; list.filter((r) => r.set === a.set && forGroup(a, r.group)).forEach((r) => { (groups[r.group] = groups[r.group] || []).push(r.id); });
  const gl = Object.keys(groups).map(Number).sort((x, y) => x - y).map((g) => groupWorkOf(a, g, groups[g], work, marks, names));
  let students = 0, parts = 0, flags = 0; gl.forEach((g) => { students += g.members.length; parts += g.parts; g.members.forEach((m) => { if (m.peerFlag) flags++; }); });
  let allIds = []; Object.keys(groups).forEach((g) => { allIds = allIds.concat(groups[g]); });
  return { id: a.id, set: a.set, title: a.title, brief: a.brief, due: a.due, outcome: a.outcome, outcomeLabel: a.outcome ? OC.outcomeLabel(a.outcome, ev._lects) : "", outOf: a.outOf, status: a.status, groupsAllocated: a.groups,
    created: T.fmtDay(a.created), groups: gl, measures: { allocated: gl.length, submitted: gl.filter((g) => g.submitted).length, onTime: gl.filter((g) => g.onTime).length,
      marked: gl.filter((g) => g.mark !== null).length, contribution: L.pct(parts, students), students, peerFlags: flags, beforeAfter: OC.asgBeforeAfter(a, allIds, ev) } };
}

// Host only: list, save, delete, close or reopen, mark and view group assignments.
function act(store, p, o) {
  const op = String(p.op || "list").toLowerCase(); let list = rows(store); const grows = G.rows(store), names = G.namesOf(store);
  if (op === "save") {
    const set = clean(p.set, 60).replace(/^'/, ""), title = clean(p.title, 120), brief = String(p.brief || "").replace(/\r/g, "").slice(0, 4000).trim();
    if (!set || !grows.some((r) => r.set === set)) return { ok: false, why: "choose a group set first" };
    if (!title) return { ok: false, why: "give the assignment a title" };
    const gs = String(p.groups || "all").toLowerCase() === "all" ? "all" : String(p.groups).split(/[\s,]+/).map(Number).filter((x) => x > 0).join(",");
    if (!gs) return { ok: false, why: "choose at least one group" };
    const due = String(p.due || "") ? T.calWhen(p.due) : ""; if (p.due && !due) return { ok: false, why: "the due date is not valid" };
    const oo = String(p.outof || "").trim(); if (oo !== "" && !(Number(oo) > 0)) return { ok: false, why: "out of must be a positive number" };
    const outc = /^L\d+(\.\d+)?$/.test(String(p.outcome || "")) ? String(p.outcome) : "";
    let a = list.filter((x) => x.id === String(p.id || ""))[0];
    if (!a) { a = { id: "A" + uuid(o).slice(0, 8).toUpperCase(), created: store.now().getTime(), status: "open" }; list.push(a); }
    a.set = set; a.groups = gs; a.title = title; a.brief = brief; a.due = due; a.outcome = outc; a.outOf = oo === "" ? "" : Number(oo);
    save(store, list); logLine(store, "assignment saved", a.title + " (" + set + ", groups " + gs + ")", "", "");
    const r1 = act(store, { op: "list" }, o); r1.saved = a.id; return r1;
  }
  const a2 = list.filter((x) => x.id === String(p.id || ""))[0];
  if (op === "delete" || op === "close" || op === "open") {
    if (!a2) return { ok: false, why: "no such assignment" };
    if (op === "delete") { list = list.filter((x) => x !== a2); logLine(store, "assignment deleted", a2.title, "", ""); } else a2.status = op === "close" ? "closed" : "open";
    save(store, list); return act(store, { op: "list" }, o);
  }
  if (op === "mark") {
    if (!a2) return { ok: false, why: "no such assignment" };
    const g = Number(p.group) || 0, mk = String(p.mark || "").trim(), fb = String(p.feedback || "").replace(/\r/g, "").slice(0, 2000).trim();
    if (mk !== "" && isNaN(Number(mk))) return { ok: false, why: "the mark must be a number" };
    const members = grows.filter((r) => r.set === a2.set && r.group === g);
    if (!members.length || !forGroup(a2, g)) return { ok: false, why: "that group does not have this assignment" };
    const mrows = T.body(store, AMK, 5).filter((r) => !(String(r[0]).trim() === a2.id && Number(r[1]) === g));
    mrows.push([a2.id, g, mk === "" ? "" : Number(mk), fb, store.now()]); T.rewrite(store, AMK, AMK_HEAD, mrows);
    if (mk !== "" && a2.outOf !== "") ST.updateMaster(store, members.filter((r) => names[r.id] !== undefined).map((r) => ({ id: r.id, name: r.name, label: "Assignment: " + a2.title, score: Number(mk), n: Number(a2.outOf) })), o);
    logLine(store, "assignment mark", a2.title + " group " + g + ": " + mk, "", "");
    return act(store, { op: "view", id: a2.id }, o);
  }
  const work = workRows(store), marks = markRows(store), ev = OC.evidence(store, o);
  if (op === "view") { if (!a2) return { ok: false, why: "no such assignment" }; return { ok: true, assignment: summary(a2, grows, work, marks, names, ev) }; }
  const sets = {}; grows.forEach((r) => { (sets[r.set] = sets[r.set] || {})[r.group] = 1; });
  return { ok: true, assignments: list.map((a) => { const s = summary(a, grows, work, marks, names, ev); delete s.groups; return s; }),
    sets: Object.keys(sets).map((k) => ({ name: k, groups: Object.keys(sets[k]).map(Number).sort((x, y) => x - y) })),
    outcomes: Object.keys(ev._lects).map(Number).sort((x, y) => x - y).reduce((acc, n) => { ev._lects[n].outcomes.forEach((t, i) => { acc.push({ key: "L" + n + "." + (i + 1), label: OC.outcomeLabel("L" + n + "." + (i + 1), ev._lects) }); }); return acc; }, []) };
}

// A student: their group's assignments, and submit, part and peer. p = {id, access, op, aid, text, link, ratings}; req and o as auth.studentCheck.
function groupWork(store, p, req, o) {
  const au = AU.studentCheck(store, p.id, p.access, "r", req, o); if (!au.id) return { ok: false, why: au.why };
  const id = au.id, op = String(p.op || "list").toLowerCase(), grows = G.rows(store), list = rows(store), names = G.namesOf(store), mine = grows.filter((r) => r.id === id);
  const mineFor = (aid) => { const a = list.filter((x) => x.id === aid)[0]; if (!a) return null; const g = mine.filter((r) => r.set === a.set && forGroup(a, r.group))[0]; return g ? { a, g: g.group } : null; };
  if (op === "submit" || op === "part" || op === "peer") {
    const m = mineFor(String(p.aid || "")); if (!m) return { ok: false, why: "this assignment is not for your group" };
    if (m.a.status === "closed") return { ok: false, why: "this assignment is closed" };
    let row = null; const now = store.now();
    if (op === "submit") { const tx = T.chatTxt(p.text, 8000), lk = T.safeLink(p.link); if (!tx && !lk) return { ok: false, why: "write the answer or give a link" }; if (p.link && !lk) return { ok: false, why: "the link must start with https://" }; row = [now, m.a.id, "'" + m.a.set, m.g, id, "work", tx, lk, ""]; }
    else if (op === "part") { const pt = T.chatTxt(p.text, 1000); if (!pt) return { ok: false, why: "say what you did" }; row = [now, m.a.id, "'" + m.a.set, m.g, id, "part", pt, "", ""]; }
    else {
      let r = {}; try { r = JSON.parse(String(p.ratings || "{}")) || {}; } catch (e) { return { ok: false, why: "the ratings could not be read" }; }
      const mates = grows.filter((x) => x.set === m.a.set && x.group === m.g && x.id !== id).map((x) => x.id), cl = {};
      mates.forEach((x) => { if (PEER_VAL[r[x]] !== undefined) cl[x] = r[x]; });
      if (!Object.keys(cl).length) return { ok: false, why: "rate at least one group-mate" };
      row = [now, m.a.id, "'" + m.a.set, m.g, id, "peer", "", "", JSON.stringify(cl)];
    }
    append(store, GW, GW_HEAD, row); logLine(store, "group work " + op, m.a.title + " group " + m.g, id, "");
  }
  const work = workRows(store), marks = markRows(store), out = [];
  list.forEach((a) => {
    const g = mine.filter((r) => r.set === a.set && forGroup(a, r.group))[0]; if (!g) return;
    const members = grows.filter((r) => r.set === a.set && r.group === g.group).map((r) => r.id), s = groupWorkOf(a, g.group, members, work, marks, names), me = s.members.filter((x) => x.id === id)[0] || {};
    const myPeer = work.filter((w) => w.aid === a.id && w.id === id && w.kind === "peer").pop(); let pr = {}; try { pr = myPeer ? JSON.parse(myPeer.rating) : {}; } catch (e) { pr = {}; }
    out.push({ id: a.id, set: a.set, group: g.group, title: a.title, brief: a.brief, due: a.due, status: a.status, outOf: a.outOf,
      mates: s.members.filter((x) => x.id !== id).map((x) => ({ id: x.id, name: String(x.name || "").trim() || "Classmate", myRating: pr[x.id] || "" })),
      submitted: s.submitted, text: s.text, link: s.link, by: s.by, time: s.time, versions: s.versions, late: s.late, myPart: me.part || "", rated: !!myPeer, mark: s.mark, feedback: s.mark !== null || s.feedback ? s.feedback : "" });
  });
  return { ok: true, assignments: out, ratingWords: PEER_WORD };
}

module.exports = { act, groupWork, rows, save, forGroup, workRows, markRows, groupWorkOf, summary, dueMs, TAB, HEAD, GW, GW_HEAD, AMK, AMK_HEAD, PEER_WORD, PEER_VAL };
