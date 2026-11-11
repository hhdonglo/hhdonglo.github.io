/* Class Manager charts: engagement and participation of one student.
   Question answered: has this student been present and active? Bars for attendance rate, quizzes taken, and practice attempts, with the
   counts. Attendance and activity are context, not evidence of understanding, and the chart says so. A missing figure is "–", never zero.
   Input: `engagement` of studentProfile_ ({attendance, quizzesTaken, practiceAttempts, missedInARow}). */
(function (root) {
  "use strict";
  var C = typeof module === "object" && module.exports ? require("./core") : root.cmCharts;
  function engagement(e, totalQuizzes) {
    if (!e) return "";
    var rows = [];
    if (e.attendance !== null && e.attendance !== undefined) rows.push(["Attendance", e.attendance, Math.round(e.attendance) + "%" + (e.missedInARow ? ", missed the last " + e.missedInARow : "")]);
    if (e.quizzesTaken !== undefined && !totalQuizzes) rows.push(["Live quizzes taken", null, String(e.quizzesTaken)]);
    if (totalQuizzes) rows.push(["Live quizzes taken", Math.min(100, 100 * e.quizzesTaken / totalQuizzes), e.quizzesTaken + " of " + totalQuizzes]);
    if (e.practiceAttempts !== undefined) rows.push(["Practice attempts", null, String(e.practiceAttempts)]);
    if (!rows.length) return C.empty("No attendance or activity recorded yet.");
    return "<div class='gn' role='list'>" + rows.map(function (r) {
      return "<div class='pb-row' role='listitem'><span class='md-label'>" + C.esc(r[0]) + "</span><div class='md-bar'>" + (r[1] === null ? "" : "<span class='pb-a' style='width:" + r[1] + "%'></span>") + "</div><span class='md-n'>" + C.esc(r[2]) + "</span></div>";
    }).join("") + "</div><p class='note'>Attendance and activity are context. They do not show what the student understands.</p>";
  }
  var api = { engagement: engagement };
  if (typeof module === "object" && module.exports) module.exports = api; else root.cmCharts = Object.assign(root.cmCharts || {}, api);
})(typeof window !== "undefined" ? window : globalThis);
