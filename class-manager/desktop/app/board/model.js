/* Class Analytics board: the numbers behind each panel. Plain data in, plain data out; no page and no drawing.
   Input: the class statistics (cmApp.stats, same object the dashboard uses) and the lecture progress (cmApp.lectureProgress, may be missing).
   Nothing is estimated or invented: a value that cannot be worked out is null and the panel says so. */
(function (root) {
  "use strict";
  var U = root.cmBoardUtil || require("./util"), has = U.has, r1 = U.r1;
  var RK = function () { return root.cmRisk || require("../dashboard/risk"); };

  function delta(now, before, unit, label) { // an arrow with the change; null when either number is missing
    if (!has(now) || !has(before)) return null;
    var d = r1(now - before);
    return { dir: d > 0 ? "up" : d < 0 ? "down" : "flat", text: (d > 0 ? "+" : d < 0 ? "−" : "") + Math.abs(d) + unit, label: label };
  }
  // Practice in the last `idle` days (the lecturer's setting), counted from each student's record.
  function practice(d) {
    var days = (d.thresholds && d.thresholds.idle) || 14, n = 0;
    (d.students || []).forEach(function (s) { if (s.practiceRecent) n++; });
    return { days: days, students: n };
  }
  function quizzes(d) { return (d.quizzes || []).filter(function (q) { return q.stats && has(q.stats.mean); }); }

  // Five KPI cards. `key` is the drill the existing click handler opens (dashboard/groups.js drills).
  function kpis(d) {
    var a = d.attendance || {}, qs = quizzes(d), last = qs[qs.length - 1], prev = qs[qs.length - 2], pr = practice(d);
    var risk = d.rosterSize ? RK().atRisk(d) : { total: 0 };
    var sm = d.summary || {}, att = a.sessions >= 4 ? delta(has(a.recentRate) ? a.recentRate : sm.recentRate, has(a.earlierRate) ? a.earlierRate : sm.earlierRate, " pts", "vs earlier sessions") : null;
    return [
      { key: "students", icon: "students", label: "Students", value: String(d.rosterSize || 0), note: d.rosterSize ? "on the class list" : "none on the class list yet", delta: null },
<<<<<<< HEAD
      { key: "attendance", icon: "attendance", label: "Attendance rate", value: has(a.rate) ? a.rate + "%" : "–", note: a.sessions ? U.plural(a.sessions, "session", "sessions") + (a.notHeld && a.notHeld.length ? " (" + a.notHeld.length + " set aside)" : "") : "no session yet", delta: att },
      { key: "learning", icon: "quiz", label: "Quiz average", value: last ? r1(last.stats.mean) + "%" : "–", note: last ? "latest quiz, " + U.short(last.quiz, 18) : "no quiz released yet", delta: prev ? delta(last.stats.mean, prev.stats.mean, " pts", "vs the quiz before") : null },
      { key: "practice", icon: "practice", label: "Practice activity", value: String(pr.students), note: pr.students ? "students practised in the last " + pr.days + " days" : "no practice in the last " + pr.days + " days", delta: null },
      { key: "risk", icon: "risk", label: "At risk", value: String(risk.strong || 0), note: riskNote(risk), delta: null, goodDown: true }
    ];
  }

  // Only flags with solid evidence are counted as at risk; a flag built on very little data is named separately and never inflates the number.
  function riskNote(r) {
    var strong = r.strong || 0, thin = r.thin || 0;
    if (!strong && !thin) return "no one flagged";
    return (strong ? "students with a solid reason to check in" : "none with solid evidence") + (thin ? (strong ? ", " : "; ") + thin + " more on thin evidence" : "");
  }
=======
      { key: "attendance", icon: "attendance", label: "Attendance rate", value: has(a.rate) ? a.rate + "%" : "–", note: a.sessions ? U.plural(a.sessions, "session", "sessions") : "no session yet", delta: att },
      { key: "learning", icon: "quiz", label: "Quiz average", value: last ? r1(last.stats.mean) + "%" : "–", note: last ? "latest quiz, " + U.short(last.quiz, 18) : "no quiz released yet", delta: prev ? delta(last.stats.mean, prev.stats.mean, " pts", "vs the quiz before") : null },
      { key: "practice", icon: "practice", label: "Practice activity", value: String(pr.students), note: pr.students ? "students practised in the last " + pr.days + " days" : "no practice in the last " + pr.days + " days", delta: null },
      { key: "risk", icon: "risk", label: "At risk", value: String(risk.total || 0), note: risk.total ? "students with a reason to check in" : "no one flagged", delta: null, goodDown: true }
    ];
  }

