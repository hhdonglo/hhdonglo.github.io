/* Student groups: made at random or mixed by quiz results or attendance, adjusted by hand, locked and marked per group.
   A port of groupsAct_, studentGroups_ and groupsDisplay_ (apps_script/src/40-collaboration.gs), with the same answers.
   o = {random} (a random text, as crypto.randomUUID) and, for marks, whatever updateMaster needs (o.site). Tab: Groups. */
"use strict";
const AC = require("./access-codes");
const AT = require("./attendance");
const ST = require("./score-tables");
const T = require("./text");
const { normalizeId } = require("../ids");
const { logLine } = require("./store");

const TAB = "Groups", HEADER = ["Set", "Group", "Student ID", "Name", "Group mark", "Out of", "Locked", "Created"];
const clean = (v, max) => { let s = String(v == null ? "" : v).trim().slice(0, max); if (/^[=+\-@]/.test(s)) s = "'" + s; return s; };

function rows(store) {
  return T.body(store, TAB, 8).map((r) => ({ set: String(r[0]).trim(), group: Number(r[1]) || 0, id: normalizeId(r[2]), name: String(r[3] || ""), mark: r[4], outOf: r[5], locked: /^y/i.test(String(r[6])), created: r[7] }))
    .filter((r) => r.set && r.group && r.id);
}
const rowOut = (store, r) => [r.set, r.group, r.id, r.name, r.mark === undefined ? "" : r.mark, r.outOf === undefined ? "" : r.outOf, r.locked ? "Yes" : "", r.created || store.now()];
function save(store, list) {
  list.sort((a, b) => (a.set < b.set ? -1 : a.set > b.set ? 1 : a.group - b.group || (a.name < b.name ? -1 : 1)));
  T.rewrite(store, TAB, HEADER, list.map((r) => rowOut(store, r)));
}
const namesOf = (store) => { const n = {}; AC.rosterRows(store).forEach((r) => { const id = normalizeId(r[0]); if (id) n[id] = AC.cleanName(r[1]); }); return n; };
const pairKey = (a, b) => (a < b ? a + "|" + b : b + "|" + a);

// How many times each pair of students has already shared a group, in sets other than `except`.
function pairCounts(list, except) {
  const by = {}, pc = {};
  list.forEach((r) => { if (r.set === except) return; (by[r.set + "|" + r.group] = by[r.set + "|" + r.group] || []).push(r.id); });
  Object.keys(by).forEach((k) => { const m = by[k]; for (let i = 0; i < m.length; i++) for (let j = i + 1; j < m.length; j++) { const p = pairKey(m[i], m[j]); pc[p] = (pc[p] || 0) + 1; } });
  return pc;
}
function repeatCost(groups, pc) {
  let c = 0;
  groups.forEach((g) => { for (let i = 0; i < g.length; i++) for (let j = i + 1; j < g.length; j++) c += pc[pairKey(g[i], g[j])] || 0; });
  return c;
}

// Per-student measure for the mixed modes: live quiz average (released results), else attendance rate.
function studentMeasure(store, mode) {
  const out = {};
  if (mode === "attendance") {
    const g = store.rows("Attendance");
    if (g && g.length > 1 && g[0].length > 1) {
      for (let i = 1; i < g.length; i++) {
        const id = normalizeId(g[i][0]); let p = 0, n = 0;
        for (let c = 1; c < g[0].length; c++) if (g[i][c] !== "" && g[i][c] != null && String(g[0][c]).trim()) { n++; if (Number(g[i][c])) p++; }
        if (id && n) out[id] = p / n;
      }
    }
    return out;
  }
  const sum = {};
  ST.collectResults(store).forEach((e) => { if (!/^(Week |Quiz )/.test(e.label) || !e.n) return; const k = normalizeId(e.id), s = sum[k] || (sum[k] = { s: 0, n: 0 }); s.s += e.score; s.n += e.n; });
  Object.keys(sum).forEach((id) => { out[id] = sum[id].s / sum[id].n; });
  return out;
}

// Deal students into k groups. Mixed modes: rank by the measure, cut into tiers of k, one from every tier to each group.
function dealGroups(o, ids, k, mode, measure) {
  let order;
  if (mode === "random") order = T.shuffled(o, ids);
  else {
    const known = ids.filter((id) => measure[id] !== undefined), vals = known.map((id) => measure[id]).sort((a, b) => a - b);
    const mid = vals.length ? vals[Math.floor(vals.length / 2)] : 0;
    order = T.shuffled(o, ids).sort((a, b) => (measure[b] !== undefined ? measure[b] : mid) - (measure[a] !== undefined ? measure[a] : mid));
  }
  const groups = []; for (let g = 0; g < k; g++) groups.push([]);
  for (let t = 0; t < order.length; t += k) {
    const tier = mode === "random" ? order.slice(t, t + k) : T.shuffled(o, order.slice(t, t + k));
    const slots = T.shuffled(o, groups.map((x, i) => i)).sort((a, b) => groups[a].length - groups[b].length); // smallest groups first
    tier.forEach((id, i) => { groups[slots[i]].push(id); });
  }
  return groups;
}

