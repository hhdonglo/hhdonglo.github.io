/* Class Manager charts: objective heat map.
   Question answered: which students are weak on which objectives, and which objectives are weak across the class?
   Rows are students (weakest overall first), columns are objectives. Each cell shows the student's current percentage on that objective,
   coloured by level, so colour is never the only signal. A dot means not enough evidence: fewer answers than the minimum is never shown
   as a low score. A row opens the student's record. Input: `students` and `outcomes` of learningProgress_. */
(function (root) {
  "use strict";
  var C = typeof module === "object" && module.exports ? require("./core") : root.cmCharts;
  var MAX_COLUMNS = 24;
  function build(students, outcomes, opt) {
    opt = opt || {};
    var cols = (outcomes || []).filter(function (o) { return o.students > 0; }).slice(0, opt.maxColumns || MAX_COLUMNS);
    var rows = (students || []).map(function (s) {
      var by = {}; (s.outcomes || []).forEach(function (o) { by[o.key] = o; });
      var known = cols.map(function (c) { return by[c.key]; }).filter(function (o) { return o && o.level !== "Not enough evidence" && o.current !== null; });
      var mean = known.length ? known.reduce(function (a, o) { return a + o.current; }, 0) / known.length : null;
      return { id: s.id, name: s.name || s.id, by: by, mean: mean, known: known.length };
    }).filter(function (r) { return Object.keys(r.by).length; });
    rows.sort(function (a, b) { return (a.mean === null ? 999 : a.mean) - (b.mean === null ? 999 : b.mean); });
    return { cols: cols, rows: rows };
  }
  function heatmap(students, outcomes, opt) {
    var m = build(students, outcomes, opt);
    if (!m.cols.length || !m.rows.length) return C.empty("Not enough evidence yet. The map appears once students have answered questions.");
    var h = "<div class='hm-wrap'><table class='hm'><caption class='sr'>Current percentage correct by student and objective</caption><thead><tr><th scope='col' class='hm-corner'>Student</th>" +
      m.cols.map(function (c) { return "<th scope='col' title='" + C.esc(C.short(c.label)) + "'><span>" + C.esc(C.short(c.label)) + "</span></th>"; }).join("") + "</tr></thead><tbody>" +
      m.rows.map(function (r) {
        return "<tr tabindex='0' data-id='" + C.esc(r.id) + "'><th scope='row'>" + C.esc(r.name) + "</th>" + m.cols.map(function (c) {
          var o = r.by[c.key]; if (!o) return "<td class='g-none hm-na' title='No answers'>·</td>";
          var enough = o.level !== "Not enough evidence" && o.current !== null;
          return "<td class='" + C.LEVEL_CLASS[o.level] + (enough ? "" : " hm-na") + "' title='" + C.esc(C.short(c.label) + ": " + (enough ? Math.round(o.current) + "% (" + o.level + ")" : "not enough evidence") + ", " + o.answers + " answers") + "'>" + (enough ? Math.round(o.current) : "·") + "</td>";
        }).join("") + "</tr>";
      }).join("") + "</tbody></table></div>" + C.legend() +
      "<p class='note'>" + m.rows.length + " students, " + m.cols.length + " objectives. Each cell is the percentage correct in the student's latest answers; a dot means fewer answers than needed to judge." +
      ((outcomes || []).filter(function (o) { return o.students > 0; }).length > m.cols.length ? " Only the first " + m.cols.length + " objectives are shown." : "") + "</p>";
    return h;
  }
  var api = { heatmap: heatmap, build: build };
  if (typeof module === "object" && module.exports) module.exports = api; else root.cmCharts = Object.assign(root.cmCharts || {}, api);
})(typeof window !== "undefined" ? window : globalThis);
