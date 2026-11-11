// Module collaboration. Collaboration: student groups, group assignments, group work and peer ratings.
// Edit the files in apps_script/src/; apps_script/quiz_receiver.gs is built from them (node apps_script/build.js).

// ---------- Student groups: made automatically, adjusted by hand, marked per group ----------
// Groups (private): one row per student per group set. Set | Group | Student ID | Name | Group mark | Out of | Locked | Created.
//   A "set" is one grouping for one activity (for example "Lab 1"). The group mark is copied to every member, and to Master and Scores
//   as a column "Group: <set>" (not counted in the live quiz total).
// Modes: random; mixed by quiz results (each group gets a spread of stronger and weaker students); mixed by attendance.
// Earlier sets are remembered: among many candidate groupings the one that repeats the fewest earlier pairings is kept.
// Locked groups are kept as they are when the set is made again.
var GROUPS_TAB = 'Groups', GROUPS_HEADER = ['Set', 'Group', 'Student ID', 'Name', 'Group mark', 'Out of', 'Locked', 'Created'];

function groupsSheet_() { return sheetWith_(GROUPS_TAB, GROUPS_HEADER); }
function groupRows_() {
  return bodyRows_(SpreadsheetApp.getActiveSpreadsheet().getSheetByName(GROUPS_TAB), 8).map(function (r) {
    return { set: String(r[0]).trim(), group: Number(r[1]) || 0, id: normId_(r[2]), name: String(r[3] || ''), mark: r[4], outOf: r[5], locked: /^y/i.test(String(r[6])), created: r[7] };
  }).filter(function (r) { return r.set && r.group && r.id; });
}
function groupRowOut_(r) { return [r.set, r.group, r.id, r.name, r.mark === undefined ? '' : r.mark, r.outOf === undefined ? '' : r.outOf, r.locked ? 'Yes' : '', r.created || new Date()]; }
function saveGroupRows_(rows) {
  rows.sort(function (a, b) { return a.set < b.set ? -1 : a.set > b.set ? 1 : a.group - b.group || (a.name < b.name ? -1 : 1); });
  rewriteBody_(groupsSheet_(), 8, rows.map(groupRowOut_));
}
function randInt_(n) { var h = Utilities.getUuid().replace(/[^0-9a-f]/gi, ''); return parseInt(h.slice(0, 12), 16) % n; }
function shuffled_(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = randInt_(i + 1), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }

// How many times each pair of students has already shared a group, in sets other than `except`.
function pairCounts_(rows, except) {
  var bySetGroup = {}, pc = {};
  rows.forEach(function (r) { if (r.set === except) return; var k = r.set + '|' + r.group; (bySetGroup[k] = bySetGroup[k] || []).push(r.id); });
  Object.keys(bySetGroup).forEach(function (k) {
    var m = bySetGroup[k];
    for (var i = 0; i < m.length; i++) for (var j = i + 1; j < m.length; j++) { var p = m[i] < m[j] ? m[i] + '|' + m[j] : m[j] + '|' + m[i]; pc[p] = (pc[p] || 0) + 1; }
  });
  return pc;
}
function repeatCost_(groups, pc) {
  var c = 0;
  groups.forEach(function (g) { for (var i = 0; i < g.length; i++) for (var j = i + 1; j < g.length; j++) { var p = g[i] < g[j] ? g[i] + '|' + g[j] : g[j] + '|' + g[i]; c += pc[p] || 0; } });
  return c;
}

