/* Class Manager: presentation mode. Shows a lecture's slides (a PDF) full screen, one page at a time, for teaching in class.
   Keys: right, down, space, page down = next; left, up, page up = previous; Home and End = first and last; B = blank the screen;
   T = dark or light surround; P = pause the timer; R = reset the timer; Esc = exit. Click the right of the slide for next, the left third for previous.
   The slides are shown by the PDF viewer built into CM, so nothing is converted or sent anywhere. The rules are in state.js.
   Opened by view.js: cmLecturePresent.start(row). */
(function () {
  "use strict";
  var S = window.cmLectureState;
  if (!S || !window.cmApp || !cmApp.lectureFileView) return;
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  var THEME_KEY = "cm-present-theme";
  var run = null; // the presentation on screen, if any

  function savedTheme() { try { return localStorage.getItem(THEME_KEY) === "light" ? "light" : "dark"; } catch (e) { return "dark"; } }
  function saveTheme(t) { try { localStorage.setItem(THEME_KEY, t); } catch (e) { /* the choice is not kept */ } }

  function start(row) {
    if (run) return;
    var chip = row && row.chips && row.chips.slides;
    if (S.slidesKind(chip) !== "pdf") return;
    cmApp.lectureFileView(chip.rel).then(function (v) {
      if (!v || !v.ok || v.type !== "pdf") return alert((v && v.why) || "The slides cannot be shown.");
      open(row, chip, v);
    });
  }

  function open(row, chip, v) {
    var pages = Math.max(1, Number(v.pages) || 1), page = 1, blank = false, theme = savedTheme();
    var began = Date.now(), paused = null, banked = 0, idleTimer = null, ticker = null;
    var el = document.createElement("div");
    el.className = "lp lp-" + theme; el.tabIndex = -1; el.setAttribute("role", "dialog"); el.setAttribute("aria-label", "Presentation: " + row.label);
    el.innerHTML =
      "<div class='lp-stage'><div class='lp-frames'></div><div class='lp-shield' data-lp='shield'></div><div class='lp-blank' hidden></div></div>" +
      "<div class='lp-bar'><span class='lp-title'>" + esc(row.label) + (row.title ? ": " + esc(row.title) : "") + "</span>" +
      "<span class='lp-nav'><button type='button' data-lp='prev' aria-label='Previous slide'>Previous</button>" +
      "<span class='lp-count' role='status' aria-live='polite'></span>" +
      "<button type='button' data-lp='next' aria-label='Next slide'>Next</button></span>" +
      "<span class='lp-tools'><span class='lp-clock' title='Time since the start. P pauses, R resets'></span>" +
      "<button type='button' data-lp='theme'>Light or dark</button><button type='button' data-lp='exit'>Exit</button></span></div>" +
      "<p class='lp-help' hidden>Next: right arrow, space. Previous: left arrow. First or last: Home, End. B blanks the screen. T changes dark or light. P pauses the timer. R resets it. Esc exits.</p>";
    document.body.appendChild(el);
    var frames = el.querySelector(".lp-frames"), count = el.querySelector(".lp-count"), clockEl = el.querySelector(".lp-clock"),
      blankEl = el.querySelector(".lp-blank"), help = el.querySelector(".lp-help");

    function elapsed() { return banked + (paused ? 0 : Date.now() - began); }
    function tick() { clockEl.textContent = (paused ? "Paused " : "") + S.clock(elapsed()); }
    function show() { // a new frame sits over the old one and the old one goes when the new page has loaded: no white flash between slides
      var f = document.createElement("iframe"); f.className = "lp-pdf"; f.title = row.label + ", slide " + page; f.tabIndex = -1;
      var old = Array.prototype.slice.call(frames.children);
      f.addEventListener("load", function () { old.forEach(function (o) { if (o.parentNode) o.parentNode.removeChild(o); }); });
      f.src = S.pageUrl(v.url, page); frames.appendChild(f);
      count.textContent = "Slide " + page + " of " + pages;
      el.querySelector("[data-lp='prev']").disabled = page <= 1; el.querySelector("[data-lp='next']").disabled = page >= pages;
    }
    function go(action) { var to = S.movePage(page, action, pages); if (to !== page) { page = to; if (blank) setBlank(false); show(); } }
    function setBlank(on) { blank = on; blankEl.hidden = !on; }
    function setTheme(t) { theme = t; el.className = el.className.replace(/lp-(dark|light)/, "lp-" + t); saveTheme(t); }
    function wake() { el.classList.remove("lp-idle"); clearTimeout(idleTimer); idleTimer = setTimeout(function () { el.classList.add("lp-idle"); }, 3000); }

    function act(a) {
      if (a === "next" || a === "prev" || a === "first" || a === "last") go(a);
      else if (a === "blank") setBlank(!blank);
      else if (a === "theme") setTheme(theme === "dark" ? "light" : "dark");
      else if (a === "pause") { if (paused) { began = Date.now(); paused = null; } else { banked = elapsed(); paused = Date.now(); } tick(); }
      else if (a === "reset") { banked = 0; began = Date.now(); if (paused) paused = Date.now(); tick(); }
      else if (a === "help") help.hidden = !help.hidden;
      else if (a === "exit") finish();
    }
    function onKey(e) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      var a = S.keyAction(e.key); if (!a || a === "full") return;
      e.preventDefault(); e.stopPropagation(); wake(); act(a);
    }
    function onClick(e) {
      var b = e.target.closest("[data-lp]"); if (!b) return; wake();
      var a = b.getAttribute("data-lp");
      if (a === "shield") { var r = el.querySelector(".lp-shield").getBoundingClientRect(); return act(e.clientX - r.left < r.width / 3 ? "prev" : "next"); }
      act(a);
    }
    // Leaving full screen (Esc) ends the presentation. The scan code window of the quiz projector also listens for leaving full screen,
    // so this one is stopped first (capture on window) and that window does not open when a lecture ends.
    function onFull(e) { if (!document.fullscreenElement) { e.stopImmediatePropagation(); finish(); } }
    function finish() {
      if (!run) return; run = null;
      clearInterval(ticker); clearTimeout(idleTimer);
      document.removeEventListener("keydown", onKey, true); window.removeEventListener("fullscreenchange", onFull, true);
      el.removeEventListener("click", onClick); el.removeEventListener("mousemove", wake);
      if (document.fullscreenElement) document.exitFullscreen().catch(function () {});
      if (el.parentNode) el.parentNode.removeChild(el);
      document.dispatchEvent(new Event("cm:present-ended"));
    }

    run = { finish: finish };
    document.addEventListener("keydown", onKey, true); window.addEventListener("fullscreenchange", onFull, true);
    el.addEventListener("click", onClick); el.addEventListener("mousemove", wake);
    ticker = setInterval(tick, 1000); tick(); show(); wake(); el.focus();
    if (el.requestFullscreen) el.requestFullscreen().catch(function () { /* the panel still covers the window */ });
  }

  window.cmLecturePresent = { start: start, active: function () { return !!run; } };
})();