// Swap students between groups while that lowers the repeated pairings; mixed modes swap only within the same tier.
function improveGroups(groups, pc, tierOf) {
  const gc = (g) => repeatCost([g], pc);
  let best = repeatCost(groups, pc), pass = 0, changed = true;
  while (changed && best > 0 && pass++ < 6) {
    changed = false;
    for (let a = 0; a < groups.length; a++) for (let b = a + 1; b < groups.length; b++) {
      let base = gc(groups[a]) + gc(groups[b]);
      if (!base) continue;
      for (let i = 0; i < groups[a].length; i++) for (let j = 0; j < groups[b].length; j++) {
        const x = groups[a][i], y = groups[b][j];
        if (tierOf && tierOf[x] !== tierOf[y]) continue;
        groups[a][i] = y; groups[b][j] = x;
        const now = gc(groups[a]) + gc(groups[b]);
        if (now < base) { best -= base - now; base = now; changed = true; } else { groups[a][i] = x; groups[b][j] = y; }
      }
    }
  }
  return best;
}

function make(store, p, o, set, list, names) {
  if (!set) return { ok: false, why: "give the set a name" };
  const mode = /^mix/i.test(p.mode) ? "mixed" : /^att/i.test(p.mode) ? "attendance" : "random";
  let pool = Object.keys(names);
  if (/^present/i.test(p.from)) { // only the students checked in at the latest attendance session
    const ses = AT.sessions(store), last = ses.length ? ses[ses.length - 1] : null, here = last ? AT.present(store, last.label) : {};
    pool = pool.filter((id) => here[id]);
    if (!last) return { ok: false, why: "no attendance session yet" };
  }
  const keep = list.filter((r) => r.set === set && r.locked), lockedIds = {}, lockedGroups = {};
  keep.forEach((r) => { lockedIds[r.id] = true; lockedGroups[r.group] = true; });
  pool = pool.filter((id) => !lockedIds[id]);
  if (!pool.length) return { ok: false, why: keep.length ? "every student is in a locked group" : "no students to group: load the class list first" };
  const size = Math.max(2, Math.min(50, Number(p.size) || 0)), count = Math.max(1, Math.min(200, Number(p.count) || 0));
  const k = Number(p.count) ? Math.min(count, pool.length) : Math.max(1, Math.ceil(pool.length / (size || 4)));
  const measure = mode === "random" ? {} : studentMeasure(store, mode === "mixed" ? "quiz" : "attendance");
  const pc = /^n/i.test(String(p.avoid || "yes")) ? {} : pairCounts(list, set);
  let best = null, bestCost = Infinity;
  for (let tries = 0; tries < 120 && bestCost > 0; tries++) { const gs = dealGroups(o, pool, k, mode, measure), c = repeatCost(gs, pc); if (c < bestCost) { best = gs; bestCost = c; } }
  let tierOf = null;
  if (mode !== "random") { tierOf = {}; best.forEach((g) => { g.forEach((id, i) => { tierOf[id] = i; }); }); }
  bestCost = improveGroups(best, pc, tierOf);
  const numbers = []; let nx = 1; while (numbers.length < best.length) { if (!lockedGroups[nx]) numbers.push(nx); nx++; }
  const now = store.now(), fresh = [];
  best.forEach((g, i) => { g.forEach((id) => { fresh.push({ set, group: numbers[i], id, name: names[id] || "", mark: "", outOf: "", locked: false, created: now }); }); });
  save(store, list.filter((r) => r.set !== set).concat(keep, fresh));
  logLine(store, "groups made", set + ": " + mode + ", " + best.length + " new group(s), repeats " + bestCost, "", "");
  const res = act(store, { op: "list", set }, o); res.repeats = bestCost; res.mode = mode; return res;
}

