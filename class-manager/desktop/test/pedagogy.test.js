/* Teaching for learning: run with `npm test` in class-manager/desktop (Node 20 or later, no Electron needed).
   The real server script runs against a temporary workbook with the made-up class (sample-class.js) and course (sample-pedagogy.js).
   Covers: the ask, discuss, revise round of a live quiz; links from questions to objectives; progress by objective; group assignments
   with submissions, parts, peer ratings and marks; the groups on the projector; the student lookup; and the student's own view. */
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { createBackend } = require("../backend");
const { writeSample } = require("./sample-class");
const { readSite } = require("./sample-pedagogy");

const WEB = path.resolve(__dirname, "..", "..");
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cm-peda-"));
const file = path.join(dir, "workbook.json");
createBackend({ webRoot: WEB, dataFile: file, readSite, log: () => {} }).flush();
const sample = writeSample(file);
const B = createBackend({ webRoot: WEB, dataFile: file, readSite, log: () => {} });
const KEY = B.hostKey();
const get = (p) => { const t = B.doPost(Object.assign({ callback: "cb" }, p)).text; const m = /^cb\(([\s\S]*)\)\s*;?\s*$/.exec(t); return JSON.parse(m ? m[1] : t); };
const host = (p) => get(Object.assign({ hostkey: KEY }, p));
const post = (p) => B.doPost(p).text;
const ids = sample.ids, names = sample.names;

// Access codes for the student views.
const codes = host({ action: "access_codes", op: "generate" });
const codeOf = {}; (codes.rows || []).forEach((c) => { codeOf[c.id] = c.code; });

test("access codes exist for the class", () => { assert.equal(Object.keys(codeOf).length, ids.length); });

test("ask, discuss, revise: a second vote keeps both answers and reports the movement", () => {
  const code = "26275";
  assert.ok(host({ action: "host", code }).ok, "host view");
  let r = host({ action: "control", code, act: "start" }); assert.ok(r.ok, JSON.stringify(r));
  const qids = r.status.qids, keys = qids.map((q) => "BDACE"[Number(q.split("-Q")[1]) - 1]);
  const wrongOf = (k) => (k === "A" ? "B" : "A");
  // Question 1: 20 students vote; 12 right at first. After discussion 6 of the 8 wrong switch to right and 1 right switches to wrong.
  const voters = ids.slice(0, 20);
  voters.forEach((id, i) => post({ kind: "answer", code, id, name: names[i].split(" ")[0], q: "1", answer: i < 12 ? keys[0] : wrongOf(keys[0]) }));
  r = host({ action: "control", code, act: "revote" }); assert.ok(r.ok, JSON.stringify(r));
  assert.equal(r.status.vote, 2); assert.deepEqual(r.status.discussed, [1]);
  assert.equal(host({ action: "control", code, act: "revote" }).ok, false, "only one second vote at a time");
  voters.forEach((id, i) => { let a = null; if (i >= 12 && i < 18) a = keys[0]; else if (i === 0) a = wrongOf(keys[0]); else if (i < 12) a = keys[0]; if (a) post({ kind: "answer", code, id, name: names[i].split(" ")[0], q: "1", answer: a }); });
  const h = host({ action: "host", code });
  assert.equal(h.firstVote.answered, 20); assert.equal(h.firstVote.dist[keys[0]], 12); assert.equal(h.dist[keys[0]], 17);
  const disp = get({ action: "display", code });
  assert.equal(disp.revote.q, 1); assert.equal(disp.revote.firstAnswered, 20); assert.ok(!disp.review || !disp.review.dist || !disp.review.q, "no spread on the projector while the question is open");
  // The rest of the quiz without a second vote.
  for (let q = 2; q <= 5; q++) { host({ action: "control", code, act: "next" }); voters.forEach((id, i) => post({ kind: "answer", code, id, name: names[i].split(" ")[0], q: String(q), answer: keys[q - 1] })); }
  r = host({ action: "control", code, act: "next" }); assert.equal(r.status.state, "ended");
  r = host({ action: "control", code, act: "review" });
  const rc = JSON.parse(post({ kind: "join", code, id: ids[13], name: names[13].split(" ")[0], want: "receipt" })).receipt; // the student's own phone
  assert.equal(get({ action: "review", code, id: ids[13] }).mine, "", "without the phone's receipt, no personal answer");
  const rv = get({ action: "review", code, id: ids[13], rc });
  assert.equal(rv.q, 1); assert.ok(rv.discussion, "review carries the before and after");
  assert.equal(rv.discussion.wrongToRight, 6); assert.equal(rv.discussion.rightToWrong, 1); assert.equal(rv.discussion.pairs, 20);
  assert.equal(rv.discussion.beforePct, 60); assert.equal(rv.discussion.afterPct, 85);
  assert.equal(rv.mineFirst, wrongOf(keys[0])); assert.equal(rv.mine, keys[0]);
  host({ action: "control", code, act: "release" });
  const lp = host({ action: "learning_progress" });
  assert.equal(lp.discussion.rounds, 1); assert.equal(lp.discussion.beforePct, 60); assert.equal(lp.discussion.afterPct, 85);
  assert.equal(lp.discussion.gain, Math.round(100 * 25 / 40) / 100, "normalised gain (85 - 60) / (100 - 60)");
  const st = lp.students.find((s) => s.id === ids[13]); assert.equal(st.discussion.wrongToRight, 1);
  // Scoring uses the final answer.
  const tab = B.tab("Form Responses 1"); const row = tab.find((x) => x[2] === ids[13] && x[3] === code); assert.equal(Number(row[9]), 5);
});