// Per-student measure for the mixed modes: live quiz average (released results), else attendance rate.
function studentMeasure_(mode) {
  var out = {};
  if (mode === 'attendance') {
    var at = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ATT_TAB);
    if (at && at.getLastRow() > 1 && at.getLastColumn() > 1) {
      var g = at.getRange(1, 1, at.getLastRow(), at.getLastColumn()).getValues();
      for (var i = 1; i < g.length; i++) { var id = normId_(g[i][0]), p = 0, n = 0; for (var c = 1; c < g[0].length; c++) if (g[i][c] !== '' && String(g[0][c]).trim()) { n++; if (Number(g[i][c])) p++; } if (id && n) out[id] = p / n; }
    }
    return out;
  }
  var sum = {};
  collectResults_().forEach(function (e) { if (!/^(Week |Quiz )/.test(e.label) || !e.n) return; var s = sum[normId_(e.id)] || (sum[normId_(e.id)] = { s: 0, n: 0 }); s.s += e.score; s.n += e.n; });
  Object.keys(sum).forEach(function (id) { out[id] = sum[id].s / sum[id].n; });
  return out;
}

// Deal students into k groups. Mixed modes: rank by the measure, cut into tiers of k, and give each group one from every tier (order
// within a tier is random, and students with no record sit in the middle). Random mode: one tier of everyone.
function dealGroups_(ids, k, mode, measure) {
  var order;
  if (mode === 'random') order = shuffled_(ids);
  else {
    var known = ids.filter(function (id) { return measure[id] !== undefined; }), vals = known.map(function (id) { return measure[id]; }).sort(function (a, b) { return a - b; });
    var mid = vals.length ? vals[Math.floor(vals.length / 2)] : 0;
    order = shuffled_(ids).sort(function (a, b) { return (measure[b] !== undefined ? measure[b] : mid) - (measure[a] !== undefined ? measure[a] : mid); });
  }
  var groups = []; for (var g = 0; g < k; g++) groups.push([]);
  for (var t = 0; t < order.length; t += k) {
    var tier = mode === 'random' ? order.slice(t, t + k) : shuffled_(order.slice(t, t + k));
    var slots = shuffled_(groups.map(function (x, i) { return i; })).sort(function (a, b) { return groups[a].length - groups[b].length; }); // the smallest groups first, so sizes differ by at most one
    tier.forEach(function (id, i) { groups[slots[i]].push(id); });
  }
  return groups;
}

// Swap students between groups while that lowers the number of repeated pairings; mixed modes swap only within the same tier.
function improveGroups_(groups, pc, tierOf) {
  function gc(g) { return repeatCost_([g], pc); }
  var best = repeatCost_(groups, pc), pass = 0, changed = true;
  while (changed && best > 0 && pass++ < 6) {
    changed = false;
    for (var a = 0; a < groups.length; a++) for (var b = a + 1; b < groups.length; b++) {
      var base = gc(groups[a]) + gc(groups[b]);
      if (!base) continue;
      for (var i = 0; i < groups[a].length; i++) for (var j = 0; j < groups[b].length; j++) {
        var x = groups[a][i], y = groups[b][j];
        if (tierOf && tierOf[x] !== tierOf[y]) continue;
        groups[a][i] = y; groups[b][j] = x;
        var now = gc(groups[a]) + gc(groups[b]);
        if (now < base) { best -= base - now; base = now; changed = true; } else { groups[a][i] = x; groups[b][j] = y; }
      }
    }
  }
  return best;
}

