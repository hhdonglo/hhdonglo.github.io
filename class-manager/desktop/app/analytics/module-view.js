(function (root) {
  "use strict";
  var esc = (root.cmBoardUtil || require("../board/util")).esc;
  function has(d, key) { return !d.analytics || !!d.analytics.available[key]; }

  function measurements(d) {
    if (!d.analytics) return "";
    var metrics = d.analytics.metrics;
    return "<section class='card acard'><h3>Workspace health measures</h3>" +
      (metrics.length ? "<dl class='stats'>" + metrics.map(function (m) {
        var sample = m.numerator == null ? "n = " + m.sample : m.numerator + " of " + m.sample;
        return "<div><dt>" + esc(m.label) + "</dt><dd><b>" + m.value + (m.percent ? "%" : "") +
          "</b><br><span class='note'>" + esc(sample + " " + m.unit + " · " + m.evidence) +
          "<br>" + esc(m.window) + "<br>" + esc(m.denominator) +
          (m.detail ? "<br>" + esc(m.detail) : "") + "</span></dd></div>";
      }).join("") + "</dl>" : "<p class='note'>No course measures have enough data yet.</p>") + "</section>";
  }

  function suggestions(d) {
    if (!d.analytics) return "";
    var support = d.analytics.suggestions.support, revisit = d.analytics.suggestions.revisit;
    return (support ? "<section class='card acard'><h3>Offer a check-in or tutorial</h3><p>" +
      "High recorded participation coincided with low scores for these students. Consider inviting them to a voluntary tutorial or asking which material they would like to review.</p>" +
      "<p class='note'>n = " + support.sample + " students · " + esc(support.evidence) + ". Observational association.</p>" +
      "<details><summary>Students to review</summary><ul>" + support.students.map(function (s) {
        return "<li>" + esc(s.name || s.id) + "</li>";
      }).join("") + "</ul></details></section>" : "") +
      (revisit ? "<section class='card acard'><h3>Revisit before the next class</h3><p>Consider sharing a worked example for " +
        esc(revisit.title) + " before the next class, then check understanding with a similar question.</p><p class='note'>" +
        revisit.value + "% correct · n = " + revisit.sample + " recorded answers · " + esc(revisit.evidence) + ".</p></section>" : "");
  }

  var api = { has: has, measurements: measurements, suggestions: suggestions };
  if (typeof module === "object" && module.exports) module.exports = api; else root.cmModuleAnalytics = api;
})(typeof window !== "undefined" ? window : globalThis);