test("questions are linked to objectives: suggestions, saving, and coverage", () => {
  let o = host({ action: "outcomes" });
  assert.ok(o.ok); assert.equal(o.lectures.length, 5);
  const l1 = o.lectures.find((l) => l.number === 1);
  assert.equal(l1.outcomes.length, 3); assert.equal(l1.untagged, 5);
  const q1 = l1.questions.find((q) => q.id === "L1-Q1"); assert.equal(q1.suggested, 1, "unit conversion matches objective 1");
  const q3 = l1.questions.find((q) => q.id === "L1-Q3"); assert.equal(q3.suggested, 3, "uncertainty matches objective 3");
  o = host({ action: "outcomes", op: "accept", lecture: "1" });
  assert.ok(o.saved >= 4, "suggestions accepted");
  o = host({ action: "outcomes", op: "save", tags: JSON.stringify([{ id: "L1-Q4", lecture: 1, outcome: 1 }, { id: "L1-Q2", lecture: 1, outcome: 2 }]) });
  const l1b = o.lectures.find((l) => l.number === 1);
  assert.equal(l1b.untagged, 0);
  assert.equal(l1b.outcomes.reduce((a, x) => a + x.questions, 0), 5);
  [2, 3, 4, 5].forEach((n) => host({ action: "outcomes", op: "accept", lecture: String(n) }));
  o = host({ action: "outcomes" });
  const o11 = o.lectures.find((l) => l.number === 1).outcomes[0];
  assert.ok(o11.answers > 0 && o11.pct !== null, "objective 1.1 has class evidence");
});

test("progress by objective: start, current, gain and level, counted from the answers", () => {
  const id = ids[1]; // works hard, improves over the weeks
  const r = host({ action: "student_stats", id });
  assert.ok(r.ok && r.profile && r.profile.progress, JSON.stringify(r).slice(0, 300));
  const P = r.profile.progress;
  const tags = {}; B.tab("Question_Outcomes").slice(1).forEach((x) => { tags[x[0]] = "L" + x[1] + "." + x[2]; });
  // Recount one objective by hand: released live answers and practice answers to its questions, in time order.
  const k = P.outcomes.find((x) => x.linked && x.answers >= 6).key;
  const ev = [];
  sample.tabs.Item_Log.slice(1).forEach((x) => { if (x[4] === id && x[7] !== "" && tags[x[6]] === k) ev.push([x[0].getTime(), x[9]]); });
  sample.tabs.Attempts.slice(1).forEach((x) => { if (x[1] !== id) return; const w = String(x[7]).split(","); String(x[8]).split(",").forEach((q) => { if (tags[q] === k) ev.push([x[0].getTime(), w.indexOf(q) < 0 ? 1 : 0]); }); });
  B.tab("Item_Log").slice(1).forEach((x) => { if (x[4] === id && x[1] === "26275" && x[7] !== "" && tags[x[6]] === k) ev.push([Date.parse(x[0]) || Date.now(), Number(x[9])]); });
  ev.sort((a, b) => a[0] - b[0]);
  const o = P.outcomes.find((x) => x.key === k);
  assert.equal(o.answers, ev.length, "answers for " + k);
  const kk = ev.length >= 6 ? 3 : Math.floor(ev.length / 2), pc = (xs) => Math.round(1000 * xs.reduce((a, x) => a + x[1], 0) / xs.length) / 10;
  assert.equal(o.start, pc(ev.slice(0, kk))); assert.equal(o.current, pc(ev.slice(ev.length - kk)));
  assert.equal(o.gain, Math.round(10 * (o.current - o.start)) / 10);
  assert.ok(["Secure", "Developing", "Beginning"].includes(o.level));
  assert.ok(P.timeline.length >= 3, "progress over time, by week");
  assert.ok(r.profile.suggestions.length >= 1);
});

