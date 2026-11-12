/* Class Manager charts: choosing a day. Pure functions on the class statistics (cmApp.stats), no page.
   timeline(d): the class days in order, one entry per date, from attendance sessions and quizzes (a session or quiz with no readable date is its own entry).
   pick(tl, now): the day to show first: today if there is a class today, else the latest day.
   figures(d, tl, i, mode): one row per student for that day: { id, name, att, quiz }, both percentages or null.
   mode "to": everything up to and including the day; mode "on": the day only. */
(function (root) {
  "use strict";
  var H = typeof module === "object" && module.exports ? require("../headings") : root.cmHeadings || { readable: function (x) { return x; } };
  function parseDate(text) {
    var s = String(text || ""), m;
    if ((m = s.match(/(\d{4})-(\d{1,2})-(\d{1,2})/))) return Date.UTC(+m[1], +m[2] - 1, +m[3]);
    if ((m = s.match(/(\d{1,2})[\/.\-](\d{1,2})(?:[\/.\-](\d{2,4}))?/))) {
      var y = m[3] ? (+m[3] < 100 ? 2000 + +m[3] : +m[3]) : new Date().getUTCFullYear();
      if (+m[2] >= 1 && +m[2] <= 12 && +m[1] >= 1 && +m[1] <= 31) return Date.UTC(y, +m[2] - 1, +m[1]);
    }
    return null;
  }
  function dayLabel(ms) { var d = new Date(ms), p = function (n) { return (n < 10 ? "0" : "") + n; }; return p(d.getUTCDate()) + "/" + p(d.getUTCMonth() + 1) + "/" + d.getUTCFullYear(); }
  function timeline(d) {
    var items = [];
    ((d.attendance && d.attendance.bySession) || []).forEach(function (s, i) { items.push({ kind: "session", idx: i, label: s.label, date: parseDate(s.label), order: i }); });
    (d.quizzes || []).forEach(function (q, i) { items.push({ kind: "quiz", idx: i, label: q.quiz, date: parseDate(q.date), order: 1000 + i }); });
    var days = [], byDate = {};
    items.forEach(function (it) {
      var key = it.date !== null ? "d" + it.date : "n" + it.kind + it.idx, day = byDate[key];
      if (!day) { day = byDate[key] = { key: key, date: it.date, sessions: [], quizzes: [], first: it.order }; days.push(day); }
      (it.kind === "session" ? day.sessions : day.quizzes).push(it.idx); day.first = Math.min(day.first, it.order);
      day.label = it.date !== null ? dayLabel(it.date) : H.readable(it.label);
    });
    days.sort(function (a, b) { return a.date !== null && b.date !== null ? a.date - b.date : a.first - b.first; });
    days.forEach(function (day) { var parts = []; if (day.sessions.length) parts.push("attendance"); if (day.quizzes.length) parts.push("quiz"); day.what = parts.join(" and "); });
    return days;
  }
  function pick(tl, now) {
    if (!tl.length) return -1;
    var t = new Date(now || Date.now()), today = Date.UTC(t.getFullYear(), t.getMonth(), t.getDate());
    for (var i = 0; i < tl.length; i++) if (tl[i].date === today) return i;
    return tl.length - 1;
  }
  var avg = function (xs) { return xs.length ? Math.round(10 * xs.reduce(function (a, b) { return a + b; }, 0) / xs.length) / 10 : null; };
  function figures(d, tl, i, mode) {
    var days = i < 0 ? [] : mode === "on" ? [tl[i]] : tl.slice(0, i + 1), sess = {}, quizzes = {};
    days.forEach(function (day) { day.sessions.forEach(function (s) { sess[s] = true; }); day.quizzes.forEach(function (q) { quizzes[(d.quizzes[q] || {}).quiz] = true; }); });
    return (d.students || []).map(function (s) {
      var marks = (s.marks || []).filter(function (v, k) { return sess[k] && v !== null && v !== undefined; });
      var qs = (s.trajectory || []).filter(function (t) { return quizzes[t.quiz]; }).map(function (t) { return t.pct; });
      return { id: s.id, name: s.name, att: marks.length ? avg([marks.reduce(function (a, b) { return a + (b ? 100 : 0); }, 0) / marks.length]) : null, quiz: avg(qs) };
    });
  }
  var api = { parseDate: parseDate, timeline: timeline, pick: pick, figures: figures };
  if (typeof module === "object" && module.exports) module.exports = api; else root.cmCharts = Object.assign(root.cmCharts || {}, { days: api });
})(typeof window !== "undefined" ? window : globalThis);
