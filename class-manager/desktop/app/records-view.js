/* Class Manager: the rest of a student's history in the Student view: laboratory, assignment, practice and group assessment records
   (by category, in date order) and the lecturer's notes. The figures come from the server script (studentRecords_, through cmApp.studentStats);
   this file only lays them out. Notes are for the lecturer only and are never shown to students. */
(function (root) {
  "use strict";
  var ORDER = ["Laboratory", "Assignment", "Practice", "Group assessment"];
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function score(x) { return x.score === null ? "–" : x.outOf ? x.score + " / " + x.outOf : String(x.score); }

  function html(r) {
    var recs = r.records || [], notes = r.notes || [], h = "";
    ORDER.forEach(function (cat) {
      var rows = recs.filter(function (x) { return x.category === cat; }).sort(function (a, b) { return String(a.date).localeCompare(String(b.date)) || String(a.assessment).localeCompare(String(b.assessment)); });
      if (!rows.length) return;
      h += "<p class='lbl'>" + esc(cat) + "</p><ul class='note rec-list'>" + rows.map(function (x) { return "<li><b>" + esc(x.assessment) + "</b>: " + esc(score(x)) + (x.date ? " <span class='note'>(" + esc(x.date) + (x.lecture ? ", lecture/week " + esc(x.lecture) : "") + ")</span>" : "") + "</li>"; }).join("") + "</ul>";
    });
    h += "<p class='lbl'>Notes</p><div class='rec-notes'>" + (notes.length ? "<ul class='note'>" + notes.map(function (n) { return "<li>" + esc(n.text) + " <span class='note'>(" + esc(String(n.time).slice(0, 10)) + ")</span></li>"; }).join("") + "</ul>" : "<p class='note'>No notes yet.</p>") +
      "<p class='row'><label class='sr' for='rec-note'>Add a note about this student</label><input class='f' id='rec-note' maxlength='1000' placeholder='A note only you can see'> <button class='btn sm' type='button' id='rec-add'>Add note</button> <span class='note' id='rec-msg' role='status'></span></p></div>";
    return h;
  }

  // Connects the add-note button inside rootEl; again() reloads the student after a note is saved.
  function wire(rootEl, id, again) {
    var b = rootEl.querySelector("#rec-add"); if (!b) return;
    b.onclick = function () {
      var t = rootEl.querySelector("#rec-note").value.trim(), m = rootEl.querySelector("#rec-msg"); if (!t) { m.textContent = "Write a note first."; return; }
      b.disabled = true;
      cmApp.studentNote({ id: id, text: t }).then(function (x) { b.disabled = false; if (x && x.ok) again(); else m.textContent = (x && x.why) || "The note was not saved."; }, function (e) { b.disabled = false; m.textContent = "Not saved: " + (e && e.message); });
    };
  }
  root.cmRecords = { html: html, wire: wire };
  if (typeof module === "object" && module.exports) module.exports = root.cmRecords;
})(typeof window !== "undefined" ? window : globalThis);