>>>>>>> 0cc9a42560f666d645a25f88f211af393e263608
  function lec(l) { return l ? l.label + (l.title ? ", " + l.title : "") : ""; }

  // Lecture plan: held, behind plan and still to come add up to the planned number.
  function plan(lp) {
    if (!lp || !lp.target) return { empty: true, why: "No lecture plan yet. Set the number of planned lectures and the teaching dates under Course settings, and CM draws the plan here." };
    var held = Math.min(lp.held, lp.target), behind = lp.state === "ended" ? 0 : Math.min(lp.behind || 0, Math.max(0, lp.target - held));
    var still = Math.max(0, lp.target - held - behind), s = lp.schedule || {}, lines = [];
    if (s.due) lines.push({ k: "Due by this week", v: lec(s.due) });
    if (s.next) lines.push({ k: "Next to teach", v: lec(s.next) });
    if (s.missed && s.missed.length) lines.push({ k: "Missed so far", v: s.missed.map(function (l) { return l.label; }).join(", ") });
    return { empty: false, target: lp.target, held: held, behind: behind, still: still, state: lp.state, headline: lp.headline || "", week: lp.weekNow ? lp.weekNow + "/" + lp.weeksTotal : "", lines: lines,
      pct: Math.round(100 * held / lp.target),
      slices: [{ key: "held", label: "Held", value: held, color: "orange" }, { key: "behind", label: "Behind plan", value: behind, color: "bad" }, { key: "still", label: "Still to come", value: still, color: "sand" }] };
  }

  function dayLabel(s) { return String(s).replace(/\s+\d{4}$/, "").replace(/\/\d{4}$/, ""); } // "2 Nov 2026" and "21/10/2026" lose the year
  function running(vals) { var s = 0, n = 0; return vals.map(function (v) { if (has(v)) { s += v; n++; } return n ? r1(s / n) : null; }); }

  // The three progress charts, as tabs. Each says what its bars and its line are; `drill` names the click that lists students behind a bar.
  function progress(d, lp) {
    var ses = (d.attendance && d.attendance.bySession) || [], qs = quizzes(d);
    var days = ((lp && lp.days) || []).filter(function (x) { return x.how !== "cancelled"; }).map(function (x) { return x.date; }).sort();
    var cum = days.map(function (_, i) { return i + 1; }), refs = [];
    if (lp && lp.target) refs.push({ value: lp.target, label: "Planned " + lp.target });
    if (lp && has(lp.expected) && lp.expected < (lp.target || 0)) refs.push({ value: lp.expected, label: "Expected by today " + lp.expected });
    return [
      { key: "attendance", title: "Attendance per session", unit: "%", max: 100, drill: "attendance", barName: "Present", lineName: "Running average",
        labels: ses.map(function (x) { return dayLabel(x.label); }), bars: ses.map(function (x) { return x.rate; }), line: running(ses.map(function (x) { return x.rate; })), refs: [],
        empty: "No attendance session submitted yet. Take attendance to draw this chart." },
      { key: "quiz", title: "Quiz average per quiz", unit: "%", max: 100, drill: "learning", barName: "Class average", lineName: "Took part",
        labels: qs.map(function (q) { return U.short(q.quiz, 11); }), bars: qs.map(function (q) { return r1(q.stats.mean); }), line: qs.map(function (q) { return has(q.participation) ? q.participation : null; }), refs: [],
        empty: "No quiz released yet. Run a quiz to draw this chart." },
      { key: "lectures", title: "Lectures held against the plan", unit: "", max: Math.max(lp && lp.target || 0, cum.length, 1), drill: null, barName: "Lectures held so far", lineName: "",
        labels: days.map(function (x) { return x.slice(8) + "/" + x.slice(5, 7); }), bars: cum, line: [], refs: refs,
        empty: "No lecture counted yet. A lecture counts when attendance is closed or when you mark it held." }
    ];
  }

  // Topics by verdict (donut) and the ranked list of topics needing attention. Comes from the learning verdict; a topic with few answers is flagged.
  var VERDICT = [["Learning", "Learning", "good"], ["Mixed", "Mixed", "gold"], ["Not yet learning", "Not yet learning", "bad"], ["Not enough data", "Few answers", "ghost"]];
  function topics(d) { return ((d.learning && d.learning.topics) || []).filter(function (t) { return t && t.label; }); }
  function topicDonut(d) {
    var ts = topics(d), n = ts.length;
    var slices = VERDICT.map(function (v) { return { key: v[0], label: v[1], value: ts.filter(function (t) { return (t.verdict || "Not enough data") === v[0]; }).length, color: v[2] }; });
    var learning = slices[0].value;
    return { total: n, slices: slices, centre: n ? { big: Math.round(100 * learning / n) + "%", small: "of topics learning" } : null, title: "Performance by lecture topic" };
  }
  function groupDonut(d) {
    var names = d.groupNames || ["On track", "Working hard but struggling", "Disengaged", "Needs a check-in", "Not enough data"], g = d.groups || {};
    var colors = ["good", "gold", "bad", "orange", "ghost"], total = 0;
    var slices = names.map(function (nm, i) { var v = g[nm] || 0; total += v; return { key: String(i), label: nm, value: v, color: colors[i % colors.length], drill: i }; });
    var on = slices[0] ? slices[0].value : 0;
    return { total: total, slices: slices, centre: total ? { big: Math.round(100 * on / total) + "%", small: "on track" } : null, title: "Students by suggested group" };
  }
  function ranked(d, max) {
    return topics(d).filter(function (t) { return has(t.pct); }).sort(function (a, b) { return a.pct - b.pct; }).slice(0, max || 6).map(function (t, i) {
      return { rank: i + 1, label: t.label, pct: t.pct, gain: has(t.gain) ? t.gain : null, small: !!t.small, verdict: t.verdict };
    });
  }

  // Plain sentences from the numbers above; every one can be checked against a chart or a card. No AI text.
  function findings(d, lp) {
    var out = [], a = d.attendance || {}, qs = quizzes(d), rk = ranked(d, 50), pr = practice(d), sm = d.summary || {}, rec = has(a.recentRate) ? a.recentRate : sm.recentRate, ear = has(a.earlierRate) ? a.earlierRate : sm.earlierRate;
    if (a.sessions >= 4 && has(rec) && has(ear)) {
      var df = r1(rec - ear);
      out.push({ icon: "bars", text: Math.abs(df) < 3 ? "Attendance is steady at about " + rec + "% over the last three sessions." : "Attendance " + (df > 0 ? "rose" : "fell") + " by " + Math.abs(df) + " points over the last three sessions, to " + rec + "%." });
    } else if (a.sessions && has(a.rate)) out.push({ icon: "bars", text: "Attendance is " + a.rate + "% across " + U.plural(a.sessions, "session", "sessions") + "." });
    if (qs.length >= 2) { var l = qs[qs.length - 1], p = qs[qs.length - 2], dq = r1(l.stats.mean - p.stats.mean); out.push({ icon: "trend", text: "The quiz average " + (dq === 0 ? "did not change" : (dq > 0 ? "rose" : "fell") + " by " + Math.abs(dq) + " points") + " from " + U.short(p.quiz, 18) + " to " + U.short(l.quiz, 18) + "." }); }
    if (lp && lp.target && (lp.state === "behind" || lp.state === "ahead" || lp.state === "ontrack" || lp.state === "met")) out.push({ icon: "pie", text: lp.headline + ". " + lp.held + " of " + lp.target + " lectures held." });
    if (rk.length) out.push({ icon: "spark", text: "Lowest topic: " + rk[0].label + " at " + rk[0].pct + "% correct" + (rk[0].small ? " (few answers)" : "") + "." + (rk.length > 1 ? " Strongest: " + rk[rk.length - 1].label + " at " + rk[rk.length - 1].pct + "%." : "") });
<<<<<<< HEAD
    var rr = d.rosterSize ? RK().atRisk(d) : { strong: 0, thin: 0 };
    if (rr.strong) out.push({ icon: "alert", text: U.plural(rr.strong, "student has", "students have") + " a solid reason to check in. Click the At risk card to see who." });
    else if (rr.thin) out.push({ icon: "alert", text: U.plural(rr.thin, "student is", "students are") + " flagged on thin evidence only (fewer than " + RK().MIN_SESSIONS + " sessions or " + RK().MIN_QUIZZES + " quizzes), so nobody is counted as at risk yet." });
    (d.targets || []).slice(0, 2).forEach(function (t) { out.push({ icon: "spark", text: t.title + (t.small ? " (small sample)" : "") + ": " + t.evidence }); });
    if (d.rosterSize >= 10 && pr.students) out.push({ icon: "bolt", text: U.plural(pr.students, "student", "students") + " of " + d.rosterSize + " practised in the last " + pr.days + " days." });
    return out.slice(0, 6);
  }

  // The spread of the students' quiz averages, in plain numbers (median, middle half, lowest, highest).
  function spread(d) {
    var v = (d.students || []).map(function (x) { return x.quizAverage; }).filter(has).sort(function (a, b) { return a - b; }), n = v.length;
    if (!n) return { n: 0 };
    var q = function (p) { var h = (n - 1) * p, lo = Math.floor(h), hi = Math.ceil(h); return v[lo] + (v[hi] - v[lo]) * (h - lo); };
    return { n: n, median: r1(q(0.5)), q1: r1(q(0.25)), q3: r1(q(0.75)), min: r1(v[0]), max: r1(v[n - 1]) };
  }

  var api = { kpis: kpis, plan: plan, progress: progress, topicDonut: topicDonut, groupDonut: groupDonut, ranked: ranked, findings: findings, spread: spread };
=======
    var risk = d.rosterSize ? RK().atRisk(d).total : 0;
    if (risk) out.push({ icon: "alert", text: U.plural(risk, "student has", "students have") + " a reason to check in. Click the At risk card to see who." });
    if (d.rosterSize >= 10 && pr.students) out.push({ icon: "bolt", text: U.plural(pr.students, "student", "students") + " of " + d.rosterSize + " practised in the last " + pr.days + " days." });
    return out.slice(0, 5);
  }

  var api = { kpis: kpis, plan: plan, progress: progress, topicDonut: topicDonut, groupDonut: groupDonut, ranked: ranked, findings: findings };
>>>>>>> 0cc9a42560f666d645a25f88f211af393e263608
  if (typeof module === "object" && module.exports) module.exports = api; else root.cmBoardModel = api;
})(typeof window !== "undefined" ? window : globalThis);
