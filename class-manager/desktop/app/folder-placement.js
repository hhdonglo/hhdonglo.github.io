/* Class Manager: the "What was found and where it goes" table at the top of the folder preview (Load student records).
   One row for each file: its kind, and the place in CM each part of it goes to. The rows are worked out by desktop/autoload/placement.js;
   this file only draws them. */
(function (root) {
  "use strict";
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  function html(p, chosen) {
    if (!p || !p.rows || !p.rows.length) return "";
    var on = {}; (chosen || []).forEach(function (i) { on[i] = true; });
    var rows = p.rows.filter(function (r) { return !r.skipped; }).map(function (r) {
      var dest = r.destinations.map(function (d) { return "<li>" + esc(d.what) + " → " + esc(d.where) + "</li>"; }).join("");
      return "<tr><td><strong>" + esc(r.rel) + "</strong>" + (on[r.id] ? "" : "<br><span class='note'>not loaded</span>") + "</td><td>" + esc(r.type) + "</td><td><ul class='note' style='margin:0;padding-left:1.1rem'>" + dest + "</ul></td></tr>";
    }).join("");
    var skipped = p.rows.filter(function (r) { return r.skipped; });
    return "<section class='card' aria-labelledby='fp-h'><h3 id='fp-h'>What was found and where it goes</h3>" +
      "<div class='tbl' style='height:auto;max-height:18rem'><table><thead><tr><th>File</th><th>What it is</th><th>Where it goes</th></tr></thead><tbody>" + rows + "</tbody></table></div>" +
      (skipped.length ? "<details><summary class='note'>" + skipped.length + " file(s) skipped</summary><ul class='note'>" + skipped.map(function (r) { return "<li>" + esc(r.rel) + ": " + esc(r.note) + "</li>"; }).join("") + "</ul></details>" : "") + "</section>";
  }
  root.cmFolderPlacement = { html: html };
})(window);
