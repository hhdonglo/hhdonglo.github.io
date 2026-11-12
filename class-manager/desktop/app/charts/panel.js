/* Class Manager charts: the dashboard graphs panel. Controls (day, "this day only" or "up to this day", measure, outlier limit) and the three graphs
   (distribution, box plot, scatter). render(d) is a pure function of the class statistics and the chosen state; bind() wires the controls;
   watch() redraws the panel when the data change (a stamp from the backend, checked every few seconds). The chosen day survives a redraw. */
(function (root) {
  "use strict";
  var K = typeof module === "object" && module.exports ? { core: require("./core"), days: require("./days"), dist: require("./distribution"), box: require("./boxplot"), scat: require("./scatter") }
    : { core: root.cmCharts, days: root.cmCharts.days, dist: root.cmCharts, box: root.cmCharts, scat: root.cmCharts };
  var esc = K.core.esc;
  var state = { day: null, mode: "to", measure: "quiz", k: 2 }; // day: key of the chosen day, or null for the default
  var MEASURES = { quiz: "Quiz average", att: "Attendance" };

  function view(d) {
    var tl = K.days.timeline(d), i = -1;
    for (var n = 0; n < tl.length; n++) if (tl[n].key === state.day) i = n;
    if (i < 0) i = K.days.pick(tl); // a day that no longer exists (after a reset) falls back to the default
    return { tl: tl, i: i, rows: K.days.figures(d, tl, i, state.mode) };
  }
  var pairs = function (rows, key) { return rows.filter(function (r) { return r[key] !== null; }).map(function (r) { return { id: r.id, name: r.name, v: r[key] }; }); };
  function seg(name, opts, cur) { return "<span class='gx-seg' role='group' aria-label='" + esc(name) + "'>" + opts.map(function (o) { return "<button type='button' data-gx='" + o[0] + "' aria-pressed='" + (o[0] === cur) + "'>" + esc(o[1]) + "</button>"; }).join("") + "</span>"; }

  function render(d) {
    var v = view(d), tl = v.tl, day = tl[v.i];
    if (!day) return "<section class='card gx' aria-labelledby='gxh'><h3 id='gxh'>Class graphs</h3><p class='note'>The graphs appear once there is a session or a quiz to show.</p></section>";
    var opts = tl.map(function (t) { return "<option value='" + esc(t.key) + "'" + (t.key === day.key ? " selected" : "") + ">" + esc(t.label + (t.what ? " (" + t.what + ")" : "")) + "</option>"; }).join("");
    var head = "<div class='gx-bar'><button type='button' class='gx-step' data-gx='prev' aria-label='Previous day'" + (v.i === 0 ? " disabled" : "") + ">‹</button>" +
      "<label class='gx-day'><span class='note'>Day</span><select id='gx-day'>" + opts + "</select></label>" +
      "<button type='button' class='gx-step' data-gx='next' aria-label='Next day'" + (v.i === tl.length - 1 ? " disabled" : "") + ">›</button>" +
      seg("Range", [["mode:to", "Up to this day"], ["mode:on", "This day only"]], "mode:" + state.mode) +
      seg("Measure", [["measure:quiz", "Quiz average"], ["measure:att", "Attendance"]], "measure:" + state.measure) +
      seg("Outlier limit", [["k:1.5", "1.5 SD"], ["k:2", "2 SD"], ["k:3", "3 SD"]], "k:" + state.k) + "</div>";
    var scope = state.mode === "on" ? "On " + day.label + " only" : "Up to " + day.label;
    var meas = MEASURES[state.measure];
    var dist = K.dist.distribution(pairs(v.rows, state.measure), { label: meas, k: state.k });
    var box = K.box.boxplot([{ label: "Quiz average", rows: pairs(v.rows, "quiz") }, { label: "Attendance", rows: pairs(v.rows, "att") }]);
    var sc = K.scat.scatter(v.rows.filter(function (r) { return r.att !== null && r.quiz !== null; }).map(function (r) { return { id: r.id, name: r.name, x: r.att, y: r.quiz }; }), { yLabel: "Quiz average" });
    return "<section class='card gx' aria-labelledby='gxh'><h3 id='gxh'>Class graphs</h3><p class='note'>" + esc(scope) + ". The graphs update by themselves when new records arrive.</p>" + head +
      "<div class='gx-grid'><div class='gx-cell'><h4>How performance is spread</h4>" + dist + "</div><div class='gx-cell'><h4>Who is an outlier</h4>" + box + "</div><div class='gx-cell'><h4>Does attendance go with performance</h4>" + sc + "</div></div></section>";
  }

  // Click and change handlers on one container; redraw() puts the new HTML in.
  function handle(target, d, redraw) {
    var b = target.closest ? target.closest("[data-gx]") : null; if (!b) return false;
    var a = b.getAttribute("data-gx"), v = view(d), tl = v.tl;
    if (a === "prev" && v.i > 0) state.day = tl[v.i - 1].key; else if (a === "next" && v.i < tl.length - 1) state.day = tl[v.i + 1].key;
    else if (a.indexOf("mode:") === 0) state.mode = a.slice(5); else if (a.indexOf("measure:") === 0) state.measure = a.slice(8); else if (a.indexOf("k:") === 0) state.k = Number(a.slice(2)) || 2;
    redraw(); return true;
  }
  function chosen(id, d, redraw) { state.day = id; redraw(); }

  // Poll the backend's data stamp; call refresh() (reload the figures, redraw the panel) when it changes. Returns a stop function.
  function watch(getStamp, refresh, every) {
    var last = null, busy = false, t = setInterval(function () {
      if (busy || (typeof document !== "undefined" && document.visibilityState === "hidden")) return;
      busy = true; Promise.resolve(getStamp()).then(function (r) {
        var s = r && r.ok ? r.stamp : null; if (s === null) return;
        if (last !== null && s !== last) { last = s; return refresh(); } last = s;
      }).catch(function () {}).then(function () { busy = false; });
    }, every || 4000);
    return function () { clearInterval(t); };
  }
  function reset() { state.day = null; state.mode = "to"; state.measure = "quiz"; state.k = 2; }
  var api = { render: render, handle: handle, chosen: chosen, watch: watch, state: state, reset: reset, view: view };
  if (typeof module === "object" && module.exports) module.exports = api; else root.cmCharts = Object.assign(root.cmCharts || {}, { panel: api });
})(typeof window !== "undefined" ? window : globalThis);
