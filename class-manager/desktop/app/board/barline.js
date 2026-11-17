/* Class Analytics board: bars with a line over them, one scale. Returns an SVG string from a series (model.js progress).
   Bars that have a `drill` are buttons (data-bd-bar) and open the students behind them. With no points it draws pale ghost bars and says what is missing. */
(function (root) {
  "use strict";
  var U = root.cmBoardUtil || require("./util"), C = U.COLOR, has = U.has;
  var W = 620, H = 270, L = 42, Rt = 16, T = 22, B = 40, BASE = H - B;
  var GHOST = [34, 52, 44, 66, 58, 78];
  function svg(s) {
    var n = s.bars.length, ghost = !n, m = ghost ? GHOST.length : n, slot = (W - L - Rt) / m, bw = Math.min(46, slot * 0.62), max = s.max || 100;
    var y = function (v) { return BASE - (BASE - T) * Math.min(v, max) / max; }, cx = function (i) { return L + slot * i + slot / 2; };
    var o = "<svg class='bd-barline' viewBox='0 0 " + W + " " + H + "' role='img' aria-label='" + U.esc(s.title + (ghost ? ": no data yet" : ": " + s.bars.join(", ") + s.unit)) + "'>";
    [0, 0.25, 0.5, 0.75, 1].forEach(function (f) { var yy = y(max * f); o += "<line x1='" + L + "' x2='" + (W - Rt) + "' y1='" + yy + "' y2='" + yy + "' stroke='" + C.grid + "'/><text class='bd-ax' x='" + (L - 6) + "' y='" + (yy + 4) + "' text-anchor='end'>" + U.r1(max * f) + (s.unit === "%" ? "%" : "") + "</text>"; });
    (s.refs || []).forEach(function (r, i) { var yy = y(r.value); o += "<line x1='" + L + "' x2='" + (W - Rt) + "' y1='" + yy + "' y2='" + yy + "' stroke='" + C.gold + "' stroke-width='2' stroke-dasharray='6 5'/><text class='bd-ref' x='" + (W - Rt) + "' y='" + (yy - 5 - i * 0) + "' text-anchor='end'>" + U.esc(r.label) + "</text>"; });
    for (var i = 0; i < m; i++) {
      var v = ghost ? GHOST[i] : s.bars[i], h = has(v) ? Math.max(v ? 2 : 0, BASE - y(v)) : 0, x = cx(i) - bw / 2;
      if (ghost) { o += "<rect x='" + x + "' y='" + (BASE - h) + "' width='" + bw + "' height='" + h + "' rx='5' fill='" + C.ghost + "'/>"; continue; }
      var lbl = s.labels[i] + ": " + (has(v) ? v + s.unit : "no data"), btn = s.drill ? " data-bd-bar='" + i + "' data-bd-key='" + U.esc(s.drill) + "' tabindex='0' role='button'" : "";
      o += "<g class='bd-bar'" + btn + " aria-label='" + U.esc(lbl) + "'><rect class='hit' x='" + (cx(i) - slot / 2) + "' y='" + T + "' width='" + slot + "' height='" + (BASE - T) + "' fill='transparent'/>" +
        "<rect class='fill' x='" + x + "' y='" + (BASE - h) + "' width='" + bw + "' height='" + h + "' rx='5' fill='" + C.orange + "'/>" +
        (m <= 12 && h > 18 ? "<text class='bd-val' x='" + cx(i) + "' y='" + (BASE - 8) + "' text-anchor='middle'>" + U.r1(v) + "</text>" : "") + "<title>" + U.esc(lbl) + "</title></g>";
      if (m <= 12 || i % Math.ceil(m / 12) === 0) o += "<text class='bd-ax' x='" + cx(i) + "' y='" + (H - 14) + "' text-anchor='middle'>" + U.esc(s.labels[i]) + "</text>";
    }
    var pts = []; (s.line || []).forEach(function (v, i) { if (has(v)) pts.push([cx(i), y(v)]); });
    if (pts.length > 1) o += "<polyline fill='none' stroke='" + C.deep + "' stroke-width='2.5' stroke-linejoin='round' points='" + pts.map(function (p) { return p[0].toFixed(1) + "," + p[1].toFixed(1); }).join(" ") + "'/>";
    pts.forEach(function (p) { o += "<circle cx='" + p[0].toFixed(1) + "' cy='" + p[1].toFixed(1) + "' r='4' fill='#fff' stroke='" + C.deep + "' stroke-width='2.5'/>"; });
    if (ghost) o += "<text class='bd-ghost' x='" + W / 2 + "' y='" + (H / 2 - 6) + "' text-anchor='middle'>" + U.esc(s.empty) + "</text>";
    return o + "</svg>";
  }
  function key(s) {
    var has2 = (s.line || []).some(has);
    return "<p class='bd-key'><span><i style='background:" + C.orange + "'></i>" + U.esc(s.barName) + "</span>" + (has2 ? "<span><i class='ln' style='background:" + C.deep + "'></i>" + U.esc(s.lineName) + "</span>" : "") + ((s.refs || []).length ? "<span><i class='dash'></i>Plan</span>" : "") + "</p>";
  }
  var api = { svg: svg, key: key };
  if (typeof module === "object" && module.exports) module.exports = api; else root.cmBoardBarline = api;
})(typeof window !== "undefined" ? window : globalThis);
