/* Class Manager: the lecture view. Clicking a lecture card on Course and Content opens it: the description, whether the lecture is held or due,
   the quiz bank, every document by role (slides, handout, tutorial, supplement, reference) and the button that starts presentation mode.
   A document opens in the existing document panel (app/lecture-viewer.js), which keeps Update, Replace, Delete and "Wrong file?".
   Opened by app/lecture-list.js: cmLectureView.open(row). The rules are in state.js; the presentation is in present.js. */
(function () {
  "use strict";
  var S = window.cmLectureState;
  if (!S || !window.cmApp || !cmApp.lectureOverview) return;
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  var KINDS = ["slides", "handout", "tutorial", "supplement", "reference"];
  var NAMES = { slides: "Slides", handout: "Handout", tutorial: "Tutorial", supplement: "Supplement", reference: "Reference" };
  var dlg = document.createElement("dialog"); dlg.className = "lw"; dlg.setAttribute("aria-label", "Lecture"); document.body.appendChild(dlg);
  var state = { n: null, row: null, progress: null };

  function presentBlock(r) {
    var kind = S.slidesKind(r.chips.slides);
    if (kind === "pdf") return "<div class='lw-present'><p><strong>Presentation mode.</strong> Shows " + esc(r.chips.slides.name) + " full screen, one slide at a time. Arrow keys change slide, Esc exits.</p><button type='button' class='lw-go' data-lw='present'>Present</button></div>";
    if (kind === "other") return "<div class='lw-present'><p><strong>Presentation mode needs slides as a PDF.</strong> The slides for this lecture are a Word file (" + esc(r.chips.slides.name) + "), which cannot be shown slide by slide. Attach a PDF to present it.</p><button type='button' class='lw-go' data-lw='attach'>Attach slides</button></div>";
    return "<div class='lw-present'><p><strong>This lecture has no slides.</strong> Attach a PDF to present it in class.</p><button type='button' class='lw-go' data-lw='attach'>Attach slides</button></div>";
  }
  function files(r) {
    return "<table><thead><tr><th>Document</th><th>File</th><th></th></tr></thead><tbody>" + KINDS.map(function (k) {
      var c = r.chips[k];
      if (!c) return "<tr class='lw-none'><td>" + NAMES[k] + "</td><td>None</td><td><button type='button' class='lc-link' data-lw='attach' data-kind='" + k + "'>Attach</button></td></tr>";
      return "<tr><td>" + NAMES[k] + "</td><td class='lw-file'>" + esc(c.name) + (c.source === "auto" ? " <small class='lc-conf lc-" + c.level + "'>" + Math.round(c.confidence * 100) + "%</small>" : "") +
        "</td><td><button type='button' class='lc-link' data-lw='open' data-kind='" + k + "'>Open</button></td></tr>";
    }).join("") + "</tbody></table>";
  }
  function pills(r) {
    var st = S.lectureState(r.number, state.progress), h = "";
    if (st) h += "<span class='lw-pill lw-" + st.key + "'>" + esc(st.label) + "</span>";
    h += "<span class='lw-pill'>" + (r.bank ? "Quiz bank" + (r.questions ? ": " + r.questions + " questions" : "") : "No quiz bank") + "</span>";
    h += "<span class='lw-pill'>" + r.fileCount + (r.fileCount === 1 ? " document" : " documents") + "</span>";
    return "<div class='lw-pills'>" + h + "</div>";
  }
  function draw() {
    var r = state.row;
    dlg.innerHTML = "<header><div><h3>" + esc(r.label) + (r.title ? ": " + esc(r.title) : "") + "</h3></div><button type='button' data-lw='close'>Close</button></header>" +
      pills(r) + (r.description ? "<p>" + esc(r.description.text) + "</p>" : "<p class='note'>No description yet. Add one with Edit on the lecture card.</p>") +
      presentBlock(r) + "<h4>Documents</h4>" + files(r);
  }
  function load() {
    var p = cmApp.lectureProgress ? cmApp.lectureProgress().then(function (x) { return x && x.ok ? x.progress : null; }, function () { return null; }) : Promise.resolve(null);
    return Promise.all([cmApp.lectureOverview(), p]).then(function (a) {
      var o = a[0]; state.progress = a[1];
      var r = o && o.ok ? o.rows.filter(function (x) { return x.number === state.n; })[0] : null;
      if (!r) { if (dlg.open) dlg.close(); return; }
      state.row = r; draw();
    });
  }
  function open(row) {
    if (!row) return;
    state.n = row.number; state.row = row; state.progress = null; draw();
    if (!dlg.open) dlg.showModal();
    load();
  }

  dlg.addEventListener("click", function (e) {
    var t = e.target.closest("[data-lw]"); if (!t || !state.row) return;
    var a = t.getAttribute("data-lw"), kind = t.getAttribute("data-kind") || "slides";
    if (a === "close") return dlg.close();
    if (a === "present") { state.presenting = true; return cmLecturePresent.start(state.row); }
    if (a === "open" && window.cmLectureViewer) return cmLectureViewer.open(state.row, kind);
    if (a === "attach" && window.cmLectureViewer) return cmLectureViewer.add(state.row, kind);
  });
  document.addEventListener("cm:lectures-changed", function () { if (dlg.open) load(); });
  document.addEventListener("cm:present-ended", function () { if (state.presenting && !dlg.open) { state.presenting = false; dlg.showModal(); load(); } }); // back to the lecture after teaching
  window.cmLectureView = { open: open };
})();
