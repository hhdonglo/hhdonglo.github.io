/* "Held, waiting for your decision" card on Class Tools (file name kept: after-class.js).
   Stopping attendance or a quiz records nothing for students. What was stopped waits here, one row per attendance session and per quiz,
   and each row has Submit (record it against the class list, grades and attendance totals) and Discard (erase it), both after a confirmation.
   Backend actions: held_items, attend_submit, attend_discard, held_release_quiz, held_discard_quiz (rules/held.js). Pure helpers are tested in Node. */
(function (root) {
  "use strict";

  /* One row to show for each held thing, from the "held_items" answer d: {ok, sessions: [{code, label, present, absent, notOnList}], quizzes: [{code, round, title, count}]}. */
  function rowsOf(d) {
    if (!d || d.ok !== true) return [];
    var rows = [];
    (d.sessions || []).forEach(function (s) {
      rows.push({ kind: "attendance", name: "Attendance " + s.label, detail: s.present + " checked in, " + s.absent + " not" + (s.notOnList ? ", " + s.notOnList + " not on the class list (kept apart)" : ""),
        params: "session=" + encodeURIComponent(s.code), submit: "attend_submit", discard: "attend_discard", what: "attendance " + s.label });
    });
    (d.quizzes || []).forEach(function (q) {
      var nm = "Quiz " + q.code + (q.title ? ", " + q.title : "") + (q.round ? " (round " + q.round + ")" : "");
      rows.push({ kind: "quiz", name: nm, detail: q.count + " result" + (q.count === 1 ? "" : "s"),
        params: "code=" + encodeURIComponent(q.code) + "&round=" + encodeURIComponent(q.round), submit: "held_release_quiz", discard: "held_discard_quiz", what: nm });
    });
    return rows;
  }

  /* What a button press asks and says, by action. */
  var ACTIONS = {
    attend_submit: { ask: function (r) { return "Submit " + r.what + "? It is recorded against the class list and the attendance totals. Every listed student who is not checked in is recorded as 0."; }, done: function (d) { return "Submitted: " + (d.submitted || []).join(", ") + "."; } },
    attend_discard: { ask: function (r) { return "Discard " + r.what + "? Its check-ins are erased and nothing is recorded. This cannot be undone."; }, done: function (d) { return "Discarded " + d.discarded + " session, " + d.checkins + " check-in(s) erased."; } },
    held_release_quiz: { ask: function (r) { return "Submit " + r.what + "? Its results are recorded against the class list and the grades are updated."; }, done: function (d) { return "Submitted " + d.released + " quiz result(s)."; } },
    held_discard_quiz: { ask: function (r) { return "Discard " + r.what + "? Its results are erased and nothing is recorded. This cannot be undone."; }, done: function (d) { return "Discarded " + d.discarded + " quiz result(s)."; } }
  };

  var EMPTY = "Nothing is held. When you stop attendance or a quiz, it waits here until you submit or discard it.";
  var api = { rowsOf: rowsOf, ACTIONS: ACTIONS, EMPTY: EMPTY };
  if (typeof module !== "undefined" && module.exports) { module.exports = api; return; }
  root.CMAfterClass = api;

  var $ = function (i) { return document.getElementById(i); };
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); };
  var KEY = ""; try { KEY = sessionStorage.getItem("cm_hk") || ""; } catch (x) { /* storage blocked */ }
  var call = function (q, cb, ms) { window.CM.call(q + "&hostkey=" + encodeURIComponent(KEY), cb, ms); };
  var rows = [];

  function draw() {
    $("ac-list").innerHTML = rows.length ? rows.map(function (r, i) {
      return "<li class='held-row'><div><b>" + esc(r.name) + "</b><span class='note'>" + esc(r.detail) + "</span></div><div class='row'>" +
        "<button class='btn primary sm' type='button' data-i='" + i + "' data-do='submit'>Submit</button>" +
        "<button class='btn sm' type='button' data-i='" + i + "' data-do='discard'>Discard</button></div></li>";
    }).join("") : "<li class='note'>" + EMPTY + "</li>";
    var tag = $("ac-tag"); if (tag) { tag.textContent = rows.length ? rows.length + " waiting" : "Nothing held"; tag.className = "tag" + (rows.length ? " held" : ""); }
  }
  function load() {
    call("action=held_items", function (d) {
      if (!d || d.ok !== true) { $("ac-list").innerHTML = "<li class='note'>Held items are unavailable.</li>"; return; }
      rows = rowsOf(d); draw();
    });
  }
  function act(r, which) {
    var name = r[which], a = ACTIONS[name]; if (!window.confirm(a.ask(r))) return;
    $("ac-msg").textContent = "Working.";
    call("action=" + name + "&" + r.params, function (d) { $("ac-msg").textContent = !d || d.ok !== true ? "Not done: " + (d && d.why ? d.why : "no answer") : a.done(d); load(); }, 30000);
  }
  function init() {
    if (!$("ac-list") || !window.CM) return;
    $("ac-list").addEventListener("click", function (e) {
      var b = e.target.closest && e.target.closest("button[data-do]"); if (b) act(rows[Number(b.getAttribute("data-i"))], b.getAttribute("data-do"));
    });
    load(); setInterval(function () { if (document.visibilityState === "visible") load(); }, 15000);
    window.addEventListener("cm:held", load);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})(typeof window !== "undefined" ? window : this);
