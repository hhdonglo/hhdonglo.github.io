/* Class Manager: the Unlisted IDs card on the Class Roster screen.
   Students who sign in to attendance or a quiz with an ID that is not on the class list are held apart from the class list, the marks, the attendance
   totals and every class figure. This card shows each one with what they did and lets the lecturer add them to the class list (their records then move
   in) or reject them (set aside, or discarded), one at a time or all at once. Every decision is made by CM's own calls (unlisted-ipc.js); this screen holds no rules. */
(function () {
  "use strict";
  var host = document.getElementById("unlisted-review");
  if (!host || !window.cmApp || !cmApp.unlistedList) return;
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function plural(n, one, many) { return n + " " + (n === 1 ? one : many); }

  var data = { items: [] }, msg = "", showAside = false;

  function did(x) {
    var bits = [];
    if (x.attendance.length) bits.push("attendance " + x.attendance.length + (x.attendance.length === 1 ? " time" : " times"));
    x.quizzes.forEach(function (q) { bits.push("quiz " + esc(q.code) + (q.submitted ? ", submitted" : q.answers ? ", " + plural(q.answers, "answer", "answers") : ", joined")); });
    return bits.length ? bits.join("; ") : "signed in";
  }
  function rowHtml(x, aside) {
    return "<tr data-id='" + esc(x.id) + "'><td><input type='checkbox' class='ul-pick' aria-label='Select " + esc(x.id) + "'></td>" +
      "<td><code>" + esc(x.id) + "</code></td>" +
      "<td>" + (aside ? esc(x.name) : "<input type='text' class='ul-name' value='" + esc(x.name) + "' maxlength='80' placeholder='Name (optional)' aria-label='Name for " + esc(x.id) + "'>") + "</td>" +
      "<td>" + did(x) + "</td><td>" + esc(plural(x.signIns, "sign-in", "sign-ins")) + "</td></tr>";
  }
  function table(list, aside) {
    return "<div class='ul-table' style='overflow-x:auto'><table><thead><tr><th scope='col'><input type='checkbox' class='ul-all' aria-label='Select all'></th><th scope='col'>ID</th><th scope='col'>Name</th><th scope='col'>What they did</th><th scope='col'>Sign-ins</th></tr></thead><tbody>" +
      list.map(function (x) { return rowHtml(x, aside); }).join("") + "</tbody></table></div>";
  }
  function draw() {
    var waiting = data.items.filter(function (x) { return x.status === "waiting"; }), aside = data.items.filter(function (x) { return x.status === "set aside"; });
    var badge = document.getElementById("unlisted-n"); if (badge) { badge.textContent = waiting.length ? String(waiting.length) : ""; badge.hidden = !waiting.length; }
    host.hidden = !waiting.length && !aside.length && !msg;
    if (host.hidden) { host.innerHTML = ""; return; }
    var h = "<h3>Unlisted IDs (" + waiting.length + " waiting)</h3>" +
      "<p class='note'>These students signed in to attendance or a quiz with an ID that is not on the class list. CM did not add them. Their sign-ins are held here, apart from the class list, the marks, the attendance totals and the class figures. They were told to see their lecturer. Add a student to bring the records in, or reject.</p>" +
      (msg ? "<p class='msg' role='status'>" + esc(msg) + "</p>" : "");
    if (waiting.length) {
      h += "<div class='ul-wait'>" + table(waiting, false) + "</div>" +
        "<p class='row' style='margin-top:12px'><button class='btn primary' type='button' data-ul='add'>Add selected to the class list</button>" +
        "<button class='btn' type='button' data-ul='aside'>Reject selected: keep aside</button>" +
        "<button class='btn' type='button' data-ul='discard'>Reject selected: discard records</button></p>" +
        "<p class='note'>Add: the student joins the class list with an access code, and attendance and quiz records move in (quiz results are held with the others until you release them). Keep aside: the records stay here, hidden, and can be restored. Discard: the records are deleted.</p>";
    }
    if (aside.length) {
      h += "<details class='ul-aside'" + (showAside ? " open" : "") + " style='margin-top:12px'><summary class='note'>Set aside (" + aside.length + ")</summary>" + table(aside, true) +
        "<p class='row' style='margin-top:12px'><button class='btn sm' type='button' data-ul='restore'>Restore selected to the waiting list</button></p></details>";
    }
    host.innerHTML = h;
  }
  function load() { return cmApp.unlistedList().then(function (r) { if (r && r.ok) { data = r; draw(); } }); }

  function picked(scope) {
    var out = [];
    host.querySelectorAll(scope + " tbody tr").forEach(function (tr) {
      var cb = tr.querySelector(".ul-pick"); if (!cb || !cb.checked) return;
      var nm = tr.querySelector(".ul-name");
      out.push({ id: tr.getAttribute("data-id"), name: nm ? nm.value : "" });
    });
    return out;
  }
  function done(r, okText) {
    msg = r && r.ok ? okText(r) : (r && r.why) || "That did not work.";
    return load();
  }
  host.addEventListener("change", function (ev) {
    var a = ev.target.closest && ev.target.closest(".ul-all"); if (!a) return;
    a.closest("table").querySelectorAll(".ul-pick").forEach(function (cb) { cb.checked = a.checked; });
  });
  host.addEventListener("click", function (ev) {
    var b = ev.target.closest && ev.target.closest("button[data-ul]"); if (!b) return;
    var act = b.getAttribute("data-ul"), aside = act === "restore", sel = picked(aside ? ".ul-aside" : ".ul-wait");
    if (!sel.length) { msg = "Select at least one student first."; draw(); return; }
    var ids = sel.map(function (x) { return x.id; });
    if (act === "add") {
      if (!confirm("Add " + plural(sel.length, "student", "students") + " to the class list? Each gets an access code and their sign-in records move in.")) return;
      b.disabled = true; cmApp.unlistedAdd(sel).then(function (r) { return done(r, function (x) { return plural(x.added, "student was", "students were") + " added to the class list" + (x.moved && x.moved.held ? ", and " + plural(x.moved.held, "quiz result is", "quiz results are") + " held for release" : "") + "."; }); });
    } else if (act === "aside" || act === "discard") {
      var q = act === "discard" ? "Discard the records of " + plural(sel.length, "ID", "IDs") + "? They are deleted and cannot be restored." : "Keep " + plural(sel.length, "ID", "IDs") + " aside? Their records stay, hidden, and can be restored.";
      if (!confirm(q)) return;
      b.disabled = true; cmApp.unlistedReject(ids, act === "discard" ? "discard" : "aside").then(function (r) { return done(r, function (x) { return plural(x.rejected, "ID was", "IDs were") + (x.mode === "discard" ? " discarded." : " set aside."); }); });
    } else if (aside) {
      showAside = true; b.disabled = true; cmApp.unlistedRestore(ids).then(function (r) { return done(r, function (x) { return plural(x.restored, "ID is", "IDs are") + " back on the waiting list."; }); });
    }
  });
  document.addEventListener("click", function (ev) { var v = ev.target.closest && ev.target.closest("[data-view='roster']"); if (v) load(); });
  if (cmApp.onAutoChanged) cmApp.onAutoChanged(load);
  setInterval(function () { if (document.visibilityState === "visible") load(); }, 15000); // check-ins arrive while the screen is open
  load();
  window.cmUnlisted = { load: load };
})();
