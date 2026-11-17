/* Student pages: the warning a student sees when their ID is not on the class list.
   One responsibility: show one clear notice, once, and keep it on screen. The decision is never made here: the class server (CM) or the relay says
   `onList: false`, and CM holds the student's sign-ins apart until the lecturer decides (desktop/rules/unlisted.js). */
(function () {
  "use strict";
  var TEXT = "Your ID is not on the class list. Your attendance and quiz answers are recorded, but kept apart and not counted until your lecturer has checked. Please ask your lecturer.";
  function show(id) {
    var el = document.getElementById("unl-note");
    if (!el) {
      el = document.createElement("p"); el.id = "unl-note"; el.setAttribute("role", "alert");
      el.style.cssText = "position:sticky;top:0;z-index:50;margin:0;padding:.7rem 1rem;background:#fff4d6;color:#4a3500;border-bottom:3px solid #d6a736;font-weight:600;font-size:1rem;text-align:center";
      document.body.insertBefore(el, document.body.firstChild);
    }
    el.textContent = (id ? "Student ID " + id + ": " : "") + TEXT;
  }
  // After a quiz, on the final screen, under the score: a quiet notice in place (never a bar at the top while the student is answering).
  var END_TEXT = "Your ID is not on the class list. Your answers are kept apart and are not counted until your lecturer has checked. Please see your lecturer.";
  function showEnd(id, host) {
    if (!host) return;
    var el = document.getElementById("unl-end");
    if (!el) { el = document.createElement("p"); el.id = "unl-end"; el.setAttribute("role", "status"); el.style.cssText = "margin:.9rem 0 0;padding:.7rem 1rem;background:#fff4d6;color:#4a3500;border-left:4px solid #d6a736;border-radius:6px;font-weight:600"; host.appendChild(el); }
    el.textContent = (id ? "Student ID " + id + ". " : "") + END_TEXT;
  }
  window.cmUnlistedNotice = { show: show, showEnd: showEnd, TEXT: TEXT, END_TEXT: END_TEXT };
})();
