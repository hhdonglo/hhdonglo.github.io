/* Class Analytics board: shares of the class for the donut charts (attendance present or absent, quiz score bands, why students are flagged,
   topic mastery bands). Numbers only, no HTML. The slice shape is the one donut.js draws: { key, label, value, color }. Runs in the window and in Node. */
(function (root) {
  "use strict";
  var U = root.cmBoardUtil || require("./util"), has = U.has;
  var TM = root.cmBoardTopicsModel || require("./topics-model");
  var RISK = root.cmRisk || (typeof require === "function" ? require("../dashboard/risk") : null);
  function total(slices) { return slices.reduce(function (s, x) { return s + x.value; }, 0); }
  // Check-ins over all counted sessions: present against absent. Sessions nobody attended are already left out by the statistics.
  function attendance(d) {
    var ses = ((d.attendance && d.attendance.bySession) || []).filter(function (s) { return has(s.counted) && s.counted > 0; });
    var present = 0, counted = 0; ses.forEach(function (s) { present += s.present || 0; counted += s.counted; });
    var slices = [{ key: "present", label: "Present", value: present, color: "good" }, { key: "absent", label: "Absent", value: counted - present, color: "orange" }];
    return { title: "Attendance, present and absent", slices: slices, total: counted, sessions: ses.length, centre: counted ? { big: U.r1(100 * present / counted) + "%", small: "present" } : null };
  }
  var BANDS = [["Under 50%", 0, 50, "bad"], ["50 to 69%", 50, 70, "orange"], ["70 to 84%", 70, 85, "gold"], ["85% or more", 85, 101, "good"]];
  // Students by their quiz average. A student with no quiz result is not placed in a band.
  function scores(d) {
    var vals = (d.students || []).map(function (s) { return s.quizAverage; }).filter(has);
    var slices = BANDS.map(function (b) { return { key: b[0], label: b[0], value: vals.filter(function (v) { return v >= b[1] && v < b[2]; }).length, color: b[3] }; });
    var top = slices[2].value + slices[3].value;
    return { title: "Students by quiz average", slices: slices, total: vals.length, centre: vals.length ? { big: Math.round(100 * top / vals.length) + "%", small: "at 70% or more" } : null };
  }
  // Why students are flagged: one slice per reason that applies. A student with two reasons is counted under each (the legend says so).
  function risk(d) {
    var r = RISK ? RISK.atRisk(d) : null; if (!r) return { title: "Why students are flagged", slices: [], total: 0, centre: null, wide: [] };
    var colors = ["bad", "orange", "gold", "sand", "deep"];
    var slices = r.reasons.map(function (x, i) { return { key: x.key, label: x.label, value: x.students.length, color: colors[i % colors.length] }; }).filter(function (x) { return x.value > 0; });
    return { title: "Why students are flagged", slices: slices, total: total(slices), centre: { big: String(r.strong), small: "on solid evidence" }, wide: r.classWide || [], thin: r.thin, students: r.total };
  }
  // Topics by mastery band (the bands and their colours come from the topic panels).
  function mastery(d) {
    var m = TM.mastery(d), c = m.counts, names = TM.BAND_NAME, cols = { well: "good", developing: "gold", attention: "bad", early: "ghost" };
    var slices = ["well", "developing", "attention", "early"].map(function (k) { return { key: k, label: names[k], value: c[k], color: cols[k] }; });
    var n = total(slices);
    return { title: "Topics by mastery", slices: slices, total: n, centre: n ? { big: Math.round(100 * c.well / n) + "%", small: "well mastered" } : null };
  }
  var api = { attendance: attendance, scores: scores, risk: risk, mastery: mastery };
  if (typeof module === "object" && module.exports) module.exports = api; else root.cmBoardShares = api;
})(typeof window !== "undefined" ? window : globalThis);
