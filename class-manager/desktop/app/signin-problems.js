/* Class Manager: the Sign-in problems card on the Attendance screen, and its count on the Attendance menu item.
   Lists each student ID that tried to sign in or check in and was refused: how many times, when, and why, so the lecturer can help.
   Works for this computer and for phones using the hosted relay. No access code or unlock code is ever shown; the list comes from CM (rules/signin-attempts.js).
   Pure helpers (when, wording) are exported for tests. */
(function (root) {
  "use strict";
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  var REASONS = {
    not_on_list: "Not on the class list", wrong_code: "Wrong access code", no_code: "Has not made an access code yet", code_expired: "Access code has expired",
    second_id: "Second ID on a phone that already checked in someone else (needs your unlock code)", wrong_unlock: "Wrong unlock code",
    old_qr: "QR code out of date (scanned too long ago)", too_far: "Too far from the room", no_location: "Location not shared", locked: "Locked out after too many tries",
    bad_id: "ID has the wrong length", old_page: "Old page, needs a refresh", closed: "No attendance session was open"
  };
  /* One short line for the time: "14:32" today, otherwise the date and time. */
  function when(iso, now) {
    var d = new Date(iso); if (isNaN(d.getTime())) return "";
    var n = new Date(now || Date.now()), hm = ("0" + d.getHours()).slice(-2) + ":" + ("0" + d.getMinutes()).slice(-2);
    return d.toDateString() === n.toDateString() ? hm : d.getDate() + "/" + (d.getMonth() + 1) + " " + hm;
  }
  function rowHtml(e, now) {
    var why = (e.reasons || []).map(function (r) { return REASONS[r] || r; });
    var tries = e.attempts + (e.attempts === 1 ? " try" : " tries");
    return "<li class='sp-row'><div><strong>" + esc(e.id) + "</strong>" + (e.name ? " " + esc(e.name) : "") +
      (e.signedIn ? " <span class='tag on'>Got in since</span>" : e.onList ? "" : " <span class='tag'>Not on the class list</span>") +
      "<br><span class='note'>" + tries + ", last " + esc(when(e.last, now)) + (e.first !== e.last ? ", first " + esc(when(e.first, now)) : "") + ". " + esc(why.join("; ")) + ".</span></div>" +
      "<button class='btn sm' type='button' data-sp-dismiss='" + esc(e.id) + "'>Dismiss</button></li>";
  }
  function html(list, now) {
    if (!list || !list.length) return "";
    return "<div class='card-head'><h3>Sign-in problems</h3><span class='note'>Students who tried and were refused</span></div>" +
      "<p class='note'>Use this to help a student. Access codes are never shown. Dismiss an ID once it is sorted out.</p>" +
      "<ul style='list-style:none;padding:0;margin:0'>" + list.map(function (e) { return rowHtml(e, now); }).join("") + "</ul>";
  }
  var api = { when: when, html: html, REASONS: REASONS };
  if (typeof module !== "undefined" && module.exports) { module.exports = api; return; }
  root.CMSigninProblems = api;

  var host = document.getElementById("signin-problems");
  if (!host || !window.cmApp || !cmApp.signinProblems) return;
  function draw(r) {
    var items = r && r.ok ? r.items : [], stuck = r && r.ok ? r.stuck : 0;
    var badge = document.getElementById("signin-n"); if (badge) { badge.textContent = stuck ? String(stuck) : ""; badge.hidden = !stuck; }
    host.innerHTML = html(items); host.hidden = !items.length;
  }
  function load() { return cmApp.signinProblems().then(draw, function () {}); }
  host.addEventListener("click", function (ev) {
    var b = ev.target.closest && ev.target.closest("[data-sp-dismiss]"); if (!b) return;
    b.disabled = true; cmApp.signinDismiss(b.getAttribute("data-sp-dismiss")).then(load);
  });
  document.addEventListener("click", function (ev) { if (ev.target.closest && ev.target.closest("[data-view='attendance']")) load(); });
  setInterval(function () { if (document.visibilityState === "visible") load(); }, 6000); // phones on the relay are collected by CM every few seconds
  load();
})(typeof window !== "undefined" ? window : this);
