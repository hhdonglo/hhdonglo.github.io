/* App Settings > "Link storage": choose a synced folder, link it with a passphrase, copy now, restore a copy.
   Talks to the app only through cmApp.linked* (preload.js); the rules are in ../linked-folder.js. */
(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };
  if (!$("lf") || !window.cmApp) return;
  var picked = null, kind = "folder", services = [];
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function when(ms) { var d = new Date(ms); return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) + " " + ("0" + d.getHours()).slice(-2) + ":" + ("0" + d.getMinutes()).slice(-2); }
  function show(s) {
    $("lf-off").hidden = !!s.linked; $("lf-on").hidden = !s.linked;
    $("lf-auto-w").hidden = !s.keychain;
    if (!s.linked) return;
    $("lf-folder").textContent = (s.folder || s.provider.name) + (s.reachable ? "" : " (not found: is the drive connected?)");
    $("lf-prov").textContent = s.provider.name; $("lf-adv2").textContent = s.advice;
    $("lf-last").textContent = !s.last ? "none yet" : s.last.ok ? when(Date.parse(s.last.at)) : "failed: " + s.last.why;
    $("lf-autoshow").textContent = s.auto ? "Yes, every four hours and when the app closes" : (s.keychain ? "No" : "No: this computer has no keychain to keep the passphrase");
    $("lf-list").innerHTML = s.copies.length ? '<table><thead><tr><th scope="col">Copy</th><th scope="col">Size</th><th scope="col"></th></tr></thead><tbody>' +
      s.copies.map(function (c) { return "<tr><td>" + esc(when(c.at)) + "</td><td>" + Math.max(1, Math.round(c.bytes / 1024)) + ' KB</td><td><button class="btn" type="button" data-lf="' + esc(c.name) + '">Restore</button></td></tr>'; }).join("") +
      '</tbody></table><p class="note">The newest ' + s.keep + " copies are kept.</p>" : '<p class="note">No copies yet.</p>';
  }
  function kinds(s) {
    services = s.services || [];
    if ($("lf-kind").options.length) return;
    var o = '<option value="folder">A synced folder: Google Drive, OneDrive, Dropbox, MEGA, iCloud, Box or a git folder</option>';
    services.forEach(function (x) { o += '<option value="' + esc(x.id) + '"' + (s.keychain ? "" : " disabled") + ">" + esc(x.name) + (s.keychain ? "" : " (needs a system keychain)") + "</option>"; });
    $("lf-kind").innerHTML = o;
  }
  function pick() { // the form follows the chosen place
    kind = $("lf-kind").value; picked = null; $("lf-form").hidden = true; $("lf-msg").textContent = "";
    $("lf-choose-w").hidden = kind !== "folder";
    if (kind === "folder") return;
    var sv = services.filter(function (x) { return x.id === kind; })[0]; if (!sv) return;
    $("lf-help").innerHTML = "<ol>" + sv.help.map(function (t) { return "<li>" + esc(t) + "</li>"; }).join("") + "</ol>";
    $("lf-fields").innerHTML = sv.fields.map(function (f) { return '<label class="f" for="lf-f-' + esc(f.key) + '">' + esc(f.label) + '</label><input class="f" id="lf-f-' + esc(f.key) + '" type="' + (f.secret ? "password" : "text") + '" autocomplete="off" spellcheck="false" placeholder="' + esc(f.placeholder || "") + '" style="max-width:34rem">'; }).join("");
    $("lf-picked").textContent = sv.name; $("lf-advice").textContent = ""; $("lf-form").hidden = false;
  }
  $("lf-kind").addEventListener("change", pick);
  function load() { cmApp.linkedState().then(function (s) { kinds(s); show(s); }); }
  $("lf-choose").addEventListener("click", function () {
    cmApp.linkedChoose().then(function (r) {
      if (!r) return; picked = r; $("lf-fields").innerHTML = ""; $("lf-help").innerHTML = "";
      $("lf-picked").textContent = r.folder + " (" + r.provider.name + ")";
      $("lf-advice").textContent = r.provider.id === "plain" ? "This folder does not look like a cloud folder. Choose the folder your sync app uses (for example Google Drive, OneDrive, Dropbox or MEGA), or continue to keep copies on this computer only." : "";
      $("lf-form").hidden = false; $("lf-pass").focus();
    });
  });
  $("lf-cancel").addEventListener("click", function () { $("lf-form").hidden = true; picked = null; $("lf-kind").value = "folder"; pick(); });
  $("lf-form").addEventListener("submit", function (e) {
    e.preventDefault();
    var p = $("lf-pass").value;
    if (p.length < 10) { $("lf-msg").textContent = "The passphrase needs at least 10 characters."; return; }
    if (p !== $("lf-again").value) { $("lf-msg").textContent = "The two passphrases differ."; return; }
    $("lf-msg").textContent = "Linking…";
    var spec = { kind: kind };
    if (kind === "folder") { if (!picked) { $("lf-msg").textContent = "Choose a folder first."; return; } spec.folder = picked.folder; }
    else { spec.creds = {}; services.filter(function (x) { return x.id === kind; })[0].fields.forEach(function (f) { spec.creds[f.key] = $("lf-f-" + f.key).value; }); }
    cmApp.linkedLink(spec, p, $("lf-auto").checked).then(function (s) {
      if (!s.linked) { $("lf-msg").textContent = "Not linked: " + (s.why || "unknown"); return; }
      $("lf-form").hidden = true; $("lf-pass").value = ""; $("lf-again").value = ""; $("lf-fields").innerHTML = ""; $("lf-kind").value = "folder"; pick(); show(s);
      $("lf-msg").textContent = s.first && s.first.ok ? "Linked. The first copy is made and was read back." : "Linked, but the first copy failed: " + ((s.first && s.first.why) || "unknown");
    });
  });
  $("lf-copy").addEventListener("click", function () {
    $("lf-msg").textContent = "Copying…";
    cmApp.linkedCopy($("lf-pass2").value).then(function (s) { show(s); $("lf-msg").textContent = s.result && s.result.ok ? "Copied and read back." : "Not copied: " + ((s.result && s.result.why) || s.why || "unknown"); });
  });
  $("lf-open").addEventListener("click", function () { cmApp.linkedOpen(); });
  $("lf-unlink").addEventListener("click", function () {
    if (!confirm("Stop linking this folder? Copies already in it stay there.")) return;
    cmApp.linkedUnlink().then(function (s) { show(s); $("lf-msg").textContent = "No longer linked."; });
  });
  $("lf-list").addEventListener("click", function (e) {
    var t = e.target.closest("button[data-lf]"); if (!t) return;
    if (!confirm("Restore this course's records from this copy? The records as they are now are kept as a backup first.")) return;
    $("lf-msg").textContent = "Restoring…";
    cmApp.linkedRestore(t.getAttribute("data-lf"), $("lf-pass2").value).then(function (r) { $("lf-msg").textContent = r.ok ? "Restored. The records as they were are kept as a backup." : "Not restored: " + r.why; if (r.ok) load(); });
  });
  /* ---- what is kept in step (sync/course-sync.js) ---- */
  var ITEMS = [["notes", "Lecturer notes", "Files you keep in the notes folder; readable in your cloud storage."], ["materials", "Course materials", "Lectures, slides and question banks; readable in your cloud storage."],
    ["classList", "Class list", "Encrypted with your passphrase."], ["attendance", "Attendance", "Encrypted with your passphrase."]];
  function syShow(s) {
    if (!s || !s.items) return;
    $("sy-items").innerHTML = ITEMS.map(function (it) { var v = s.items[it[0]]; return '<p class="row"><label for="sy-' + it[0] + '" style="min-width:11rem"><b>' + it[1] + '</b></label><select class="f" id="sy-' + it[0] + '" data-item="' + it[0] + '" style="max-width:26rem"><option value="local"' + (v === "local" ? " selected" : "") + '>This computer only</option><option value="sync"' + (v === "sync" ? " selected" : "") + '>Kept here and in the cloud, in step</option></select> <span class="note">' + esc(it[2]) + "</span></p>"; }).join("");
    var l = s.last; $("sy-last").textContent = !l ? "Not synchronised yet in this session." : l.skipped ? "" : l.ok ? "Last synchronised " + when(l.at) + (l.records ? ". " + (l.records.conflicts ? l.records.conflicts + " conflicting change(s) were settled (class list: this computer kept; attendance: present kept)." : "No conflicts.") : "") : l.why;
    $("sy-devices").innerHTML = s.devices && s.devices.length ? "Other computers in step: " + s.devices.map(function (d) { return esc(d.name) + " (" + when(d.at) + ")"; }).join(", ") : "";
    $("sy-pass-note").hidden = !!(s.last && s.last.ok !== false) || !(s.items.classList === "sync" || s.items.attendance === "sync") || !(s.last && /passphrase/.test(s.last.why || ""));
  }
  $("sy-items").addEventListener("change", function (e) {
    var t = e.target.closest("select[data-item]"); if (!t) return; var o = {}; o[t.getAttribute("data-item")] = t.value;
    cmApp.syncItems(o).then(function (s) { if (s.ok === false) { $("lf-msg").textContent = s.why; return; } syShow(s); $("lf-msg").textContent = t.value === "sync" ? "Kept in step. Both copies stay." : "Now this computer only. The copy in the cloud stays where it is."; });
  });
  $("sy-now").addEventListener("click", function () { $("lf-msg").textContent = "Synchronising…"; cmApp.syncNow($("lf-pass2").value).then(function (s) { syShow(s); $("lf-msg").textContent = s.result && s.result.ok ? "Done." : (s.result && s.result.why) || "Not done."; }); });
  $("sy-notes").addEventListener("click", function () { cmApp.openNotes(); });
  function syLoad() { cmApp.syncState().then(syShow); }
  syLoad(); setInterval(function () { if (document.visibilityState === "visible" && !$("lf-on").hidden) syLoad(); }, 30000);
  load();
})();
