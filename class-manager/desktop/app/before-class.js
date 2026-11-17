/* Before class card on Class Tools: today's lecture (week, join code, handout) and the pre-class check.
   One job: show what to confirm before teaching. It reads and writes through CM.call, as the old Control Centre did.
   The pure helpers (weekText, checkLines) have no page code, so tests can run them in Node. */
(function (root) {
  "use strict";
  var DEFAULT_BASE = "2627";

  /* One line of the pre-class check: level is ok, warn or bad. */
  function line(level, text) { return { level: level, text: text }; }

  /* The check lines from the backend answers. d is the "preclass" answer, loc is {ok, accuracy} or {error}, seen is the projector tick. */
  function checkLines(d, loc, seen) {
    var L = [];
    if (!d || d.ok !== true) L.push(line("bad", "CM did not answer the checks: " + (d && d.why ? d.why : "no answer") + "."));
    else {
      L.push(line("ok", "CM responds"));
      L.push(d.rosterCount > 0 ? line("ok", "Class list loaded: " + d.rosterCount + " IDs") : line("bad", "The class list is empty. Add students on the Class Roster page before opening attendance."));
      if (d.week) L.push(d.weekListed && d.bankQuestions > 0 ? line("ok", "Quiz bank for Week " + d.week + " present (" + d.bankQuestions + " questions)") : line("bad", "No quiz bank for Week " + d.week + ". Load the course pack or add a bank under Course and Content."));
      L.push(d.masterOn ? line("ok", "Results recording is on (totals: " + (d.totalsMode || "Best") + ")") : line("warn", "Results recording is off: scores are not written to the record."));
    }
    L.push(seen ? line("ok", "Projector display seen (confirmed by you)") : line("warn", "Projector display not confirmed. Open the display, look at the real screen, then tick the box."));
    if (loc && loc.error === "none") L.push(line("bad", "This window has no location. Attendance needs it on the device you teach from."));
    else if (loc && loc.error) L.push(line("bad", "Location is blocked. Allow it before opening attendance."));
    else if (loc) L.push(line(loc.accuracy > 100 ? "warn" : "ok", "Location works (accuracy about " + Math.round(loc.accuracy) + " m)"));
    return L;
  }

  /* "Week 3, Lecture 3: Newton's laws" from the course settings (data/portal.json). */
  function weekText(cfg, week) { return "Week " + week + ", Lecture " + week + ": " + ((cfg && cfg.lectures && cfg.lectures[week]) || ""); }

  var api = { checkLines: checkLines, weekText: weekText, DEFAULT_BASE: DEFAULT_BASE };
  if (typeof module !== "undefined" && module.exports) { module.exports = api; return; }
  root.CMBeforeClass = api;

  /* ---- page wiring (browser only) ---- */
  var $ = function (i) { return document.getElementById(i); };
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); };
  var KEY = ""; try { KEY = sessionStorage.getItem("cm_hk") || ""; } catch (x) { /* storage blocked */ }
  var hk = function () { return "hostkey=" + encodeURIComponent(KEY); };
  var call = function (q, cb, ms) { window.CM.call(q, cb, ms); };
  var CFG = null, WEEK = null, BASE = DEFAULT_BASE;

  function showWeek() {
    if (!CFG || !WEEK) return;
    $("bc-lec").innerHTML = "<b>" + esc(weekText(CFG, WEEK)) + "</b><br><span class='note'>" + esc(CFG.contacts || "") + "</span>";
    $("bc-code").textContent = BASE + WEEK;
    var h = CFG.handouts && CFG.handouts[WEEK];
    $("bc-hand").hidden = !h; if (h) $("bc-hand").setAttribute("href", "../" + h);
  }
  function loadWeek() {
    call("action=portal_status", function (d) {
      var chosen = d && d.portal === 1 && d.week >= 1 ? d.week : 0;
      WEEK = chosen || (CFG && CFG.currentWeek);
      $("bc-week").value = String(chosen);
      $("bc-wmsg").textContent = chosen ? "Chosen by you. The Portal follows it." : "Using the default in data/portal.json.";
      showWeek();
    });
  }
  function loadCourse() {
    var x = new XMLHttpRequest(); x.open("GET", "../data/portal.json?_=" + Date.now());
    x.onload = function () {
      try { CFG = JSON.parse(x.responseText); } catch (e) { $("bc-lec").textContent = "Could not read data/portal.json."; return; }
      for (var i = 1; i <= 12; i++) { var o = document.createElement("option"); o.value = i; o.textContent = "Week " + i + ": " + (CFG.lectures[i] || ""); $("bc-week").appendChild(o); }
      WEEK = CFG.currentWeek; showWeek(); loadWeek();
    };
    x.onerror = function () { $("bc-lec").textContent = "Could not read data/portal.json."; };
    x.send();
  }
  function render(L) {
    $("bc-list").innerHTML = L.map(function (l) { return "<li class='" + l.level + "'><b aria-hidden='true'>" + (l.level === "ok" ? "&#10003;" : l.level === "warn" ? "!" : "&times;") + "</b><span>" + esc(l.text) + "</span></li>"; }).join("");
  }
  function runChecks() {
    var btn = $("bc-run"); btn.disabled = true; $("bc-list").innerHTML = "<li class='note'>Running.</li>";
    call("action=preclass&week=" + encodeURIComponent(WEEK || "") + "&" + hk(), function (d) {
      var done = function (loc) { render(checkLines(d, loc, $("bc-proj").checked)); btn.disabled = false; };
      if (!navigator.geolocation) { done({ error: "none" }); return; }
      navigator.geolocation.getCurrentPosition(function (p) { done({ accuracy: p.coords.accuracy }); }, function () { done({ error: "blocked" }); }, { timeout: 10000, maximumAge: 60000 });
    }, 12000);
  }
  function init() {
    if (!$("bc-run") || !window.CM) return;
    loadCourse();
    $("bc-week").addEventListener("change", function () {
      $("bc-wmsg").textContent = "Saving.";
      call("action=set_week&w=" + encodeURIComponent($("bc-week").value) + "&" + hk(), function (d) {
        if (!d || d.ok !== true) { $("bc-wmsg").textContent = "Not saved: " + (d && d.why ? d.why : "no answer") + "."; return; }
        loadWeek();
      });
    });
    $("bc-base-save").addEventListener("click", function () {
      $("bc-bmsg").textContent = "Saving.";
      call("action=join_base&base=" + encodeURIComponent($("bc-base").value) + "&" + hk(), function (d) {
        $("bc-bmsg").textContent = d && d.ok ? "Saved. Week 1 is now " + d.base + "1." : "Not saved: " + (d && d.why ? d.why : "no answer") + ".";
        if (d && d.ok) { BASE = d.base; $("bc-base").value = d.base; showWeek(); }
      });
    });
    call("action=join_base&" + hk(), function (d) { if (d && d.ok) { BASE = d.base; $("bc-base").value = d.base; showWeek(); } });
    $("bc-run").addEventListener("click", runChecks);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})(typeof window !== "undefined" ? window : this);
