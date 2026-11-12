/* Class Manager charts: attendance against performance.
   Question answered: does coming to class go with doing well? Drawn as: one dot per student (attendance rate across, quiz performance up);
   each dot opens the student. The correlation is stated in words and only when there are at least 10 students; it shows association, not cause.
   Input: rows [{id, name, x, y}] (percentages). */
(function (root) {
  "use strict";
  var C = typeof module === "object" && module.exports ? require("./core") : root.cmCharts;
  var S = typeof module === "object" && module.exports ? require("./stats") : root.cmCharts.stats;

  function scatter(rows, opt) {
    opt = opt || {};
    rows = (rows || []).filter(function (r) { return typeof r.x === "number" && typeof r.y === "number" && isFinite(r.x) && isFinite(r.y); });
    var caption = "<p class='note ch-cap'><b>What this shows:</b> each dot is a student, with attendance across and " + C.esc((opt.yLabel || "performance").toLowerCase()) + " up. It shows whether the two go together.</p>";
    if (!rows.length) return caption + C.empty("Not enough students with both attendance and performance figures yet.");
    var W = 420, H = 300, pl = 40, pb = 34, pt = 10, pr = 12, x = function (v) { return pl + (W - pl - pr) * v / 100; }, y = function (v) { return pt + (H - pt - pb) * (1 - v / 100); };
    var svg = "<svg class='scat' viewBox='0 0 " + W + " " + H + "' role='img' aria-label='Scatter of attendance against " + C.esc((opt.yLabel || "performance").toLowerCase()) + ", " + rows.length + " students'>";
    [0, 50, 100].forEach(function (g) { svg += "<line class='pt-grid' x1='" + pl + "' x2='" + (W - pr) + "' y1='" + y(g) + "' y2='" + y(g) + "'/><text class='pt-ax' x='" + (pl - 5) + "' y='" + (y(g) + 4) + "' text-anchor='end'>" + g + "</text><text class='pt-ax' x='" + x(g) + "' y='" + (H - 16) + "' text-anchor='middle'>" + g + "</text>"; });
    rows.forEach(function (r) { svg += "<g class='scat-dot' data-student='" + C.esc(r.id) + "' tabindex='0'><title>" + C.esc((r.name || r.id) + ": attendance " + S.r1(r.x) + "%, " + S.r1(r.y) + "%") + "</title><circle cx='" + x(r.x) + "' cy='" + y(r.y) + "' r='5'/></g>"; });
    svg += "<text class='pt-ax' x='" + (pl + (W - pl - pr) / 2) + "' y='" + (H - 2) + "' text-anchor='middle'>Attendance (%)</text></svg>";
    var small = rows.length < S.MIN, r = small ? null : S.pearson(rows.map(function (p) { return { x: p.x, y: p.y }; }));
    var word = r === null ? "" : Math.abs(r) < .2 ? "little or no" : Math.abs(r) < .5 ? "a weak" : Math.abs(r) < .8 ? "a moderate" : "a strong";
    var read = small ? "<p class='note warnline'>Small sample: fewer than " + S.MIN + " students, so no relationship is stated.</p>" :
      r === null ? "" : "<p class='note'>Across " + rows.length + " students there is " + word + (Math.abs(r) < .2 ? "" : r > 0 ? " positive" : " negative") + " relationship (correlation " + Math.round(r * 100) / 100 + "). This is an association, not a cause.</p>";
    return caption + svg + read + C.asTable("Attendance and performance by student", ["Student", "ID", "Attendance (%)", (opt.yLabel || "Performance") + " (%)"], rows.map(function (p) { return [p.name || p.id, p.id, S.r1(p.x), S.r1(p.y)]; }));
  }
  var api = { scatter: scatter };
  if (typeof module === "object" && module.exports) module.exports = api; else root.cmCharts = Object.assign(root.cmCharts || {}, api);
})(typeof window !== "undefined" ? window : globalThis);
