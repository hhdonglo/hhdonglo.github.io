/* After class card on Class Tools: records held until the lecturer decides (closed attendance sessions and quiz results).
   One job: submit or discard them, each after a confirmation. It uses the same backend actions the Control Centre used
   (held_status, attend_submit, attend_discard, held_release_quiz, held_discard_quiz). Pure helpers are tested in Node. */
(function (root) {
  "use strict";

  /* The summary lines from the "held_status" answer d: {ok, quiz, sessions: [{label, present}]} */
  function heldText(d) {
    if (!d || d.ok !== true) return { sessions: "Held attendance: unavailable", quiz: "Held quiz results: unavailable", list: [], total: 0 };
    var total = 0; d.sessions.forEach(function (x) { total += x.present; });
    return {
      sessions: d.sessions.length ? "Held sessions: " + d.sessions.length + ", " + total + " checked in" : "Held sessions: none",
      quiz: "Quiz results held: " + d.quiz,
      list: d.sessions.map(function (x) { return x.label + ": " + x.present + " checked in"; }),
      total: total
    };
  }

  /* What a button press asks and says, by action. */
  var ACTIONS = {
    attend_submit: { ask: "Submit attendance? Every student on the class list who is not checked in is recorded as 0.", done: function (d) { return "Attendance submitted: " + (d.submitted || []).join(", ") + "."; }, msg: "ac-msg" },
    attend_discard: { ask: "Discard the closed attendance session and its check-ins? This cannot be undone.", done: function (d) { return "Discarded " + d.discarded + " session(s), " + d.checkins + " check-in(s)."; }, msg: "ac-msg" },
    held_release_quiz: { ask: "Release all held quiz results into the record now? Grades and totals are updated.", done: function (d) { return "Released " + d.released + " quiz result(s)."; }, msg: "ac-qmsg" },
    held_discard_quiz: { ask: "Discard all held quiz results? This cannot be undone.", done: function (d) { return "Discarded " + d.discarded + " held result(s)."; }, msg: "ac-qmsg" }
  };

  var api = { heldText: heldText, ACTIONS: ACTIONS };
  if (typeof module !== "undefined" && module.exports) { module.exports = api; return; }
  root.CMAfterClass = api;

  var $ = function (i) { return document.getElementById(i); };
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); };
  var KEY = ""; try { KEY = sessionStorage.getItem("cm_hk") || ""; } catch (x) { /* storage blocked */ }
  var call = function (q, cb, ms) { window.CM.call(q + "&hostkey=" + encodeURIComponent(KEY), cb, ms); };

  function load() {
    call("action=held_status", function (d) {
      var t = heldText(d);
      $("ac-sum").textContent = t.sessions; $("ac-qsum").textContent = t.quiz;
      $("ac-list").innerHTML = t.list.map(function (l) { return "<li>" + esc(l) + "</li>"; }).join("");
    });
  }
  function act(name) {
    var a = ACTIONS[name]; if (!window.confirm(a.ask)) return;
    $(a.msg).textContent = "Working.";
    call("action=" + name, function (d) { $(a.msg).textContent = !d || d.ok !== true ? "Not done: " + (d && d.why ? d.why : "no answer") : a.done(d); load(); }, 30000);
  }
  function init() {
    if (!$("ac-sum") || !window.CM) return;
    document.querySelectorAll("[data-held]").forEach(function (b) { b.addEventListener("click", function () { act(b.getAttribute("data-held")); }); });
    load(); setInterval(function () { if (document.visibilityState === "visible") load(); }, 15000);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})(typeof window !== "undefined" ? window : this);
