/* Learning Progress, the student profile and the extras of My results: the parts of the lecturer's and student's views that need groups, group work
   and learning evidence together. A port of learningProgress_, studentProfile_, studentStats_ (apps_script/src/30-analytics.gs) and the group,
   learning and progress lines of portalResults_ (60-portal.gs). o = {site, random}. */
"use strict";
const AC = require("./access-codes");
const AS = require("./assignments");
const CS = require("./class-stats");
const G = require("./groups");
const L = require("./learning");
const OC = require("./outcomes");
const { normalizeId } = require("../ids");

const MIN = OC.PROG_MIN;

function learningProgress(store, p, o) {
  const ev = OC.evidence(store, o), lects = ev._lects, roster = AC.rosterRows(store).map((r) => ({ id: normalizeId(r[0]), name: AC.cleanName(r[1]).trim() })).filter((r) => r.id);
  const disc = OC.discussionStats(store), asg = AS.act(store, { op: "list" }, o);
  const students = roster.map((r) => {
    const sp = OC.studentProgress(r.id, ev), d = disc.byStudent[r.id] || null;
    return { id: r.id, name: r.name, answers: sp.overall.answers, start: sp.overall.start, current: sp.overall.current, gain: sp.overall.gain, level: sp.overall.level, levels: sp.levels,
      outcomes: sp.outcomes.map((x) => ({ key: x.key, current: x.current, level: x.level, answers: x.answers, gain: x.gain })), discussion: d };
  });
  const sets = {}; G.rows(store).forEach((g) => { const s = sets[g.set] || (sets[g.set] = {}); (s[g.group] = s[g.group] || []).push(g.id); });
  const byId = {}; students.forEach((s) => { byId[s.id] = s; });
  const groupProgress = Object.keys(sets).map((name) => ({ set: name, groups: Object.keys(sets[name]).map(Number).sort((a, b) => a - b).map((g) => {
    const m = sets[name][g].map((id) => byId[id]).filter(Boolean), cur = m.filter((s) => s.current !== null && s.answers >= MIN), gn = m.filter((s) => s.gain !== null && s.answers >= 4);
    const avg = (xs, k) => (xs.length ? Math.round(10 * xs.reduce((a, s) => a + s[k], 0) / xs.length) / 10 : null);
    return { group: g, members: m.length, current: avg(cur, "current"), gain: avg(gn, "gain"), withEvidence: cur.length };
  }) }));
  return { ok: true, generated: store.now().toISOString(), minimum: MIN, levelsNames: OC.PROG_LEVELS, thresholds: { secure: OC.PROG_SECURE, developing: OC.PROG_DEVELOPING },
    outcomes: OC.classOutcomes(store, ev, lects), timeline: OC.classTimeline(store, ev), discussion: { rounds: disc.rounds, pairs: disc.pairs, beforePct: disc.beforePct, afterPct: disc.afterPct, gain: disc.gain, wrongToRight: disc.wrongToRight, rightToWrong: disc.rightToWrong, questions: disc.questions, note: disc.note },
    assignments: asg.assignments || [], students, groupProgress };
}

