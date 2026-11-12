/* Class Manager charts: the statistics the distribution, box plot and scatter charts need. Pure functions on plain numbers; no page, no server.
   mean, standard deviation (sample), skew, quartiles (linear), outliers (beyond k standard deviations, or beyond 1.5 times the quartile range),
   histogram bins, the normal curve, Pearson correlation. Small samples are reported, never hidden: see MIN. */
(function (root) {
  "use strict";
  var MIN = 10; // fewer values than this is a small sample: no fitted curve, and every figure carries a warning
  var nums = function (xs) { return (xs || []).filter(function (v) { return typeof v === "number" && isFinite(v); }); };
  function mean(xs) { xs = nums(xs); return xs.length ? xs.reduce(function (a, b) { return a + b; }, 0) / xs.length : null; }
  function sd(xs) { xs = nums(xs); if (xs.length < 2) return null; var m = mean(xs); return Math.sqrt(xs.reduce(function (a, v) { return a + (v - m) * (v - m); }, 0) / (xs.length - 1)); }
  function skew(xs) { xs = nums(xs); var s = sd(xs); if (xs.length < 3 || !s) return null; var m = mean(xs); return xs.reduce(function (a, v) { return a + Math.pow((v - m) / s, 3); }, 0) * xs.length / ((xs.length - 1) * (xs.length - 2)); }
  function quantile(sorted, q) { if (!sorted.length) return null; var p = (sorted.length - 1) * q, lo = Math.floor(p), hi = Math.ceil(p); return sorted[lo] + (sorted[hi] - sorted[lo]) * (p - lo); }
  function quartiles(xs) { var s = nums(xs).slice().sort(function (a, b) { return a - b; }); return { min: s[0], q1: quantile(s, .25), median: quantile(s, .5), q3: quantile(s, .75), max: s[s.length - 1], n: s.length }; }
  // rows: [{id, name, v}]. Returns { high: [...], low: [...] } of rows more than k standard deviations from the mean, with their z.
  function outliers(rows, k) {
    var vs = rows.map(function (r) { return r.v; }), m = mean(vs), s = sd(vs), out = { high: [], low: [], mean: m, sd: s };
    if (!s) return out;
    rows.forEach(function (r) { var z = (r.v - m) / s; if (z >= k) out.high.push(Object.assign({ z: z }, r)); else if (z <= -k) out.low.push(Object.assign({ z: z }, r)); });
    out.high.sort(function (a, b) { return b.z - a.z; }); out.low.sort(function (a, b) { return a.z - b.z; });
    return out;
  }
  // Tukey fences for the box plot: values beyond 1.5 times the quartile range from the quartiles.
  function fences(xs) { var q = quartiles(xs), iqr = q.q3 - q.q1; return { lo: q.q1 - 1.5 * iqr, hi: q.q3 + 1.5 * iqr, q: q }; }
  function histogram(xs, bins, lo, hi) { var out = []; for (var i = 0; i < bins; i++) out.push(0); var w = (hi - lo) / bins; nums(xs).forEach(function (v) { var i = Math.min(bins - 1, Math.max(0, Math.floor((v - lo) / w))); out[i]++; }); return out; }
  function normalPdf(x, m, s) { return Math.exp(-0.5 * Math.pow((x - m) / s, 2)) / (s * Math.sqrt(2 * Math.PI)); }
  function pearson(pairs) { // [{x, y}]
    var n = pairs.length; if (n < 3) return null;
    var mx = mean(pairs.map(function (p) { return p.x; })), my = mean(pairs.map(function (p) { return p.y; })), sxy = 0, sxx = 0, syy = 0;
    pairs.forEach(function (p) { sxy += (p.x - mx) * (p.y - my); sxx += (p.x - mx) * (p.x - mx); syy += (p.y - my) * (p.y - my); });
    return sxx && syy ? sxy / Math.sqrt(sxx * syy) : null;
  }
  var r1 = function (v) { return v === null || v === undefined ? null : Math.round(v * 10) / 10; };
  var api = { MIN: MIN, mean: mean, sd: sd, skew: skew, quartiles: quartiles, outliers: outliers, fences: fences, histogram: histogram, normalPdf: normalPdf, pearson: pearson, r1: r1 };
  if (typeof module === "object" && module.exports) module.exports = api; else root.cmCharts = Object.assign(root.cmCharts || {}, { stats: api });
})(typeof window !== "undefined" ? window : globalThis);
