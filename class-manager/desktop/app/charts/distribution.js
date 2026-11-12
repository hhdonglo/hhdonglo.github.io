/* Class Manager charts: the distribution of student performance.
   Question answered: how is performance spread across the class, and who is unusually high or low?
   Drawn as: a histogram (students per band) with a fitted Gaussian curve, the mean and one standard deviation either side, and the outliers marked on the axis.
   Below it: the students beyond k standard deviations, high and low, each opening the student. Under 10 students: no curve, a warning, the table only.
   Input: rows [{id, name, v}] (v is a percentage 0 to 100), options { label, k }. */
(function (root) {
  "use strict";
  var C = typeof module === "object" && module.exports ? require("./core") : root.cmCharts;
  var S = typeof module === "object" && module.exports ? require("./stats") : root.cmCharts.stats;

  function list(title, rows, cls) {
    if (!rows.length) return "<p class='note'>" + C.esc(title) + ": none.</p>";
    return "<p class='lbl'>" + C.esc(title) + "</p><ul class='note dist-out " + cls + "'>" + rows.map(function (r) {
      return "<li><button type='button' class='link' data-student='" + C.esc(r.id) + "'>" + C.esc(r.name || r.id) + "</button>: " + S.r1(r.v) + "% <span class='note'>(" + (r.z > 0 ? "+" : "−") + Math.abs(S.r1(r.z)) + " SD)</span></li>";
    }).join("") + "</ul>";
  }

  function distribution(rows, opt) {
    opt = opt || {}; var k = opt.k || 2, label = opt.label || "Performance";
    rows = (rows || []).filter(function (r) { return typeof r.v === "number" && isFinite(r.v); });
    var caption = "<p class='note ch-cap'><b>What this shows:</b> how " + C.esc(label.toLowerCase()) + " is spread across the class, with the average and the students who stand out.</p>";
    if (!rows.length) return caption + C.empty("No " + label.toLowerCase() + " figures yet for this selection.");
    var vs = rows.map(function (r) { return r.v; }), n = rows.length, m = S.mean(vs), s = S.sd(vs), sk = S.skew(vs), small = n < S.MIN;
    var facts = "<p class='note'>" + n + " students · mean " + S.r1(m) + "%" + (s !== null ? " · standard deviation " + S.r1(s) : "") + (sk !== null ? " · skew " + Math.round(sk * 100) / 100 : "") + "</p>";
    var warn = small ? "<p class='note warnline'>Small sample: fewer than " + S.MIN + " students, so no curve is fitted and the shape means little.</p>" : "";
    var table = C.asTable(label + " by student", ["Student", "ID", label + " (%)"], rows.slice().sort(function (a, b) { return b.v - a.v; }).map(function (r) { return [r.name || r.id, r.id, S.r1(r.v)]; }));
    if (small || !s) return caption + facts + warn + table;
    var W = 620, H = 220, padL = 34, padB = 40, padT = 14, bins = 10, counts = S.histogram(vs, bins, 0, 100), maxC = Math.max.apply(null, counts) || 1;
    var pw = W - padL - 10, ph = H - padB - padT, bw = pw / bins, x = function (v) { return padL + pw * v / 100; }, y = function (c) { return padT + ph - ph * c / (maxC * 1.25); };
    var svg = "<svg class='dist' viewBox='0 0 " + W + " " + H + "' role='img' aria-label='" + C.esc(label + " histogram with fitted normal curve, mean " + S.r1(m) + " percent") + "'>";
    [0, .5, 1].forEach(function (f) { var yy = padT + ph - ph * f / 1.25 * 1; svg += "<line class='pt-grid' x1='" + padL + "' x2='" + (W - 10) + "' y1='" + yy + "' y2='" + yy + "'/>"; });
    counts.forEach(function (c, i) { svg += "<rect class='dist-bar' x='" + (padL + i * bw + 2) + "' y='" + y(c) + "' width='" + (bw - 4) + "' height='" + (padT + ph - y(c)) + "'><title>" + (i * 10) + " to " + (i * 10 + 10) + "%: " + c + " student" + (c === 1 ? "" : "s") + "</title></rect><text class='pt-ax' x='" + (padL + i * bw) + "' y='" + (H - padB + 14) + "' text-anchor='middle'>" + (i * 10) + "</text>"; });
    svg += "<text class='pt-ax' x='" + (padL + pw) + "' y='" + (H - padB + 14) + "' text-anchor='middle'>100</text>";
    var pts = []; for (var v = 0; v <= 100; v += 1) pts.push(x(v).toFixed(1) + "," + y(S.normalPdf(v, m, s) * n * (100 / bins)).toFixed(1));
    svg += "<polyline class='dist-curve' points='" + pts.join(" ") + "'/>";
    svg += "<line class='dist-mean' x1='" + x(m) + "' x2='" + x(m) + "' y1='" + padT + "' y2='" + (padT + ph) + "'/><text class='pt-ax' x='" + x(m) + "' y='" + (padT + 9) + "' text-anchor='middle'>mean</text>";
    [m - s, m + s].forEach(function (v) { if (v >= 0 && v <= 100) svg += "<line class='dist-sd' x1='" + x(v) + "' x2='" + x(v) + "' y1='" + padT + "' y2='" + (padT + ph) + "'/>"; });
    var o = S.outliers(rows, k);
    o.high.concat(o.low).forEach(function (r) { svg += "<g class='dist-out-mark " + (r.z > 0 ? "hi" : "lo") + "' data-student='" + C.esc(r.id) + "'><title>" + C.esc((r.name || r.id) + ": " + S.r1(r.v) + "%") + "</title><path d='M" + x(r.v) + "," + (H - padB - 2) + "l-6,10h12z'/></g>"; });
    svg += "<text class='pt-ax' x='" + (padL + pw / 2) + "' y='" + (H - 4) + "' text-anchor='middle'>" + C.esc(label) + " (%)</text></svg>";
    var key = "<p class='note lv-legend'><span><i class='dist-key bar'></i>Students per band</span><span><i class='dist-key curve'></i>Fitted normal curve</span><span><i class='dist-key tri'></i>Outlier (beyond " + k + " SD)</span></p>";
    return caption + facts + svg + key + list("Unusually high", o.high, "hi") + list("Unusually low", o.low, "lo") + "<p class='note'>An outlier is a prompt for a conversation, not a judgement.</p>" + table;
  }
  var api = { distribution: distribution };
  if (typeof module === "object" && module.exports) module.exports = api; else root.cmCharts = Object.assign(root.cmCharts || {}, api);
})(typeof window !== "undefined" ? window : globalThis);
