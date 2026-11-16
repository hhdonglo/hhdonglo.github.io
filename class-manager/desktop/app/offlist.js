/* Class Manager: the "IDs not on the class list" notice on Grades and Results.
   Shows how many IDs without a place on the class list have rows in the tables (left by an older import or quiz), lists them, and sets them aside only when the
   lecturer presses the button. Also lists the IDs flagged by imports, with the file each came from. The calls are in offlist.js. */
(function () {
  "use strict";
  var host = document.getElementById("r-msg"); if (!host || !window.cmApp || !cmApp.offListScan) return;
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  var box = document.createElement("div"); box.id = "offlist"; host.parentNode.insertBefore(box, host.nextSibling);
  function show() {
    cmApp.offListScan().then(function (r) {
      if (!r || !r.ok || (!r.rows.length && !(r.flagged || []).length)) { box.innerHTML = ""; return; }
      var html = "";
      if (r.rows.length) {
        html += "<details open class='card' style='margin:.6rem 0;padding:.6rem .9rem'><summary class='msg'><strong>" + r.rows.length + "</strong> ID(s) in these tables are not on the class list (" + r.blank + " with no records, " + r.withRecords + " with records).</summary>" +
          "<p class='note'>The class list alone decides who has a row. These are listed so you can check them. Setting them aside moves their rows to a kept list (tab Offlist_Rows_Kept); nothing is deleted and Restore puts them back.</p>" +
          "<p class='note' style='word-break:break-word'>" + r.rows.slice(0, 200).map(function (x) { return esc(x.id) + (x.blank ? "" : " (has records)"); }).join(", ") + (r.rows.length > 200 ? " and " + (r.rows.length - 200) + " more" : "") + "</p>" +
          "<p class='row'><button class='btn' type='button' id='ol-blank'>Set aside the " + r.blank + " with no records</button><button class='btn' type='button' id='ol-all'>Set aside all " + r.rows.length + "</button><button class='btn' type='button' id='ol-restore'>Restore set-aside rows</button></p></details>";
      }
      if ((r.flagged || []).length) {
        html += "<details class='card' style='margin:.6rem 0;padding:.6rem .9rem'><summary class='note'>IDs flagged by imports (" + r.flagged.length + "): not on the class list, never added</summary><ul class='note'>" +
          r.flagged.slice(-200).map(function (x) { return "<li>" + esc(x.id) + ": " + esc(x.why) + ", from " + esc(x.file) + " (" + esc(String(x.when).slice(0, 10)) + ")</li>"; }).join("") + "</ul></details>";
      }
      box.innerHTML = html;
      function go(ids, msg) { if (!confirm(msg)) return; cmApp.offListSetAside(ids).then(function (x) { if (x && x.ok) location.reload(); else alert(x && x.why || "Nothing was changed."); }); }
      var b = box.querySelector("#ol-blank"), a = box.querySelector("#ol-all"), rs = box.querySelector("#ol-restore");
      if (b) b.onclick = function () { go(r.rows.filter(function (x) { return x.blank; }).map(function (x) { return x.id; }), "Set aside " + r.blank + " rows that hold no records? They can be restored."); };
      if (a) a.onclick = function () { go(r.rows.map(function (x) { return x.id; }), "Set aside all " + r.rows.length + " IDs, including " + r.withRecords + " that hold records? They can be restored."); };
      if (rs) rs.onclick = function () { cmApp.offListRestore().then(function (x) { if (x && x.ok) location.reload(); else alert(x && x.why || "Nothing to restore."); }); };
    });
  }
  show(); window.addEventListener("cm:stamp", show);
})();
