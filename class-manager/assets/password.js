/* Lecturer password page (password.html): choose or change the password, or recover it with the recovery code.
   Only this page talks to the password actions of the class server (apps_script/src/06-password.gs). */
(function () {
  "use strict";
  var $ = function (i) { return document.getElementById(i); };
  var MIN = 10;

  function say(id, text, bad) { var o = $(id); o.textContent = text; o.className = "note" + (bad ? " bad" : ""); o.hidden = !text; }
  function showCode(code) { // the recovery code is shown once, with a copy button
    $("rc-code").textContent = code;
    $("rc").hidden = false; $("p-set").hidden = $("p-recover").hidden = true;
    $("rc").scrollIntoView({ block: "center" });
  }
  function check(n, m) {
    if (n.length < MIN) return "The password must have at least " + MIN + " characters. A few words make a good one.";
    if (n !== m) return "The two new passwords do not match.";
    return "";
  }

  CM.call("action=password_status", function (s) {
    var chosen = !!(s && s.chosen);
    $("first").hidden = chosen; $("change-cur").hidden = false;
    $("cur-label").textContent = chosen ? "Current password" : "Temporary key (shown in the app, or in the Key tab of the Sheet)";
    $("set-title").textContent = chosen ? "Change the password" : "Choose your password";
    if (location.hash === "#recover" && s && s.recovery) { $("p-set").hidden = true; $("p-recover").hidden = false; }
    $("to-recover").hidden = !(s && s.recovery);
    $("no-recovery").hidden = !!(s && s.recovery);
  });

  $("set-form").addEventListener("submit", function (e) {
    e.preventDefault();
    var c = $("cur").value.trim(), n = $("new").value, m = $("new2").value, bad = check(n, m);
    if (bad) return say("set-msg", bad, true);
    say("set-msg", "Working...");
    CM.call("action=setkey&hostkey=" + encodeURIComponent(c) + "&newkey=" + encodeURIComponent(n), function (d) {
      if (!d) return say("set-msg", "Could not reach the class server.", true);
      if (!d.ok) return say("set-msg", "Not changed: " + (d.why || "refused"), true);
      try { sessionStorage.removeItem("cm_hk"); } catch (x) { /* none */ }
      $("cur").value = $("new").value = $("new2").value = "";
      showCode(d.recovery);
    });
  });

  $("rec-form").addEventListener("submit", function (e) {
    e.preventDefault();
    var r = $("rec").value, n = $("rnew").value, m = $("rnew2").value, bad = check(n, m);
    if (bad) return say("rec-msg", bad, true);
    say("rec-msg", "Working...");
    CM.call("action=password_recover&recovery=" + encodeURIComponent(r) + "&newkey=" + encodeURIComponent(n), function (d) {
      if (!d) return say("rec-msg", "Could not reach the class server.", true);
      if (!d.ok) return say("rec-msg", d.why || "Not accepted.", true);
      try { sessionStorage.removeItem("cm_hk"); } catch (x) { /* none */ }
      $("rec").value = $("rnew").value = $("rnew2").value = "";
      showCode(d.recovery);
    });
  });

  $("to-recover").addEventListener("click", function () { $("p-set").hidden = true; $("p-recover").hidden = false; });
  $("to-set").addEventListener("click", function () { $("p-set").hidden = false; $("p-recover").hidden = true; });
  $("rc-copy").addEventListener("click", function () {
    try { navigator.clipboard.writeText($("rc-code").textContent); $("rc-copy").textContent = "Copied"; } catch (x) { $("rc-copy").textContent = "Select and copy it"; }
  });
})();
