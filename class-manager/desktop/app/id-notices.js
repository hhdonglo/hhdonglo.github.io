/* Class Manager: the Duplicate IDs card on the Class Roster screen.
   Lists each ID that appeared on more than one row, with both source rows exactly as they were and the names they gave,
   and lets the lecturer pick the right name (or keep the current one). The ID is the key; CM already merged the rows,
   so this screen only records which name is right. Everything is worked out by CM (db/id-guard.js, db/notices.js). */
(function () {
  "use strict";
  var host = document.getElementById("id-notices");
  if (!host || !window.cmApp || !cmApp.idNotices) return;
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  function cells(e) { return (e.cells || []).filter(function (c) { return c !== "" && c != null; }).map(String).join(" | "); }

  function noticeHtml(n, i) {
    var names = n.names || [];
    var rows = (n.entries || []).map(function (e) {
      return "<li>Row " + esc(e.row) + ": <code>" + esc(e.rawId) + "</code>" + (e.name ? ", " + esc(e.name) : "") + "<br><span class='note'>" + esc(cells(e)) + "</span></li>";
    }).join("");
    var picks = names.length > 1 ? names.map(function (nm, k) {
      return "<button class='btn sm' type='button' data-pick='" + i + "' data-name='" + esc(nm) + "'>Use " + esc(nm) + "</button>";
    }).join(" ") : "";
    return "<li class='dupn'><strong>" + esc(n.id) + "</strong> (" + esc(n.tab) + ")" +
      (n.namesDiffer ? " <span class='tag'>different names</span>" : "") +
      (n.conflicts ? " <span class='tag'>" + esc(n.conflicts) + " differing value" + (n.conflicts === 1 ? "" : "s") + " kept from the first row</span>" : "") +
      "<ul class='note'>" + rows + "</ul><p class='row'>" + picks + "<button class='btn sm' type='button' data-keep='" + i + "'>" + (names.length > 1 ? "Keep the first name" : "Mark as checked") + "</button></p></li>";
  }

  var shown = [];
  function draw(list) {
    shown = list || [];
    var badge = document.getElementById("id-notices-n"); if (badge) badge.textContent = shown.length ? String(shown.length) : "";
    host.hidden = !shown.length;
    if (!shown.length) { host.innerHTML = ""; return; }
    host.innerHTML = "<h3>Duplicate IDs (" + shown.length + ")</h3>" +
      "<p class='note'>The same student ID was on more than one row. CM kept one row per ID and filled blanks from the other. A different value is never overwritten. Choose the right name, or mark the ID as checked.</p>" +
      "<ul class='dupl' style='list-style:none;padding:0'>" + shown.map(noticeHtml).join("") + "</ul>";
  }
  function load() { return cmApp.idNotices().then(function (r) { draw(r && r.ok ? r.notices : []); }); }

  host.addEventListener("click", function (ev) {
    var b = ev.target.closest && ev.target.closest("button"); if (!b) return;
    var pick = b.getAttribute("data-pick"), keep = b.getAttribute("data-keep"), i = pick != null ? pick : keep;
    if (i == null || !shown[i]) return;
    var n = shown[i], name = pick != null ? b.getAttribute("data-name") : (n.names && n.names[0]) || "";
    b.disabled = true;
    cmApp.idResolve(n.tab, n.id, name).then(load);
  });
  // The card is on the Class Roster screen: refresh whenever that screen opens or the data changes.
  document.addEventListener("click", function (ev) { var v = ev.target.closest && ev.target.closest("[data-view='roster']"); if (v) load(); });
  if (cmApp.onAutoChanged) cmApp.onAutoChanged(load);
  load();
  window.cmIdNotices = { load: load, draw: draw };
})();
