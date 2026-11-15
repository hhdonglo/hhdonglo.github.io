/* Class Manager analytics charts: puts the extra charts on a screen and handles the clicks on them.
   mount(el, screen, getData, getCohorts) draws the cards for "overview", "attendance", "quizzes" or "students" into el; a click on a bar lists the students behind it. */
(function (root) {
  "use strict";
  var X = root.cmExplore, V = root.cmExploreView;
  var chosen = {}; // chart key -> { bar, all }, kept while the screen redraws
  function draw(el, screen, d, cohorts) {
    var cs = X.forScreen(screen, d, cohorts);
    el._charts = cs;
    el.innerHTML = cs.length ? "<div class='dgrid'>" + cs.map(function (c) { var s = chosen[c.key] || {}; return V.card(c, s.bar === undefined ? null : s.bar, s.all); }).join("") + "</div>" : "";
  }
  function mount(el, screen, getData, getCohorts) {
    if (!el || !X || !V) return;
    var d = getData(); if (!d) { el.innerHTML = ""; return; }
    var go = function () { draw(el, screen, getData(), getCohorts ? getCohorts() : {}); };
    go();
    if (el._bound) return; el._bound = true;
    el.addEventListener("click", function (e) {
      var card = e.target.closest && e.target.closest(".xc"); if (!card) return;
      var key = card.getAttribute("data-xc"), s = chosen[key] || (chosen[key] = {}), bar = e.target.closest("[data-bar]");
      if (e.target.closest("[data-xall]")) { s.all = !s.all; go(); return; }
      if (bar) { var i = +bar.getAttribute("data-bar"); s.bar = s.bar === i ? undefined : i; s.all = false; go(); }
    });
    el.addEventListener("keydown", function (e) { var b = e.target.getAttribute && e.target.getAttribute("data-bar"); if (b !== null && b !== undefined && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); e.target.dispatchEvent(new MouseEvent("click", { bubbles: true })); } });
  }
  root.cmExplorePanel = { mount: mount, draw: draw };
})(window);