function groupsAct_(p) {
  var op = String(p.op || 'list').toLowerCase(), set = clean_(p.set, 60).replace(/^'/, ''), rows = groupRows_();
  var names = {}; rosterRows_().forEach(function (r) { var id = normId_(r[0]); if (id) names[id] = cleanName_(r[1]); });
  if (op === 'make') {
    if (!set) return { ok: false, why: 'give the set a name' };
    var mode = /^mix/i.test(p.mode) ? 'mixed' : /^att/i.test(p.mode) ? 'attendance' : 'random';
    var pool = Object.keys(names);
    if (/^present/i.test(p.from)) { // only the students checked in at the latest attendance session
      var ses = attRows_(), last = ses.length ? ses[ses.length - 1] : null, here = last ? attPresent_(last.label) : {};
      pool = pool.filter(function (id) { return here[id]; });
      if (!last) return { ok: false, why: 'no attendance session yet' };
    }
    var keep = rows.filter(function (r) { return r.set === set && r.locked; }), lockedIds = {}, lockedGroups = {};
    keep.forEach(function (r) { lockedIds[r.id] = true; lockedGroups[r.group] = true; });
    pool = pool.filter(function (id) { return !lockedIds[id]; });
    if (!pool.length) return { ok: false, why: keep.length ? 'every student is in a locked group' : 'no students to group: load the class list first' };
    var size = Math.max(2, Math.min(50, Number(p.size) || 0)), count = Math.max(1, Math.min(200, Number(p.count) || 0));
    var k = Number(p.count) ? Math.min(count, pool.length) : Math.max(1, Math.ceil(pool.length / (size || 4)));
    var measure = mode === 'random' ? {} : studentMeasure_(mode === 'mixed' ? 'quiz' : 'attendance');
    var pc = /^n/i.test(String(p.avoid || 'yes')) ? {} : pairCounts_(rows, set), best = null, bestCost = Infinity;
    for (var tries = 0; tries < 120 && bestCost > 0; tries++) {
      var gs = dealGroups_(pool, k, mode, measure), c = repeatCost_(gs, pc);
      if (c < bestCost) { best = gs; bestCost = c; }
    }
    var tierOf = null;
    if (mode !== 'random') { tierOf = {}; best.forEach(function (g) { g.forEach(function (id, i) { tierOf[id] = i; }); }); }
    bestCost = improveGroups_(best, pc, tierOf);
    var numbers = [], nx = 1; while (numbers.length < best.length) { if (!lockedGroups[nx]) numbers.push(nx); nx++; }
    var now = new Date(), fresh = [];
    best.forEach(function (g, i) { g.forEach(function (id) { fresh.push({ set: set, group: numbers[i], id: id, name: names[id] || '', mark: '', outOf: '', locked: false, created: now }); }); });
    saveGroupRows_(rows.filter(function (r) { return r.set !== set; }).concat(keep, fresh));
    log_('groups made', set + ': ' + mode + ', ' + best.length + ' new group(s), repeats ' + bestCost, '', '');
    var res = groupsAct_({ op: 'list', set: set }); res.repeats = bestCost; res.mode = mode; return res;
  }
  if (op === 'move' || op === 'lock' || op === 'mark' || op === 'delete') {
    var inSet = rows.filter(function (r) { return r.set === set; });
    if (!inSet.length) return { ok: false, why: 'no such set' };
    var g = Number(p.group) || 0;
    if (op === 'move') {
      var id = normId_(p.id), to = Math.max(1, Math.min(200, Number(p.to) || 0)), who = inSet.filter(function (r) { return r.id === id; })[0];
      if (!who || !to) return { ok: false, why: 'student not in this set' };
      var target = inSet.filter(function (r) { return r.group === to; })[0];
      who.group = to; who.locked = target ? target.locked : false;
      if (target) { who.mark = target.mark; who.outOf = target.outOf; } else { who.mark = ''; who.outOf = ''; }
    } else if (op === 'lock') {
      inSet.forEach(function (r) { if (r.group === g) r.locked = !/^(0|no|false)$/i.test(String(p.value || 'yes')); });
    } else if (op === 'mark') {
      var mk = String(p.mark || '').trim(), oo = String(p.outof || '').trim();
      if (mk !== '' && isNaN(Number(mk))) return { ok: false, why: 'the mark must be a number' };
      if (oo !== '' && (isNaN(Number(oo)) || Number(oo) <= 0)) return { ok: false, why: 'out of must be a positive number' };
      var members = inSet.filter(function (r) { return r.group === g; });
      if (!members.length) return { ok: false, why: 'no such group' };
      members.forEach(function (r) { r.mark = mk === '' ? '' : Number(mk); r.outOf = oo === '' ? '' : Number(oo); });
      if (mk !== '' && oo !== '') updateMaster_(members.filter(function (r) { return names[r.id] !== undefined; }).map(function (r) { return { id: r.id, name: r.name, label: 'Group: ' + set, score: Number(mk), n: Number(oo) }; }));
      log_('group mark', set + ' group ' + g + ': ' + mk + (oo ? ' / ' + oo : ''), '', '');
    } else if (op === 'delete') {
      saveGroupRows_(rows.filter(function (r) { return r.set !== set; }));
      log_('groups deleted', set, '', '');
      return groupsAct_({ op: 'list' });
    }
    saveGroupRows_(rows);
    return groupsAct_({ op: 'list', set: set });
  }
  // list: the sets, and the groups of one set
  var sets = [], seenSet = {};
  rows.forEach(function (r) { if (!seenSet[r.set]) { seenSet[r.set] = { name: r.set, students: 0, groups: {}, created: r.created }; sets.push(seenSet[r.set]); } seenSet[r.set].students++; seenSet[r.set].groups[r.group] = 1; });
  var pick = set && seenSet[set] ? set : (sets.length ? sets[sets.length - 1].name : '');
  var pcAll = pairCounts_(rows, pick), groups = {};
  rows.filter(function (r) { return r.set === pick; }).forEach(function (r) {
    var gg = groups[r.group] || (groups[r.group] = { group: r.group, locked: r.locked, mark: r.mark, outOf: r.outOf, members: [] });
    gg.members.push({ id: r.id, name: r.name || names[r.id] || '', onList: names[r.id] !== undefined });
  });
  var list = Object.keys(groups).map(function (k) { return groups[k]; }).sort(function (a, b) { return a.group - b.group; });
  var inGroup = {}; list.forEach(function (gq) { gq.members.forEach(function (m) { inGroup[m.id] = true; }); });
  return { ok: true, sets: sets.map(function (s) { return { name: s.name, students: s.students, groups: Object.keys(s.groups).length }; }), set: pick, groups: list,
    repeats: repeatCost_(list.map(function (gq) { return gq.members.map(function (m) { return m.id; }); }), pcAll),
    notGrouped: Object.keys(names).filter(function (id) { return !inGroup[id]; }).map(function (id) { return { id: id, name: names[id] }; }) };
}

// A student's own groups, for My progress: the other members' names as on the class list, so the group can find each other.
function studentGroups_(id) {
  var rows = groupRows_(), mine = rows.filter(function (r) { return r.id === id; });
  return mine.map(function (m) {
    var others = rows.filter(function (r) { return r.set === m.set && r.group === m.group && r.id !== id; }).map(function (r) { return String(r.name || '').trim() || 'Classmate'; });
    return { set: m.set, group: m.group, members: others, mark: m.mark === '' ? null : m.mark, outOf: m.outOf === '' ? null : m.outOf };
  });
}

// ---- Group assignments: allocated to some or all groups of a set; one shared submission per group, each member's own part, and private peer ratings ----
var ASG_TAB = 'Assignments', ASG_HEAD = ['ID', 'Set', 'Groups', 'Title', 'Brief', 'Due', 'Outcome', 'Out of', 'Status', 'Created', 'Updated'];
var GW_TAB = 'Group_Work', GW_HEAD = ['Time', 'Assignment ID', 'Set', 'Group', 'Student ID', 'Kind', 'Text', 'Link', 'Rating'];
var AMK_TAB = 'Assignment_Marks', AMK_HEAD = ['Assignment ID', 'Group', 'Mark', 'Feedback', 'Marked'];
var PEER_WORD = { full: 'Contributed fully', part: 'Contributed partly', little: 'Contributed little' }, PEER_VAL = { full: 2, part: 1, little: 0 };

function asgRows_() {
  return bodyRows_(SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ASG_TAB), 11).map(function (r) {
    return { id: String(r[0]).trim(), set: String(r[1]).replace(/^'/, ''), groups: String(r[2] || 'all'), title: String(r[3]), brief: String(r[4]), due: String(r[5] || '').replace(/^'/, ''),
      outcome: String(r[6] || '').replace(/^'/, ''), outOf: r[7] === '' ? '' : Number(r[7]), status: String(r[8] || 'open'), created: new Date(r[9]).getTime() || 0, updated: r[10] };
  }).filter(function (a) { return a.id; });
}
function asgSave_(list) { rewriteBody_(sheetWith_(ASG_TAB, ASG_HEAD), 11, list.map(function (a) { return [a.id, "'" + a.set, a.groups, a.title, a.brief, a.due ? "'" + a.due : '', a.outcome ? "'" + a.outcome : '', a.outOf, a.status, new Date(a.created || Date.now()), new Date()]; })); }
function asgFor_(a, g) { return a.groups === 'all' || String(a.groups).split(',').map(Number).indexOf(Number(g)) >= 0; }
function gwRows_() {
  return bodyRows_(SpreadsheetApp.getActiveSpreadsheet().getSheetByName(GW_TAB), 9).map(function (r) {
    return { t: new Date(r[0]).getTime() || 0, aid: String(r[1]).trim(), set: String(r[2]).replace(/^'/, ''), group: Number(r[3]) || 0, id: normId_(r[4]), kind: String(r[5]), text: String(r[6] || ''), link: String(r[7] || ''), rating: String(r[8] || '') };
  });
}
function amkRows_() { var o = {}; bodyRows_(SpreadsheetApp.getActiveSpreadsheet().getSheetByName(AMK_TAB), 5).forEach(function (r) { o[String(r[0]).trim() + '|' + Number(r[1])] = { mark: r[2] === '' ? null : Number(r[2]), feedback: String(r[3] || ''), marked: r[4] }; }); return o; }
function dueMs_(due) { var d = calDate_(due); if (!d) return 0; if (!/T/.test(due)) d.setHours(23, 59, 0, 0); return d.getTime(); }
// How one group did on one assignment: the latest shared submission, each member's part, the peer ratings (lecturer only) and the mark.
function groupWorkOf_(a, g, members, work, marks, names) {
  var mine = work.filter(function (w) { return w.aid === a.id && w.group === g; }), due = dueMs_(a.due);
  var subs = mine.filter(function (w) { return w.kind === 'work'; }), last = subs.length ? subs[subs.length - 1] : null;
  var parts = {}, peers = {};
  mine.forEach(function (w) { if (w.kind === 'part') parts[w.id] = w; if (w.kind === 'peer') { var r = {}; try { r = JSON.parse(w.rating) || {}; } catch (err) { r = {}; } peers[w.id] = r; } });
  var mem = members.map(function (id) {
    var got = []; Object.keys(peers).forEach(function (rater) { if (rater !== id && peers[rater][id] && PEER_VAL[peers[rater][id]] !== undefined) got.push(PEER_VAL[peers[rater][id]]); });
    var avg = got.length ? Math.round(100 * got.reduce(function (x, y) { return x + y; }, 0) / got.length) / 100 : null;
    return { id: id, name: names[id] || '', part: parts[id] ? parts[id].text : '', partTime: parts[id] ? fmtDay_(parts[id].t) : '', rated: !!peers[id], peerAvg: avg, peerN: got.length,
      peerFlag: avg !== null && got.length >= 2 && avg < 1, submitted: subs.some(function (w) { return w.id === id; }) };
  });
  var mk = marks[a.id + '|' + g] || null;
  return { group: g, members: mem, submitted: !!last, text: last ? last.text : '', link: last ? last.link : '', by: last ? (names[last.id] || last.id) : '', time: last ? fmtDay_(last.t) : '', versions: subs.length,
    onTime: last ? (!due || last.t <= due) : null, late: !!(last && due && last.t > due), mark: mk ? mk.mark : null, feedback: mk ? mk.feedback : '',
    parts: mem.filter(function (m) { return m.part; }).length, ratedBy: mem.filter(function (m) { return m.rated; }).length };
}
function asgSummary_(a, rows, work, marks, names, ev) {
  var groups = {}; rows.filter(function (r) { return r.set === a.set && asgFor_(a, r.group); }).forEach(function (r) { (groups[r.group] = groups[r.group] || []).push(r.id); });
  var list = Object.keys(groups).map(Number).sort(function (x, y) { return x - y; }).map(function (g) { return groupWorkOf_(a, g, groups[g], work, marks, names); });
  var students = 0, parts = 0, flags = 0; list.forEach(function (g) { students += g.members.length; parts += g.parts; g.members.forEach(function (m) { if (m.peerFlag) flags++; }); });
  var allIds = []; Object.keys(groups).forEach(function (g) { allIds = allIds.concat(groups[g]); });
  return { id: a.id, set: a.set, title: a.title, brief: a.brief, due: a.due, outcome: a.outcome, outcomeLabel: a.outcome ? outcomeLabel_(a.outcome, ev._lects) : '', outOf: a.outOf, status: a.status, groupsAllocated: a.groups,
    created: fmtDay_(a.created), groups: list, measures: { allocated: list.length, submitted: list.filter(function (g) { return g.submitted; }).length, onTime: list.filter(function (g) { return g.onTime; }).length,
      marked: list.filter(function (g) { return g.mark !== null; }).length, contribution: pct_(parts, students), students: students, peerFlags: flags, beforeAfter: asgBeforeAfter_(a, allIds, ev) } };
}

// Host only: list, save, delete, close or reopen, and mark group assignments.
function assignmentsAct_(p) {
  var op = String(p.op || 'list').toLowerCase(), list = asgRows_(), rows = groupRows_();
  var names = {}; rosterRows_().forEach(function (r) { var id = normId_(r[0]); if (id) names[id] = cleanName_(r[1]); });
  if (op === 'save') {
    var set = clean_(p.set, 60).replace(/^'/, ''), title = clean_(p.title, 120), brief = String(p.brief || '').replace(/\r/g, '').slice(0, 4000).trim();
    if (!set || !rows.some(function (r) { return r.set === set; })) return { ok: false, why: 'choose a group set first' };
    if (!title) return { ok: false, why: 'give the assignment a title' };
    var gs = String(p.groups || 'all').toLowerCase() === 'all' ? 'all' : String(p.groups).split(/[\s,]+/).map(Number).filter(function (x) { return x > 0; }).join(',');
    if (!gs) return { ok: false, why: 'choose at least one group' };
    var due = String(p.due || '') ? calWhen_(p.due) : ''; if (p.due && !due) return { ok: false, why: 'the due date is not valid' };
    var oo = String(p.outof || '').trim(); if (oo !== '' && !(Number(oo) > 0)) return { ok: false, why: 'out of must be a positive number' };
    var outc = /^L\d+(\.\d+)?$/.test(String(p.outcome || '')) ? String(p.outcome) : '';
    var a = list.filter(function (x) { return x.id === String(p.id || ''); })[0];
    if (!a) { a = { id: 'A' + Utilities.getUuid().replace(/-/g, '').slice(0, 8).toUpperCase(), created: Date.now(), status: 'open' }; list.push(a); }
    a.set = set; a.groups = gs; a.title = title; a.brief = brief; a.due = due; a.outcome = outc; a.outOf = oo === '' ? '' : Number(oo);
    asgSave_(list); log_('assignment saved', a.title + ' (' + set + ', groups ' + gs + ')', '', '');
    var r1 = assignmentsAct_({ op: 'list' }); r1.saved = a.id; return r1;
  }
  var a2 = list.filter(function (x) { return x.id === String(p.id || ''); })[0];
  if (op === 'delete' || op === 'close' || op === 'open') {
    if (!a2) return { ok: false, why: 'no such assignment' };
    if (op === 'delete') { list = list.filter(function (x) { return x !== a2; }); log_('assignment deleted', a2.title, '', ''); }
    else a2.status = op === 'close' ? 'closed' : 'open';
    asgSave_(list); return assignmentsAct_({ op: 'list' });
  }
  if (op === 'mark') {
    if (!a2) return { ok: false, why: 'no such assignment' };
    var g = Number(p.group) || 0, mk = String(p.mark || '').trim(), fb = String(p.feedback || '').replace(/\r/g, '').slice(0, 2000).trim();
    if (mk !== '' && isNaN(Number(mk))) return { ok: false, why: 'the mark must be a number' };
    var members = rows.filter(function (r) { return r.set === a2.set && r.group === g; });
    if (!members.length || !asgFor_(a2, g)) return { ok: false, why: 'that group does not have this assignment' };
    var sh = sheetWith_(AMK_TAB, AMK_HEAD), mrows = bodyRows_(sh, 5).filter(function (r) { return !(String(r[0]).trim() === a2.id && Number(r[1]) === g); });
    mrows.push([a2.id, g, mk === '' ? '' : Number(mk), fb, new Date()]); rewriteBody_(sh, 5, mrows);
    if (mk !== '' && a2.outOf !== '') updateMaster_(members.filter(function (r) { return names[r.id] !== undefined; }).map(function (r) { return { id: r.id, name: r.name, label: 'Assignment: ' + a2.title, score: Number(mk), n: Number(a2.outOf) }; }));
    log_('assignment mark', a2.title + ' group ' + g + ': ' + mk, '', '');
    return assignmentsAct_({ op: 'view', id: a2.id });
  }
  var work = gwRows_(), marks = amkRows_(), ev = evidence_();
  if (op === 'view') { if (!a2) return { ok: false, why: 'no such assignment' }; return { ok: true, assignment: asgSummary_(a2, rows, work, marks, names, ev) }; }
  var sets = {}; rows.forEach(function (r) { (sets[r.set] = sets[r.set] || {})[r.group] = 1; });
  return { ok: true, assignments: list.map(function (a) { var s = asgSummary_(a, rows, work, marks, names, ev); delete s.groups; return s; }),
    sets: Object.keys(sets).map(function (k) { return { name: k, groups: Object.keys(sets[k]).map(Number).sort(function (x, y) { return x - y; }) }; }),
    outcomes: Object.keys(ev._lects).map(Number).sort(function (x, y) { return x - y; }).reduce(function (acc, n) { ev._lects[n].outcomes.forEach(function (t, i) { acc.push({ key: 'L' + n + '.' + (i + 1), label: outcomeLabel_('L' + n + '.' + (i + 1), ev._lects) }); }); return acc; }, []) };
}

function groupWork_(p) {
  var au = studentAuth_(p); if (!au.id) return { ok: false, why: au.why };
  var id = au.id, op = String(p.op || 'list').toLowerCase(), rows = groupRows_(), list = asgRows_();
  var names = {}; rosterRows_().forEach(function (r) { var x = normId_(r[0]); if (x) names[x] = cleanName_(r[1]); });
  var myGroups = rows.filter(function (r) { return r.id === id; });
  function mineFor(aid) { var a = list.filter(function (x) { return x.id === aid; })[0]; if (!a) return null; var g = myGroups.filter(function (r) { return r.set === a.set && asgFor_(a, r.group); })[0]; return g ? { a: a, g: g.group } : null; }
  if (op === 'submit' || op === 'part' || op === 'peer') {
    var m = mineFor(String(p.aid || '')); if (!m) return { ok: false, why: 'this assignment is not for your group' };
    if (m.a.status === 'closed') return { ok: false, why: 'this assignment is closed' };
    var row = null;
    if (op === 'submit') { var tx = chatTxt_(p.text, 8000), lk = safeLink_(p.link); if (!tx && !lk) return { ok: false, why: 'write the answer or give a link' }; if (p.link && !lk) return { ok: false, why: 'the link must start with https://' }; row = [new Date(), m.a.id, "'" + m.a.set, m.g, id, 'work', tx, lk, '']; }
    else if (op === 'part') { var pt = chatTxt_(p.text, 1000); if (!pt) return { ok: false, why: 'say what you did' }; row = [new Date(), m.a.id, "'" + m.a.set, m.g, id, 'part', pt, '', '']; }
    else {
      var r = {}; try { r = JSON.parse(String(p.ratings || '{}')) || {}; } catch (err) { return { ok: false, why: 'the ratings could not be read' }; }
      var mates = rows.filter(function (x) { return x.set === m.a.set && x.group === m.g && x.id !== id; }).map(function (x) { return x.id; }), clean = {};
      mates.forEach(function (x) { if (PEER_VAL[r[x]] !== undefined) clean[x] = r[x]; });
      if (!Object.keys(clean).length) return { ok: false, why: 'rate at least one group-mate' };
      row = [new Date(), m.a.id, "'" + m.a.set, m.g, id, 'peer', '', '', JSON.stringify(clean)];
    }
    var gl = LockService.getScriptLock(); gl.waitLock(20000);
    try { append_(GW_TAB, GW_HEAD, row); } finally { gl.releaseLock(); }
    log_('group work ' + op, m.a.title + ' group ' + m.g, id, '');
  }
  var work = gwRows_(), marks = amkRows_();
  var out = [];
  list.forEach(function (a) {
    var g = myGroups.filter(function (r) { return r.set === a.set && asgFor_(a, r.group); })[0]; if (!g) return;
    var members = rows.filter(function (r) { return r.set === a.set && r.group === g.group; }).map(function (r) { return r.id; });
    var s = groupWorkOf_(a, g.group, members, work, marks, names), me = s.members.filter(function (x) { return x.id === id; })[0] || {};
    var myPeer = work.filter(function (w) { return w.aid === a.id && w.id === id && w.kind === 'peer'; }).pop(), pr = {}; try { pr = myPeer ? JSON.parse(myPeer.rating) : {}; } catch (err) { pr = {}; }
    out.push({ id: a.id, set: a.set, group: g.group, title: a.title, brief: a.brief, due: a.due, status: a.status, outOf: a.outOf,
      mates: s.members.filter(function (x) { return x.id !== id; }).map(function (x) { return { id: x.id, name: String(x.name || '').trim() || 'Classmate', myRating: pr[x.id] || '' }; }),
      submitted: s.submitted, text: s.text, link: s.link, by: s.by, time: s.time, versions: s.versions, late: s.late, myPart: me.part || '', rated: !!myPeer,
      mark: s.mark, feedback: s.mark !== null || s.feedback ? s.feedback : '' });
  });
  return { ok: true, assignments: out, ratingWords: PEER_WORD };
}

// Host only: the groups of one set, laid out for the projector (first name and the initial of the last name).
function groupsDisplay_(p) {
  var r = groupsAct_({ op: 'list', set: p.set }); if (!r.ok) return r;
  var short = function (n) { var w = String(n || '').trim().split(/\s+/); return w.length > 1 ? w[0] + ' ' + w[w.length - 1].charAt(0) + '.' : (w[0] || 'Student'); };
  var asg = asgRows_().filter(function (a) { return a.set === r.set && a.status !== 'closed'; });
  return { ok: true, set: r.set, sets: r.sets, groups: r.groups.map(function (g) { return { group: g.group, members: g.members.map(function (m) { return short(m.name); }), tasks: asg.filter(function (a) { return asgFor_(a, g.group); }).map(function (a) { return a.title; }) }; }) };
}
