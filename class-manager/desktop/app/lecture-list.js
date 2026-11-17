/* Class Manager: the lectures on Course and Content, as cards. Built from cmApp.lectureOverview (lecture-files/build.js).
   Each card: "Lecture N: topic", a description (the course's own, the lecturer's, or one drafted from the notes with its source named),
   one chip per role (Slides, Handout, Tutorial, Supplement, Reference) with CM's confidence, the quiz bank, the documents behind "Files",
   and the files CM ignored with a way to add one back. A chip opens the document (app/lecture-viewer.js). */
(function () {
  "use strict";
  var host = document.getElementById("lec-list");
  if (!host || !window.cmApp || !cmApp.lectureOverview) return;
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  var KINDS = ["slides", "handout", "tutorial", "supplement", "reference"];
  var NAMES = { slides: "Slides", handout: "Handout", tutorial: "Tutorial", supplement: "Supplement", reference: "Reference" };
  var data = null;
  var base = function (rel) { return String(rel).split(/[\\/]/).pop(); };

  function chips(r) {
    var h = KINDS.map(function (k) {
      var c = r.chips && r.chips[k];
      if (!c) return "<button type='button' class='lc-chip lc-none' data-add='" + k + "' data-n='" + r.number + "'>+ " + NAMES[k] + "</button>";
      return "<button type='button' class='lc-chip' data-open='" + k + "' data-n='" + r.number + "' title='" + esc(c.name) + "'>" + NAMES[k] +
        (c.source === "auto" ? " <small class='lc-conf lc-" + c.level + "'>" + Math.round(c.confidence * 100) + "%</small>" : "") + "</button>";
    }).join("");
    h += r.bank ? "<span class='lc-chip lc-bank'>Quiz bank" + (r.questions ? ": " + r.questions + " questions" : "") + "</span>" : "<span class='lc-chip lc-none'>No quiz bank</span>";
    return h;
  }
  function description(r) {
    var d = r.description, n = r.number;
    var edit = "<button type='button' class='lc-link' data-edit='" + n + "'>Edit</button>";
    if (!d) return "<p class='lc-d note'>No description yet. " + edit + "</p>";
    var src = d.source === "drafted" ? "<span class='note'> Drafted from " + esc(d.from) + ". </span><button type='button' class='lc-link' data-keep='" + n + "'>Keep</button> " : "";
    return "<p class='lc-d'>" + esc(d.text) + "</p><p class='lc-src'>" + src + edit + "</p>";
  }
  function ignored(r) {
    if (!r.ignored || !r.ignored.length) return "";
    var items = r.ignored.map(function (x) {
      var can = /\.(pdf|docx)$/i.test(x.rel);
      var add = can ? " <select data-addkind='" + esc(x.rel) + "'>" + KINDS.map(function (k) { return "<option value='" + k + "'" + (k === x.guess ? " selected" : "") + ">" + NAMES[k] + "</option>"; }).join("") + "</select> <button type='button' class='lc-link' data-addback='" + esc(x.rel) + "' data-n='" + r.number + "'>Add back</button>" : "";
      return "<li>" + esc(base(x.rel)) + " <span class='note'>(" + esc(label(x.reason)) + ")</span>" + add + "</li>";
    }).join("");
    return "<details class='lc-files lc-ign'><summary>Ignored (" + r.ignored.length + ")</summary><ul>" + items + "</ul></details>";
  }
  function label(reason) { var g = (data.ignored.groups || []).filter(function (x) { return x.reason === reason; })[0]; return g ? g.label : reason; }
  function card(r) {
    var head = r.title ? esc(r.label) + ": " + esc(r.title) : esc(r.label);
    var files = r.documents.map(function (d) { return "<li>" + esc(d.name) + " <span class='note'>" + NAMES[d.kind] + "</span></li>"; }).join("");
    return "<article class='lc' data-n='" + r.number + "'><h4>" + head + "</h4>" + description(r) +
      "<div class='lc-chips'>" + chips(r) + "</div>" +
      (r.fileCount ? "<details class='lc-files'><summary>Files (" + r.fileCount + ")</summary><ul>" + files + "</ul></details>" : "<p class='note lc-nf'>No lecture documents yet.</p>") +
      ignored(r) + "</article>";
  }
  function summary(o) {
    if (!o.ignored.total) return "";
    var g = o.ignored.groups.map(function (x) { return x.label + ": " + x.count; }).join("; ");
    return "<p class='note lc-ignsum'>Ignored, not lecture documents: " + esc(g) + ". Open a card's Ignored list to add a file back.</p>";
  }
  function draw(o) {
    data = o;
    if (!o || !o.ok || !o.rows.length) { host.hidden = !o || !o.ok; host.innerHTML = o && o.ok ? "<h3>Lectures</h3><p class='note'>No lectures found yet. Load a course folder, or add lectures under Course settings.</p>" + summary(o) : ""; return; }
    host.hidden = false;
    var bad = o.rows.filter(function (r) { return r.status !== "Complete"; }).length;
    host.innerHTML = "<h3>Lectures (" + o.rows.length + ")</h3><p class='note'>" + (o.gaps.length ? "Nothing was found for lecture " + o.gaps.join(", ") + ". " : "") + (bad ? bad + " without all files or a quiz bank." : "Every lecture has files and a quiz bank.") + "</p>" + summary(o) + "<div class='lc-grid'>" + o.rows.map(card).join("") + "</div>";
  }
  function row(n) { return data && data.rows.filter(function (r) { return r.number === Number(n); })[0]; }
  function load() { return cmApp.lectureOverview().then(draw, function () {}); }

  host.addEventListener("click", function (e) {
    var t = e.target.closest("button"); if (!t) return;
    var n = t.getAttribute("data-n") || (t.closest(".lc") && t.closest(".lc").getAttribute("data-n"));
    if (t.hasAttribute("data-open") && window.cmLectureViewer) return cmLectureViewer.open(row(n), t.getAttribute("data-open"), KINDS.reduce(function (m, k) { m[k] = NAMES[k]; return m; }, {}));
    if (t.hasAttribute("data-add") && window.cmLectureViewer) return cmLectureViewer.add(row(n), t.getAttribute("data-add"));
    if (t.hasAttribute("data-addback")) {
      var rel = t.getAttribute("data-addback"), sel = t.parentNode.querySelector("select");
      return cmApp.lectureFileChoose(Number(n), sel.value, rel).then(function (r) { if (r && !r.ok) alert(r.why); load(); });
    }
    if (t.hasAttribute("data-edit")) {
      var r = row(t.getAttribute("data-edit")), p = t.closest(".lc").querySelector(".lc-d, .lc-src");
      var box = document.createElement("div");
      box.innerHTML = "<textarea rows='3' style='width:100%'>" + esc(r.description ? r.description.text : "") + "</textarea><p><button type='button' class='lc-link' data-save='" + r.number + "'>Save</button> <button type='button' class='lc-link' data-cancel='1'>Cancel</button></p>";
      t.closest(".lc").insertBefore(box, t.closest(".lc").querySelector(".lc-chips")); box.className = "lc-edit";
      Array.prototype.forEach.call(t.closest(".lc").querySelectorAll(".lc-d,.lc-src"), function (x) { x.hidden = true; });
      return;
    }
    if (t.hasAttribute("data-cancel")) return load().then(function () {});
    if (t.hasAttribute("data-save")) return cmApp.lectureDescription(Number(t.getAttribute("data-save")), t.closest(".lc-edit").querySelector("textarea").value).then(load);
    if (t.hasAttribute("data-keep")) { var k = row(t.getAttribute("data-keep")); return cmApp.lectureDescription(k.number, k.description.text).then(load); }
  });
  document.addEventListener("cm:lectures-changed", load);
  load();
  var nav = document.querySelector("button.nav[data-view='course']"); if (nav) nav.addEventListener("click", load);
})();
