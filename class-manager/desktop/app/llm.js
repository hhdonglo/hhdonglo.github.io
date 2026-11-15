/* CM Settings > "Use this course with an AI assistant": preview, save, and look up a pseudonym.
   Talks to CM only through cmApp.llm* (preload.js); the rules are in ../llm/. */
(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };
  if (!$("llm") || !window.cmApp) return;
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function choices() { return { includeNames: $("llm-names").checked, realIds: $("llm-ids").checked }; }
  $("llm-preview").addEventListener("click", function () {
    cmApp.llmPreview(choices()).then(function (p) {
      if (!p.ok) { $("llm-view").textContent = p.why; return; }
      var names = p.privacy.names === "included", ids = p.privacy.studentIds === "real";
      $("llm-view").innerHTML = "<p><b>" + p.students + " students.</b> IDs: " + (ids ? "real" : "pseudonyms") + ". Names: " + (names ? "included" : "removed") + ".</p>" +
        (p.tables.length ? "<ul>" + p.tables.map(function (t) {
          return "<li><b>" + esc(t.name) + "</b>, " + t.rows + " rows. Columns: " + esc(t.columns.join(", ")) + (t.sample.length ? "<br>Example row: " + esc(t.sample[0].join(" | ")) : "") + "</li>";
        }).join("") + "</ul>" : "<p>This course has no records yet.</p>");
    });
  });
  $("llm-save").addEventListener("click", function () {
    cmApp.llmSave(choices()).then(function (r) {
      if (!r) return;
      $("llm-view").textContent = r.ok ? "Saved to " + r.folder + ": " + r.files.join(", ") + "." : "Not saved: " + r.why;
    });
  });
  $("llm-find").addEventListener("click", function () {
    cmApp.llmLookup($("llm-who").value).then(function (r) { $("llm-found").textContent = r.ok ? r.id + (r.name ? " (" + r.name + ")" : "") : r.why; });
  });
})();
