/* Class Manager: "Reset…" for one course (Manage courses). The lecturer chooses what to reset, types the course code to confirm,
   a backup is made first, and the chosen parts are moved aside, not deleted. Earlier resets are listed here and can be restored.
   The work is done by course-reset.js; this file only lays the screen out. */
(function () {
  "use strict";
  if (!window.cmApp || !cmApp.resetCourse) return;
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  var d = document.createElement("dialog");
  d.id = "rst-d"; d.setAttribute("aria-labelledby", "rst-h"); d.style.width = "min(40rem, 94vw)";
  d.innerHTML = "<h2 id='rst-h'>Reset this course</h2><div id='rst-body'></div>";
  document.body.appendChild(d);
  var body = d.querySelector("#rst-body"), id = "", code = "";

  function when(s) { try { return new Date(s).toLocaleString(); } catch (e) { return s; } }
  function drawList(list) {
    return list && list.length ? "<h3 style='margin-top:1rem'>Earlier resets</h3><ul class='note' style='line-height:2'>" + list.map(function (r) {
      return "<li>" + esc(when(r.made)) + " · " + (r.scope === "all" ? "everything" : "setup only") + " <button class='btn sm' type='button' data-restore='" + esc(r.name) + "'>Restore</button></li>"; }).join("") + "</ul>" : "";
  }
  function show(list, msg) {
    var want = code || "RESET";
    body.innerHTML =
      "<p>Not happy with how this course was set up? Start it again. <strong>Nothing is deleted:</strong> a backup is made first, and the parts you choose are moved into a folder inside the course's data folder. You can restore them below.</p>" +
      "<fieldset style='border:0;padding:0;margin:.6rem 0'><legend class='lbl'>What to reset</legend>" +
      "<label style='display:block;margin:.4rem 0'><input type='radio' name='rst-scope' value='all' checked> <strong>Everything for this course.</strong> Course details, lectures and materials, approved questions and the library, the class list, scores, attendance, analytics and access codes. The course starts empty. It is moved aside, so you can restore it.</label>" +
      "<label style='display:block;margin:.4rem 0'><input type='radio' name='rst-scope' value='setup'> <strong>Setup only.</strong> As above, but the class list, scores and attendance stay.</label></fieldset>" +
      "<label class='lbl' for='rst-confirm'>Type <strong>" + esc(want) + "</strong> to confirm</label><input class='f' id='rst-confirm' autocomplete='off' style='max-width:14rem'>" +
      "<p class='msg' id='rst-msg' role='status'>" + esc(msg || "") + "</p>" + drawList(list) +
      "<p class='row' style='justify-content:flex-end;margin-top:14px'><button class='btn' type='button' id='rst-close'>Close</button><button class='btn danger' type='button' id='rst-go'>Reset</button></p>";
    body.querySelector("#rst-close").onclick = function () { d.close(); };
    body.querySelector("#rst-go").onclick = function () {
      var scope = body.querySelector("input[name=rst-scope]:checked").value, typed = body.querySelector("#rst-confirm").value;
      body.querySelector("#rst-msg").textContent = "Making a backup, then resetting…";
      cmApp.resetCourse(id, { scope: scope, confirm: typed }).then(function (r) {
        if (!r || !r.ok) return show(list, r && r.why);
        if (r.url) { location.href = r.url; return; }
        show(r.list, "Done. The parts were moved aside and can be restored below.");
      });
    };
    Array.prototype.forEach.call(body.querySelectorAll("[data-restore]"), function (b) {
      b.onclick = function () {
        if (!confirm("Restore this reset? What is in the course now is moved aside first, so this can be undone too.")) return;
        cmApp.resetRestore(id, b.getAttribute("data-restore")).then(function (r) { if (r && r.ok && r.url) { location.href = r.url; return; } show(r && r.list || list, r && r.ok ? "Restored." : (r && r.why)); });
      };
    });
  }
  document.addEventListener("click", function (e) {
    var b = e.target.closest && e.target.closest("[data-cact=reset]"); if (!b) return;
    id = b.getAttribute("data-id");
    var inp = document.querySelector("[data-cf=code][data-id='" + id + "']"); code = inp ? inp.value.trim() : "";
    cmApp.resetList(id).then(function (r) { show(r && r.list || []); d.showModal(); });
  });
})();
