/* Class Analytics board: clicks. Tabs and the donut switch redraw one panel; a bar or a group slice opens the students behind it
   through cmDashInteract.open (dashboard/interact.js), which lists them on the lecturer's screen only. Draws and calculates nothing itself. */
(function (root) {
  "use strict";
  var V = root.cmBoardView, st = { tab: "attendance", view: "topics", pane: "overview" };
  var $ = function (i) { return document.getElementById(i); };
  function put(id, htmlStr) { var e = $(id); if (e) e.innerHTML = htmlStr; }
  function paintProgress(d, lp) {
    var el = $("bd-prog"); if (!el) return;
    el.innerHTML = V.progressPanel(d, lp, st.tab);
    el.hidden = !el.innerHTML;
  }
  function paint(d, lp) { put("bd-plan", V.planPanel(lp)); paintProgress(d, lp); put("bd-break", V.breakPanel(d, st.view)); put("bd-rank", V.rankedPanel(d)); put("bd-ins", V.insightsPanel(d, lp)); }
  // Show one section grid and hide the rest; the choice is kept in st.pane so a refresh of the page keeps it.
  function pane(k) {
    st.pane = k;
    [].forEach.call(document.querySelectorAll("[data-bd-pane]"), function (b) { b.setAttribute("aria-selected", String(b.getAttribute("data-bd-pane") === k)); });
    [].forEach.call(document.querySelectorAll(".bd-pane"), function (p) { p.hidden = p.id !== "sec-" + k; });
  }
  function init(getData, getLecture) {
    document.addEventListener("click", function (e) {
      var t = e.target, c, d;
      if (t.closest && (c = t.closest("[data-bd-pane]"))) { pane(c.getAttribute("data-bd-pane")); return; }
      d = getData(); if (!d || !t.closest) return;
      if ((c = t.closest("[data-bd-tab]"))) { st.tab = c.getAttribute("data-bd-tab"); put("bd-prog", V.progressPanel(d, getLecture(), st.tab)); return; }
      if ((c = t.closest("[data-bd-view]"))) { st.view = c.getAttribute("data-bd-view"); put("bd-break", V.breakPanel(d, st.view)); return; }
      if ((c = t.closest("[data-bd-bar]")) && root.cmDashInteract) { root.cmDashInteract.open(c.getAttribute("data-bd-key"), +c.getAttribute("data-bd-bar"), d); return; }
      if ((c = t.closest("[data-bd-slice]")) && root.cmDashInteract && (st.view === "groups" || d.analytics && !d.analytics.available.questions)) root.cmDashInteract.open("students", +c.getAttribute("data-bd-slice"), d);
    });
    document.addEventListener("keydown", function (e) { if ((e.key === "Enter" || e.key === " ") && e.target.closest && e.target.closest("[data-bd-bar],[data-bd-slice]")) { e.preventDefault(); e.target.closest("[data-bd-bar],[data-bd-slice]").dispatchEvent(new MouseEvent("click", { bubbles: true })); } });
    document.addEventListener("cm:lecture", function () { var d = getData(); if (d) paint(d, getLecture()); });
  }
  root.cmBoardInteract = { init: init, state: st, paint: paint, pane: pane };
})(typeof window !== "undefined" ? window : globalThis);
