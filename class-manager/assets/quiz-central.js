/* Quiz administration: central control of every quiz that is running or waiting, from the one quiz window.
   Lists each quiz (code, title, state, how many joined) with Open and Stop buttons and a Stop all quizzes button.
   Only in the CM desktop window (it asks CM which quizzes are live: cmApp.live); a browser or phone never sees this panel.
   Stopping a running quiz holds its answers for you to submit or discard (as on Class Tools); closing a waiting room only sends students back to wait.
   Pure helpers (stopPlan, rows) are tested in desktop/test/quiz-central.test.js. */
(function (root) {
  "use strict";
  var STATE = { lobby: "Waiting room", running: "Running", paused: "Paused" };
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  /* What stopping each quiz sends: running or paused ends it, a waiting room is closed (reset). */
  function stopPlan(quizzes) {
    return (quizzes || []).map(function (q) { return { code: q.code, act: q.state === "lobby" ? "reset" : "end" }; });
  }
  function rows(quizzes, current) {
    return (quizzes || []).map(function (q) {
      return "<div class='qc-row'" + (q.code === current ? " aria-current='true'" : "") + "><b>" + esc(q.code) + "</b><span>" + esc(q.title || "Quiz") + "</span><span class='note'>" + (STATE[q.state] || esc(q.state)) +
        ", " + (q.joined || 0) + " joined</span><span class='qc-btns'>" +
        (q.code === current ? "<span class='badge'>Shown below</span>" : "<button class='go alt' type='button' data-qc-open='" + esc(q.code) + "'>Open</button>") +
        "<button class='go alt' type='button' data-qc-stop='" + esc(q.code) + "' data-state='" + esc(q.state) + "'>" + (q.state === "lobby" ? "Close lobby" : "Stop quiz") + "</button></span></div>";
    }).join("");
  }
  var api = { stopPlan: stopPlan, rows: rows };
  if (typeof module !== "undefined" && module.exports) { module.exports = api; return; }
  root.CMQuizCentral = api;

  var host = document.getElementById("h-all");
  if (!host || !window.cmApp || !cmApp.live || !window.CM) return;
  var KEY = ""; try { KEY = sessionStorage.getItem("cm_hk") || ""; } catch (x) { /* storage blocked */ }
  if (!KEY) return;
  var list = [], busy = false;
  function current() { var m = /[?&]code=([^&]+)/.exec(location.search); return m ? decodeURIComponent(m[1]).toUpperCase() : ""; }
  function draw() {
    host.hidden = !list.length;
    host.innerHTML = list.length ? "<h3 style='margin:.1rem 0 .4rem'>All quizzes</h3><div id='qc-list'>" + rows(list, current()) + "</div>" +
      "<p><button class='go' type='button' id='qc-all'>Stop all quizzes</button> <span class='note' id='qc-msg' role='status'></span></p>" : "";
  }
  function poll() { if (busy || document.visibilityState !== "visible") return; cmApp.live().then(function (d) { list = (d && d.quizzes) || []; draw(); }, function () {}); }
  function send(p, done) { // one control call per quiz, in turn
    CM.call("action=control&act=" + p.act + "&code=" + encodeURIComponent(p.code) + "&hostkey=" + encodeURIComponent(KEY), function (d) { done(!d || d.ok === false ? (d && d.why) || "no answer" : ""); }, 30000);
  }
  function run(plans, ask, okText) {
    if (!plans.length || !window.confirm(ask)) return;
    busy = true; var msg = document.getElementById("qc-msg"), fails = [];
    (function next(i) {
      if (i >= plans.length) { busy = false; if (msg) msg.textContent = fails.length ? "Not stopped: " + fails.join("; ") : okText; poll(); return; }
      send(plans[i], function (why) { if (why) fails.push(plans[i].code + " (" + why + ")"); next(i + 1); });
    })(0);
  }
  host.addEventListener("click", function (e) {
    var o = e.target.closest && e.target.closest("[data-qc-open]"); if (o) { location.href = "quiz-host.html?code=" + encodeURIComponent(o.getAttribute("data-qc-open")); return; }
    var s = e.target.closest && e.target.closest("[data-qc-stop]");
    if (s) { var code = s.getAttribute("data-qc-stop"), lobby = s.getAttribute("data-state") === "lobby";
      run([{ code: code, act: lobby ? "reset" : "end" }], lobby ? "Close the waiting room of quiz " + code + "? Nothing is recorded." : "Stop quiz " + code + "? Answers so far are held, not recorded. You decide to submit or discard them.", "Done."); return; }
    if (e.target.closest && e.target.closest("#qc-all")) run(stopPlan(list), "Stop all " + list.length + " quizzes? Running quizzes are stopped and held for you to submit or discard; waiting rooms are closed. Nothing is recorded for students.", "All stopped. Submit or discard the held results on Class Tools.");
  });
  poll(); setInterval(poll, 4000);
})(typeof window !== "undefined" ? window : this);
