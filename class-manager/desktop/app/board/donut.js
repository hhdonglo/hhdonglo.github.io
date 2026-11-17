/* Class Analytics board: a donut chart and its legend. Returns SVG and HTML strings; slices come from model.js.
   A slice or legend row with a `drill` value is a button (data-bd-slice). With no data it draws a grey ring and says so. */
(function (root) {
  "use strict";
  var U = root.cmBoardUtil || require("./util"), C = U.COLOR;
  var R = 70, CIRC = 2 * Math.PI * R;
  function col(k) { return C[k] || C.muted; }
  function svg(slices, centre, title) {
    var total = slices.reduce(function (s, x) { return s + x.value; }, 0), live = slices.filter(function (x) { return x.value > 0; }).length, acc = 0;
    var s = "<svg class='bd-donut' viewBox='0 0 200 200' role='img' aria-label='" + U.esc(title + ": " + (total ? slices.map(function (x) { return x.label + " " + x.value; }).join(", ") : "no data")) + "'>" +
      "<circle cx='100' cy='100' r='" + R + "' fill='none' stroke='" + C.ghost + "' stroke-width='30'/>";
    if (total) slices.forEach(function (x, i) {
      if (!x.value) return;
      var len = CIRC * x.value / total, gap = live > 1 ? 2 : 0, attr = x.drill !== undefined ? " data-bd-slice='" + x.drill + "' tabindex='0' role='button' class='bd-slice'" : "";
      s += "<circle" + attr + " cx='100' cy='100' r='" + R + "' fill='none' stroke='" + col(x.color) + "' stroke-width='30' stroke-dasharray='" + Math.max(0, len - gap).toFixed(2) + " " + (CIRC - Math.max(0, len - gap)).toFixed(2) + "' stroke-dashoffset='" + (-acc).toFixed(2) + "' transform='rotate(-90 100 100)'><title>" + U.esc(x.label + ": " + x.value) + "</title></circle>";
      acc += len;
    });
    s += "<text class='bd-dbig' x='100' y='" + (centre ? 104 : 106) + "' text-anchor='middle'>" + (centre ? U.esc(centre.big) : "–") + "</text>" + "<text class='bd-dsmall' x='100' y='124' text-anchor='middle'>" + (centre ? U.esc(centre.small) : "no data") + "</text></svg>";
    return s;
  }
  function legend(slices) {
    var total = slices.reduce(function (s, x) { return s + x.value; }, 0);
    return "<ul class='bd-legend'>" + slices.map(function (x) {
      var inner = "<i style='background:" + col(x.color) + "'></i><span class='bd-lname'>" + U.esc(x.label) + "</span><b>" + x.value + "</b><span class='bd-lpct'>" + (total ? Math.round(100 * x.value / total) + "%" : "–") + "</span>";
      return "<li>" + (x.drill !== undefined ? "<button type='button' data-bd-slice='" + x.drill + "'>" + inner + "</button>" : "<div>" + inner + "</div>") + "</li>";
    }).join("") + "</ul>";
  }
  var api = { svg: svg, legend: legend };
  if (typeof module === "object" && module.exports) module.exports = api; else root.cmBoardDonut = api;
})(typeof window !== "undefined" ? window : globalThis);
