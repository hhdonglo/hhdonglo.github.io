/* Class Manager: the lectures on Course and Content, as cards.
   Each card: "Lecture N: topic", one or two sentences on what it covers (the course's own summary, never invented), chips for slides, handout,
   tutorial, supplement and the quiz bank, and the files behind a "Files" control. Built from cmApp.lectureOverview (lecture-progress/overview.js). */
(function () {
  "use strict";
  var host = document.getElementById("lec-list");
  if (!host || !window.cmApp || !cmApp.lectureOverview) return;
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  var NAMES = { slides: "Slides", handout: "Handout", tutorial: "Tutorial", supplement: "Supplement", reference: "Reference" };

  function chips(r) {
    var h = Object.keys(NAMES).filter(function (k) { return r.chips && r.chips[k]; }).map(function (k) { return "<span class='lc-chip'>" + NAMES[k] + "</span>"; }).join("");
    h += r.bank ? "<span class='lc-chip lc-bank'>Quiz bank" + (r.questions ? ": " + r.questions + " questions" : "") + "</span>" : "<span class='lc-chip lc-none'>No quiz bank</span>";
    return h;
  }
  function card(r) {
    var head = r.title ? esc(r.label) + ": " + esc(r.title) : esc(r.label);
    var files = r.files.map(function (f) { return "<li>" + esc(f.split(/[\\/]/).pop()) + "</li>"; }).join("");
    return "<article class='lc'><h4>" + head + "</h4>" +
      (r.description ? "<p class='lc-d'>" + esc(r.description) + "</p>" : "<p class='lc-d note'>No description yet. Add one in Course settings.</p>") +
      "<div class='lc-chips'>" + chips(r) + "</div>" +
      (r.fileCount ? "<details class='lc-files'><summary>Files (" + r.fileCount + ")</summary><ul>" + files + "</ul></details>" : "<p class='note lc-nf'>No files found.</p>") + "</article>";
  }
  function draw(o) {
    if (!o || !o.ok || !o.rows.length) { host.hidden = !o || !o.ok; host.innerHTML = o && o.ok ? "<h3>Lectures</h3><p class='note'>No lectures found yet. Load a course folder, or add lectures under Course settings.</p>" : ""; return; }
    host.hidden = false;
    var bad = o.rows.filter(function (r) { return r.status !== "Complete"; }).length;
    host.innerHTML = "<h3>Lectures (" + o.rows.length + ")</h3><p class='note'>" + (o.gaps.length ? "Nothing was found for lecture " + o.gaps.join(", ") + ". " : "") + (bad ? bad + " without all files or a quiz bank." : "Every lecture has files and a quiz bank.") + "</p><div class='lc-grid'>" + o.rows.map(card).join("") + "</div>";
  }
  function load() { cmApp.lectureOverview().then(draw, function () {}); }
  load();
  var nav = document.querySelector("button.nav[data-view='course']"); if (nav) nav.addEventListener("click", load);
})();