test("a student with few answers reads as not enough evidence", () => {
  const lp = host({ action: "learning_progress" });
  lp.students.forEach((s) => s.outcomes.forEach((o) => { if (o.answers < lp.minimum) assert.equal(o.level, "Not enough evidence"); }));
  const cls = lp.outcomes.find((x) => x.key === "L1.1");
  assert.ok(cls && cls.students > 0 && cls.current !== null);
  assert.equal(Object.values(cls.levels).reduce((a, b) => a + b, 0), cls.students);
});

test("group assignments: allocate to some groups, submit, describe parts, rate peers, mark", () => {
  let g = host({ action: "groups", op: "make", set: "Lab 1", mode: "mixed", size: "4" });
  assert.ok(g.ok, JSON.stringify(g)); const groups = g.groups; assert.ok(groups.length >= 6);
  let a = host({ action: "assignments", op: "save", set: "Lab 1", title: "Projectile design", brief: "Design a launch to hit a target 5 m away.", groups: "1,2", due: "2099-12-01", outcome: "L4.2", outof: "20" });
  assert.ok(a.ok, JSON.stringify(a)); const A1 = a.saved;
  a = host({ action: "assignments", op: "save", set: "Lab 1", title: "Free-body poster", groups: "3", due: "2000-01-01T09:00" });
  const A2 = a.saved;
  assert.equal(host({ action: "assignments", op: "save", set: "No such set", title: "x" }).ok, false);
  const g1 = groups.find((x) => x.group === 1).members.map((m) => m.id), g3 = groups.find((x) => x.group === 3).members.map((m) => m.id);
  const g5 = groups.find((x) => x.group === 5).members.map((m) => m.id);
  const S = (id, p) => get(Object.assign({ action: "group_work", id, access: codeOf[id] }, p));
  // A student in group 5 has neither assignment; a student in group 1 sees only the first.
  assert.equal(S(g5[0], {}).assignments.length, 0);
  let mine = S(g1[0], {}); assert.equal(mine.assignments.length, 1); assert.equal(mine.assignments[0].title, "Projectile design");
  assert.equal(mine.assignments[0].mates.length, g1.length - 1);
  assert.equal(S(g1[0], { access: "WRONG-CODE" }).ok, false);
  assert.equal(S(g5[0], { op: "submit", aid: A1, text: "Not ours" }).ok, false, "only the allocated groups can submit");
  assert.equal(S(g1[0], { op: "submit", aid: A1, text: "x", link: "javascript:alert(1)" }).ok, false, "links must be https");
  assert.ok(S(g1[0], { op: "submit", aid: A1, text: "Launch at 7 m/s and 45 degrees.", link: "https://example.org/sheet" }).ok);
  assert.ok(S(g1[1], { op: "submit", aid: A1, text: "Launch at 7.0 m/s and 45 degrees; checked with the range formula." }).ok);
  assert.ok(S(g1[0], { op: "part", aid: A1, text: "I worked out the range formula." }).ok);
  assert.ok(S(g1[1], { op: "part", aid: A1, text: "I checked the numbers and wrote it up." }).ok);
  const rate = {}; g1.slice(1).forEach((x, i) => { rate[x] = i === g1.length - 2 ? "little" : "full"; });
  assert.ok(S(g1[0], { op: "peer", aid: A1, ratings: JSON.stringify(rate) }).ok);
  const rate2 = {}; g1.filter((x) => x !== g1[1]).forEach((x) => { rate2[x] = x === g1[g1.length - 1] ? "little" : "full"; });
  assert.ok(S(g1[1], { op: "peer", aid: A1, ratings: JSON.stringify(rate2) }).ok);
  // The group's latest version is shown, and the late submission to the second assignment is flagged.
  mine = S(g1[2], {}).assignments[0];
  assert.equal(mine.versions, 2); assert.ok(/checked with the range/.test(mine.text)); assert.equal(mine.late, false); assert.equal(mine.mark, null);
  assert.ok(S(g3[0], { op: "submit", aid: A2, text: "Poster link to follow" }).ok);
  assert.equal(S(g3[1], {}).assignments[0].late, true);
  // The lecturer's view: measures, parts and the peer flag (two raters, both "little").
  let v = host({ action: "assignments", op: "view", id: A1 }).assignment;
  assert.equal(v.measures.allocated, 2); assert.equal(v.measures.submitted, 1); assert.equal(v.measures.onTime, 1);
  const G1 = v.groups.find((x) => x.group === 1);
  assert.equal(G1.parts, 2); assert.equal(G1.ratedBy, 2);
  const last = G1.members.find((m) => m.id === g1[g1.length - 1]); assert.equal(last.peerAvg, 0); assert.equal(last.peerFlag, true);
  assert.equal(v.measures.contribution, Math.round(1000 * 2 / v.measures.students) / 10);
  assert.ok(v.measures.beforeAfter && v.measures.beforeAfter.outcome === "L4.2");
  // Mark and feedback reach the group, and the mark reaches the grades.
  v = host({ action: "assignments", op: "mark", id: A1, group: "1", mark: "16", feedback: "Clear method; state your assumptions." }).assignment;
  assert.equal(v.groups.find((x) => x.group === 1).mark, 16);
  mine = S(g1[3] || g1[0], {}).assignments[0]; assert.equal(mine.mark, 16); assert.ok(/assumptions/.test(mine.feedback));
  const master = B.tab("Master"); assert.ok(master[0].some((h) => /Assignment: Projectile design/.test(h)), "a Master column for the assignment");
  // Closing stops new submissions.
  host({ action: "assignments", op: "close", id: A1 });
  assert.equal(S(g1[0], { op: "part", aid: A1, text: "more" }).ok, false);
  // The lecturer sees the peer flag in the student lookup, never the student.
  const prof = host({ action: "student_stats", id: g1[g1.length - 1] }).profile;
  assert.ok(prof.groupWork.some((x) => x.peerFlag));
  assert.ok(!JSON.stringify(S(g1[g1.length - 1], {})).includes("peerAvg"));
});

