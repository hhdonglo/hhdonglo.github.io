/* The LMS connector screen (app/lms.html). Every action goes through cmApp.lms*; the work is done in desktop/lms/. */
(function () {
  "use strict";
  var $ = function (i) { return document.getElementById(i); };
  if (!window.cmApp || !cmApp.lmsState) { document.body.innerHTML = "<p style='padding:2rem'>Open this page from Class Manager.</p>"; return; }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function n(k, one, many) { return k + " " + (k === 1 ? one : many); }

  function fill(st) {
    var c = st.config;
    $("l-prof").innerHTML = st.profiles.map(function (p) { return "<option value='" + p.id + "'>" + esc(p.label) + "</option>"; }).join("");
    $("l-prof").value = c.profile;
    $("c-on").checked = c.enabled; $("c-id").value = c.clientId; $("c-tok").value = c.tokenUrl; $("c-mem").value = c.membersUrl; $("c-li").value = c.lineItemsUrl;
    $("l-assess").innerHTML = st.assessments.length ? st.assessments.map(function (a) {
      return "<label><input type='checkbox' value='" + a.column + "'> " + esc(a.name) + " <span class='note'>(" + a.scored + " scored, out of " + a.outOf + ")</span></label>";
    }).join("") : "<p class='note'>No assessments yet: they appear here once students have scores.</p>";
    var off = !c.enabled; $("l-svc").disabled = off; $("l-dry").disabled = off; $("l-send").disabled = off;
  }
  function refresh() { return cmApp.lmsState().then(fill); }
  function chosen() { return Array.prototype.map.call(document.querySelectorAll("#l-assess input:checked"), function (i) { return Number(i.value); }); }

  function drawPlan(r) {
    if (!r) return;
    if (!r.ok) { $("l-plan").innerHTML = "<p class='err'>" + esc(r.why) + "</p>"; return; }
    var p = r.plan, h = "<p><b>" + esc(r.source) + "</b>: " + p.total + " students; " + p.matched + " already in CM.</p>";
    if (r.skipped) h += "<p class='warn'>" + n(r.skipped, "row has", "rows have") + " no valid student ID and " + (r.skipped === 1 ? "was" : "were") + " skipped.</p>";
    if (r.unmatched) h += "<p class='warn'>" + r.unmatched + " LMS learners have no student number and cannot be matched.</p>";
    if (p.nameDiffers.length) h += "<p class='warn'>" + p.nameDiffers.length + " students have a different name in the LMS. CM keeps its own.</p>";
    if (p.notInLms.length) h += "<p class='warn'>" + n(p.notInLms.length, "student", "students") + " in CM " + (p.notInLms.length === 1 ? "is" : "are") + " not in the LMS. Left as is.</p>";
    if (p.toAdd.length) h += "<p>" + p.toAdd.length + " students are in the LMS but not in CM.</p><p><button class='b p' type='button' id='l-add'>Add these " + p.toAdd.length + " to the class list</button></p>";
    else h += "<p>Nothing to add: the class list already has every student.</p>";
    $("l-plan").innerHTML = h;
    if ($("l-add")) $("l-add").onclick = function () {
      if (!confirm("Add " + p.toAdd.length + " students to the class list? A backup is made first.")) return;
      cmApp.lmsRosterApply({ addMissing: true }).then(function (d) { $("l-plan").innerHTML = d.ok ? "<p>Added " + d.added + " students.</p>" : "<p class='err'>" + esc(d.why) + "</p>"; });
    };
  }

  $("l-file").onclick = function () { cmApp.lmsRosterFile({ profile: $("l-prof").value }).then(drawPlan); };
  $("l-svc").onclick = function () { $("l-plan").innerHTML = "<p>Contacting the LMS…</p>"; cmApp.lmsRosterService().then(drawPlan); };
  $("l-csv").onclick = function () {
    cmApp.lmsGradebookFile({ columns: chosen(), profile: $("l-prof").value }).then(function (r) {
      if (r) $("l-gmsg").innerHTML = r.ok ? "Saved for " + r.students + " students; " + r.noScores + " had no score in the chosen assessments." : "<span class='err'>" + esc(r.why) + "</span>";
    });
  };
  function service(dry) {
    $("l-gmsg").textContent = "Contacting the LMS…";
    cmApp.lmsGradesService({ columns: chosen(), dryRun: dry }).then(function (r) {
      if (!r.ok) { $("l-gmsg").innerHTML = "<span class='err'>" + esc(r.why) + "</span>"; return; }
      var t = r.report.assessments.map(function (a) { return esc(a.name) + ": " + (r.dryRun ? a.would + " would be sent" : a.sent + " sent" + (a.failed ? ", " + a.failed + " failed" : "")); }).join("; ");
      if (r.report.notInLms.length) t += ". " + r.report.notInLms.length + " students with scores are not in the LMS roster and were skipped.";
      $("l-gmsg").textContent = t;
    });
  }
  $("l-dry").onclick = function () { service(true); };
  $("l-send").onclick = function () { if (confirm("Send the chosen scores to the LMS gradebook now?")) service(false); };
  $("c-save").onclick = function () {
    cmApp.lmsSave({ enabled: $("c-on").checked, profile: $("l-prof").value, clientId: $("c-id").value, tokenUrl: $("c-tok").value, membersUrl: $("c-mem").value, lineItemsUrl: $("c-li").value })
      .then(function (r) { fill(Object.assign({ profiles: [], assessments: [] }, r)); return refresh(); }).then(function () { $("c-msg").textContent = "Saved. Addresses that do not start with https are not kept."; });
  };
  $("c-reg").onclick = function () { cmApp.lmsToolConfig().then(function (r) { if (r) $("c-msg").textContent = r.ok ? "Saved. Give this file to the LMS administrator." : r.why; }); };
  refresh();
})();
