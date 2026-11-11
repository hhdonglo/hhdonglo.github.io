/* Class Manager: the screen for importing results from the web version (Grades and Results, "Import from the web").
   Choose the Excel file downloaded from the web version's Google Sheet (or a CSV of one tab), read the preview, then import.
   Everything is worked out by CM (import-plan.js); this file only lays the preview out and asks for confirmation. */
(function () {
  "use strict";
  var btns = document.querySelectorAll("[data-import-web]");
  if (!btns.length || !window.cmApp || !cmApp.importPick) return;
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  var n = function (v) { return Number(v || 0).toLocaleString(); };

  var d = document.createElement("dialog");
  d.id = "imp-d"; d.setAttribute("aria-labelledby", "imp-h"); d.style.maxWidth = "46rem"; d.style.width = "min(46rem, 94vw)";
  d.innerHTML = "<h2 id='imp-h'>Import results from the web version</h2><div id='imp-body'></div>";
  document.body.appendChild(d);
  var body = d.querySelector("#imp-body"), opts = { addMissing: false }, file = "";

  if (cmApp.onImportProgress) cmApp.onImportProgress(function (p) { // the file is read in chunks; show where it is
    if (!d.open) return;
    var m = body.querySelector("#imp-pick"); if (m) m.disabled = true;
    body.innerHTML = "<p role='status' aria-live='polite'>Reading the file… " + esc(p.sheet) + (p.rows ? " (" + n(p.rows) + " rows)" : "") + "</p><p class='note'>Large files take a little while. You can keep using CM.</p>";
  });

  function close() { d.close(); cmApp.importForget(); }
  function conflictsHtml(st){
    if(!st||!st.nameConflicts)return "";
    return "<details open style='margin:.6rem 0'><summary class='msg'><strong>"+n(st.nameConflicts)+"</strong> student ID(s) have a different name in the files. The ID is the key, so the name already on the class list is kept. Check these:</summary><ul class='note'>"+(st.conflicts||[]).map(function(x){return "<li>"+esc(x.id)+": class list “"+esc(x.existing)+"”, file “"+esc(x.incoming)+"”</li>"}).join("")+"</ul></details>";
  }
  function buttons(html) { return "<p class='row' style='justify-content:flex-end;margin-top:14px'>" + html + "</p>"; }

  function start(msg) {
    body.innerHTML =
      "<p>Bring the scores, attendance and practice attempts collected on the web into this course.</p>" +
      "<ol class='note' style='line-height:1.7'><li>In the web version's Google Sheet choose File, Download, Microsoft Excel (.xlsx). A CSV of a single tab also works. (Or choose a filled-in template.)</li>" +
      "<li>Choose that file here and read the preview. <strong>Nothing changes until you press Import.</strong></li></ol>" +
      "<p class='note'>Students are matched to this course's class list by student ID (when you continue from existing data, the class list is taken from the file). Records already here are never changed, and importing the same file again adds nothing. A backup is made before anything is written.</p>" +
      (msg ? "<p class='msg err' role='alert'>" + esc(msg) + "</p>" : "") +
      buttons("<button class='btn' type='button' id='imp-cancel'>Cancel</button><button class='btn primary' type='button' id='imp-pick'>Choose the file…</button>");
    body.querySelector("#imp-cancel").onclick = close;
    body.querySelector("#imp-pick").onclick = function () { cmApp.importPick().then(function (r) { if (!r) return; if (!r.ok) return start(r.why); file = r.name; preview(r.report); }); };
  }

  function rowOf(t) {
    var inFile = t.tab === "Attendance" ? n(t.total) + " students" : n(t.total);
    var added = t.tab === "Attendance" ? n(t.add) + " marks" + (t.newSessions && t.newSessions.length ? ", " + t.newSessions.length + " new session" + (t.newSessions.length === 1 ? "" : "s") : "") : n(t.add);
    var note = t.status === "skipped" ? esc(t.note) : "";
    return "<tr><td>" + esc(t.label) + "</td><td>" + inFile + "</td><td><strong>" + added + "</strong></td><td>" + n(t.duplicates) + "</td><td>" + n(t.offList) + "</td></tr>" + (note ? "<tr><td colspan='5' class='note'>" + note + "</td></tr>" : "");
  }

  function preview(rep) {
    var s = rep.students, w = rep.warnings || [];
    var table = rep.blocked || !rep.tabs.length ? "" :
      "<div class='tbl' style='height:auto;max-height:18rem'><table><thead><tr><th>Records</th><th>In the file</th><th>New</th><th>Already here</th><th>Not on class list</th></tr></thead><tbody>" + rep.tabs.map(rowOf).join("") + "</tbody></table></div>";
    var people = "<p>Class list: <strong>" + n(s.classList) + "</strong> students. <strong>" + n(s.withData) + "</strong> of them have records in the file." +
      (s.notOnList ? " <strong>" + n(s.notOnList) + "</strong> other IDs in the file are not on the class list and are left out." : "") + "</p>";
    var add = (s.notOnList || s.toAdd || !s.classList) ?
      "<label style='display:block;margin:.6rem 0'><input type='checkbox' id='imp-add'" + (opts.addMissing ? " checked" : "") + "> Add the students in the file to the class list" + (s.toAdd ? " (" + n(s.toAdd) + " would be added)" : "") + "</label>" : "";
    var cols = rep.tabs.filter(function (t) { return t.columns && t.columns.length; });
    var colsHtml = cols.length ? "<details style='margin:.6rem 0'><summary class='note'>Columns the import found</summary><ul class='note'>" + cols.map(function (t) { return "<li>" + esc(t.label) + ": " + t.columns.map(function (c) { return esc(c.need) + (c.found && c.found !== c.need ? " (from “" + esc(c.found) + "”)" : ""); }).join(", ") + "</li>"; }).join("") + "</ul></details>" : "";
    var ign = (rep.ignored || []).length ? "<details style='margin:.6rem 0'><summary class='note'>Tabs in the file that are not imported (" + rep.ignored.length + ")</summary><ul class='note'>" + rep.ignored.map(function (x) { return "<li>" + esc(x.tab) + ": " + esc(x.why) + "</li>"; }).join("") + "</ul></details>" : "";
    body.innerHTML = "<p class='note'>File: " + esc(file) + "</p>" + people + add + (s.namesFilled ? "<p class='note'>" + n(s.namesFilled) + " student(s) on the class list had no name; the file gives it.</p>" : "") + conflictsHtml(s) + table + w.map(function (x) { return "<p class='msg'>" + esc(x) + "</p>"; }).join("") + colsHtml + ign +
      (rep.changes ? "<p class='note'>Marks (Master, Scores and Totals) are worked out again after the import. Learning Progress, Students and Attendance then include the new records.</p>" : "<p class='msg'>Nothing in the file is new to this course.</p>") +
      buttons("<button class='btn' type='button' id='imp-cancel'>Cancel</button><button class='btn' type='button' id='imp-other'>Choose another file…</button><button class='btn primary' type='button' id='imp-go'" + (rep.changes ? "" : " disabled") + ">Import " + (rep.changes ? n(rep.changes) + " records" : "") + "</button>");
    body.querySelector("#imp-cancel").onclick = close;
    body.querySelector("#imp-other").onclick = function () { start(); };
    var box = body.querySelector("#imp-add");
    if (box) box.onchange = function () { opts.addMissing = box.checked; cmApp.importPlan(opts).then(function (r) { if (r && r.ok) preview(r.report); }); };
    body.querySelector("#imp-go").onclick = function () {
      body.querySelector("#imp-go").disabled = true; body.querySelector("#imp-go").textContent = "Importing…";
      cmApp.importApply(opts).then(done);
    };
  }

  function done(r) {
    if (!r || !r.ok) { body.innerHTML = "<p class='msg err' role='alert'>The import did not finish: " + esc(r && r.why) + "</p>" + buttons("<button class='btn primary' type='button' id='imp-x'>Close</button>"); body.querySelector("#imp-x").onclick = close; return; }
    body.innerHTML = "<p><strong>" + (r.nothing ? "Nothing to add." : "Imported " + n(r.done.rows) + " records" + (r.done.students ? " and " + n(r.done.students) + " students" : "") + ".") + "</strong></p>" +
      (r.backup ? "<p class='note'>A backup of the records as they were is in Settings, under Backups (" + esc(r.backup) + "). Restoring it undoes this import.</p>" : "") +
      buttons("<button class='btn primary' type='button' id='imp-ok'>Done</button>");
    body.querySelector("#imp-ok").onclick = function () { d.close(); location.reload(); };
  }

  // data-import-web="continue": the first-run choice "Continue from existing data". The class list is taken from the file, and the course carries on from there.
  Array.prototype.forEach.call(btns, function (b) {
    b.addEventListener("click", function () {
      var mode = b.getAttribute("data-import-web"), cont = mode === "continue" || mode === "template";
      opts = { addMissing: cont };
      d.querySelector("#imp-h").textContent = mode === "template" ? "Load the filled template" : cont ? "Continue from existing data" : "Import results from the web version";
      start(); d.showModal();
    });
  });
})();
