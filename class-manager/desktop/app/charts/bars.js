/* Class Manager charts: horizontal bar charts on objectives.
   learningGain: latest minus first percentage on the same objective, drawn from zero (right gain, left loss). Class: mean gain over the
     students with at least four answers, with how many. Student: their own gain per objective. Question answered: where did learning move?
   studentVsClass: paired bars, the student's current percentage and the class mean for each objective, with the answer count. It shows
     relative strengths; the class mean is not a standard. Not enough evidence shows no bar.
   discussionPairs: before and after pair discussion, percentage correct, as paired bars per question. */
(function (root) {
  "use strict";
  var C = typeof module === "object" && module.exports ? require("./core") : root.cmCharts;
  var sign = function (v) { return (v > 0 ? "+" : v < 0 ? "−" : "") + Math.abs(v); };
  function learningGain(items, opt) { // items: [{label, gain, n}]
    var rs = (items || []).filter(function (i) { return i.gain !== null && i.gain !== undefined; });
    if (!rs.length) return C.empty("Not enough evidence yet. Gain needs at least four answers on an objective, first and latest compared.");
    var max = Math.max(20, Math.max.apply(null, rs.map(function (i) { return Math.abs(i.gain); })));
    var h = "<div class='gn' role='list'>" + rs.map(function (i) {
      var w = Math.abs(i.gain) / max * 50, pos = i.gain >= 0;
      return "<div class='gn-row' role='listitem'><span class='md-label'>" + C.esc(C.short(i.label)) + "</span><div class='gn-track' role='img' aria-label='" + C.esc(C.short(i.label) + ": " + sign(i.gain) + " points" + (i.n ? ", " + i.n + " " + ((opt || {}).unit || "students") : "")) + "'><span class='gn-zero'></span><span class='gn-bar " + (pos ? "gn-up" : "gn-down") + "' style='width:" + w + "%;" + (pos ? "left:50%" : "right:50%") + "'></span></div><span class='md-n'>" + sign(i.gain) + " pts" + (i.n ? " <span class='note'>(" + i.n + ")</span>" : "") + "</span></div>";
    }).join("") + "</div><p class='note'>Latest minus first percentage correct on the same objective. Left of the line is a fall. " + ((opt || {}).note || "") + "</p>";
    return h + C.asTable("Learning gain by objective", ["Objective", "Gain (points)", "Count"], rs.map(function (i) { return [C.short(i.label), sign(i.gain), i.n || ""]; }));
  }
  function pair(rows, a, b, aria) { // rows: [{label, a, b, aN, bN}]
    var h = "<div class='pb' role='list'>" + rows.map(function (r) {
      var bar = function (v, cls) { return "<span class='pb-bar " + cls + "' style='width:" + (v === null ? 0 : v) + "%'></span><span class='pb-v'>" + (v === null ? "–" : Math.round(v) + "%") + "</span>"; };
      return "<div class='pb-row' role='listitem'><span class='md-label'>" + C.esc(C.short(r.label)) + "</span><div class='pb-pair' role='img' aria-label='" + C.esc(C.short(r.label) + ": " + a + " " + (r.a === null ? "not enough evidence" : Math.round(r.a) + "%") + ", " + b + " " + (r.b === null ? "not enough evidence" : Math.round(r.b) + "%")) + "'><div class='pb-line'>" + bar(r.a, "pb-a") + "</div><div class='pb-line'>" + bar(r.b, "pb-b") + "</div></div><span class='md-n note'>" + (r.note || "") + "</span></div>";
    }).join("") + "</div><p class='note lv-legend'><span><i class='pb-a pb-key'></i>" + C.esc(a) + "</span><span><i class='pb-b pb-key'></i>" + C.esc(b) + "</span></p>";
    return h + C.asTable(aria, ["Item", a, b], rows.map(function (r) { return [C.short(r.label), r.a === null ? "–" : Math.round(r.a) + "%", r.b === null ? "–" : Math.round(r.b) + "%"]; }));
  }
  function studentVsClass(outcomes, classByKey, minimum) { // outcomes: student's [{key,label,current,answers,level}]
    var rows = (outcomes || []).map(function (o) { var c = (classByKey || {})[o.key]; return { label: o.label, a: o.level === "Not enough evidence" ? null : o.current, b: c && c.current !== undefined ? c.current : null, note: o.answers + " answers" }; })
      .filter(function (r) { return r.a !== null || r.b !== null; });
    if (!rows.length) return C.empty("Not enough evidence yet: fewer than " + (minimum || 3) + " answers on every objective.");
    return pair(rows, "This student", "Class mean", "Student and class by objective") + "<p class='note'>The class mean shows where this student sits relative to the class. It is not a standard to reach.</p>";
  }
  function discussionPairs(questions) {
    var rows = (questions || []).filter(function (q) { return q.beforePct !== null && q.afterPct !== null; }).map(function (q) { return { label: (q.week ? "Week " + q.week + " " : "") + (q.qid || "Q" + q.q), a: q.beforePct, b: q.afterPct, note: q.pairs + " paired" }; });
    if (!rows.length) return "";
    return pair(rows, "Before discussion", "After discussion", "Correct before and after discussion") + "<p class='note'>A shift after discussion is evidence of a change in answers, not proof that discussion caused lasting learning.</p>";
  }
  var api = { learningGain: learningGain, studentVsClass: studentVsClass, discussionPairs: discussionPairs };
  if (typeof module === "object" && module.exports) module.exports = api; else root.cmCharts = Object.assign(root.cmCharts || {}, api);
})(typeof window !== "undefined" ? window : globalThis);
