/* Course material from a folder (setup, step 3): finds the quiz banks in the online format, shows what each holds, and loads them add only.
   Every rule is in desktop/first-run/ (quiz-bank.js, bank-folder.js); this file only lays out the screen. */
(function () {
  "use strict";
  var $ = function (i) { return document.getElementById(i); };
  if (!$("bf-pick") || !window.cmApp || !cmApp.bankFolderPick) return;
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function show(p) {
    var box = $("bf-found"), msg = $("bf-msg"); $("bf-load").hidden = true; msg.textContent = "";
    if (!p) { box.innerHTML = ""; return; }
    if (p.ok === false) { box.innerHTML = ""; msg.textContent = p.why; return; }
    if (!p.files.length) { box.innerHTML = "<p class='note'>No quiz files found. CM looks for lecture1.json, lecture2.json and so on, in the folder, its quizzes folder, or one folder below.</p>"; return; }
    box.innerHTML = "<ul>" + p.files.map(function (f) {
      if (!f.ok) return "<li><strong>" + esc(f.file) + "</strong>: not loaded. " + esc(f.problems.slice(0, 3).join(" ")) + (f.problems.length > 3 ? " (and " + (f.problems.length - 3) + " more)" : "") + "</li>";
      return "<li><strong>" + esc(f.file) + "</strong>: lecture " + f.lecture + (f.title ? " (" + esc(f.title) + ")" : "") + ", " + f.questions + " questions. " +
        (f.isNew ? "New to this course." : f.add + " new, " + f.same + " already in the course" + (f.differing.length ? ", " + f.differing.length + " with the same id but different text are kept as they are" : "") + ".") + "</li>";
    }).join("") + "</ul>";
    var c = p.content; if (c && (c.lectures || c.banks)) box.innerHTML += "<p class='note'>Found " + c.lectures + " lectures, " + c.banks + " quiz banks with " + c.questions + " questions, " + c.files + " lecture files." + (c.noBank.length ? " No quiz bank for lecture " + c.noBank.join(", ") + "." : "") + (c.missing.length ? " Listed but not in the folder: " + c.missing.map(function (m) { return esc(m.file); }).join(", ") + "." : "") + "</p>";
    if (p.loadable) $("bf-load").hidden = false;
  }
  $("bf-pick").addEventListener("click", function () { cmApp.bankFolderPick().then(show); });
  $("bf-load").addEventListener("click", function () {
    cmApp.bankFolderLoad().then(function (r) {
      if (!r || !r.ok) { $("bf-msg").textContent = (r && r.why) || "Not loaded."; return; }
      var n = r.loaded.reduce(function (a, l) { return a + l.added; }, 0);
      $("bf-msg").textContent = "Loaded " + r.loaded.length + " quiz file" + (r.loaded.length === 1 ? "" : "s") + ", " + n + " question" + (n === 1 ? "" : "s") + " added." + (r.skipped.length ? " " + r.skipped.length + " not loaded." : "");
      $("bf-load").hidden = true; setTimeout(function () { location.reload(); }, 1200);
    });
  });
  cmApp.firstRunState().then(function (s) { if (s && s.hasKey === false) $("bf-gen").textContent += " No key is saved yet: add it under Settings in Resources and questions."; });
})();
