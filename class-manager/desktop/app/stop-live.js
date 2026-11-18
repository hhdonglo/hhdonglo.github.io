/* Stop buttons on Class Tools (Live activity): Stop attendance and Stop quiz.
   One job: stop what is running and hand the result to the "Held, waiting for your decision" card. Stopping records nothing for students and never submits.
   Backend actions: attend_close, control (act=end for a running quiz, act=reset to close a lobby). Pure helpers are tested in Node. */
(function (root) {
  "use strict";
  var ASK = {
    attendance: "Stop attendance? Check-ins are held, not recorded. You decide to Submit or Discard them under \"Held, waiting for your decision\".",
    lobby: function (code) { return "Close the waiting room of quiz " + code + "? Students who joined are sent back to wait; nothing is recorded."; },
  quiz: function (code) { return "Stop quiz " + code + "? Answers so far are held, not recorded. You decide to Submit or Discard them under \"Held, waiting for your decision\"."; }
  };
  /* The backend call for each stop. */
  function stopQuery(kind, code, state) { return kind === "attendance" ? "action=attend_close" : "action=control&act=" + (state === "lobby" ? "reset" : "end") + "&code=" + encodeURIComponent(code); }
  var api = { ASK: ASK, stopQuery: stopQuery };
  if (typeof module !== "undefined" && module.exports) { module.exports = api; return; }
  root.CMStopLive = api;

  var $ = function (i) { return document.getElementById(i); };
  var KEY = ""; try { KEY = sessionStorage.getItem("cm_hk") || ""; } catch (x) { /* storage blocked */ }
  function stop(kind, code, state) {
    var ask = kind === "quiz" ? (state === "lobby" ? ASK.lobby(code) : ASK.quiz(code)) : ASK.attendance; if (!window.confirm(ask)) return;
    var msg = $("ac-msg"); if (msg) msg.textContent = "Stopping.";
    window.CM.call(stopQuery(kind, code, state) + "&hostkey=" + encodeURIComponent(KEY), function (d) {
      if (msg) msg.textContent = !d || d.ok === false ? "Not stopped: " + (d && d.why ? d.why : "no answer") : (kind === "quiz" ? (state === "lobby" ? "Waiting room of quiz " + code + " closed." : "Quiz " + code + " stopped and held. Submit or discard it below.") : "Attendance stopped and held. Submit or discard it below.");
      window.dispatchEvent(new Event("cm:held")); if (window.livePoll) window.livePoll();
    }, 30000);
  }
  function init() {
    if (!window.CM) return;
    document.addEventListener("click", function (e) {
      var q = e.target.closest && e.target.closest("[data-stop-quiz]"); if (q) { stop("quiz", q.getAttribute("data-stop-quiz"), q.getAttribute("data-state") || ""); return; }
      if (e.target.closest && e.target.closest("#att-stop")) stop("attendance");
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})(typeof window !== "undefined" ? window : this);
