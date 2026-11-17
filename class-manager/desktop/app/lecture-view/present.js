/* Class Manager: presentation mode. Shows a lecture's slides (a PDF) full screen, one page at a time, for teaching in class.
   Keys: right, down, space, page down = next; left, up, page up = previous; Home and End = first and last; B = blank the screen;
   T = dark or light surround; P = pause the timer; R = reset the timer; Esc = exit. Click the right of the slide for next, the left third for previous.
   Each slide is drawn off screen first (slide-renderer.js) and swapped in only when ready (slide-show.js), so changing slide never blinks; nothing is converted or sent anywhere. The rules are in state.js and slide-cache.js.
   Opened by view.js: cmLecturePresent.start(row). */
(function () {
  "use strict";
  var S = window.cmLectureState;
  if (!S || !window.cmApp || !cmApp.lectureFileView) return;
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  var THEME_KEY = "cm-present-theme";
  var run = null, starting = false; // the presentation on screen, if any

  function savedTheme() { try { return localStorage.getItem(THEME_KEY) === "light" ? "light" : "dark"; } catch (e) { return "dark"; } }
  function saveTheme(t) { try { localStorage.setItem(THEME_KEY, t); } catch (e) { /* the choice is not kept */ } }

  // Called from a click. Full screen can only be asked for inside the click itself, so it is asked for first, before the file is read.
  // The whole page goes full screen (the presentation covers it), and any open panel is closed because a panel would sit above the slide.
  function start(row) {
    if (run || starting) return;
    var chip = row && row.chips && row.chips.slides;
    if (S.slidesKind(chip) !== "pdf") return;
    starting = true;
    var asked = document.documentElement.requestFullscreen ? document.documentElement.requestFullscreen().catch(function () { /* the presentation still covers the window */ }) : Promise.resolve();
    Array.prototype.forEach.call(document.querySelectorAll("dialog[open]"), function (d) { d.close(); });
    cmApp.lectureFileView(chip.rel).then(function (v) {
      starting = false;
      if (!v || !v.ok || v.type !== "pdf") { leave(); return alert((v && v.why) || "The slides cannot be shown."); }
      asked.then(function () { open(row, chip, v); });
    }, function () { starting = false; leave(); });
  }
  // Leave full screen without the quiz projector's scan window opening (see onFull below).
  function leave() {
    if (!document.fullscreenElement) return;
    function quiet(e) { e.stopImmediatePropagation(); window.removeEventListener("fullscreenchange", quiet, true); }
    window.addEventListener("fullscreenchange", quiet, true); document.exitFullscreen().catch(function () {});
  }

  function open(row, chip, v) {
    var pages = Math.max(1, Number(v.pages) || 1), page = 1, blank = false, theme = savedTheme();
    var began = Date.now(), paused = null, banked = 0, idleTimer = null, ticker = null;
    var el = document.createElement("div");
    el.className = "pres pres-" + theme; el.tabIndex = -1; el.setAttribute("role", "dialog"); el.setAttribute("aria-label", "Presentation: " + row.label);
    el.innerHTML =
      "<div class='pres-stage'><div class='pres-frames'></div><div class='pres-shield' data-pres='shield'></div><div class='pres-blank' hidden></div></div>" +
      "<div class='pres-bar'><span class='pres-title'>" + esc(row.label) + (row.title ? ": " + esc(row.title) : "") + "</span>" +
      "<span class='pres-nav'><button type='button' data-pres='prev' aria-label='Previous slide'>Previous</button>" +
      "<span class='pres-count' role='status' aria-live='polite'></span>" +
      "<button type='button' data-pres='next' aria-label='Next slide'>Next</button></span>" +
      "<span class='pres-tools'><span class='pres-clock' title='Time since the start. P pauses, R resets'></span>" +
      "<button type='button' data-pres='theme'>Light or dark</button><button type='button' data-pres='exit'>Exit</button></span></div>" +
      "<p class='pres-help' hidden>Next: right arrow, space. Previous: left arrow. First or last: Home, End. B blanks the screen. T changes dark or light. P pauses the timer. R resets it. Esc exits.</p>";
    document.body.appendChild(el);
    var frames = el.querySelector(".pres-frames"), count = el.querySelector(".pres-count"), clockEl = el.querySelector(".pres-clock"),
      blankEl = el.querySelector(".pres-blank"), help = el.querySelector(".pres-help");

    function elapsed() { return banked + (paused ? 0 : Date.now() - began); }
    function tick() { clockEl.textContent = (paused ? "Paused " : "") + S.clock(elapsed()); }
    // Slides are drawn by slide-renderer.js onto a canvas off screen and swapped in by slide-show.js once ready, so the slide on screen never goes blank.
    // If the PDF reader cannot be used, the slides are shown by the PDF viewer built into CM instead (frameShow).
    var shower = null, rend = null, settled = false, canvas = null, resizeTimer = null;
    function label() {
      count.textContent = "Slide " + page + " of " + pages;
      el.querySelector("[data-pres='prev']").disabled = page <= 1; el.querySelector("[data-pres='next']").disabled = page >= pages;
    }
    function size() { var r = frames.getBoundingClientRect(); return { w: r.width, h: r.height, dpr: window.devicePixelRatio || 1 }; }
    function paint(d) { // one step: the new page replaces the old one in the same frame
      if (canvas.width !== d.canvas.width || canvas.height !== d.canvas.height) { canvas.width = d.canvas.width; canvas.height = d.canvas.height; }
      canvas.style.width = d.cssW + "px"; canvas.style.height = d.cssH + "px";
      canvas.getContext("2d").drawImage(d.canvas, 0, 0);
      canvas.setAttribute("aria-label", row.label + ", slide " + d.page);
    }
    function setup(r) {
      rend = r; pages = Math.max(1, r.pages || pages);
      canvas = document.createElement("canvas"); canvas.className = "pres-canvas"; canvas.setAttribute("role", "img"); frames.appendChild(canvas);
      shower = window.cmSlideShow.create({ pages: pages, size: size, draw: r.draw, paint: paint, shown: function () { label(); }, max: 5 });
    }
    function frameShow() { // a new frame sits over the old one and the old one goes when the new page has loaded
      var f = document.createElement("iframe"); f.className = "pres-pdf"; f.title = row.label + ", slide " + page; f.tabIndex = -1;
      var old = Array.prototype.slice.call(frames.children);
      f.addEventListener("load", function () { old.forEach(function (o) { if (o.parentNode) o.parentNode.removeChild(o); }); });
      f.src = S.pageUrl(v.url, page); frames.appendChild(f); label();
    }
    function fallBack() { // the PDF reader failed: keep teaching with the built-in viewer
      if (shower) shower.stop();
      shower = null; if (canvas && canvas.parentNode) canvas.parentNode.removeChild(canvas); canvas = null; frameShow();
    }
    function show() {
      if (!settled) return;
      if (shower) shower.show(page).catch(fallBack); else frameShow();
    }
    function onSize() { clearTimeout(resizeTimer); resizeTimer = setTimeout(function () { if (shower) shower.resize().catch(fallBack); }, 150); }
    function go(action) { var to = S.movePage(page, action, pages); if (to !== page) { page = to; if (blank) setBlank(false); show(); } }
    function setBlank(on) { blank = on; blankEl.hidden = !on; }
    function setTheme(t) { theme = t; el.className = el.className.replace(/pres-(dark|light)/, "pres-" + t); saveTheme(t); }
    function wake() { el.classList.remove("pres-idle"); clearTimeout(idleTimer); idleTimer = setTimeout(function () { el.classList.add("pres-idle"); }, 3000); }

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
      var b = e.target.closest("[data-pres]"); if (!b) return; wake();
      var a = b.getAttribute("data-pres");
      if (a === "shield") { var r = el.querySelector(".pres-shield").getBoundingClientRect(); return act(e.clientX - r.left < r.width / 3 ? "prev" : "next"); }
      act(a);
    }
    // Leaving full screen (Esc) ends the presentation. The scan code window of the quiz projector also listens for leaving full screen,
    // so this one is stopped first (capture on window) and that window does not open when a lecture ends.
    function onFull(e) { if (!document.fullscreenElement) { e.stopImmediatePropagation(); finish(); } }
    function finish() {
      if (!run) return; run = null;
      clearInterval(ticker); clearTimeout(idleTimer); clearTimeout(resizeTimer); window.removeEventListener("resize", onSize);
      if (shower) shower.stop(); if (rend) rend.close();
      document.removeEventListener("keydown", onKey, true); window.removeEventListener("fullscreenchange", onFull, true);
      el.removeEventListener("click", onClick); el.removeEventListener("mousemove", wake);
      leave();
      if (el.parentNode) el.parentNode.removeChild(el);
      document.dispatchEvent(new Event("cm:present-ended"));
    }

    run = { finish: finish };
    document.addEventListener("keydown", onKey, true); window.addEventListener("fullscreenchange", onFull, true);
    el.addEventListener("click", onClick); el.addEventListener("mousemove", wake);
    window.addEventListener("resize", onSize);
    ticker = setInterval(tick, 1000); tick(); label(); wake(); el.focus();
    (window.cmSlideRenderer && window.cmSlideShow ? window.cmSlideRenderer.open(v.url).then(setup, function () { /* use the built-in viewer */ }) : Promise.resolve())
      .then(function () { settled = true; if (run) show(); }, function () { settled = true; if (run) show(); });
  }

  window.cmLecturePresent = { start: start, active: function () { return !!run; } };
})();
