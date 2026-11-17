/* Class Manager: opens a lecture document inside CM (a PDF in a panel, a Word file as text) and offers to choose another file, update,
   replace or delete it. Delete asks first and never erases: it takes the file off the lecture, and may move it to Removed; Undo brings it back.
   Works with app/lecture-list.js (cmLectureViewer.open and .add) and lecture-files/ipc.js. */
(function () {
  "use strict";
  if (!window.cmApp || !cmApp.lectureFileView) return;
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  var NAMES = { slides: "Slides", handout: "Handout", tutorial: "Tutorial", supplement: "Supplement", reference: "Reference" };
  var dlg = document.createElement("dialog"); dlg.className = "lv"; document.body.appendChild(dlg);
  var state = null;
  function changed() { document.dispatchEvent(new Event("cm:lectures-changed")); }
  function close() { dlg.close(); changed(); }
  function bar(msg) { var b = dlg.querySelector(".lv-msg"); if (b) b.innerHTML = msg || ""; }

  function body(r, c) {
    var box = dlg.querySelector(".lv-body");
    return cmApp.lectureFileView(c.rel).then(function (v) {
      if (!v || !v.ok) { box.innerHTML = "<p class='note'>" + esc(v && v.why || "This file cannot be shown.") + "</p>"; return; }
      box.innerHTML = v.type === "pdf" ? "<iframe class='lv-pdf' title='" + esc(c.name) + "' src='" + esc(v.url) + "'></iframe>" : "<pre class='lv-text'>" + esc(v.text) + "</pre>";
    });
  }
  function show(r, kind) {
    var c = r.chips[kind]; state = { r: r, kind: kind };
    if (!c) return add(r, kind);
    var others = r.documents.concat((r.ignored || []).filter(function (x) { return /\.(pdf|docx)$/i.test(x.rel); }).map(function (x) { return { rel: x.rel, name: x.rel.split(/[\\/]/).pop() }; }));
    var conf = c.source === "auto" ? "<p class='lv-why'>CM's guess: <strong class='lc-" + c.level + "'>" + Math.round(c.confidence * 100) + "% " + c.level + "</strong> because " + esc(c.reasons.join("; ")) + ".</p>" : "<p class='lv-why'>" + esc(c.reasons[0]) + ".</p>";
    dlg.innerHTML = "<header><h3>" + esc(r.label) + ": " + NAMES[kind] + "</h3><button type='button' class='lv-x' aria-label='Close'>Close</button></header>" +
      "<p class='lv-name'>" + esc(c.name) + "</p>" + conf +
      "<div class='lv-tools'><label>Wrong file? <select class='lv-pick'>" + others.map(function (o) { return "<option value='" + esc(o.rel) + "'" + (o.rel === c.rel ? " selected" : "") + ">" + esc(o.name) + "</option>"; }).join("") + "</select></label>" +
      (kind === "slides" && window.cmLecturePresent && /\.pdf$/i.test(c.rel) ? "<button type='button' class='lv-present' data-a='present'>Present</button>" : "") + "<button type='button' data-a='update'>Update</button><button type='button' data-a='replace'>Replace</button><button type='button' data-a='delete'>Delete</button></div>" +
      "<div class='lv-msg' role='status'></div><div class='lv-body'></div>";
    if (!dlg.open) dlg.showModal();
    body(r, c);
  }
  function add(r, kind) { // no file for this role: choose one from this computer
    cmApp.lectureFileReplace(r.number, kind).then(function (res) { if (res && !res.ok) alert(res.why); changed(); });
  }
  function refresh(then) { cmApp.lectureOverview().then(function (o) { var r = o.rows.filter(function (x) { return x.number === state.r.number; })[0]; changed(); if (r && r.chips[state.kind]) { state.r = r; show(r, state.kind); if (then) bar(then); } else { close(); } }); }

  dlg.addEventListener("click", function (e) {
    var t = e.target.closest("button"); if (!t || !state) return;
    var r = state.r, kind = state.kind, c = r.chips[kind];
    if (t.classList.contains("lv-x")) return close();
    if (t.hasAttribute("data-undo")) return cmApp.lectureFileUndo().then(function (u) { if (u && !u.ok) return bar(esc(u.why)); changed(); refreshAfterUndo(); });
    var a = t.getAttribute("data-a");
    if (a === "present") return cmLecturePresent.start(r); // asks for full screen inside this click, then closes this panel
    if (a === "update") return cmApp.lectureFileUpdate(c.rel).then(function (u) { bar(u && u.ok ? "Opened in its own program. Save your changes there, then <button type='button' data-a='reread'>Show the updated file</button>." : esc(u && u.why || "Could not open it.")); });
    if (a === "reread") return refresh("Showing the file as it is now.");
    if (a === "replace") return cmApp.lectureFileReplace(r.number, kind).then(function (res) { if (!res) return; if (!res.ok) return bar(esc(res.why)); refresh("Replaced. The old file is still in the folder. <button type='button' data-undo='1'>Undo</button>"); });
    if (a === "delete") return bar("Delete " + NAMES[kind] + " from " + esc(r.label) + "? It is taken off the lecture first. <button type='button' data-a='detach'>Take off the lecture</button> <button type='button' data-a='remove'>Take off and move the file to Removed</button> <button type='button' data-a='cancel'>Cancel</button>");
    if (a === "cancel") return bar("");
    if (a === "detach" || a === "remove") return cmApp.lectureFileDetach(r.number, kind, c.rel, a === "remove").then(function (res) {
      if (!res || !res.ok) return bar(esc(res && res.why || "Could not do that."));
      changed(); dlg.close(); toast((res.note || (res.moved ? "The file was moved to Removed in the course folder." : "Taken off the lecture. The file is still in the folder.")) + " ", true);
    });
  });
  dlg.addEventListener("change", function (e) {
    if (!e.target.classList.contains("lv-pick") || !state) return;
    cmApp.lectureFileChoose(state.r.number, state.kind, e.target.value).then(function (res) { if (res && !res.ok) return bar(esc(res.why)); refresh("Changed. <button type='button' data-undo='1'>Undo</button>"); });
  });
  function refreshAfterUndo() { cmApp.lectureOverview().then(function () { changed(); }); }
  function toast(msg, undo) { // shown on the page after the panel closes
    var t = document.getElementById("lv-toast") || document.body.appendChild(Object.assign(document.createElement("div"), { id: "lv-toast", className: "lv-toast", role: "status" }));
    t.innerHTML = esc(msg) + (undo ? "<button type='button' class='lc-link'>Undo</button>" : ""); t.hidden = false;
    t.onclick = function (e) { if (e.target.tagName === "BUTTON") cmApp.lectureFileUndo().then(function () { t.hidden = true; changed(); }); };
    setTimeout(function () { t.hidden = true; }, 15000);
  }
  window.cmLectureViewer = { open: show, add: add };
})();
