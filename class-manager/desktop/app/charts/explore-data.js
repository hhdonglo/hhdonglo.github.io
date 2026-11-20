/* Class Manager analytics charts: the data behind the extra charts. Plain data in, plain data out; no drawing.
   Each builder returns a chart in one shape: { key, title, hint, caption, unit, max, kind, bars: [{ label, value, n, students, small }] }.
   `students` is the list behind a bar ({ id, name }; for a question chart `kind` is "question" and the list holds questions).
   Groups under SMALL students are marked small, never judged. Relations are associations, not causes.
   Input is the class statistics (classStats_). Runs in the CM window (window.cmExplore) and in Node (the tests). */
(function (root) {
  "use strict";
  var SMALL = 5;
  var num = function (v) { return v === null || v === undefined || v === "" ? null : Number(v); };
  var who = function (s) { return { id: s.id, name: s.name || s.id }; };
  var mean = function (xs) { xs = xs.filter(function (x) { return x !== null; }); return xs.length ? Math.round(10 * xs.reduce(function (a, b) { return a + b; }, 0) / xs.length) / 10 : null; };
  function bar(label, ss, value, extra) { return Object.assign({ label: label, value: value, n: ss.length, students: ss.map(who), small: ss.length < SMALL }, extra || {}); }
  function chart(key, title, hint, caption, unit, max, bars, kind) { if (unit !== "%") bars.forEach(function (b) { b.small = false; }); /* counts are not judged by size; only averages are */ return { key: key, title: title, hint: hint, caption: caption, unit: unit, max: max, kind: kind || "student", bars: bars }; }

  // How the class's quiz averages are spread: ten bands of ten points.
  function spread(d) {
    var ss = (d.students || []).filter(function (s) { return num(s.quizAverage) !== null; }), bands = [];
    for (var i = 0; i < 10; i++) bands.push([]);
    ss.forEach(function (s) { bands[Math.min(9, Math.floor(s.quizAverage / 10))].push(s); });
    var c = chart("spread", "How quiz averages are spread", "Click a band to list the students in it.", "Students with at least one quiz result: " + ss.length + ".", " students", null,
      bands.map(function (b, i) { return bar(i * 10 + "–" + (i === 9 ? 100 : i * 10 + 9), b, b.length); }));
    var v = ss.map(function (s) { return s.quizAverage; }).sort(function (a, b) { return a - b; });
    if (v.length) { var q = function (p) { var h = (v.length - 1) * p, lo = Math.floor(h), hi = Math.ceil(h); return Math.round(10 * (v[lo] + (v[hi] - v[lo]) * (h - lo))) / 10; };
      c.facts = [["Students", String(v.length)], ["Median", q(0.5) + "%"], ["Middle half", q(0.25) + "% to " + q(0.75) + "%"], ["Lowest", q(0) + "%"], ["Highest", q(1) + "%"]]; }
    return c;
  }
  // Change since the quiz before, in five steps. Only students with two or more quizzes.
  function change(d) {
    var ss = (d.students || []).filter(function (s) { return num(s.change) !== null; }), defs = [["Down 10+", function (c) { return c <= -10; }], ["Down 1 to 9", function (c) { return c < -1 && c > -10; }], ["About the same", function (c) { return c >= -1 && c <= 1; }], ["Up 1 to 9", function (c) { return c > 1 && c < 10; }], ["Up 10+", function (c) { return c >= 10; }]];
    return chart("change", "Change since the quiz before", "Click a bar to list the students. Points of quiz score, latest against the one before.", "Students with two or more quizzes: " + ss.length + ". A change can be chance; look at the next quiz before acting.", " students", null,
      defs.map(function (f) { return bar(f[0], ss.filter(function (s) { return f[1](s.change); }), ss.filter(function (s) { return f[1](s.change); }).length); }));
  }
  // Who took part in each quiz.
  function participation(d) {
    var ss = d.students || [], qs = d.quizzes || [];
    return chart("participation", "Who took each quiz", "Click a quiz to list the students who did not take it.", "Percent of the class list that took part.", "%", 100,
      qs.map(function (q) { var took = ss.filter(function (s) { return (s.trajectory || []).some(function (t) { return t.quiz === q.quiz; }); }), miss = ss.filter(function (s) { return took.indexOf(s) < 0; });
        return Object.assign(bar(q.quiz, miss, ss.length ? Math.round(1000 * took.length / ss.length) / 10 : null), { what: "did not take it", small: ss.length < SMALL }); }));
  }
  // How many sessions in a row each student has missed.
  function missed(d) {
    var ss = (d.students || []).filter(function (s) { return num(s.missedInARow) !== null; }), defs = [["None", 0, 0], ["1", 1, 1], ["2", 2, 2], ["3 or more", 3, 999]];
    return chart("missed", "Sessions missed in a row", "Click a bar to list the students.", "Counted back from the latest session.", " students", null,
      defs.map(function (f) { var l = ss.filter(function (s) { return s.missedInARow >= f[1] && s.missedInARow <= f[2]; }); return bar(f[0], l, l.length); }));
  }
  // Practice and results together: mean quiz average by how much a student practised. Practice is optional and this is an association.
  function practice(d) {
    var ss = (d.students || []).filter(function (s) { return num(s.quizAverage) !== null && s.practiceAttempts !== undefined; }), defs = [["None", 0, 0], ["1 to 2", 1, 2], ["3 to 5", 3, 5], ["6 or more", 6, 9999]];
    return chart("practice", "Practice and quiz average", "Click a bar to list the students. Bars with fewer than " + SMALL + " students are marked small.", "Mean quiz average by number of practice attempts. This shows what goes together, not what causes what; practice is optional.", "%", 100,
      defs.map(function (f) { var l = ss.filter(function (s) { return s.practiceAttempts >= f[1] && s.practiceAttempts <= f[2]; }); return bar(f[0], l, mean(l.map(function (s) { return num(s.quizAverage); }))); }));
  }
  // Results by group: the suggested engagement groups, and the teaching groups when the class list has them. cohorts: {id: "A"}
  function groups(d, cohorts) {
    var ss = (d.students || []).filter(function (s) { return num(s.quizAverage) !== null; }), out = [];
    var names = d.groupNames || [];
    out.push(chart("grp-eng", "Quiz average by suggested group", "Click a bar to list the students. Groups are suggestions for your review.", "Groups of fewer than " + SMALL + " students are marked small. The groups are built from these results, so they differ by design.", "%", 100,
      names.map(function (g) { var l = ss.filter(function (s) { return s.group === g; }); return bar(g, l, mean(l.map(function (s) { return num(s.quizAverage); }))); }).filter(function (b) { return b.n > 0; })));
    var keys = {}; Object.keys(cohorts || {}).forEach(function (id) { keys[cohorts[id]] = 1; });
    var ks = Object.keys(keys).sort();
    if (ks.length) out.push(chart("grp-teach", "Quiz average by teaching group", "Click a bar to list the students.", "A gap between groups is a prompt to check teaching conditions (time slot, room, facilitator), not a difference between students.", "%", 100,
      ks.map(function (g) { var l = ss.filter(function (s) { return cohorts[s.id] === g; }); return bar("Group " + g, l, mean(l.map(function (s) { return num(s.quizAverage); }))); })));
    return out;
  }
  // Performance by topic (lecture): the class's percent correct, and the questions behind it.
  function topics(d) {
    var qs = d.questions || [], ls = (d.lectures || []).filter(function (l) { return l.lecture >= 0; });
    return chart("topics", "Percent correct by lecture", "Click a lecture to list its questions, hardest first.", "Live answers only. A lecture with fewer than 30 answers is marked small.", "%", 100,
      ls.map(function (l) { var list = qs.filter(function (q) { return q.lecture === l.lecture; }).sort(function (a, b) { return (a.pct === null ? 101 : a.pct) - (b.pct === null ? 101 : b.pct); }).map(function (q) { return { id: q.id, name: q.id + (q.pct === null ? "" : " (" + q.pct + "%)") }; });
        return { label: l.lecture === 0 ? "Intro" : "Lecture " + l.lecture, value: l.pct, n: l.answers, students: list, small: l.answers < 30, what: "questions" }; }), "question");
  }
  // Question difficulty and discrimination, in bands. A question needs 10 answers to be placed.
  function items(d) {
    var qs = (d.questions || []).filter(function (q) { return (q.answers || 0) >= 10 && q.pct !== null; });
    var q2 = function (l) { return l.map(function (q) { return { id: q.id, name: q.id + " (" + q.pct + "%)" }; }); };
    var dif = [["Very hard", function (q) { return q.pct < 20; }], ["Hard", function (q) { return q.pct >= 20 && q.pct < 50; }], ["Medium", function (q) { return q.pct >= 50 && q.pct < 80; }], ["Easy", function (q) { return q.pct >= 80; }]];
    var dis = [["Reversed", function (q) { return q.discrimination !== null && q.discrimination < 0; }], ["Weak", function (q) { return q.discrimination !== null && q.discrimination >= 0 && q.discrimination < 0.2; }], ["Good", function (q) { return q.discrimination !== null && q.discrimination >= 0.2 && q.discrimination < 0.4; }], ["Strong", function (q) { return q.discrimination !== null && q.discrimination >= 0.4; }]];
    var mk = function (defs) { return defs.map(function (f) { var l = qs.filter(f[1]); return { label: f[0], value: l.length, n: l.length, students: q2(l), small: false, what: "questions" }; }); };
    return [chart("difficulty", "Question difficulty", "Click a bar to list the questions.", "Very hard: under 20% correct; hard: 20 to 49; medium: 50 to 79; easy: 80 or more. Questions with at least 10 live answers: " + qs.length + ".", " questions", null, mk(dif), "question"),
      chart("discrimination", "Do questions separate stronger from weaker students?", "Click a bar to list the questions. Reversed questions need their key and wording checked.", "Reversed: below 0; weak: 0 to 0.2; good: 0.2 to 0.4; strong: 0.4 or more. Discrimination compares the top and bottom 27 percent of students on the rest of the quiz.", " questions", null, mk(dis), "question")];
  }
  // Attendance by session, with the numbers: how many were present of how many, and who was absent.
  function sessions(d) {
    var ss = d.students || [], sess = (d.attendance && d.attendance.bySession) || [], roster = d.rosterSize || ss.length;
    return chart("sessions", "Attendance by session", "Click a session to list who was absent.", "Present out of the recorded marks for each session. The class list has " + roster + " students.", "%", 100,
      sess.map(function (x, i) { var absent = ss.filter(function (s) { return s.marks && s.marks[i] === 0; }); var pres = x.present !== undefined ? x.present : Math.round((x.rate || 0) * roster / 100);
        return Object.assign(bar((x.label || "S" + (i + 1)) + " · " + pres + "/" + (x.counted == null ? roster : x.counted), absent, x.rate), { text: x.rate + "%", what: "absent" }); }));
  }
  // Quiz average and who took part, quiz by quiz.
  function quizTrend(d) {
    var ss = d.students || [], qs = d.quizzes || [], low = (d.thresholds && d.thresholds.perf) || 50;
    return chart("quiztrend", "Quiz average and participation, quiz by quiz", "Click a quiz to list the students who scored below " + low + "%.", "Average of those who took part; the label shows how many took part. A rising average with falling participation can mean weaker students stopped taking the quiz.", "%", 100,
      qs.map(function (q) { var l = ss.filter(function (s) { var t = (s.trajectory || []).filter(function (x) { return x.quiz === q.quiz; })[0]; return t && t.pct < low; });
        return Object.assign(bar(q.quiz + " · n=" + q.students, l, q.stats ? q.stats.mean : null), { text: q.stats && q.stats.mean !== null ? q.stats.mean + "%" : "–", what: "below " + low + "%" }); }));
  }
  var SHORT = { attendance: "Low attendance", missed: "Missed in a row", quiz: "Low quiz avg", noquiz: "No quiz taken", fall: "Falling" };
  // Who is at risk, and why. Practice is never a reason on its own; reasons built on little data are marked thin.
  function risk(d) {
    var RK = root.cmRisk || (typeof require === "function" ? require("../dashboard/risk") : null), r = RK.atRisk(d), th = d.thresholds || {};
    var c = chart("atrisk", "Who is at risk, and why", "Click a reason to list the students. A student can have more than one reason.", r.total + " students have at least one reason: " + r.strong + " on solid evidence and " + r.thin + " on thin evidence (fewer than " + r.minSessions + " submitted sessions or " + r.minQuizzes + " quizzes). Not practising is never a reason by itself. " + (r.classWide && r.classWide.length ? r.classWide.map(function (w) { return w.label + " fits " + w.count + " of " + w.of + " students, so it is a class pattern and flags no one. "; }).join("") : "") + "Thresholds are set under Students, Engagement rules.", " students", null,
      r.reasons.map(function (x) { return Object.assign(bar(SHORT[x.key] || x.label, x.students, x.students.length), { what: "students", note: x.label + ": " + x.rule + (x.thin ? " (thin evidence)" : "") }); }));
    c.bars.forEach(function (b) { b.small = false; });
    c.facts = [["At risk", String(r.total)], ["Solid evidence", String(r.strong)], ["Thin evidence", String(r.thin)], ["Submitted sessions", String(r.sessions)], ["Quizzes", String(r.quizzes)]];
    return c;
  }
  // The charts for each screen.
  function forScreen(screen, d, cohorts) {
    var g = groups(d, cohorts), it = items(d);
    if (screen === "overview") return [sessions(d), quizTrend(d), spread(d), risk(d), change(d), practice(d), participation(d)].concat(g, it);
    // The Class Analytics sections (board/sections.js) each take their own charts, so no chart appears twice on the page.
    if (screen === "ov-attendance") return d.attendance && d.attendance.sessions ? [missed(d)] : [];
    if (screen === "ov-quizzes") return [participation(d), change(d), practice(d)].concat(g);
    if (screen === "ov-risk") return [risk(d)];
    if (screen === "ov-questions") return it;
    if (screen === "attendance") return [missed(d)];
    if (screen === "quizzes") return [participation(d), spread(d), change(d), topics(d)].concat(it);
    if (screen === "students") return [spread(d), practice(d)].concat(g);
    return [];
  }
  function availableCharts(screen, d, cohorts) {
    var charts = forScreen(screen, d, cohorts);
    if (!d.analytics) return charts;
    var a = d.analytics.available;
    var show = { sessions: a.attendance, missed: a.attendance, quiztrend: a.quizzes, spread: a.quizzes,
      participation: a.quizzes, change: a.quizzes, practice: a.practice && a.quizzes,
      "grp-eng": a.engagement && a.quizzes, "grp-teach": a.groups && a.quizzes, topics: a.questions,
      difficulty: a.questions, discrimination: a.quizzes && a.questions, atrisk: a.risk };
    return charts.filter(function (c) {
      return show[c.key] && c.bars.some(function (b) { return b.value != null && b.n > 0; });
    });
  }
  var api = { sessions: sessions, quizTrend: quizTrend, risk: risk, SMALL: SMALL, spread: spread, change: change, participation: participation, missed: missed, practice: practice, groups: groups, topics: topics, items: items, forScreen: availableCharts };
  if (typeof module === "object" && module.exports) module.exports = api; else root.cmExplore = api;
})(typeof window !== "undefined" ? window : globalThis);