// The student profile for the lookup: the statistics record, progress by outcome, group work, and suggestions for the lecturer.
function studentProfile(store, id, all, me, o) {
  const ev = OC.evidence(store, o), sp = OC.studentProgress(id, ev), disc = OC.discussionStats(store).byStudent[id] || null, th = all.thresholds;
  const rows = G.rows(store), list = AS.rows(store), work = AS.workRows(store), marks = AS.markRows(store), names = G.namesOf(store), groupWork = [];
  list.forEach((a) => {
    const g = rows.filter((r) => r.id === id && r.set === a.set && AS.forGroup(a, r.group))[0]; if (!g) return;
    const members = rows.filter((r) => r.set === a.set && r.group === g.group).map((r) => r.id), s = AS.groupWorkOf(a, g.group, members, work, marks, names), m = s.members.filter((x) => x.id === id)[0];
    groupWork.push({ title: a.title, set: a.set, group: g.group, due: a.due, submitted: s.submitted, late: s.late, mark: s.mark, outOf: a.outOf, part: m ? m.part : "", peerAvg: m ? m.peerAvg : null, peerN: m ? m.peerN : 0, peerFlag: m ? m.peerFlag : false });
  });
  const known = sp.outcomes.filter((x) => x.answers >= MIN);
  const strengths = known.filter((x) => x.level === "Secure").sort((a, b) => b.current - a.current || b.answers - a.answers).slice(0, 3);
  const weak = known.filter((x) => x.level === "Beginning" || (x.level === "Developing" && x.current < 60)).sort((a, b) => a.current - b.current || b.answers - a.answers).slice(0, 3);
  let partners = []; // classmates who are secure where this student is weakest
  if (weak.length) {
    const k = weak[0].key;
    Object.keys(ev).forEach((x) => { if (x === id || x.charAt(0) === "_" || !names[x]) return; const es = ev[x].filter((e) => e.key === k); if (es.length < MIN) return; const pr = OC.progressOf(es); if (pr.level === "Secure") partners.push({ id: x, name: names[x], current: pr.current }); });
    partners.sort((a, b) => b.current - a.current); partners = partners.slice(0, 3);
  }
  const tips = [];
  if (sp.overall.answers < 2 * MIN && (me.quizzesTaken || 0) < 2) tips.push({ kind: "Evidence", text: "Too little evidence for a judgement: " + sp.overall.answers + " answers so far. Look again after the next quiz." });
  if (me.missedInARow >= th.misses) tips.push({ kind: "Check-in", text: "Missed the last " + me.missedInARow + " sessions. A short, private check-in on how things are going." });
  if (weak.length) tips.push({ kind: "Revision", text: "Revise " + weak[0].label + " (" + weak[0].current + "% in the latest answers, " + weak[0].answers + " answers). Point to the practice for that lecture and the questions to revisit." });
  if (partners.length) tips.push({ kind: "Pairing", text: "For the next pair task, a partner secure on that objective: " + partners.map((x) => x.name).join(", ") + "." });
  if (me.group === "Working hard but struggling") tips.push({ kind: "Support", text: "Effort is high but results are low. Worked examples and a short feedback conversation are likely to help more than extra practice alone." });
  if (!me.practiceRecent && me.practiceAttempts >= 0 && all.students.some((s) => s.practiceAttempts)) tips.push({ kind: "Practice", text: "No practice in the last " + th.idle + " days. Encourage short retrieval practice spread over the week." });
  if (disc && disc.pairs >= 3 && disc.rightToWrong > disc.wrongToRight) tips.push({ kind: "Discussion", text: "After discussion this student changed from right to wrong more often (" + disc.rightToWrong + ") than from wrong to right (" + disc.wrongToRight + "). Ask them to explain their reasoning before they change." });
  groupWork.filter((g) => g.submitted && !g.part).slice(0, 1).forEach((g) => { tips.push({ kind: "Group work", text: 'Has not described their own part in "' + g.title + '". Ask what they contributed.' }); });
  groupWork.filter((g) => g.peerFlag).slice(0, 1).forEach((g) => { tips.push({ kind: "Group work", text: 'Group-mates rated their contribution to "' + g.title + '" as low (' + g.peerN + " ratings). Talk to the group before acting on it." }); });
  if (!tips.length) tips.push({ kind: "On track", text: "Nothing calls for action. Keep the challenge up: an extension question or a peer-explainer role." });
  const classNow = {}; OC.classOutcomes(store, ev, ev._lects).forEach((x) => { classNow[x.key] = { current: x.current, students: x.students }; });
  return { progress: sp, classTimeline: OC.classTimeline(store, ev), classByKey: classNow, engagement: { attendance: me.attendance, quizzesTaken: me.quizzesTaken, practiceAttempts: me.practiceAttempts, missedInARow: me.missedInARow }, discussion: disc, groupWork, groups: G.studentGroups(store, id), strengths, weak, partners, suggestions: tips };
}

// Host only: one student in full, for the Class statistics student view.
function studentStats(store, p, o, version) {
  const id = normalizeId(p.id); if (!id) return { ok: false, why: "no student ID" };
  const all = CS.classStats(store, p, version, o); let me = null; all.students.forEach((s) => { if (s.id === id) me = s; });
  if (!me) return { ok: false, why: "that ID is not on the class list" };
  let ln = { mastery: [], revisit: [], practice: [] }; try { ln = L.studentLearning(store, id); } catch (e) { /* shown without it */ }
  let prof = null; try { prof = studentProfile(store, id, all, me, o); } catch (e) { prof = { error: String(e).slice(0, 160) }; }
  let rec = { records: [], notes: [] }; try { rec = L.studentRecords(store, id); } catch (e) { /* shown without them */ }
  return { ok: true, records: rec.records, notes: rec.notes, student: me, sessions: all.attendance.bySession.map((s) => s.label), mastery: ln.mastery, revisit: ln.revisit.slice(0, 15), practice: ln.practice, thresholds: all.thresholds, profile: prof };
}

// What My results adds after attendance and quiz marks: the student's groups, what to revisit, progress by objective and the group-work count.
function portalExtras(store, id, o) {
  const out = {};
  try { out.groups = G.studentGroups(store, id); } catch (e) { out.groups = []; }
  try { const ln = L.studentLearning(store, id); out.mastery = ln.mastery; out.revisit = ln.revisit; out.practice = ln.practice; } catch (e) { out.learningError = true; }
  try { out.topics = require("./topics").studentTopics(store, o, id); } catch (e) { out.topicsError = true; } // the student's own topics only
  try {
    const sp = OC.studentProgress(id, OC.evidence(store, o));
    out.progress = { outcomes: sp.outcomes.map((x) => ({ label: x.label, answers: x.answers, start: x.start, current: x.current, gain: x.gain, level: x.level })), timeline: sp.timeline, overall: { answers: sp.overall.answers, start: sp.overall.start, current: sp.overall.current, gain: sp.overall.gain }, minimum: sp.minimum };
  } catch (e) { out.progressError = true; }
  try { out.groupWork = AS.rows(store).filter((a) => (out.groups || []).some((g) => g.set === a.set && AS.forGroup(a, g.group))).length; } catch (e) { out.groupWork = 0; }
  return out;
}

module.exports = { learningProgress, studentProfile, studentStats, portalExtras };
