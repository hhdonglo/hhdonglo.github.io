/* Class Manager dashboard: clicks. Opens the chart and the students behind a number, a bar or a zone, and links the views:
   a zone chosen in "Who needs attention" is highlighted in "What goes with what". Draws nothing itself (charts.js) and works out
   nothing itself (groups.js). The class statistics are read through getData() each time, so a refresh is picked up. Lecturer screen only. */
(function (root) {
  "use strict";
  var G = root.cmGroups, C = root.cmDashCharts;
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  var st = { drill: null, bar: null, zone: null, corr: 0, all: false };
  var CAP = 8; // a long list shows the first few and a button for the rest, so a click never fills the screen with names
  var $ = function (i) { return document.getElementById(i); };
  var names = function (l) { var cap = st.all ? l.length : CAP; return l.slice(0, cap).map(function (s) { return "<button type='button' class='link' data-student='" + esc(s.id) + "'>" + esc(s.name) + "</button>"; }).join("") + (l.length > CAP ? "<button type='button' class='zb' data-all='1'>" + (st.all ? "Show fewer" : "Show all " + l.length) + "</button>" : ""); };

  function drawDrill(d) {
    var box = $("ddrill"); if (!box) return;
    if (!st.drill) { box.hidden = true; box.innerHTML = ""; return; }
    var dr = G.drills(d)[st.drill]; if (!dr) { box.hidden = true; return; }
    var b = st.bar === null ? null : dr.bars[st.bar];
    box.hidden = false;
    box.innerHTML = "<div class='card-head'><h3>" + esc(dr.title) + "</h3><button type='button' class='zb' data-drill-close='1'>Close</button></div><p class='note'>" + esc(dr.hint) + "</p>" +
      (dr.bars.length ? C.bars(dr, st.bar) : "<p class='note'>Nothing to show yet.</p>") +
      "<div class='zlist' aria-live='polite'>" + (b ? "<span class='note'>" + esc(b.label) + " · " + b.students.length + " " + esc(b.what || "students") + ":</span>" + names(b.students) : "<span class='note'>Choose a bar to see its students.</span>") + "</div>";
  }
  function drawRisk(d) {
    var chart = $("drisk-chart"); if (!chart) return;
    var z = G.riskZones(d), sel = st.zone;
    chart.innerHTML = C.risk(z, sel);
    Array.prototype.forEach.call(document.querySelectorAll("#drisk .zb"), function (b) { b.setAttribute("aria-pressed", String(b.getAttribute("data-zone") === sel)); });
    var cur = sel && z.zones.filter(function (x) { return x.key === sel; })[0];
    $("drisk-list").innerHTML = cur ? "<span class='note'>" + esc(cur.label) + " · " + cur.students.length + ":</span>" + names(cur.students) : "Choose a zone to see its students.";
  }
  function chosen(d) { // the ids of the chosen zone, or null: the linked views highlight these students
    if (!st.zone) return null; var m = {}; G.riskZones(d).zones.forEach(function (x) { if (x.key === st.zone) x.students.forEach(function (s) { m[s.id] = 1; }); }); return m;
  }
  function drawCorr(d) {
    var box = $("dcorr-chart"); if (!box) return;
    var vs = G.correlations(d), v = vs[st.corr] || vs[0];
    box.innerHTML = C.relation(v, chosen(d)); $("dcorr-text").textContent = v.text + (st.zone ? " Students in the chosen zone are highlighted." : "");
    Array.prototype.forEach.call(document.querySelectorAll("#dcorr .zb"), function (b) { b.setAttribute("aria-pressed", String(+b.getAttribute("data-corr") === st.corr)); });
  }
  function drawCards() { Array.prototype.forEach.call(document.querySelectorAll(".dstat"), function (b) { b.setAttribute("aria-pressed", String(b.getAttribute("data-drill") === st.drill)); }); }

  function init(getData) {
    document.addEventListener("click", function (e) {
      var t = e.target, d = getData(); if (!d || !t.closest) return;
      var c;
      if ((c = t.closest("[data-drill]"))) {
        var k = c.getAttribute("data-drill");
        if (k === "risk") { var r = $("drisk"); if (r) { r.scrollIntoView({ behavior: "smooth", block: "center" }); var b0 = r.querySelector(".zb"); if (b0) b0.focus(); } return; }
        st.drill = st.drill === k ? null : k; st.bar = null; drawDrill(d); drawCards(); return;
      }
      if (t.closest("[data-all]")) { st.all = !st.all; drawDrill(d); drawRisk(d); return; }
      if (t.closest("[data-drill-close]")) { st.drill = null; st.bar = null; drawDrill(d); drawCards(); return; }
      if ((c = t.closest("#ddrill [data-bar]"))) { var i = +c.getAttribute("data-bar"); st.bar = st.bar === i ? null : i; st.all = false; drawDrill(d); return; }
      if ((c = t.closest("#drisk [data-zone]"))) { var z = c.getAttribute("data-zone"); st.zone = st.zone === z ? null : z; st.all = false; drawRisk(d); drawCorr(d); return; }
      if ((c = t.closest("#dcorr [data-corr]"))) { st.corr = +c.getAttribute("data-corr"); drawCorr(d); }
    });
    document.addEventListener("keydown", function (e) { if ((e.key === "Enter" || e.key === " ") && e.target.getAttribute && e.target.getAttribute("data-bar") !== null) { e.preventDefault(); e.target.dispatchEvent(new MouseEvent("click", { bubbles: true })); } });
  }
  // After the overview is drawn again (a refresh), the chosen drill, zone and view are shown again.
  function restore(d) { drawDrill(d); drawCards(); drawRisk(d); drawCorr(d); }
  // Opens the drill for `key` with bar `i` chosen (used by the board's charts, board/interact.js).
  function open(key, i, d) { st.drill = key; st.bar = i; st.all = false; drawDrill(d); drawCards(); var b = $("ddrill"); if (b && !b.hidden && b.scrollIntoView) b.scrollIntoView({ behavior: "smooth", block: "nearest" }); }
  root.cmDashInteract = { init: init, restore: restore, open: open, state: st };
})(window);
