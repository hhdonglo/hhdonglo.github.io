/* Class Manager: the Class Roster screen that asks for the roster from standard files.
   One responsibility: choose, drop or paste files (CSV, Excel, Word, text, PDF, screenshots) or text, show what CM read as a table the lecturer can correct, and save it through cmApp.rosterShotsSave.
   The checks (unique IDs, one name per ID, nothing guessed) are made by CM itself (desktop/roster-shots/review.js), again at save. This file only lays the screen out.
   Used by setup.html (the Class Roster step). Call cmRosterShots.init({ onSaved: function () {} }). */
(function () {
  "use strict";
  var $ = function (i) { return document.getElementById(i); };
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); };
  var rows = [], choices = {}, renames = {}, last = null, onSaved = function () {};
  var TYPES = /\.(csv|tsv|txt|text|md|xlsx|xls|docx|pdf|png|jpe?g|webp|gif)$/i, IMG = /^image\/(png|jpeg|webp|gif)$/;

  function toImage(file) { // one file as { name, type, data (base64) }; CM works out what it is
    return new Promise(function (ok, no) {
      var name = file.name || "pasted image";
      if (!TYPES.test(name) && !IMG.test(file.type)) return no(new Error(name + " is not a kind of file CM reads here. Use CSV, Excel, Word, text, PDF or a screenshot."));
      var r = new FileReader();
      r.onload = function () { ok({ name: name, type: file.type, data: String(r.result).split(",")[1] || "" }); };
      r.onerror = function () { no(new Error("Could not read " + name)); };
      r.readAsDataURL(file);
    });
  }
  function pastedText(t) { return { name: "pasted text.txt", type: "text/plain", data: btoa(unescape(encodeURIComponent(t))) }; }
  function msg(t, bad) { var m = $("rs-msg"); m.textContent = t || ""; m.className = bad ? "msg err" : "msg"; }

  function readFiles(files) {
    files = Array.prototype.slice.call(files || []);
    if (!files.length) return;
    msg("Reading " + files.length + " file" + (files.length === 1 ? "" : "s") + "…");
    Promise.all(files.map(function (f) { return f.data ? f : toImage(f); })).then(function (images) { return cmApp.rosterShotsRead(images); }).then(function (r) {
      if (!r.ok) { msg(r.why, true); return; }
      msg(r.why || (r.sentToAnthropic && r.sentToAnthropic.length ? "Read on this computer, except " + r.sentToAnthropic.length + " picture or scanned file" + (r.sentToAnthropic.length === 1 ? "" : "s") + " sent to Anthropic to be read: " + r.sentToAnthropic.join(", ") + "." : "Read on this computer. Nothing was sent anywhere."), !!r.why);
      rows = rows.concat(r.found.map(function (f) { return { id: f.id, name: f.name, shot: f.shot, unclear: f.unclear }; }));
      draw();
    }).catch(function (e) { msg(e.message, true); });
  }


  function draw() {
    var box = $("rs-table");
    $("rs-work").hidden = !rows.length;
    box.innerHTML = "<table><thead><tr><th>Student ID</th><th>Name</th><th>From</th><th></th></tr></thead><tbody>" + rows.map(function (r, i) {
      return "<tr" + (r.unclear ? " class='unclear'" : "") + "><td><input data-f='id' data-i='" + i + "' value='" + esc(r.id) + "' aria-label='Student ID, row " + (i + 1) + "' inputmode='numeric'></td>" +
        "<td><input data-f='name' data-i='" + i + "' value='" + esc(r.name) + "' aria-label='Name, row " + (i + 1) + "'></td><td>" + esc(r.shot || "") + (r.unclear ? " <span class='opt'>(unclear in the picture or scan: check)</span>" : "") +
        "</td><td><button type='button' class='link' data-del='" + i + "'>Delete</button></td></tr>";
    }).join("") + "</tbody></table>";
    // Ask CM (not this file) what the rows amount to, so there is one set of rules.
    cmApp.rosterShotsPreview({ rows: rows, choices: choices }).then(function (p) { last = p; notes(p); });
  }

  function notes(p) {
    var h = "";
    if (p.conflicts.length) h += "<p class='msg err'><strong>" + p.conflicts.length + " ID" + (p.conflicts.length === 1 ? " has" : "s have") + " more than one name.</strong> An ID belongs to one student. Choose the name to keep.</p>" +
      p.conflicts.map(function (c) { return "<p><code>" + esc(c.id) + "</code> " + c.names.map(function (n) { return "<label style='display:inline;font-weight:400;margin-right:1rem'><input type='radio' name='rs-c-" + esc(c.id) + "' data-pick='" + esc(c.id) + "' value='" + esc(n) + "'" + (choices[c.id] === n ? " checked" : "") + "> " + esc(n) + "</label>"; }).join("") + "</p>"; }).join("");
    if (p.ambiguous.length) h += "<p class='msg err'><strong>" + p.ambiguous.length + " ID" + (p.ambiguous.length === 1 ? " cannot" : "s cannot") + " be read with certainty</strong> (" + esc(p.ambiguous.slice(0, 3).map(function (a) { return a.raw + ": " + a.why; }).join("; ")) + "). Correct " + (p.ambiguous.length === 1 ? "it" : "them") + " in the table or delete the row.</p>";
    if (p.merged.length) h += "<p class='note'>" + p.merged.length + " student" + (p.merged.length === 1 ? " appears" : "s appear") + " more than once in the files (same ID and name). Each is kept once.</p>";
    if (p.differsFromList.length) h += "<p class='note'>" + p.differsFromList.length + " student" + (p.differsFromList.length === 1 ? " is" : "s are") + " already on the list under a different name. The list keeps its name unless you tick the box.</p>" +
      p.differsFromList.map(function (d) { return "<p><label style='display:inline;font-weight:400'><input type='checkbox' data-rename='" + esc(d.id) + "'" + (renames[d.id] ? " checked" : "") + "> <code>" + esc(d.id) + "</code> change " + esc(d.listName) + " to " + esc(d.shotName) + "</label></p>"; }).join("");
    var fresh = p.students.length - p.alreadyOnList.length;
    h += "<p class='note'>" + fresh + " new student" + (fresh === 1 ? "" : "s") + " to add; " + p.alreadyOnList.length + " already on the list.</p>";
    $("rs-notes").innerHTML = h;
    $("rs-save").disabled = !!(p.conflicts.length || p.ambiguous.length || !p.students.length);
  }

  function init(o) {
    onSaved = (o && o.onSaved) || onSaved;
    $("rs-file").addEventListener("change", function (e) { readFiles(e.target.files); e.target.value = ""; });
    $("rs-pick").addEventListener("click", function () { $("rs-file").click(); });
    var drop = $("rs-drop");
    ["dragover", "dragenter"].forEach(function (n) { drop.addEventListener(n, function (e) { e.preventDefault(); drop.classList.add("over"); }); });
    ["dragleave", "drop"].forEach(function (n) { drop.addEventListener(n, function (e) { e.preventDefault(); drop.classList.remove("over"); }); });
    drop.addEventListener("drop", function (e) { readFiles(e.dataTransfer && e.dataTransfer.files); });
    document.addEventListener("paste", function (e) { if (!$("rs-drop").offsetParent) return; var cd = e.clipboardData, f = Array.prototype.filter.call((cd && cd.files) || [], function (x) { return IMG.test(x.type) || TYPES.test(x.name || ""); }); if (f.length) { e.preventDefault(); readFiles(f); return; } var t = cd && cd.getData("text/plain"); if (t && !/^(INPUT|TEXTAREA)$/.test((e.target || {}).tagName || "")) { e.preventDefault(); readFiles([pastedText(t)]); } });
    $("rs-table").addEventListener("change", function (e) { var t = e.target; if (!t.dataset || t.dataset.i == null) return; rows[+t.dataset.i][t.dataset.f] = t.value; if (t.dataset.f === "id") rows[+t.dataset.i].unclear = false; draw(); });
    $("rs-table").addEventListener("click", function (e) { var b = e.target.closest && e.target.closest("[data-del]"); if (!b) return; rows.splice(+b.dataset.del, 1); draw(); });
    $("rs-notes").addEventListener("change", function (e) { var t = e.target; if (t.dataset && t.dataset.pick) { choices[t.dataset.pick] = t.value; draw(); } if (t.dataset && t.dataset.rename) { if (t.checked) renames[t.dataset.rename] = true; else delete renames[t.dataset.rename]; } });
    $("rs-clear").addEventListener("click", function () { rows = []; choices = {}; renames = {}; draw(); msg(""); });
    $("rs-save").addEventListener("click", function () {
      var rep = $("rs-replace").checked;
      if (rep && !confirm("Replace the whole class list? Students who are not in this list are set aside with all their records, and can be restored.")) return;
      $("rs-save").disabled = true;
      cmApp.rosterShotsSave({ rows: rows, choices: choices, replace: rep, renames: Object.keys(renames) }).then(function (r) {
        if (!r || !r.ok) { msg("Not saved: " + ((r && r.why) || "unknown problem"), true); $("rs-save").disabled = false; return; }
        rows = []; choices = {}; renames = {}; draw();
        msg("Saved. " + r.added + " added, " + r.unchanged + " already on the list" + (r.renamed ? ", " + r.renamed + " renamed" : "") + (r.removed ? ", " + r.removed + " set aside" : "") + ". A backup was made first.");
        onSaved(r);
      });
    });
  }
  window.cmRosterShots = { init: init };
})();
