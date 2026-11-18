/* "Back to Class Tools" link in a tool window (Attendance, Quiz). Inside CM it asks CM to bring the existing main window forward and close this tool window
   (no second window, no reload of the dashboard). In any other browser the link keeps working as an ordinary link to Class Tools.
   Mark the link with data-back-tools. Logic of choosing the window: desktop/back-to-tools.js. */
(function () {
  "use strict";
  document.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest("a[data-back-tools]");
    if (!a || !window.cmApp || !window.cmApp.backToTools || e.defaultPrevented || e.button) return;
    e.preventDefault();
    window.cmApp.backToTools().then(function (r) { if (!r || r.ok === false) window.location.href = a.getAttribute("href"); }, function () { window.location.href = a.getAttribute("href"); });
  });
})();