test("groups on the projector: first name and initial, with each group's task", () => {
  const d = host({ action: "groups_display", set: "Lab 1" });
  assert.ok(d.ok); const one = d.groups.find((x) => x.group === 3);
  one.members.forEach((m) => assert.match(m, /^\S+( \S\.)?$/));
  assert.deepEqual(one.tasks, ["Free-body poster"]);
  assert.equal(get({ action: "groups_display", set: "Lab 1", hostkey: "nope" }).ok, false);
});

test("the student sees only their own progress on My results", () => {
  const id = ids[0];
  const r = get({ action: "my_results", id, code: codeOf[id] });
  assert.ok(r.ok, JSON.stringify(r).slice(0, 200));
  assert.ok(r.progress && r.progress.outcomes.length > 0);
  const s = JSON.stringify(r);
  assert.ok(!/Working hard|Disengaged|Needs a check-in|peer/i.test(s), "no labels or peer ratings in the student's view");
  ids.slice(1).forEach((other) => assert.ok(!s.includes(other), "no other student's ID"));
});

test("the student lookup gives strengths, weak areas and suggestions", () => {
  const weak = host({ action: "student_stats", id: ids[3] }).profile; // rarely attends, low scores, stopped coming
  assert.ok(weak.suggestions.some((t) => t.kind === "Check-in"));
  const strong = host({ action: "student_stats", id: ids[8] }).profile;
  assert.ok(strong.strengths.length >= 1);
  assert.equal(host({ action: "student_stats", id: "99999999" }).ok, false);
});
