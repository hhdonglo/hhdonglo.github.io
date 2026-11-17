/* Class Manager: lecture progress on the home screen. A card at the top of Class Analytics (lectures held, left, the target and the verdict)
   and a banner that appears when the course is behind. Everything shown comes from one call, cmApp.lectureProgress (lecture-progress/ipc.js),
   so the card and the banner always agree. The banner can be dismissed until the number of lectures held or expected changes. */
(function () {
  "use strict";
  var ov = document.getElementById("ov"), main = document.getElementById("main");
  if (!ov || !main || !window.cmApp || !cmApp.lectureProgress) return;
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function memo(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } }

  var card = document.createElement("section");
  card.id = "lp-card"; card.className = "card lp"; card.setAttribute("aria-labelledby", "lp-h");
  ov.parentNode.insertBefore(card, ov);
  if (window.cmBoardLpSlot) { cmBoardLpSlot.park(document); cmBoardLpSlot.mount(document); } // keep the card out of #ov's redraws (board/lp-slot.js)
  var banner = document.createElement("div");
  banner.id = "lp-banner"; banner.className = "lp-banner"; banner.setAttribute("role", "alert"); banner.hidden = true;
  main.insertBefore(banner, main.firstChild);

  var LABEL = { ontrack: "On track", ahead: "Ahead", behind: "Behind", met: "Target met", ended: "Semester ended", notstarted: "Not started", count: "Dates needed", none: "No target" };
  var HOWTO = { attendance: "attendance taken", "marked held": "marked held", "make-up": "make-up", cancelled: "cancelled" };
  var current = null;

  function dismissedKey(p) { return "cm-lp-dismissed:" + (document.title || "") + ":" + p.key; }

  function drawBanner(p) {
    var show = (p.state === "behind" || p.state === "ended") && !memo(dismissedKey(p));
    banner.hidden = !show;
    if (!show) { banner.innerHTML = ""; return; }
    banner.innerHTML = "<div><strong>" + esc(p.headline) + ".</strong> " + esc(p.detail) + "</div>" +
      "<button type='button' class='x' id='lp-x' aria-label='Hide this alert' title='Hide until the next lecture or week changes it'>&times;</button>";
    document.getElementById("lp-x").addEventListener("click", function () { memo(dismissedKey(p), "1"); banner.hidden = true; });
  }

  // The same lectures with their one-line descriptions, for the expandable section.
  function teachDetail(p) {
    var s = p.schedule; if (!s || !s.missed.length) return "";
    return "<h4>Lectures to catch up on</h4><ul class='lp-days'>" + s.missed.map(function (l) {
      return "<li><span><strong>" + esc(l.label) + "</strong>" + (l.title ? " " + esc(l.title) : "") + (l.summary ? "<br><span class='note'>" + esc(l.summary) + "</span>" : "") + "</span></li>";
    }).join("") + "</ul><p class='note'>Lectures are counted in order: when 4 lectures are held, Lectures 1 to 4 count as covered.</p>";
  }

  function days(p) {
    if (!p.days.length) return "<p class='note'>No lecture counted yet. A lecture counts when an attendance session is closed, or when you mark it here.</p>";
    return "<ul class='lp-days'>" + p.days.slice(0, 40).map(function (d) {
      var own = d.how !== "attendance";
      return "<li><span>" + esc(d.date) + " <span class='note'>" + esc(HOWTO[d.how] || d.how) + "</span></span>" +
        "<span>" + (d.how !== "cancelled" ? "<button type='button' class='btn sm' data-lp='cancelled' data-date='" + esc(d.date) + "'>Cancel</button> " : "") +
        (own ? "<button type='button' class='btn sm' data-lp='' data-date='" + esc(d.date) + "'>Remove mark</button>" : "") + "</span></li>";
    }).join("") + "</ul>";
  }

  function draw(p) {
    if (!p) return;
    if (!card.isConnected && window.cmBoardLpSlot) { var h = cmBoardLpSlot.holder(document); if (h) h.appendChild(card); } // never left detached
    current = p; window.cmLecture = p; document.dispatchEvent(new Event("cm:lecture")); drawBanner(p); // the Class Analytics board draws the plan from this (board/)
    var today = new Date(), iso = today.getFullYear() + "-" + ("0" + (today.getMonth() + 1)).slice(-2) + "-" + ("0" + today.getDate()).slice(-2);
    // The strip (board/strip.js) is the picture; the date corrections stay one click away under "Corrections".
    card.innerHTML = (window.cmBoardStrip ? cmBoardStrip.html(p) : "<div class='lp-head'><h3 id='lp-h'>Lecture plan</h3></div>") +
      "<details class='lp-more'><summary>Corrections</summary>" + teachDetail(p) + days(p) +
      "<p class='row'><label for='lp-date' class='note'>Date</label><input class='f' id='lp-date' type='date' value='" + iso + "' style='max-width:11rem'> " +
      "<button type='button' class='btn sm' data-lp='held' data-date=''>Mark held (also a make-up)</button> <button type='button' class='btn sm' data-lp='cancelled' data-date=''>Mark cancelled</button> " +
      "<button type='button' class='btn sm' id='lp-set'>Set target and dates</button> <span class='note' id='lp-msg' role='status'></span></p></details>";
  }

  card.addEventListener("click", function (ev) {
    var b = ev.target.closest && ev.target.closest("button"); if (!b) return;
    if (b.id === "lp-set") { var g = document.querySelector("[data-go='setup.html#course']"); if (g) g.click(); else cmApp.openWindow("setup.html#course"); return; }
    if (b.getAttribute("data-lp") == null) return;
    var date = b.getAttribute("data-date") || document.getElementById("lp-date").value, kind = b.getAttribute("data-lp");
    cmApp.lectureMark(date, kind || null).then(function (r) {
      if (r && r.ok) draw(r.progress); else { var m = document.getElementById("lp-msg"); if (m) m.textContent = (r && r.why) || "Not saved."; }
    });
  });

  var sw = document.getElementById("lp-notify");
  if (sw) sw.addEventListener("change", function () {
    cmApp.lectureNotify(sw.checked).then(function (r) { var m = document.getElementById("lp-notify-msg"); if (m) m.textContent = r && r.ok ? (r.notify ? "On" : "Off") : "Not saved."; });
  });
  function load() { return cmApp.lectureProgress().then(function (r) { if (r && r.ok) { draw(r.progress); if (sw) sw.checked = !!r.progress.notify; } }); }
  load();
  setInterval(function () { if (document.visibilityState === "visible") load(); }, 15000);
  window.addEventListener("focus", load);
})();
