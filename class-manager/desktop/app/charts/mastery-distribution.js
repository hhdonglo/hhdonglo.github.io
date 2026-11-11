/* Class Manager charts: mastery distribution.
   Question answered: on which objectives have many students not yet shown understanding?
   One 100% stacked horizontal bar per objective (Secure, Developing, Beginning, Not enough evidence), with the number of students in each
   part written on the bar and the total beside it. Input: the `outcomes` list of learningProgress_ ({key, label, linked, students, levels}). */
(function (root) {
  "use strict";
  var C = typeof module === "object" && module.exports ? require("./core") : root.cmCharts;
  function rows(outcomes) {
    return outcomes.map(function (o) {
      var total = C.LEVELS.reduce(function (a, k) { return a + ((o.levels || {})[k] || 0); }, 0);
      return { key: o.key, label: C.short(o.label), linked: !!o.linked, total: total, parts: C.LEVELS.map(function (k) { var n = (o.levels || {})[k] || 0; return { level: k, n: n, share: C.pct(n, total) }; }) };
    }).filter(function (r) { return r.total > 0; });
  }
  function masteryDistribution(outcomes) {
    var rs = rows(outcomes || []);
    if (!rs.length) return C.empty("Not enough evidence yet. Levels appear once students have answered questions on an objective or lecture.");
    var h = "<div class='md' role='list'>" + rs.map(function (r) {
      var aria = r.label + ": " + r.parts.map(function (p) { return p.n + " " + p.level; }).join(", ") + " (" + r.total + " students)";
      return "<div class='md-row' role='listitem'><span class='md-label'>" + C.esc(r.label) + "</span>" +
        "<div class='md-bar' role='img' aria-label='" + C.esc(aria) + "'>" + r.parts.map(function (p) {
          return p.n ? "<span class='" + C.LEVEL_CLASS[p.level] + "' style='flex:" + p.n + "' title='" + C.esc(p.level + ": " + p.n + " of " + r.total + " (" + p.share + "%)") + "'>" + (p.share >= 12 ? p.n : "") + "</span>" : "";
        }).join("") + "</div><span class='md-n note'>" + r.total + " students</span></div>";
    }).join("") + "</div>" + C.legend() + (rs.some(function (r) { return !r.linked; }) ? "<p class='note'>Rows that are lectures have no questions linked to an objective yet, so they show the whole lecture.</p>" : "");
    h += C.asTable("Students at each level, by objective", ["Objective"].concat(C.LEVELS, ["Students"]),
      rs.map(function (r) { return [r.label].concat(r.parts.map(function (p) { return p.n + " (" + p.share + "%)"; }), [r.total]); }));
    return h;
  }
  var api = { masteryDistribution: masteryDistribution, rows: rows };
  if (typeof module === "object" && module.exports) module.exports = api; else root.cmCharts = Object.assign(root.cmCharts || {}, api);
})(typeof window !== "undefined" ? window : globalThis);
