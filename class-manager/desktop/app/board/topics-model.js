/* Class Analytics board, topic part: the numbers behind the topic panels. Plain data in, plain data out; no page and no drawing.
   Input: the class statistics (cmApp.stats) with its `topics` block (rules/topics) and its students.
   Nothing is estimated or invented: a figure that cannot be worked out is null and the panel says so. Every sentence quotes the numbers it rests on. */
(function (root) {
  "use strict";
  var U = root.cmBoardUtil || require("./util"), has = U.has, r1 = U.r1;
  var MIN_PAIRS = 10;      // fewer pairs than this and no coefficient is shown at all
  var SMALL_N = 30;        // under this many pairs the coefficient carries a small-sample caution
  var WEAK_R = 0.3;        // under this size the link is called weak
  var BAND_NAME = { well: "Well mastered", developing: "Developing", attention: "Needs attention", early: "Too early to say" };

  function topicsOf(d) { return (d.topics && d.topics.semester) || []; }

  // Pearson correlation of paired values (pairs with a missing side are dropped). Returns null under MIN_PAIRS or when a side does not vary.
  function pearson(xs, ys) {
    var p = [], i; for (i = 0; i < xs.length; i++) if (has(xs[i]) && has(ys[i])) p.push([Number(xs[i]), Number(ys[i])]);
    var n = p.length; if (n < MIN_PAIRS) return { n: n, r: null };
    var mx = 0, my = 0; p.forEach(function (a) { mx += a[0]; my += a[1]; }); mx /= n; my /= n;
    var sxy = 0, sxx = 0, syy = 0; p.forEach(function (a) { sxy += (a[0] - mx) * (a[1] - my); sxx += (a[0] - mx) * (a[0] - mx); syy += (a[1] - my) * (a[1] - my); });
    if (!sxx || !syy) return { n: n, r: null };
    return { n: n, r: Math.round(1000 * sxy / Math.sqrt(sxx * syy)) / 1000, points: p };
  }
  // r in words, with the caution that goes with it. Association only, never cause.
  function describe(label, c, what) {
    var out = { label: label, n: c.n, r: c.r, points: c.points || [], strength: "none", caution: "", text: "" };
    if (c.r === null) { out.text = c.n < MIN_PAIRS ? "Needs at least " + MIN_PAIRS + " students with both numbers (" + c.n + " so far)." : "One of the two numbers does not vary, so there is no coefficient."; return out; }
    var a = Math.abs(c.r); out.strength = a < 0.1 ? "none" : a < WEAK_R ? "weak" : a < 0.5 ? "moderate" : "strong";
    var dir = c.r > 0 ? "go up together" : "move in opposite directions";
    out.text = "n = " + c.n + " students, r = " + c.r + ": " + (out.strength === "none" ? "no clear link" : out.strength + " link, " + what + " " + dir) + ".";
    var cs = []; if (c.n < SMALL_N) cs.push("Only " + c.n + " students, so this could be chance."); if (a < WEAK_R) cs.push("A weak link: do not act on it alone.");
    cs.push("This shows what goes together, not what causes what."); out.caution = cs.join(" ");
    return out;
  }

  // Attendance, practice and topics against quiz average, and topic against topic.
  function correlations(d) {
    var ss = d.students || [], out = [];
    out.push(describe("Attendance and quiz average", pearson(ss.map(function (s) { return s.attendance; }), ss.map(function (s) { return s.quizAverage; })), "attendance and quiz average"));
    out.push(describe("Practice and quiz average", pearson(ss.map(function (s) { return s.practiceAttempts; }), ss.map(function (s) { return s.quizAverage; })), "practice attempts and quiz average"));
    var per = (d.topics && d.topics.students) || {}, ts = topicsOf(d).filter(function (t) { return t.students >= MIN_PAIRS; }), pairs = [];
    for (var i = 0; i < ts.length; i++) for (var j = i + 1; j < ts.length; j++) {
      var a = [], b = []; Object.keys(per).forEach(function (id) { var x = per[id][ts[i].key], y = per[id][ts[j].key]; if (x && y && x.n >= (d.topics.cutoffs ? d.topics.cutoffs.minStudentAnswers : 3) && y.n >= 3) { a.push(x.pct); b.push(y.pct); } });
      var c = pearson(a, b); if (c.r !== null) pairs.push(describe(ts[i].label + " and " + ts[j].label, c, "the two topics"));
    }
    pairs.sort(function (x, y) { return Math.abs(y.r) - Math.abs(x.r); });
    return { main: out, topicPairs: pairs.slice(0, 3), topicPairsTotal: pairs.length };
  }

  // Topic bars: every topic with its band, counts of students per band, and whether the answers are few.
  function mastery(d) {
    var ts = topicsOf(d), counts = { well: 0, developing: 0, attention: 0, early: 0 };
    ts.forEach(function (t) { counts[t.band]++; });
    return { topics: ts.map(function (t) { return { key: t.key, label: t.label, title: t.title, pct: t.pct, band: t.band, answers: t.answers, students: t.students, small: t.small, studentBands: t.studentBands }; }), counts: counts, answers: d.topics ? d.topics.answers : 0, unmapped: d.topics ? d.topics.unmapped : 0 };
  }

  // Topic by quiz grid: rows are topics, columns are the quizzes with answer-level records; a gap is "not asked or under 5 answers".
  function overTime(d) {
    var ot = (d.topics && d.topics.overTime) || [], qs = (d.quizzes || []).map(function (q) { return q.quiz; });
    var cols = qs.filter(function (q, i) { return ot.some(function (s) { return has(s.values[i]); }); });
    var idx = cols.map(function (q) { return qs.indexOf(q); });
    return { quizzes: cols, rows: ot.map(function (s) { return { key: s.key, label: s.label, title: s.title, values: idx.map(function (i) { return has(s.values[i]) ? s.values[i] : null; }), answers: idx.map(function (i) { return s.answers[i]; }) }; }).filter(function (r) { return r.values.some(has); }) };
  }

  // General trend: the class mean quiz after quiz and the topic that moved most between its last two appearances.
  function trend(d) {
    var qs = (d.quizzes || []).filter(function (q) { return q.stats && has(q.stats.mean) && q.students >= 10; }), out = { quizzes: qs.length, first: null, last: null, change: null, movers: [] };
    if (qs.length >= 2) { out.first = qs[0]; out.last = qs[qs.length - 1]; out.change = r1(out.last.stats.mean - out.first.stats.mean); }
    overTime(d).rows.forEach(function (r) {
      var v = r.values.map(function (x, i) { return { v: x, n: r.answers[i] }; }).filter(function (x) { return has(x.v) && x.n >= 5; });
      if (v.length >= 2) out.movers.push({ label: r.label, from: v[v.length - 2].v, to: v[v.length - 1].v, change: r1(v[v.length - 1].v - v[v.length - 2].v) });
    });
    out.movers.sort(function (a, b) { return Math.abs(b.change) - Math.abs(a.change); });
    return out;
  }

  // Short sentences from real numbers only. Each one can be checked against a panel on this page.
  function insights(d) {
    var out = [], m = mastery(d), ts = m.topics.filter(function (t) { return t.band !== "early" && has(t.pct); }), tr = trend(d), co = correlations(d);
    if (ts.length) {
      out.push({ icon: "pie", text: m.counts.well + " of " + m.topics.length + " topics are well mastered, " + m.counts.developing + " developing, " + m.counts.attention + " need attention" + (m.counts.early ? " and " + m.counts.early + " have too few answers to judge." : ".") });
    }
    if (tr.movers.length && Math.abs(tr.movers[0].change) >= 10) { var mv = tr.movers[0]; out.push({ icon: "bars", text: mv.label + " " + (mv.change > 0 ? "rose" : "fell") + " by " + Math.abs(mv.change) + " points between its last two quizzes (" + mv.from + "% to " + mv.to + "%)." }); }
    var sh = null; topicsOf(d).forEach(function (t) { (t.wrong || []).forEach(function (w) { if (!sh || w.share > sh.share) sh = { id: w.id, share: w.share, option: w.option, text: w.text, n: w.n }; }); });
    if (sh) out.push({ icon: "alert", text: "Most shared wrong answer: " + sh.share + "% chose option " + sh.option + " on " + sh.id + (sh.text ? " (" + sh.text + ")" : "") + "." });
    co.main.concat(co.topicPairs).forEach(function (c) {
      if (c.r !== null && c.n >= SMALL_N && Math.abs(c.r) >= WEAK_R) out.push({ icon: "bolt", text: c.label + " go together (r = " + c.r + ", n = " + c.n + "). An association, not a cause." });
    });
    return out;
  }

  var api = { pearson: pearson, describe: describe, correlations: correlations, mastery: mastery, overTime: overTime, trend: trend, insights: insights, BAND_NAME: BAND_NAME, MIN_PAIRS: MIN_PAIRS, SMALL_N: SMALL_N, WEAK_R: WEAK_R };
  if (typeof module === "object" && module.exports) module.exports = api; else root.cmBoardTopicsModel = api;
})(typeof window !== "undefined" ? window : globalThis);
