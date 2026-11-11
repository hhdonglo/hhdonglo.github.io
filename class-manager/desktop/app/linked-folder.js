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
  load();
})();
