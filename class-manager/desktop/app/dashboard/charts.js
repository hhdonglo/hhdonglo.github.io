/* Class Manager dashboard: the drawings. Each function returns an SVG string; no calculation beyond placing marks on one scale.
   Colours come from CM's tokens (--bar, --grid, --faint, --g-need, --g-hard). Every drawing carries a text label, and the
   same information is in the list under it, so colour and position are never the only way to read it. Runs in the CM window and in Node. */
(function (root) {
  "use strict";
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  var f1 = function (n) { return (Math.round(n * 10) / 10).toString(); };

  // Bars with a value above each. `sel` is the chosen bar; every bar is a button-like group with data-bar.
  function bars(drill, sel) {
    var bs = drill.bars || [], W = 560, H = 200, base = 168, top = 24, n = bs.length || 1, slot = 470 / n, w = Math.min(70, slot - 14);
    var vals = bs.map(function (b) { return b.value === null || b.value === undefined ? 0 : b.value; });
    var max = drill.max || Math.max.apply(null, vals.concat([1]));
    var s = "<svg class='dbars' viewBox='0 0 " + W + " " + H + "' role='img' aria-label='" + esc(drill.title) + "'><line class='grid' x1='30' y1='" + base + "' x2='" + (W - 10) + "' y2='" + base + "'/>";
    bs.forEach(function (b, i) {
      var v = b.value, h = v === null || v === undefined ? 0 : Math.max(v ? 2 : 0, (base - top) * v / max), x = 50 + i * slot + (slot - w) / 2, on = sel === i;
      s += "<g class='dbar" + (on ? " on" : "") + "' data-bar='" + i + "' tabindex='0' role='button' aria-pressed='" + on + "' aria-label='" + esc(b.label + ": " + (v === null || v === undefined ? "no data" : f1(v) + (drill.unit || ""))) + "'>" +
        "<rect class='hit' x='" + (50 + i * slot) + "' y='0' width='" + slot + "' height='" + base + "'/><rect class='fill' x='" + x + "' y='" + (base - h) + "' width='" + w + "' height='" + h + "' rx='4'/>" +
        "<text class='val' x='" + (x + w / 2) + "' y='" + (base - h - 6) + "' text-anchor='middle'>" + (b.text ? esc(b.text) : v === null || v === undefined ? "–" : f1(v) + (drill.unit === "%" ? "%" : "")) + "</text>" +
        "<text class='ax' x='" + (x + w / 2) + "' y='" + (H - 8) + "' text-anchor='middle'>" + esc(String(b.label).length > 14 ? String(b.label).slice(0, 13) + "…" : b.label) + "</text></g>";
    });
    return s + "</svg>";
  }

  // The risk scatter. Three shaded zones from the thresholds; a click on a zone has data-zone. `sel` is the chosen zone key.
  function risk(z, sel) {
    var W = 420, H = 260, X0 = 44, X1 = 410, Y0 = 14, Y1 = 222, c = z.cuts;
    var px = function (a) { return X0 + a / 100 * (X1 - X0); }, py = function (q) { return Y1 - q / 100 * (Y1 - Y0); };
    var ax = px(c.attendance), qy = py(c.quiz);
    var zone = function (key, x, y, w, h, cls) { return "<rect class='zone " + cls + (sel === key ? " on" : "") + "' data-zone='" + key + "' x='" + x + "' y='" + y + "' width='" + w + "' height='" + h + "'/>"; };
    var s = "<svg class='dscatter' viewBox='0 0 " + W + " " + H + "' role='img' aria-label='Attendance against quiz average, one dot per student, with three shaded zones'>";
    s += zone("both", X0, qy, ax - X0, Y1 - qy, "z-both") + zone("attendance", X0, Y0, ax - X0, qy - Y0, "z-att") + zone("quiz", ax, qy, X1 - ax, Y1 - qy, "z-quiz");
    s += "<line class='grid' x1='" + X0 + "' y1='" + Y1 + "' x2='" + X1 + "' y2='" + Y1 + "'/><line class='grid' x1='" + X0 + "' y1='" + Y0 + "' x2='" + X0 + "' y2='" + Y1 + "'/>";
    s += "<text class='ax' x='" + X0 + "' y='240'>0%</text><text class='ax' x='" + (ax - 10) + "' y='240'>" + f1(c.attendance) + "%</text><text class='ax' x='" + (X1 - 26) + "' y='240'>100%</text><text class='ax' x='" + (X0 + 120) + "' y='256'>Attendance</text>";
    s += "<text class='ax' x='2' y='" + (qy + 4) + "'>" + f1(c.quiz) + "</text><text class='ax' x='2' y='" + (Y0 + 8) + "'>Quiz</text>";
    var inZone = function (p) { return !sel || (root.cmGroups || require("./groups")).zoneOf(p, c) === sel; };
    z.points.forEach(function (p) { var on = !sel || inZone(p); s += "<circle class='dot" + (sel && on ? " on" : "") + (sel && !on ? " dim" : "") + "' cx='" + px(p.x) + "' cy='" + py(p.y) + "' r='" + (sel && on ? 4.6 : 3.4) + "'><title>" + esc(p.name + ": attendance " + p.x + "%, quiz " + p.y + "%") + "</title></circle>"; });
    return s + "</svg>";
  }

  // One relation between two measures. Dots in the chosen set are highlighted in every view (linked views).
  function relation(v, chosen) {
    var W = 560, H = 230, X0 = 54, X1 = 540, Y0 = 16, Y1 = 192;
    if (v.r === null) return "<p class='note'>" + esc(v.text) + "</p>";
    var xs = v.points.map(function (p) { return p.x; }), ys = v.points.map(function (p) { return p.y; });
    var x0 = Math.min.apply(null, xs), x1 = Math.max.apply(null, xs), y0 = Math.min.apply(null, ys), y1 = Math.max.apply(null, ys);
    if (x1 === x0) x1 = x0 + 1; if (y1 === y0) y1 = y0 + 1;
    var px = function (a) { return X0 + (a - x0) / (x1 - x0) * (X1 - X0); }, py = function (b) { return Y1 - (b - y0) / (y1 - y0) * (Y1 - Y0); };
    var s = "<svg class='dscatter' viewBox='0 0 " + W + " " + H + "' role='img' aria-label='" + esc(v.title + ": " + v.text) + "'><line class='grid' x1='" + X0 + "' y1='" + Y1 + "' x2='" + X1 + "' y2='" + Y1 + "'/><line class='grid' x1='" + X0 + "' y1='" + Y0 + "' x2='" + X0 + "' y2='" + Y1 + "'/>";
    s += "<text class='ax' x='" + X0 + "' y='208'>" + f1(x0) + "</text><text class='ax' x='" + (X1 - 20) + "' y='208'>" + f1(x1) + "</text><text class='ax' x='" + (X0 + 140) + "' y='224'>" + esc(v.xl) + "</text>";
    s += "<text class='ax' x='2' y='" + (Y1 + 4) + "'>" + f1(y0) + "</text><text class='ax' x='2' y='" + (Y0 + 8) + "'>" + f1(y1) + "</text><text class='ax' x='60' y='11'>" + esc(v.yl) + "</text>";
    v.points.forEach(function (p) { var on = !chosen || chosen[p.id]; s += "<circle class='dot" + (chosen && on ? " on" : "") + (chosen && !on ? " dim" : "") + "' cx='" + px(p.x) + "' cy='" + py(p.y) + "' r='" + (chosen && on ? 4.6 : 3.4) + "'><title>" + esc(p.name) + "</title></circle>"; });
    return s + "</svg>";
  }

  var api = { bars: bars, risk: risk, relation: relation };
  if (typeof module === "object" && module.exports) module.exports = api; else root.cmDashCharts = api;
})(typeof window !== "undefined" ? window : globalThis);
