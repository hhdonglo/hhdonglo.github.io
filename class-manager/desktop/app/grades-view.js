/* The Grades table on the Grades and Results screen. Data comes from cmApp.grades() (desktop/grades/); this file only draws it.
   Fixed columns first (Student ID, Name), then grouped columns, then Last activity. A blank reads "no record".
   Click a row to select it: an action bar offers Open timeline (every dated entry, newest first) and Remove row (see row-select.js and row-actions.js).
   Hover a value to see when it was entered. Click a heading to sort. */
(function () {
  "use strict";
  var data = null, sortKey = null, sortDir = 1, show = "all", host = null, hooks = {};
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
    var band = "<tr class='band'><th class='fz1'></th><th class='fz2'></th>" + data.groups.map(function (g) { return "<th colspan='" + g.span + "' scope='colgroup'>" + esc(g.label) + "</th>"; }).join("") + "<th></th></tr>";
    var head = "<tr>" + th("__id", "Student ID", "fz1") + th("__name", "Name", "fz2") + data.columns.map(function (c) { return th(c.key, c.label); }).join("") + th("__last", "Last activity") + "</tr>";
    var body = rows.slice(0, 1000).map(function (r) {
      return "<tr data-sel='" + esc(r.id) + "' tabindex='0'><td class='fz1'>" + esc(r.id) + "</td><td class='fz2'>" + esc(r.name) + "</td>" + data.columns.map(function (c) {
        var x = r.cells[c.key]; return "<td" + (x.empty ? " class='none'" : "") + (x.when ? " title='Entered " + esc(x.when) + "'" : "") + ">" + esc(x.t) + "</td>";
      }).join("") + "<td" + (r.last === null ? " class='none'" : "") + ">" + esc(r.lastText) + "</td>" +
        "</tr>";
    }).join("");
    host.innerHTML = "<div class='gbar'>" + chips + "</div><div class='gscroll frz-scroll'><table class='gt frz'><thead>" + band + head + "</thead><tbody>" + body + "</tbody></table></div>" +
      (rows.length === 0 ? "<p class='note' style='padding:.8rem 1rem'>No students match.</p>" : "") + (rows.length > 1000 ? "<p class='note' style='padding:.6rem 1rem'>First 1000 of " + rows.length + " students shown. Download as Excel to see all.</p>" : "");
    var ctx = { tab: "Grades", student: true, timeline: timeline, reload: function () { if (hooks.reload) hooks.reload(); } };
    cmRowSelect.bind({ host: host, item: function (k) { var r = data.rows.filter(function (x) { return x.id === k; })[0]; return r ? { key: k, id: r.id, name: r.name } : null; }, actions: function (items) { return cmRowActions.actions(ctx, items); } });
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
    if (!host || !host.contains(e.target)) return;
    var chip = e.target.closest && e.target.closest("[data-show]"); if (chip) { show = chip.getAttribute("data-show"); draw(); return; }
    var t = e.target.closest && e.target.closest("th[data-k]"); if (t) { var k = t.getAttribute("data-k"); sortDir = k === sortKey ? -sortDir : 1; sortKey = k; draw(); var n = host.querySelector("th[data-k='" + k + "']"); if (n) n.focus(); }
  });
  document.addEventListener("keydown", function (e) {
    if (!host || !host.contains(e.target) || (e.key !== "Enter" && e.key !== " ")) return;
    var t = e.target.closest && e.target.closest("th[data-k]"); if (t) { e.preventDefault(); t.click(); }
  });
  window.cmGradesView = { timeline: timeline, render: render, redraw: function () { if (data && host) draw(); } };
})();
