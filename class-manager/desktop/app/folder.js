/* Class Manager: the screen for loading data from a folder ("Load from a folder…").
   The lecturer points at a folder; CM finds the files, reads what each holds (class list, quiz results, attendance, quiz questions),
   keeps only the useful fields in a clean working file of its own, and previews what would be added. Originals are never changed.
   Everything is worked out by CM (desktop/autoload/); this file only lays the screens out. */
(function () {
  "use strict";
  var btns = document.querySelectorAll("[data-folder-import]");
  if (!btns.length || !window.cmApp || !cmApp.autoPick) return;
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  var n = function (v) { return Number(v || 0).toLocaleString(); };

  var d = document.createElement("dialog");
  d.id = "fld-d"; d.setAttribute("aria-labelledby", "fld-h"); d.style.width = "min(50rem, 94vw)";
  d.innerHTML = "<h2 id='fld-h'>Load data from a folder</h2><div id='fld-body'></div>";
  document.body.appendChild(d);
  var body = d.querySelector("#fld-body"), scan = null, watching = false, working = null, opts = { addMissing: null };

  function conflictsHtml(st){
    if(!st||!st.nameConflicts)return "";
    return "<details open style='margin:.6rem 0'><summary class='msg'><strong>"+n(st.nameConflicts)+"</strong> student ID(s) have a different name in the files. The ID is the key, so the name already on the class list is kept. Check these:</summary><ul class='note'>"+(st.conflicts||[]).map(function(x){return "<li>"+esc(x.id)+": class list “"+esc(x.existing)+"”, file “"+esc(x.incoming)+"”</li>"}).join("")+"</ul></details>";
  }
  function flaggedHtml(st) {
    if (!st || !st.flaggedCount) return st && st.noIdRows ? "<p class='msg'>" + n(st.noIdRows) + " row(s) have no usable student ID and are left out.</p>" : "";
    return "<details open style='margin:.6rem 0'><summary class='msg'><strong>" + n(st.flaggedCount) + "</strong> ID(s) do not conform to the class list. Check these. They are never added as students unless they are valid IDs and you tick the box below:</summary>" +
      "<ul class='note'>" + (st.flagged || []).map(function (x) { return "<li>" + esc(x.id) + ": " + esc(x.why) + "</li>"; }).join("") + (st.flaggedCount > (st.flagged || []).length ? "<li>and " + n(st.flaggedCount - st.flagged.length) + " more</li>" : "") + "</ul>" +
      (st.noIdRows ? "<p class='note'>" + n(st.noIdRows) + " other row(s) have no usable student ID and are left out.</p>" : "") + "</details>";
  }
  function buttons(html) { return "<p class='row' style='justify-content:flex-end;margin-top:14px'>" + html + "</p>"; }
  function close() { cmApp.autoWatch(false); cmApp.importForget(); d.close(); }

  if (cmApp.onAutoProgress) cmApp.onAutoProgress(function (p) {
    var el = body.querySelector("#fld-status"); if (el && p.reading) el.textContent = "Reading " + p.file + " (" + n(p.done) + " of " + n(p.total) + ")…";
  });
  if (cmApp.onAutoChanged) cmApp.onAutoChanged(function () { if (d.open && body.querySelector("#fld-list")) { var el = body.querySelector("#fld-changed"); if (el) el.hidden = false; } });

  function welcome(msg) {
    body.innerHTML =
      "<p>Choose the folder that holds your class files, for example the folder with the class list, the quiz bank, the scores and the attendance.</p>" +
      "<ul class='note' style='line-height:1.7'><li>Excel, CSV, Word, text and PDF files are looked at. Files can be in any layout: CM looks for the columns it needs by their headings and by what they contain, and ignores the rest.</li>" +
      "<li>It keeps only the useful fields and writes a clean working file of its own. <strong>Your original files are never changed.</strong></li>" +
      "<li>You see what was found, and what is missing, before anything is added to the course.</li></ul>" +
      (msg ? "<p class='msg err' role='alert'>" + esc(msg) + "</p>" : "") +
      buttons("<button class='btn' type='button' id='fld-cancel'>Cancel</button><button class='btn primary' type='button' id='fld-pick'>Choose the folder…</button>");
    body.querySelector("#fld-cancel").onclick = close;
    body.querySelector("#fld-pick").onclick = function () { busy("Looking at the folder…"); cmApp.autoPick().then(function (r) { if (!r) return welcome(); found(r); }); };
  }
  function busy(t) { body.innerHTML = "<p id='fld-status' role='status' aria-live='polite'>" + esc(t) + "</p><p class='note'>A large folder takes a little while. Files already looked at are not read again.</p>"; }

  function kindsOf(f) { return f.kinds.length ? f.kinds.join(", ") : "nothing usable"; }
  function countsOf(s) {
    if (!s) return "";
    var p = []; if (s.students) p.push(n(s.students) + " students"); if (s.results) p.push(n(s.results) + " quiz results"); if (s.attempts) p.push(n(s.attempts) + " practice attempts");
    if (s.sessions) p.push(n(s.sessions) + " attendance sessions"); if (s.questions) p.push(n(s.questions) + " question sets"); return p.join(", ");
  }
  function fileRow(f) {
    var cols = f.sheets.filter(function (s) { return s.status === "used"; }).map(function (s) {
      return "<li>" + esc(s.name) + " → " + esc(s.role) + (s.columns && s.columns.length ? " (" + s.columns.map(function (c) { return esc(c.field) + ": “" + esc(c.heading) + "”" + (c.by === "content" ? " (guessed from the cells)" : ""); }).join("; ") + ")" : "") + (s.note ? ". " + esc(s.note) : "") + "</li>";
    }).join("");
    var left = f.sheets.filter(function (s) { return s.status !== "used" && s.note; }).slice(0, 12).map(function (s) { return "<li>" + esc(s.name) + ": " + esc(s.note) + "</li>"; }).join("");
    if (!f.ok) return "<li class='note'>" + esc(f.rel) + ": cannot be read. " + esc(f.error) + "</li>";
    if (!f.useful) return "<li class='note'>" + esc(f.rel) + ": " + esc(f.why) + "</li>";
    return "<li style='margin:.5rem 0'><label><input type='checkbox' class='fld-pick' data-i='" + f.id + "'" + (f.big ? "" : " checked") + "> <strong>" + esc(f.rel) + "</strong></label><br>" + (f.big ? "<span class='msg'>This file lists " + n(f.big.students) + " students, far more than the " + n(f.big.others) + " in your other files. It may be a whole-course list, so it is not ticked. Tick it only if it is your class.</span><br>" : "") + "<span class='note'>Found: " + esc(kindsOf(f)) + ". " + esc(countsOf(f.summary)) + "</span>" +
      "<details><summary class='note'>What was taken from it</summary><ul class='note'>" + cols + "</ul>" + (left ? "<p class='note'>Left out:</p><ul class='note'>" + left + "</ul>" : "") + "</details></li>";
  }

  function found(r) {
    try { foundScreen(r); } catch (err) { failed(err); }
  }
  function foundScreen(r) {
    if (!r.ok) return welcome(r.why);
    scan = r;
    var good = r.files.filter(function (f) { return f.ok && f.useful; }), rest = r.files.filter(function (f) { return !(f.ok && f.useful); });
    var sk = r.skipped || {}, other = (sk.other || 0) + (sk.tooBig || 0);
    body.innerHTML =
      "<p class='note'>Folder: <strong>" + esc(r.folder) + "</strong> · " + n(r.files.length) + " files read" + (r.reread < r.files.length ? " (" + n(r.files.length - r.reread) + " unchanged since the last scan)" : "") + (other ? " · " + n(other) + " other files ignored" : "") + "</p>" +
      (r.capped ? "<p class='msg'>The folder has more files than are read at once. Point CM at a smaller folder to see the rest.</p>" : "") +
      "<p id='fld-changed' class='msg' role='status' hidden>Files in the folder have changed. Press Rescan to look again.</p>" +
      (good.length ? "<p>Files with usable data. Untick any you do not want:</p><ul id='fld-list' style='list-style:none;padding:0'>" + good.map(fileRow).join("") + "</ul>" : "<p class='msg'>No file in this folder holds a class list, scores, attendance or quiz questions that CM could recognise.</p>") +
      (rest.length ? "<details><summary class='note'>Other files (" + rest.length + ")</summary><ul class='note'>" + rest.map(fileRow).join("") + "</ul></details>" : "") +
      "<p><label><input type='checkbox' id='fld-watch'" + (watching ? " checked" : "") + "> Tell me when files in this folder change</label></p><p id='fld-status' class='note' role='status'></p>" +
      buttons("<button class='btn' type='button' id='fld-cancel'>Cancel</button><button class='btn' type='button' id='fld-change'>Change folder…</button><button class='btn' type='button' id='fld-files2'>Choose files…</button><button class='btn' type='button' id='fld-rescan'>Rescan</button>" +
        "<button class='btn primary' type='button' id='fld-preview'" + (good.length ? "" : " disabled") + ">Preview</button>");
    body.querySelector("#fld-cancel").onclick = close;
    body.querySelector("#fld-change").onclick = function () { busy("Looking at the folder…"); cmApp.autoPick().then(function (x) { if (!x) return found(r); found(x); }); };
    body.querySelector("#fld-files2").onclick = function () { busy("Reading the files…"); cmApp.autoPickFiles().then(function (x) { if (!x) return found(r); found(x); }); };
    body.querySelector("#fld-rescan").onclick = function () { busy("Looking at the folder…"); cmApp.autoScan({}).then(found); };
    body.querySelector("#fld-watch").onchange = function (e) { watching = e.target.checked; cmApp.autoWatch(watching); };
    body.querySelector("#fld-preview").onclick = function () { preview(); };
  }

  function ids() { return Array.prototype.map.call(body.querySelectorAll(".fld-pick:checked"), function (x) { return Number(x.getAttribute("data-i")); }); }
  var chosenIds = [], courseFields = [];

  function preview() {
    chosenIds = ids();
    if (!chosenIds.length) { var st = body.querySelector("#fld-status"); if (st) st.textContent = "Tick at least one file."; return; }
    busy("Building the working file…");
    cmApp.autoPlan({ ids: chosenIds, addMissing: opts.addMissing }).then(function (r) {
      if (!r.ok) { found(scan); var st = body.querySelector("#fld-status"); if (st) st.textContent = r.why; return; }
      working = r; opts.addMissing = r.addMissing;
      return cmApp.autoCourse({ ids: chosenIds }).then(function (c) { courseFields = c && c.ok ? c.fields : []; }, function () { courseFields = []; }).then(function () { show(r); });
    }).catch(function (err) { failed(err); });
  }

  // Whatever goes wrong while building a preview is shown in the dialog, with a way back to the list.
  function failed(err) {
    body.innerHTML = "<p class='msg err' role='alert'>The preview could not be made: " + esc(err && err.message ? err.message : String(err || "unknown error")) + "</p>" +
      "<p class='note'>Nothing was added to the course. Go back, untick the file that may be the cause, and try again.</p>" +
      buttons("<button class='btn' type='button' id='fld-cancel'>Close</button><button class='btn primary' type='button' id='fld-back2'>Back to the files</button>");
    body.querySelector("#fld-cancel").onclick = close;
    body.querySelector("#fld-back2").onclick = function () { busy("Looking at the folder…"); cmApp.autoScan({}).then(found); };
  }

  function tableRow(t) {
    var inFile = t.tab === "Attendance" ? n(t.total) + " students" : n(t.total);
    var added = t.tab === "Attendance" ? n(t.add) + " marks" + (t.newSessions && t.newSessions.length ? ", " + t.newSessions.length + " new session" + (t.newSessions.length === 1 ? "" : "s") : "") : n(t.add);
    return "<tr><td>" + esc(t.label) + "</td><td>" + inFile + "</td><td><strong>" + added + "</strong></td><td>" + n(t.duplicates) + "</td><td>" + n(t.offList) + "</td></tr>";
  }

  function show(r) {
    var rep = r.report, s = r.working.summary, st = rep.students, qn = s.questions;
    var table = rep.blocked || !rep.tabs.length ? "" : "<div class='tbl' style='height:auto;max-height:16rem'><table><thead><tr><th>Records</th><th>In the files</th><th>New</th><th>Already here</th><th>Not on class list</th></tr></thead><tbody>" + rep.tabs.map(tableRow).join("") + "</tbody></table></div>";
    body.innerHTML =
      "<p><strong>Working file made.</strong> From " + (r.name ? esc(r.name) : "the files") + ", CM kept " + esc(countsOf(s) || "nothing") + ". It is saved in CM's own folder; your originals are untouched.</p>" +
      "<p class='row'><button class='btn' type='button' id='fld-export'>Export the working file…</button><button class='btn' type='button' id='fld-open'>Open the working folder</button></p>" +
      "<p>Class list: <strong>" + n(st.classList) + "</strong> students in this course. <strong>" + n(st.withData) + "</strong> have records in the files." + (st.notOnList ? " <strong>" + n(st.notOnList) + "</strong> other IDs are not on the class list and are left out unless you add them." : "") + "</p>" +
      ((st.notOnList || st.toAdd || !st.classList) ? "<label style='display:block;margin:.6rem 0'><input type='checkbox' id='fld-add'" + (opts.addMissing ? " checked" : "") + "> Add the students in the files to the class list" + (st.toAdd ? " (" + n(st.toAdd) + " would be added)" : "") + "</label>" : "") +
      (window.cmFolderCourse ? cmFolderCourse.html(courseFields) : "") +
      (st.namesFilled ? "<p class='note'>" + n(st.namesFilled) + " student(s) on the class list had no name; the files give it.</p>" : "") + flaggedHtml(st) + conflictsHtml(st) + table + (rep.warnings || []).map(function (x) { return "<p class='msg'>" + esc(x) + "</p>"; }).join("") +
      (qn ? "<p>The files also hold <strong>" + n(qn) + "</strong> quiz question set(s). <button class='btn' type='button' id='fld-q'>Send them to the review queue</button> <span class='note' id='fld-qmsg' role='status'>You approve each question before students see it.</span></p>" : "") +
      (rep.changes ? "<p class='note'>A backup is made first. Records already here are never changed, and loading the same files again adds nothing.</p>" : "<p class='msg'>Nothing in these files is new to this course.</p>") +
      buttons("<button class='btn' type='button' id='fld-back'>Back</button><button class='btn' type='button' id='fld-cancel'>Close</button><button class='btn primary' type='button' id='fld-go'" + (rep.changes ? "" : " disabled") + ">Add " + (rep.changes ? n(rep.changes) + " records" : "") + " to the course</button>");
    body.querySelector("#fld-cancel").onclick = close;
    if (window.cmFolderCourse) cmFolderCourse.wire(body);
    body.querySelector("#fld-back").onclick = function () { cmApp.autoScan({}).then(found); };
    body.querySelector("#fld-export").onclick = function () { cmApp.autoExport().then(function (x) { if (x && !x.ok) alert(x.why); }); };
    body.querySelector("#fld-open").onclick = function () { cmApp.autoOpenWorking(); };
    var add = body.querySelector("#fld-add");
    if (add) add.onchange = function () { opts.addMissing = add.checked; cmApp.importPlan({ addMissing: opts.addMissing }).then(function (x) { if (x && x.ok) show({ ok: true, name: r.name, working: r.working, addMissing: opts.addMissing, report: x.report }); }); };
    var q = body.querySelector("#fld-q");
    if (q) q.onclick = function () { cmApp.autoQuestions({ ids: chosenIds }).then(function (x) { body.querySelector("#fld-qmsg").textContent = x.ok ? n(x.added) + " question(s) are in the review queue (Author, Drafts)." + (x.flagged ? " " + x.flagged + " could not be read as complete questions." : "") : x.why; q.disabled = !!x.ok; }); };
    var go = body.querySelector("#fld-go");
    go.onclick = function () { go.disabled = true; go.textContent = "Adding…"; cmApp.importApply({ addMissing: !!opts.addMissing }).then(done); };
  }

  function done(r) {
    if (!r || !r.ok) { body.innerHTML = "<p class='msg err' role='alert'>Nothing was added: " + esc(r && r.why) + "</p>" + buttons("<button class='btn primary' type='button' id='fld-x'>Close</button>"); body.querySelector("#fld-x").onclick = close; return; }
    var st = (r.report && r.report.students) || {}, tabs = (r.report && r.report.tabs || []).filter(function (t) { return t.add; });
    body.innerHTML = "<p><strong>" + (r.nothing ? "Nothing to add: everything in these files is already here." : "Added " + n(r.done.rows) + " records" + (r.done.students ? " and " + n(r.done.students) + " new students" : "") + ".") + "</strong></p>" +
      (tabs.length ? "<ul class='note'>" + tabs.map(function (t) { return "<li>" + esc(t.label) + ": " + n(t.add) + " new, " + n(t.duplicates) + " already here</li>"; }).join("") + "</ul>" : "") +
      (st.namesFilled ? "<p class='note'>" + n(st.namesFilled) + " existing student(s) were given the name the file has.</p>" : "") +
      (st.nameConflicts ? "<p class='msg'>" + n(st.nameConflicts) + " ID(s) had a different name in the files; the class list name was kept.</p>" : "") +
      "<p class='note'>Load more files whenever you like. Each load matches students by ID, adds the new ones and fills gaps, and never duplicates or overwrites.</p>" +
      (r.backup ? "<p class='note'>A backup of the records as they were is in Settings, under Backups (" + esc(r.backup) + "). Restoring it undoes this.</p>" : "") +
      buttons("<button class='btn primary' type='button' id='fld-ok'>Done</button>");
    body.querySelector("#fld-ok").onclick = function () { d.close(); location.reload(); };
  }

  Array.prototype.forEach.call(btns, function (b) {
    b.addEventListener("click", function () {
      opts = { addMissing: b.getAttribute("data-folder-import") === "setup" ? true : null };
      d.showModal(); busy("Looking at the folder…");
      cmApp.autoState().then(function (s) { watching = false; if (!s.folder) return welcome(); cmApp.autoScan({}).then(found); });
    });
  });
})();