function act(store, p, o) {
  const op = String(p.op || "list").toLowerCase(), set = clean(p.set, 60).replace(/^'/, ""), list = rows(store), names = namesOf(store);
  if (op === "make") return make(store, p, o, set, list, names);
  if (op === "move" || op === "lock" || op === "mark" || op === "delete") {
    const inSet = list.filter((r) => r.set === set);
    if (!inSet.length) return { ok: false, why: "no such set" };
    const g = Number(p.group) || 0;
    if (op === "move") {
      const id = normalizeId(p.id), to = Math.max(1, Math.min(200, Number(p.to) || 0)), who = inSet.filter((r) => r.id === id)[0];
      if (!who || !to) return { ok: false, why: "student not in this set" };
      const target = inSet.filter((r) => r.group === to)[0];
      who.group = to; who.locked = target ? target.locked : false;
      if (target) { who.mark = target.mark; who.outOf = target.outOf; } else { who.mark = ""; who.outOf = ""; }
    } else if (op === "lock") {
      inSet.forEach((r) => { if (r.group === g) r.locked = !/^(0|no|false)$/i.test(String(p.value || "yes")); });
    } else if (op === "mark") {
      const mk = String(p.mark || "").trim(), oo = String(p.outof || "").trim();
      if (mk !== "" && isNaN(Number(mk))) return { ok: false, why: "the mark must be a number" };
      if (oo !== "" && (isNaN(Number(oo)) || Number(oo) <= 0)) return { ok: false, why: "out of must be a positive number" };
      const members = inSet.filter((r) => r.group === g);
      if (!members.length) return { ok: false, why: "no such group" };
      members.forEach((r) => { r.mark = mk === "" ? "" : Number(mk); r.outOf = oo === "" ? "" : Number(oo); });
      if (mk !== "" && oo !== "") ST.updateMaster(store, members.filter((r) => names[r.id] !== undefined).map((r) => ({ id: r.id, name: r.name, label: "Group: " + set, score: Number(mk), n: Number(oo) })), o);
      logLine(store, "group mark", set + " group " + g + ": " + mk + (oo ? " / " + oo : ""), "", "");
    } else if (op === "delete") {
      save(store, list.filter((r) => r.set !== set));
      logLine(store, "groups deleted", set, "", "");
      return act(store, { op: "list" }, o);
    }
    save(store, list);
    return act(store, { op: "list", set }, o);
  }
  // list: the sets, and the groups of one set
  const sets = [], seen = {};
  list.forEach((r) => { if (!seen[r.set]) { seen[r.set] = { name: r.set, students: 0, groups: {}, created: r.created }; sets.push(seen[r.set]); } seen[r.set].students++; seen[r.set].groups[r.group] = 1; });
  const pick = set && seen[set] ? set : (sets.length ? sets[sets.length - 1].name : ""), pcAll = pairCounts(list, pick), groups = {};
  list.filter((r) => r.set === pick).forEach((r) => {
    const gg = groups[r.group] || (groups[r.group] = { group: r.group, locked: r.locked, mark: r.mark, outOf: r.outOf, members: [] });
    gg.members.push({ id: r.id, name: r.name || names[r.id] || "", onList: names[r.id] !== undefined });
  });
  const out = Object.keys(groups).map((k) => groups[k]).sort((a, b) => a.group - b.group), inGroup = {};
  out.forEach((gq) => { gq.members.forEach((m) => { inGroup[m.id] = true; }); });
  return { ok: true, sets: sets.map((s) => ({ name: s.name, students: s.students, groups: Object.keys(s.groups).length })), set: pick, groups: out,
    repeats: repeatCost(out.map((gq) => gq.members.map((m) => m.id)), pcAll),
    notGrouped: Object.keys(names).filter((id) => !inGroup[id]).map((id) => ({ id, name: names[id] })) };
}

// A student's own groups, for My progress: the other members' names as on the class list.
function studentGroups(store, id) {
  const all = rows(store);
  return all.filter((r) => r.id === id).map((m) => {
    const others = all.filter((r) => r.set === m.set && r.group === m.group && r.id !== id).map((r) => String(r.name || "").trim() || "Classmate");
    return { set: m.set, group: m.group, members: others, mark: m.mark === "" ? null : m.mark, outOf: m.outOf === "" ? null : m.outOf };
  });
}

// Host only: the groups of one set, laid out for the projector (first name and the initial of the last name).
function display(store, p, o) {
  const r = act(store, { op: "list", set: p.set }, o); if (!r.ok) return r;
  const short = (n) => { const w = String(n || "").trim().split(/\s+/); return w.length > 1 ? w[0] + " " + w[w.length - 1].charAt(0) + "." : (w[0] || "Student"); };
  const asg = require("./assignments"), list = asg.rows(store).filter((a) => a.set === r.set && a.status !== "closed");
  return { ok: true, set: r.set, sets: r.sets, groups: r.groups.map((g) => ({ group: g.group, members: g.members.map((m) => short(m.name)), tasks: list.filter((a) => asg.forGroup(a, g.group)).map((a) => a.title) })) };
}

module.exports = { act, rows, save, studentGroups, display, studentMeasure, dealGroups, improveGroups, pairCounts, repeatCost, namesOf, TAB, HEADER };
