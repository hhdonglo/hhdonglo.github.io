/* Class Manager: the lecture list on Course and Content. "Lecture 1" to the last lecture, each with its title, files, quiz bank and a plain status.
   Built from cmApp.lectureOverview (lecture-progress/overview.js): the lecturer sees the lectures, not raw file names. */
(function () {
  "use strict";
  var host = document.getElementById("lec-list");
  if (!host || !window.cmApp || !cmApp.lectureOverview) return;
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  var OK = { Complete: "lp-ontrack", "No quiz bank": "lp-behind", "No files": "lp-behind", "Nothing found": "lp-behind" };

  function row(r) {
    var files = r.files.slice(0, 6).map(function (f) { return esc(f.split(/[\\/]/).pop()); }).join(", ") + (r.files.length > 6 ? " and " + (r.files.length - 6) + " more" : "");
    return "<li class='ll-row'><div class='ll-h'><strong>" + esc(r.label) + "</strong>" + (r.title ? " <span class='note'>" + esc(r.title) + "</span>" : "") +
      " <span class='tag " + (OK[r.status] || "") + "'>" + esc(r.status) + "</span></div>" +
      "<div class='note'>" + (r.fileCount ? r.fileCount + (r.fileCount === 1 ? " file: " : " files: ") + files : "No files") + ". Quiz bank: " + (r.bank ? "yes" : "none") + ".</div></li>";
  }
  function draw(o) {
    if (!o || !o.ok || !o.rows.length) { host.hidden = !o || !o.ok; host.innerHTML = o && o.ok ? "<h3>Lectures</h3><p class='note'>No lectures found yet. Load a course folder, or add lectures under Course settings.</p>" : ""; return; }
    host.hidden = false;
    var bad = o.rows.filter(function (r) { return r.status !== "Complete"; }).length;
    host.innerHTML = "<h3>Lectures (" + o.rows.length + ")</h3><p class='note'>Lecture 1 to Lecture " + o.last + ", found from the names of the files and folders and from the course's lecture list." +
      (o.gaps.length ? " Nothing was found for lecture " + o.gaps.join(", ") + "." : "") + (bad ? " " + bad + " need attention." : "") + "</p><ul class='ll'>" + o.rows.map(row).join("") + "</ul>";
  }
  function load() { cmApp.lectureOverview().then(draw, function () {}); }
  load();
  var nav = document.querySelector("button.nav[data-view='course']"); if (nav) nav.addEventListener("click", load);
})();
