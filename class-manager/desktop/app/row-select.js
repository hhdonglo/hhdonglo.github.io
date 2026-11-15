/* Selecting rows in a table, and what can be done with them. One responsibility: the selection, the action bar, the confirm dialog and the Undo notice.
   It knows nothing about students or tabs: a screen marks each row with data-sel="<key>" and gives bind() a function that says which actions the
   selection allows. Click selects a row; Ctrl or Cmd click adds or removes one; Shift click selects a range; Esc clears; Delete asks to remove.
   A removal is always confirmed first (naming what goes), sets records aside, and offers Undo (see confirm() and notice()). */
(function () {
  "use strict";
  var host = null, hooks = null, sel = [], anchor = null, bar = null;
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function rows() { return host ? Array.prototype.slice.call(host.querySelectorAll("tr[data-sel]")) : []; }
  function keyOf(tr) { return tr.getAttribute("data-sel"); }

  function paint() {
    rows().forEach(function (tr) { var on = sel.indexOf(keyOf(tr)) >= 0; tr.classList.toggle("sel", on); tr.setAttribute("aria-selected", on ? "true" : "false"); });
    if (!bar) { bar = document.createElement("div"); bar.className = "selbar"; bar.setAttribute("role", "toolbar"); bar.setAttribute("aria-label", "Selected rows"); }
    var items = sel.map(function (k) { return hooks.item(k); }).filter(Boolean);
    sel = items.map(function (x) { return x.key; }); // keys that are no longer in the table drop out
    if (!items.length) { if (bar.parentNode) bar.parentNode.removeChild(bar); return; }
    var acts = hooks.actions(items) || [];
    bar.innerHTML = "<span class='selcount'>" + items.length + (items.length === 1 ? " row selected" : " rows selected") + "</span>" +
      acts.map(function (a, i) { return "<button type='button' class='btn" + (a.danger ? " danger" : "") + "' data-act='" + i + "'>" + esc(a.label) + "</button>"; }).join("") +
      "<button type='button' class='btn' data-act='clear'>Clear</button><span class='note selhint'>Ctrl or Shift click selects more rows.</span>";
    bar._acts = acts; bar._items = items;
    if (bar.parentNode !== host.parentNode || host.previousSibling !== bar) host.parentNode.insertBefore(bar, host);
  }
  function setSel(list) { sel = list; paint(); }
  function click(e) {
    if (e.target.closest("button,a,input,select,textarea,th")) return;
    var tr = e.target.closest("tr[data-sel]"); if (!tr || !host.contains(tr)) return;
    var k = keyOf(tr), all = rows().map(keyOf);
    if (e.shiftKey && anchor !== null && all.indexOf(anchor) >= 0) { var a = all.indexOf(anchor), b = all.indexOf(k); setSel(all.slice(Math.min(a, b), Math.max(a, b) + 1)); return; }
    anchor = k;
    if (e.ctrlKey || e.metaKey) setSel(sel.indexOf(k) >= 0 ? sel.filter(function (x) { return x !== k; }) : sel.concat(k));
    else setSel(sel.length === 1 && sel[0] === k ? [] : [k]);
  }
  function barClick(e) {
    var b = e.target.closest("button[data-act]"); if (!b) return; var a = b.getAttribute("data-act");
    if (a === "clear") { setSel([]); return; }
    var act = bar._acts[+a]; if (act) act.run(bar._items);
  }
  function key(e) {
    if (e.key === "Escape" && sel.length && !document.querySelector("dialog[open]")) { setSel([]); return; }
    var tr = e.target.closest && e.target.closest("tr[data-sel]");
    if (tr && host.contains(tr) && (e.key === " " || e.key === "Enter") && !e.target.closest("button,a,input")) { e.preventDefault(); var k = keyOf(tr); anchor = k; setSel(sel.indexOf(k) >= 0 ? sel.filter(function (x) { return x !== k; }) : sel.concat(k)); return; }
    if ((e.key === "Delete" || e.key === "Backspace") && sel.length && !/INPUT|TEXTAREA|SELECT/.test((e.target.tagName || "")) && bar && bar._acts) {
      var rm = bar._acts.filter(function (a) { return a.danger; })[0]; if (rm) { e.preventDefault(); rm.run(bar._items); }
    }
  }
  // h: { host, item(key) -> {key,...}|null, actions(items) -> [{label, danger, run(items)}] }. Call again after the table is redrawn: the selection stays.
  function bind(h) {
    if (host !== h.host) { sel = []; anchor = null; if (bar && bar.parentNode) bar.parentNode.removeChild(bar); }
    host = h.host; hooks = h;
    if (!host._rsBound) { host._rsBound = true; host.addEventListener("click", click); host.addEventListener("keydown", key); }
    if (!document._rsBar) { document._rsBar = true; document.addEventListener("click", function (e) { if (bar && bar.contains(e.target)) barClick(e); }); }
    paint();
  }
  function clear() { setSel([]); }

  // confirm({ title, lines:[text], choices:[{value,label,help}], go:"Remove" }) -> Promise of the chosen value, or null when cancelled.
  function confirm(o) {
    return new Promise(function (resolve) {
      var d = document.createElement("dialog"); d.className = "rsd"; d.setAttribute("aria-labelledby", "rsd-h");
      d.innerHTML = "<h2 id='rsd-h'>" + esc(o.title) + "</h2>" + (o.lines || []).map(function (l) { return "<p>" + l + "</p>"; }).join("") +
        (o.choices && o.choices.length ? "<fieldset class='rsc'><legend class='sr'>What to remove</legend>" + o.choices.map(function (c, i) {
          return "<label><input type='radio' name='rsc' value='" + esc(c.value) + "'" + (i === 0 ? " checked" : "") + "> <b>" + esc(c.label) + "</b><span class='note' style='display:block;margin-left:1.6rem'>" + esc(c.help || "") + "</span></label>"; }).join("") + "</fieldset>" : "") +
        "<p class='row'><button class='btn' type='button' data-x='no'>Cancel</button><button class='btn primary danger' type='button' data-x='go'>" + esc(o.go || "OK") + "</button></p>";
      document.body.appendChild(d);
      function end(v) { d.close(); d.remove(); resolve(v); }
      d.addEventListener("click", function (e) { var x = e.target.getAttribute && e.target.getAttribute("data-x"); if (x === "no") end(null); if (x === "go") { var r = d.querySelector("input[name=rsc]:checked"); end(r ? r.value : true); } });
      d.addEventListener("cancel", function (e) { e.preventDefault(); end(null); });
      d.showModal(); d.querySelector("[data-x=no]").focus();
    });
  }

  // notice(text, { undo: fn }): a message at the bottom with an Undo button for a while (60 seconds).
  var noticeEl = null, noticeTimer = null;
  function notice(text, o) {
    if (!noticeEl) { noticeEl = document.createElement("div"); noticeEl.className = "rsn"; noticeEl.setAttribute("role", "status"); document.body.appendChild(noticeEl); }
    noticeEl.innerHTML = "<span>" + esc(text) + "</span>" + (o && o.undo ? "<button type='button' class='btn'>Undo</button>" : "") + "<button type='button' class='btn rsx' aria-label='Dismiss'>×</button>";
    noticeEl.hidden = false; clearTimeout(noticeTimer);
    var hide = function () { noticeEl.hidden = true; };
    noticeEl.querySelector(".rsx").onclick = hide;
    var u = noticeEl.querySelector("button:not(.rsx)"); if (u) u.onclick = function () { hide(); o.undo(); };
    noticeTimer = setTimeout(hide, 60000);
  }

  window.cmRowSelect = { bind: bind, clear: clear, confirm: confirm, notice: notice, selection: function () { return sel.slice(); } };
})();
