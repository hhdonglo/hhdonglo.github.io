/* Class Analytics board: arranging the cards. The lecturer can drag a card or use its buttons to move it, change its width and height, hide it and show it
   again; "Reset layout" restores the defaults. The choices are saved per course on this computer only (localStorage). Numbers come from layout.js; this file
   only reads and writes the page. Long captions under charts become an info icon with the text as a tooltip, to keep the page light. */
(function (root) {
  "use strict";
  var L = root.cmBoardLayout, doc = root.document;
  var st = { edit: false }, busy = false, obs = null, raf = 0, ro = null;
  var ROW = 8, GAP = 13; // the grid has 8 pixel rows; a card spans as many as its height needs, so short cards fill the space under each other
  var CARD = ".bd-card,.card,.acard";
  function course() { var s = doc.getElementById("course-sel"); return (s && s.value) || "default"; }
  function key() { return "cm.board.layout." + course(); }
  var mem = null; // the saved layout of the chosen course: { key: { w, h, order, hidden }, _c: course }
  function load() { try { return JSON.parse(root.localStorage.getItem(key()) || "{}") || {}; } catch (e) { return {}; } }
  function saved() { if (!mem || mem._c !== course()) mem = Object.assign(load(), { _c: course() }); return mem; }
  function persist(m) { var c = Object.assign({}, m); delete c._c; try { root.localStorage.setItem(key(), JSON.stringify(c)); } catch (e) { /* no storage: the layout lasts until the page is closed */ } mem = Object.assign(c, { _c: course() }); }

  // The cards of one pane: top level cards only, not the student list that opens on a click.
  function cards(pane) {
    var seen = {};
    return [].filter.call(pane.querySelectorAll(CARD), function (el) { return !el.classList.contains("ddrill") && !(el.parentElement && el.parentElement.closest(CARD) && pane.contains(el.parentElement.closest(CARD))); }).map(function (el) {
      if (!el.getAttribute("data-bd-key")) {
        var h = el.querySelector("h3,h4") || el.querySelector(".bd-head,.card-head,.lbl");
        var k = el.id || "c-" + L.slug(h ? h.textContent : el.className); el.setAttribute("data-bd-key", k);
      }
      var k2 = el.getAttribute("data-bd-key"); if (seen[k2]) { k2 += "-" + (seen[k2]++); el.setAttribute("data-bd-key", k2); } else seen[k2] = 1;
      return el;
    });
  }
  function titleOf(el) { var h = el.querySelector("h3,h4") || el.querySelector(".bd-head,.card-head,.lbl,.bd-kl"); return (h ? h.textContent : el.getAttribute("data-bd-key")).replace(/\s+/g, " ").trim().slice(0, 40); }

  // Captions become an info icon beside the card's heading.
  function tidy(el) {
    [].forEach.call(el.querySelectorAll(".bd-foot,.ch-cap"), function (p) {
      var head = el.querySelector(".bd-head,.card-head,h3,h4"), text = p.textContent.replace(/\s+/g, " ").trim();
      if (!head || !text) return;
      var i = doc.createElement("span"); i.className = "bd-i"; i.tabIndex = 0; i.setAttribute("role", "img"); i.setAttribute("aria-label", text); i.title = text; i.textContent = "i";
      head.appendChild(i); p.remove();
    });
  }
  function bar(el, c, list) {
    var b = doc.createElement("div"); b.className = "bd-ah"; b.setAttribute("data-bd-ah", "1");
    var btn = function (act, label, text) { return "<button type='button' data-bd-act='" + act + "' aria-label='" + label + " " + titleOf(el).replace(/'/g, "") + "' title='" + label + "'>" + text + "</button>"; };
    b.innerHTML = "<span class='bd-grip' aria-hidden='true'>⠿</span><span class='bd-at'>" + titleOf(el).replace(/</g, "&lt;") + "</span>" +
      btn("earlier", "Move earlier", "◀") + btn("later", "Move later", "▶") + btn("narrower", "Narrower", "−") + btn("wider", "Wider", "+") + btn("shorter", "Shorter", "↑") + btn("taller", "Taller", "↓") + btn("hide", "Hide this card", "✕");
    el.insertBefore(b, el.firstChild);
    var z = doc.createElement("span"); z.className = "bd-rz"; z.setAttribute("data-bd-rz", "1"); z.setAttribute("aria-hidden", "true"); z.title = "Drag to resize"; el.appendChild(z);
  }
  // Masonry: each grid item takes the number of rows its height needs (and keeps up when its content changes).
  function fit(el) { if (el.hidden || !el.offsetParent) return; el.style.gridRowEnd = "span " + Math.max(1, Math.ceil((el.offsetHeight + GAP) / ROW)); }
  function watch(el) { if (!ro && root.ResizeObserver) ro = new root.ResizeObserver(function (es) { es.forEach(function (e) { fit(e.target); }); }); if (ro) ro.observe(el); fit(el); }
  function applyPane(pane) {
    var els = cards(pane), byKey = {}; els.forEach(function (e) { byKey[e.getAttribute("data-bd-key")] = e; });
    var list = L.resolve(Object.keys(byKey), saved()), hidden = [];
    list.forEach(function (c, i) {
      var el = byKey[c.key]; tidy(el);
      el.classList.add("bd-arr"); el.style.order = String(i); el.style.setProperty("--w", c.w); el.style.height = c.h ? c.h + "px" : ""; el.classList.toggle("bd-sized", !!c.h);
      var off = c.hidden && !st.edit; el.classList.toggle("bd-off", c.hidden); el.hidden = off;
      if (c.hidden) hidden.push({ key: c.key, title: titleOf(el) });
      [].forEach.call(el.querySelectorAll("[data-bd-ah],[data-bd-rz]"), function (x) { x.remove(); });
      el.draggable = st.edit; el.classList.toggle("bd-editing", st.edit);
      if (st.edit && !c.hidden) bar(el, c, list);
      watch(el);
    });
    [].forEach.call(pane.children, function (x) { if (x.classList.contains("bd-sh")) watch(x); });
    return { list: list, hidden: hidden };
  }
  function toolbar(info) {
    var t = doc.getElementById("bd-arrbar"); if (!t) return;
    var hid = info.hidden.length ? "<span class='bd-hid'>Hidden: " + info.hidden.map(function (h) { return "<button type='button' data-bd-show='" + h.key + "'>+ " + h.title.replace(/</g, "&lt;") + "</button>"; }).join("") + "</span>" : ""; // always visible, so a hidden card is never lost
    t.innerHTML = st.edit ? "<button type='button' class='bd-arr-done' data-bd-act='done'>Done</button><button type='button' data-bd-act='reset'>Reset layout</button>" + hid :
      "<button type='button' data-bd-act='edit' title='Move, resize and hide cards. Saved on this computer for this course.'>Arrange cards</button>" + hid;
    t.classList.toggle("bd-on", st.edit);
  }
  function apply() {
    var ov = doc.getElementById("ov"); if (!ov || busy) return; busy = true; if (obs) obs.disconnect();
    var info = { hidden: [], list: [] };
    [].forEach.call(ov.querySelectorAll(".bd-pane"), function (p) { var r = applyPane(p); if (!p.hidden) info = r; });
    toolbar(info); doc.body.classList.toggle("bd-arranging", st.edit);
    busy = false; if (obs) obs.observe(ov, { childList: true, subtree: true });
  }
  function later() { if (busy || raf) return; raf = root.requestAnimationFrame(function () { raf = 0; apply(); }); }

  function cur(el) { var pane = el.closest(".bd-pane"), els = cards(pane), by = {}; els.forEach(function (e) { by[e.getAttribute("data-bd-key")] = e; }); return { pane: pane, list: L.resolve(Object.keys(by), saved()), by: by }; }
  function patch(k, f) { var m = Object.assign({}, saved()); delete m._c; m[k] = Object.assign({}, m[k], f); persist(m); apply(); }
  function reorder(pane, orders) { var m = Object.assign({}, saved()); delete m._c; Object.keys(orders).forEach(function (k) { m[k] = Object.assign({}, m[k], { order: orders[k] }); }); persist(m); apply(); }
  function act(a, el) {
    var c = cur(el), k = el.getAttribute("data-bd-key"), me = c.list.filter(function (x) { return x.key === k; })[0]; if (!me) return;
    if (a === "earlier" || a === "later") { var o = L.step(c.list, k, a === "earlier" ? -1 : 1); if (o) reorder(c.pane, o); return; }
    if (a === "narrower") return patch(k, { w: L.clampW(me.w - 1) });
    if (a === "wider") return patch(k, { w: L.clampW(me.w + 1) });
    var h = me.h || Math.round(el.getBoundingClientRect().height);
    if (a === "shorter") return patch(k, { h: L.snapH(h - L.STEP_H * 2) });
    if (a === "taller") return patch(k, { h: L.snapH(h + L.STEP_H * 2) });
    if (a === "hide") return patch(k, { hidden: true });
  }
  function resizeStart(ev, el) {
    ev.preventDefault(); var k = el.getAttribute("data-bd-key"), pane = el.closest(".bd-pane"), pr = pane.getBoundingClientRect(), colW = pr.width / L.COLS, r0 = el.getBoundingClientRect();
    function move(e) { el.style.setProperty("--w", L.clampW((e.clientX - r0.left) / colW)); el.style.height = L.snapH(e.clientY - r0.top) + "px"; el.classList.add("bd-sized"); }
    function up(e) { doc.removeEventListener("pointermove", move); doc.removeEventListener("pointerup", up); patch(k, { w: L.clampW((e.clientX - r0.left) / colW), h: L.snapH(e.clientY - r0.top) }); }
    doc.addEventListener("pointermove", move); doc.addEventListener("pointerup", up);
  }
  var dragKey = null;
  function init() {
    if (init.done || !doc) return; init.done = true;
    doc.addEventListener("click", function (e) {
      var t = e.target.closest && e.target.closest("[data-bd-act],[data-bd-show]"); if (!t) return;
      var a = t.getAttribute("data-bd-act"), s = t.getAttribute("data-bd-show");
      if (s) { var el = doc.querySelector("[data-bd-key='" + s + "']"); if (el) patch(s, { hidden: false }); return; }
      if (a === "edit") { st.edit = true; apply(); return; }
      if (a === "done") { st.edit = false; apply(); return; }
      if (a === "reset") { try { root.localStorage.removeItem(key()); } catch (x) { /* nothing saved */ } mem = null; apply(); return; }
      var card = t.closest("[data-bd-key]"); if (card) act(a, card);
    });
    doc.addEventListener("pointerdown", function (e) { var z = e.target.closest && e.target.closest("[data-bd-rz]"); if (z) resizeStart(e, z.closest("[data-bd-key]")); });
    doc.addEventListener("dragstart", function (e) { var c = st.edit && e.target.closest && e.target.closest("[data-bd-key]"); if (!c || e.target.closest("svg")) return; dragKey = c.getAttribute("data-bd-key"); try { e.dataTransfer.setData("text/plain", dragKey); e.dataTransfer.effectAllowed = "move"; } catch (x) { /* no dataTransfer */ } });
    doc.addEventListener("dragover", function (e) { if (dragKey && e.target.closest && e.target.closest("[data-bd-key]")) e.preventDefault(); });
    doc.addEventListener("drop", function (e) {
      var c = dragKey && e.target.closest && e.target.closest("[data-bd-key]"); if (!c) return; e.preventDefault();
      var info = cur(c), before = c.getAttribute("data-bd-key"); if (before !== dragKey) reorder(info.pane, L.move(info.list, dragKey, before)); dragKey = null;
    });
    doc.addEventListener("dragend", function () { dragKey = null; });
    var ov = doc.getElementById("ov"); if (ov && root.MutationObserver) { obs = new root.MutationObserver(later); obs.observe(ov, { childList: true, subtree: true }); }
  }
  root.cmBoardArrange = { init: init, apply: apply, state: st };
})(typeof window !== "undefined" ? window : globalThis);
