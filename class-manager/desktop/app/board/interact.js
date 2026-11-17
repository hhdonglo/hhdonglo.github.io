/* Class Analytics board: clicks. Tabs and the donut switch redraw one panel; a bar or a group slice opens the students behind it
   through cmDashInteract.open (dashboard/interact.js), which lists them on the lecturer's screen only. Draws and calculates nothing itself. */
(function (root) {
  "use strict";
  var V = root.cmBoardView, st = { tab: "attendance", view: "topics" };
  var $ = function (i) { return document.getElementById(i); };
  function put(id, htmlStr) { var e = $(id); if (e) e.innerHTML = htmlStr; }
  function paint(d, lp) { put("bd-plan", V.planPanel(lp)); put("bd-prog", V.progressPanel(d, lp, st.tab)); put("bd-break", V.breakPanel(d, st.view)); put("bd-rank", V.rankedPanel(d)); put("bd-ins", V.insightsPanel(d, lp)); }
  function init(getData, getLecture) {
    document.addEventListener("click", function (e) {
      var d = getData(), t = e.target, c; if (!d || !t.closest || !$("bd-prog")) return;
      if ((c = t.closest("[data-bd-tab]"))) { st.tab = c.getAttribute("data-bd-tab"); put("bd-prog", V.progressPanel(d, getLecture(), st.tab)); return; }
      if ((c = t.closest("[data-bd-view]"))) { st.view = c.getAttribute("data-bd-view"); put("bd-break", V.breakPanel(d, st.view)); return; }
      if ((c = t.closest("[data-bd-bar]")) && root.cmDashInteract) { root.cmDashInteract.open(c.getAttribute("data-bd-key"), +c.getAttribute("data-bd-bar"), d); return; }
      if ((c = t.closest("[data-bd-slice]")) && root.cmDashInteract && st.view === "groups") root.cmDashInteract.open("students", +c.getAttribute("data-bd-slice"), d);
    });
    document.addEventListener("keydown", function (e) { if ((e.key === "Enter" || e.key === " ") && e.target.closest && e.target.closest("[data-bd-bar],[data-bd-slice]")) { e.preventDefault(); e.target.closest("[data-bd-bar],[data-bd-slice]").dispatchEvent(new MouseEvent("click", { bubbles: true })); } });
    document.addEventListener("cm:lecture", function () { var d = getData(); if (d && $("bd-plan")) { put("bd-plan", V.planPanel(getLecture())); put("bd-prog", V.progressPanel(d, getLecture(), st.tab)); put("bd-ins", V.insightsPanel(d, getLecture())); } });
  }
  root.cmBoardInteract = { init: init, state: st, paint: paint };
})(typeof window !== "undefined" ? window : globalThis);
