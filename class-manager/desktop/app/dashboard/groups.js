/* Class Manager dashboard: groups of students behind every number and chart. Plain data in, plain data out.
   Each function returns the students (by id) that a number, bar or zone stands for, so a click can list them.
   Input is the class statistics (classStats_). The same file runs in the CM window (window.cmGroups) and in Node (the tests). */
(function (root) {
  "use strict";
  var MIN_POINTS = 5; // a relation drawn from fewer students is not shown
  var norm = function (v) { return v === null || v === undefined ? null : Number(v); };
  function label(s) { return s.name || s.id; }
  function pick(ss, fn) { return ss.filter(fn).map(function (s) { return { id: s.id, name: label(s) }; }); }

  // The risk scatter: attendance against quiz average, one point per student who has both. Three zones, with the line at the lecturer's thresholds.
  function riskPoints(d) {
    return (d.students || []).filter(function (s) { return norm(s.attendance) !== null && norm(s.quizAverage) !== null; })
      .map(function (s) { return { id: s.id, name: label(s), x: s.attendance, y: s.quizAverage }; });
  }
  function cuts(d) { var t = d.thresholds || {}; return { attendance: norm(t.effort) === null ? 70 : t.effort, quiz: norm(t.perf) === null ? 50 : t.perf }; }
  function zoneOf(p, c) { var la = p.x < c.attendance, lq = p.y < c.quiz; return la && lq ? "both" : la ? "attendance" : lq ? "quiz" : "ok"; }
  var ZONES = [["both", "Low attendance and low quiz scores"], ["attendance", "Low attendance only"], ["quiz", "Low quiz scores only"]];
  function riskZones(d) {
    var pts = riskPoints(d), c = cuts(d), by = { both: [], attendance: [], quiz: [], ok: [] };
    pts.forEach(function (p) { by[zoneOf(p, c)].push({ id: p.id, name: p.name }); });
    var plotted = {}; pts.forEach(function (p) { plotted[p.id] = 1; });
    var missing = (d.students || []).filter(function (s) { return !plotted[s.id]; }).length;
    return { cuts: c, points: pts, zones: ZONES.map(function (z) { return { key: z[0], label: z[1], students: by[z[0]] }; }), ok: by.ok, missing: missing };
  }

  // Bars behind the numbers at the top: each bar carries the students it stands for.
  function drills(d) {
    var ss = d.students || [], th = d.thresholds || {}, out = {};
    var gn = d.groupNames || ["On track", "Working hard but struggling", "Disengaged", "Needs a check-in", "Not enough data"];
    out.students = { title: "Who is on the class list", hint: "Click a bar to list the students. Groups are suggestions for your review.", unit: " students", bars: gn.map(function (g) { var l = pick(ss, function (s) { return s.group === g; }); return { label: g, value: l.length, students: l }; }) };
    var sess = (d.attendance && d.attendance.bySession) || [];
    out.attendance = { title: "Attendance by session", hint: "Click a session to list who was absent.", unit: "%", max: 100, bars: sess.map(function (x, i) { return { label: x.label, value: x.rate, students: pick(ss, function (s) { return s.marks && s.marks[i] === 0; }), what: "absent" }; }) };
    var qs = d.quizzes || [], low = norm(th.perf) === null ? 50 : th.perf;
    out.learning = { title: "Class average by quiz", hint: "Click a quiz to list who scored below " + low + "%.", unit: "%", max: 100, bars: qs.map(function (q) { return { label: q.quiz, value: q.stats ? q.stats.mean : null, what: "below " + low + "%", students: pick(ss, function (s) { return (s.trajectory || []).some(function (t) { return t.quiz === q.quiz && t.pct < low; }); }) }; }) };
    var idle = th.idle || 14, yes = pick(ss, function (s) { return s.practiceRecent; }), no = pick(ss, function (s) { return !s.practiceRecent; });
    out.practice = { title: "Practice in the last " + idle + " days", hint: "Click a bar to list the students. Practice is optional, so not practising is not a flag by itself.", unit: " students", bars: [{ label: "Practised", value: yes.length, students: yes }, { label: "Did not practise", value: no.length, students: no }] };
    return out;
  }

  // Pearson correlation. Needs MIN_POINTS students and some spread in both measures; otherwise null.
  function pearson(pts) {
    var n = pts.length; if (n < MIN_POINTS) return null;
    var mx = 0, my = 0; pts.forEach(function (p) { mx += p.x; my += p.y; }); mx /= n; my /= n;
    var sxy = 0, sxx = 0, syy = 0; pts.forEach(function (p) { var a = p.x - mx, b = p.y - my; sxy += a * b; sxx += a * a; syy += b * b; });
    return sxx && syy ? Math.round(100 * sxy / Math.sqrt(sxx * syy)) / 100 : null;
  }
  function strength(r) { var a = Math.abs(r); return a >= 0.7 ? "strong" : a >= 0.4 ? "moderate" : a >= 0.2 ? "weak" : "no clear"; }
  // Linked views: the same students in each. A relation is shown as an association, never as a cause.
  function correlations(d) {
    var ss = d.students || [];
    var defs = [
      { key: "att-quiz", title: "Attendance and quiz average", xl: "Attendance %", yl: "Quiz average %", x: function (s) { return norm(s.attendance); }, y: function (s) { return norm(s.quizAverage); } },
      { key: "prac-change", title: "Practice and quiz change", xl: "Practice attempts", yl: "Change since the quiz before, points", x: function (s) { return s.practiceAttempts === undefined ? null : s.practiceAttempts; }, y: function (s) { return norm(s.change); } },
      { key: "prac-quiz", title: "Practice and quiz average", xl: "Practice attempts", yl: "Quiz average %", x: function (s) { return s.practiceAttempts === undefined ? null : s.practiceAttempts; }, y: function (s) { return norm(s.quizAverage); } }
    ];
    return defs.filter(function (v) {
      return !d.analytics || d.analytics.available.quizzes && d.analytics.available[v.key === "att-quiz" ? "attendance" : "practice"];
    }).map(function (v) {
      var pts = ss.map(function (s) { return { id: s.id, name: label(s), x: v.x(s), y: v.y(s) }; }).filter(function (p) { return p.x !== null && p.y !== null; });
      var r = pearson(pts), n = pts.length, text;
      if (r === null) text = n < MIN_POINTS ? "Only " + n + " students have both measures, too few to compare." : "One of the two measures does not vary, so there is nothing to compare.";
      else {
        var description = strength(r) === "no clear" ? "no clear association" : "a " + strength(r) + " " + (r < 0 ? "negative" : "positive") + " association";
        var caution = d.analytics ? (n < 10 ? "Limited evidence from a small sample. " : "") + "Observational comparison." : "This shows what goes together, not what causes what.";
        text = "n = " + n + " students, r = " + r + ": " + description + ". " + caution;
      }
      return { key: v.key, title: v.title, xl: v.xl, yl: v.yl, points: pts, n: n, r: r, text: text };
    }).filter(function (v) { return !d.analytics || v.r !== null; });
  }

  var api = { MIN_POINTS: MIN_POINTS, riskPoints: riskPoints, riskZones: riskZones, zoneOf: zoneOf, drills: drills, pearson: pearson, correlations: correlations };
  if (typeof module === "object" && module.exports) module.exports = api; else root.cmGroups = api;
})(typeof window !== "undefined" ? window : globalThis);
