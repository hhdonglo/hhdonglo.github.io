/* The Grades table on the Grades and Results screen. Data comes from cmApp.grades() (desktop/grades/); this file only draws it.
   Fixed columns first (Student ID, Name), then grouped columns, then Last activity. A blank reads "no record".
   A row has an explicit actions menu: Timeline (every dated entry, newest first) and Remove from class (confirmed, set aside, can be undone).
   Hover a value to see when it was entered. Click a heading to sort. */
(function () {
  "use strict";
  var data = null, sortKey = null, sortDir = 1, show = "all", host = null, hooks = {}, openMenu = null;
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  function value(r, key) {
    if (key === "__id") return r.id; if (key === "__name") return r.name; if (key === "__last") return r.last;
    var c = r.cells[key]; return c && !c.empty ? (c.n !== undefined && c.n !== null ? c.n : c.t) : null; // no record sorts last
  }
  function rowsShown(q) {
    var r = data.rows.filter(function (x) { return show === "all" || (show === "with" ? x.entries > 0 : x.entries === 0); });
    if (q) r = r.filter(function (x) { return (x.id + " " + x.name).toLowerCase().indexOf(q) >= 0; });
    if (sortKey) r = r.slice().sort(function (a, b) {
      var x = value(a, sortKey), y = value(b, sortKey);
      if (x === null && y === null) return 0; if (x === null) return 1; if (y === null) return -1; // blanks stay at the bottom either way
      var c = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y), undefined, { numeric: true });
      return c * sortDir;
    });
    return r;
  }
  function th(key, label, cls) { return "<th scope='col' tabindex='0' class='" + (cls || "") + "' data-k='" + esc(key) + "'" + (key === sortKey ? " aria-sort='" + (sortDir > 0 ? "ascending" : "descending") + "'" : "") + ">" + esc(label) + "</th>"; }

  function draw() {
    var q = (hooks.filter && hooks.filter() || "").trim().toLowerCase(), rows = rowsShown(q), s = data.summary;
    var chips = [["all", "All students (" + s.students + ")"], ["with", "With records (" + s.withRecords + ")"], ["none", "No records yet (" + (s.students - s.withRecords) + ")"]].map(function (c) {
      return "<button type='button' class='gchip" + (show === c[0] ? " on" : "") + "' data-show='" + c[0] + "' aria-pressed='" + (show === c[0]) + "'>" + esc(c[1]) + "</button>";
    }).join("");
    var band = "<tr class='band'><th colspan='2'></th>" + data.groups.map(function (g) { return "<th colspan='" + g.span + "' scope='colgroup'>" + esc(g.label) + "</th>"; }).join("") + "<th colspan='2'></th></tr>";
    var head = "<tr>" + th("__id", "Student ID", "stick1") + th("__name", "Name", "stick2") + data.columns.map(function (c) { return th(c.key, c.label); }).join("") + th("__last", "Last activity") + "<th scope='col'><span class='sr'>Actions</span></th></tr>";
    var body = rows.slice(0, 1000).map(function (r) {
      return "<tr><td class='stick1'>" + esc(r.id) + "</td><td class='stick2'>" + esc(r.name) + "</td>" + data.columns.map(function (c) {
        var x = r.cells[c.key]; return "<td" + (x.empty ? " class='none'" : "") + (x.when ? " title='Entered " + esc(x.when) + "'" : "") + ">" + esc(x.t) + "</td>";
      }).join("") + "<td" + (r.last === null ? " class='none'" : "") + ">" + esc(r.lastText) + "</td>" +
        "<td class='act'><button type='button' class='gdots' aria-haspopup='menu' aria-label='Actions for " + esc(r.name || r.id) + "' data-id='" + esc(r.id) + "' data-nm='" + esc(r.name) + "'>⋯</button></td></tr>";
    }).join("");
    host.innerHTML = "<div class='gbar'>" + chips + "</div><div class='gscroll'><table class='gt'><thead>" + band + head + "</thead><tbody>" + body + "</tbody></table></div>" +
      (rows.length === 0 ? "<p class='note' style='padding:.8rem 1rem'>No students match.</p>" : "") + (rows.length > 1000 ? "<p class='note' style='padding:.6rem 1rem'>First 1000 of " + rows.length + " students shown. Download as Excel to see all.</p>" : "");
  }

  function closeMenu() { if (openMenu) { openMenu.remove(); openMenu = null; } }
  function menu(btn) {
    closeMenu();
    var m = document.createElement("div"); m.className = "gmenu"; m.setAttribute("role", "menu");
    m.innerHTML = "<button type='button' role='menuitem' data-a='tl'>Timeline</button><button type='button' role='menuitem' data-a='rm'>Remove from class…</button>";
    var r = btn.getBoundingClientRect(); m.style.top = r.bottom + window.scrollY + "px"; m.style.left = Math.max(8, r.right - 190 + window.scrollX) + "px";
    document.body.appendChild(m); openMenu = m; m.querySelector("button").focus();
    m.addEventListener("click", function (e) {
      var a = e.target.getAttribute && e.target.getAttribute("data-a"); closeMenu();
      if (a === "tl") timeline(btn.getAttribute("data-id"), btn.getAttribute("data-nm"));
      if (a === "rm" && hooks.remove) hooks.remove(btn.getAttribute("data-id"), btn.getAttribute("data-nm"));
    });
    m.addEventListener("keydown", function (e) { if (e.key === "Escape") { closeMenu(); btn.focus(); } });
  }
  function timeline(id, name) {
    cmApp.gradesTimeline(id).then(function (list) {
      var d = document.getElementById("g-tl"); if (!d) { d = document.createElement("dialog"); d.id = "g-tl"; d.className = "gtl"; document.body.appendChild(d); }
      d.innerHTML = "<h3>" + esc(name || "No name") + " <span class='note'>(" + esc(id) + ")</span></h3>" + (list.length ? "<table><thead><tr><th>When</th><th>What</th><th>Result</th></tr></thead><tbody>" + list.map(function (e) {
        return "<tr><td>" + esc(e.when) + "</td><td><span class='gkind'>" + esc(e.kind) + "</span> " + esc(e.what) + "</td><td>" + esc(e.result) + "</td></tr>"; }).join("") + "</tbody></table>" : "<p class='note'>No entries yet for this student.</p>") + "<p class='row'><button type='button' class='btn' id='g-tl-close'>Close</button></p>";
      d.showModal(); d.querySelector("#g-tl-close").addEventListener("click", function () { d.close(); });
    });
  }

  function render(h) {
    host = h.host; hooks = h;
    return cmApp.grades().then(function (g) { data = g; draw(); });
  }
  document.addEventListener("click", function (e) {
    if (!host || !host.contains(e.target)) { if (openMenu && !openMenu.contains(e.target)) closeMenu(); return; }
    var chip = e.target.closest && e.target.closest("[data-show]"); if (chip) { show = chip.getAttribute("data-show"); draw(); return; }
    var dots = e.target.closest && e.target.closest(".gdots"); if (dots) { menu(dots); e.stopPropagation(); return; }
    var t = e.target.closest && e.target.closest("th[data-k]"); if (t) { var k = t.getAttribute("data-k"); sortDir = k === sortKey ? -sortDir : 1; sortKey = k; draw(); var n = host.querySelector("th[data-k='" + k + "']"); if (n) n.focus(); }
  });
  document.addEventListener("keydown", function (e) {
    if (!host || !host.contains(e.target) || (e.key !== "Enter" && e.key !== " ")) return;
    var t = e.target.closest && e.target.closest("th[data-k]"); if (t) { e.preventDefault(); t.click(); }
  });
  window.cmGradesView = { render: render, redraw: function () { if (data && host) draw(); } };
})();
