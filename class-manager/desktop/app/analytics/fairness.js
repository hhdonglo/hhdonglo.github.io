/* Class Manager analytics: a fairness view. Do results differ between the groups the class is organised in (the Group column of the class list,
   for example the facilitator groups A to H)? A gap is shown with each group's size and is a prompt to look at teaching conditions (time slot, room,
   facilitator), never a judgement of students. No personal characteristics are collected or used. Plain data in, plain data out. */
(function (root) {
  "use strict";
  var E = root.cmEvidence || (typeof require === "function" ? require("./evidence") : null);
  var GAP = 10, MIN_GROUP = 10;
  function mean(xs) { xs = xs.filter(function (x) { return x !== null && x !== undefined; }); return xs.length ? Math.round(10 * xs.reduce(function (a, b) { return a + b; }, 0) / xs.length) / 10 : null; }
  // students: [{id, quizAverage, attendance, practiceAttempts}], cohorts: {id: "A"}
  function byGroup(students, cohorts) {
    var by = {};
    (students || []).forEach(function (s) { var g = cohorts && cohorts[s.id]; if (!g) return; (by[g] = by[g] || []).push(s); });
    var groups = Object.keys(by).sort().map(function (g) {
      var ss = by[g];
      return { group: g, n: ss.length, quiz: mean(ss.map(function (s) { return s.quizAverage; })), attendance: mean(ss.map(function (s) { return s.attendance; })), practice: mean(ss.map(function (s) { return s.practiceAttempts; })), confidence: E ? E.confidence(ss.length) : null, students: ss.map(function (s) { return s.id; }) };
    });
    var ok = groups.filter(function (g) { return g.n >= MIN_GROUP && g.quiz !== null; }), note = "";
    var gap = null;
    if (ok.length >= 2) { var hi = ok.reduce(function (a, b) { return b.quiz > a.quiz ? b : a; }), lo = ok.reduce(function (a, b) { return b.quiz < a.quiz ? b : a; }); gap = { hi: hi.group, lo: lo.group, points: Math.round(10 * (hi.quiz - lo.quiz)) / 10 };
      if (gap.points >= GAP) note = "Group " + gap.lo + " averages " + gap.points + " points below group " + gap.hi + " on quizzes. Check what differs in the teaching conditions (time slot, room, facilitator, how quizzes were run) before reading it as a difference between students."; }
    return { groups: groups, gap: gap, flagged: !!note, note: note || (groups.length ? "No gap of " + GAP + " points or more between groups of at least " + MIN_GROUP + " students." : ""), usable: ok.length >= 2, empty: !groups.length };
  }
  var api = { GAP: GAP, MIN_GROUP: MIN_GROUP, byGroup: byGroup };
  if (typeof module === "object" && module.exports) module.exports = api; else root.cmFairness = api;
})(typeof window !== "undefined" ? window : globalThis);
