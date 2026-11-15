/* The mailbox screen (app/mailbox.html). Every action goes through cmApp.mailbox*; the work is done in desktop/relay/. */
(function () {
  "use strict";
  var $ = function (i) { return document.getElementById(i); };
  if (!window.cmApp || !cmApp.mailboxStatus) { document.body.innerHTML = "<p style='padding:2rem'>Open this page from Class Manager.</p>"; return; }
  function say(t) { $("m-msg").textContent = t; }
  function show(s) {
    if (!s.configured) { say("Not set up. Phones keep each result and send it when CM can be reached."); return; }
    say("On. " + (s.at ? "Last check " + new Date(s.at).toLocaleTimeString() + (s.ok ? ": " + s.received + " collected." : ": not reached (" + s.why + ").") : "Checks every three minutes while CM is open."));
  }
  $("m-save").addEventListener("click", function () {
    cmApp.mailboxSetup({ url: $("m-url").value, drop: $("m-drop").value, pull: $("m-pull").value }).then(function (r) {
      if (!r.ok) { say(r.why); return; } $("m-pull").value = ""; return cmApp.mailboxStatus().then(show);
    });
  });
  $("m-pullnow").addEventListener("click", function () { say("Collecting…"); cmApp.mailboxPull().then(function (r) { show(r); }); });
  $("m-clear").addEventListener("click", function () { cmApp.mailboxClear().then(function () { return cmApp.mailboxStatus(); }).then(show); });
  cmApp.mailboxStatus().then(show);
})();
