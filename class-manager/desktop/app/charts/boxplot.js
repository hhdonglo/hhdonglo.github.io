/* Class Manager charts: box plots.
   Question answered: who is an outlier, on each measure? Drawn as: one horizontal box per measure (quartiles, median, whiskers to the last value within
   1.5 times the quartile range) with the outliers as dots that open the student. Input: measures [{ label, rows: [{id, name, v}] }] (v is a percentage).
   Under 10 students on a measure the box is shown with a small-sample warning. */
(function (root) {
  "use strict";
  var C = typeof module === "object" && module.exports ? require("./core") : root.cmCharts;
  var S = typeof module === "object" && module.exports ? require("./stats") : root.cmCharts.stats;

  function boxplot(measures) {
    var ms = (measures || []).map(function (m) { return { label: m.label, rows: (m.rows || []).filter(function (r) { return typeof r.v === "number" && isFinite(r.v); }) }; }).filter(function (m) { return m.rows.length; });
    var caption = "<p class='note ch-cap'><b>What this shows:</b> the middle half of the class (the box), the typical range (the lines) and the students outside it (the dots).</p>";
    if (!ms.length) return caption + C.empty("No figures yet for this selection.");
    var W = 620, row = 54, padL = 120, H = ms.length * row + 34, x = function (v) { return padL + (W - padL - 14) * v / 100; };
    var svg = "<svg class='box' viewBox='0 0 " + W + " " + H + "' role='img' aria-label='Box plots of " + C.esc(ms.map(function (m) { return m.label; }).join(", ")) + "'>";
    [0, 25, 50, 75, 100].forEach(function (g) { svg += "<line class='pt-grid' x1='" + x(g) + "' x2='" + x(g) + "' y1='6' y2='" + (H - 24) + "'/><text class='pt-ax' x='" + x(g) + "' y='" + (H - 8) + "' text-anchor='middle'>" + g + "%</text>"; });
    var tbl = [], warns = [];
    ms.forEach(function (m, i) {
      var vs = m.rows.map(function (r) { return r.v; }), f = S.fences(vs), q = f.q, cy = 12 + i * row + row / 2 - 4;
      var inside = vs.filter(function (v) { return v >= f.lo && v <= f.hi; }), lo = Math.min.apply(null, inside), hi = Math.max.apply(null, inside);
      svg += "<text class='pt-ax' x='" + (padL - 8) + "' y='" + (cy + 4) + "' text-anchor='end'>" + C.esc(m.label) + "</text>" +
        "<line class='box-whisk' x1='" + x(lo) + "' x2='" + x(hi) + "' y1='" + cy + "' y2='" + cy + "'/>" +
        "<rect class='box-box' x='" + x(q.q1) + "' y='" + (cy - 11) + "' width='" + Math.max(2, x(q.q3) - x(q.q1)) + "' height='22'><title>" + C.esc(m.label + ": median " + S.r1(q.median) + "%, quartiles " + S.r1(q.q1) + " to " + S.r1(q.q3) + "%") + "</title></rect>" +
        "<line class='box-med' x1='" + x(q.median) + "' x2='" + x(q.median) + "' y1='" + (cy - 11) + "' y2='" + (cy + 11) + "'/>";
      m.rows.filter(function (r) { return r.v < f.lo || r.v > f.hi; }).forEach(function (r) { svg += "<g class='box-out' data-student='" + C.esc(r.id) + "'><title>" + C.esc((r.name || r.id) + ": " + S.r1(r.v) + "%") + "</title><circle cx='" + x(r.v) + "' cy='" + cy + "' r='5'/></g>"; });
      tbl.push([m.label, vs.length, S.r1(q.min), S.r1(q.q1), S.r1(q.median), S.r1(q.q3), S.r1(q.max), m.rows.filter(function (r) { return r.v < f.lo || r.v > f.hi; }).map(function (r) { return r.name || r.id; }).join(", ") || "none"]);
      if (vs.length < S.MIN) warns.push(m.label);
    });
    svg += "</svg>";
    return caption + (warns.length ? "<p class='note warnline'>Small sample (fewer than " + S.MIN + " students): " + C.esc(warns.join(", ")) + ".</p>" : "") + svg +
      C.asTable("Quartiles and outliers", ["Measure", "Students", "Lowest", "Lower quartile", "Median", "Upper quartile", "Highest", "Outliers"], tbl);
  }
  var api = { boxplot: boxplot };
  if (typeof module === "object" && module.exports) module.exports = api; else root.cmCharts = Object.assign(root.cmCharts || {}, api);
})(typeof window !== "undefined" ? window : globalThis);
