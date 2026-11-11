/* Class Manager charts: progress over time.
   Question answered: is the class, or one student, doing better week by week?
   A line of the proportion correct per calendar week of answers. Class: mean line, median dashed, a band from first to third quartile
   (only with four or more students in the week) and the number of students at each point. Student: their line over the class mean, with
   the number of answers at each point. This is the proportion correct in that week's answers, not a measure of understanding, and
   weeks may not be comparable. Input: `timeline` of learningProgress_, and for a student `progress.timeline` with `classTimeline`. */
(function (root) {
  "use strict";
  var C = typeof module === "object" && module.exports ? require("./core") : root.cmCharts;
  var W = 640, H = 220, L = 38, R = 12, T = 12, B = 34;
  function x(i, n) { return n === 1 ? (L + W - R) / 2 : L + i * (W - L - R) / (n - 1); }
  function y(v) { return T + (H - T - B) * (1 - v / 100); }
  function path(pts) { return pts.map(function (p, i) { return (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1); }).join(" "); }
  function draw(weeks, series, o) {
    var n = weeks.length, s = "<svg class='pt' viewBox='0 0 " + W + " " + H + "' role='img' aria-label='" + C.esc(o.aria) + "'>";
    [0, 25, 50, 75, 100].forEach(function (g) { s += "<line class='pt-grid' x1='" + L + "' x2='" + (W - R) + "' y1='" + y(g) + "' y2='" + y(g) + "'/><text class='pt-ax' x='" + (L - 6) + "' y='" + (y(g) + 4) + "' text-anchor='end'>" + g + "%</text>"; });
    if (o.band) {
      var up = [], dn = [];
      weeks.forEach(function (w, i) { if (w.q1 !== null && w.q3 !== null) { up.push([x(i, n), y(w.q3)]); dn.unshift([x(i, n), y(w.q1)]); } });
      if (up.length > 1) s += "<path class='pt-band' d='" + path(up.concat(dn)) + " Z'><title>First to third quartile of students</title></path>";
    }
    series.forEach(function (se) {
      var segs = [], cur = [];
      weeks.forEach(function (w, i) { var v = se.value(w, i); if (v === null || v === undefined) { if (cur.length) segs.push(cur); cur = []; } else cur.push([x(i, n), y(v)]); }); if (cur.length) segs.push(cur);
      segs.forEach(function (sg) { if (sg.length > 1) s += "<path class='pt-line " + se.cls + "' d='" + path(sg) + "'/>"; });
      weeks.forEach(function (w, i) { var v = se.value(w, i); if (v === null || v === undefined) return; s += "<circle class='pt-dot " + se.cls + "' cx='" + x(i, n) + "' cy='" + y(v) + "' r='3.5'><title>" + C.esc(se.title(w, v)) + "</title></circle>"; });
    });
    var step = Math.ceil(n / 8);
    weeks.forEach(function (w, i) { if (i % step === 0 || i === n - 1) s += "<text class='pt-ax' x='" + x(i, n) + "' y='" + (H - 18) + "' text-anchor='middle'>" + C.esc(String(w.week).slice(0, 5)) + "</text><text class='pt-n' x='" + x(i, n) + "' y='" + (H - 4) + "' text-anchor='middle'>" + C.esc(o.count(w)) + "</text>"; });
    return s + "</svg>";
  }
  function classProgress(timeline) {
    if (!timeline || !timeline.length) return C.empty("Not enough evidence yet. The line appears once students have answered questions.");
    var h = draw(timeline, [{ cls: "pt-med", value: function (w) { return w.median; }, title: function (w, v) { return w.week + ": median " + v + "%"; } }, { cls: "pt-mean", value: function (w) { return w.mean; }, title: function (w) { return w.week + ": mean " + w.mean + "%, " + w.students + " students, " + w.answers + " answers"; } }],
      { band: true, aria: "Class proportion correct by week: mean, median and quartile band", count: function (w) { return w.students + " st."; } });
    h += "<p class='note lv-legend'><span><i class='pt-key pt-mean'></i>Mean</span><span><i class='pt-key pt-med'></i>Median</span><span><i class='pt-key pt-bandkey'></i>First to third quartile</span><span>Under each week: students who answered</span></p>" +
      "<p class='note'>Proportion correct in each week's answers. A rising line shows better results on that week's questions, not necessarily better understanding, and different weeks ask different questions.</p>";
    return h + C.asTable("Class proportion correct by week", ["Week", "Students", "Answers", "Mean %", "Median %", "Q1 %", "Q3 %"], timeline.map(function (w) { return [w.week, w.students, w.answers, w.mean, w.median, w.q1 === null ? "–" : w.q1, w.q3 === null ? "–" : w.q3]; }));
  }
  function studentProgress(timeline, classTimeline) {
    if (!timeline || !timeline.length) return C.empty("Not enough evidence yet: no answers recorded.");
    var cls = {}; (classTimeline || []).forEach(function (w) { cls[w.week] = w; });
    var weeks = timeline.map(function (t) { return { week: t.week, pct: t.pct, n: t.n, cls: cls[t.week] ? cls[t.week].mean : null, clsN: cls[t.week] ? cls[t.week].students : 0 }; });
    var h = draw(weeks, [{ cls: "pt-mean", value: function (w) { return w.cls; }, title: function (w) { return w.week + ": class mean " + w.cls + "% (" + w.clsN + " students)"; } }, { cls: "pt-me", value: function (w) { return w.pct; }, title: function (w) { return w.week + ": " + w.pct + "%, " + w.n + " answers"; } }],
      { aria: "This student's proportion correct by week, with the class mean", count: function (w) { return w.n + " ans."; } });
    h += "<p class='note lv-legend'><span><i class='pt-key pt-me'></i>This student</span><span><i class='pt-key pt-mean'></i>Class mean</span><span>Under each week: this student's answers</span></p>" +
      (weeks.some(function (w) { return w.n < 3; }) ? "<p class='note'>Weeks with fewer than three answers are a weak guide.</p>" : "");
    return h + C.asTable("Student and class proportion correct by week", ["Week", "Student %", "Answers", "Class mean %"], weeks.map(function (w) { return [w.week, w.pct, w.n, w.cls === null ? "–" : w.cls]; }));
  }
  var api = { classProgress: classProgress, studentProgress: studentProgress };
  if (typeof module === "object" && module.exports) module.exports = api; else root.cmCharts = Object.assign(root.cmCharts || {}, api);
})(typeof window !== "undefined" ? window : globalThis);
