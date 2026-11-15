/* What the action bar offers for the selected rows, and the removal flows behind it. Uses cmRowSelect (selection, dialog, notice) and cmApp (the CM calls).
   A screen gives it: { tab, student: true when each row is a student, timeline(id, name), reload() }. Two kinds of removal, always confirmed, never a delete:
   - a whole student: leaves the class list, attendance, marks and totals (remove-student.js); Restore or Undo puts everything back;
   - a single entry: one row of a tab is set aside in Removed_Entries (remove-entry.js); Undo puts it back in place. */
(function () {
  "use strict";
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); };
  var who = function (x) { return "<b>" + esc(x.name || "No name") + "</b> (" + esc(x.id) + ")"; };
  function list(items) { var s = items.slice(0, 6).map(who).join(", "); return s + (items.length > 6 ? " and " + (items.length - 6) + " more" : ""); }
  function each(items, fn) { return items.reduce(function (p, x) { return p.then(function (acc) { return fn(x).then(function (r) { acc.push(r); return acc; }); }); }, Promise.resolve([])); }
  function failed(rs) { var f = rs.filter(function (r) { return !(r && r.ok); })[0]; return f ? ((f && f.why) || "Not done.") : ""; }

  function removeStudents(ctx, items) {
    var one = items.length === 1;
    return cmRowSelect.confirm({
      title: one ? "Remove this student from the class?" : "Remove " + items.length + " students from the class?",
      lines: [list(items), "They leave the class list, attendance, marks and totals. Nothing is deleted: the records are set aside in Removed_Students. You can undo this now, or restore a student from that tab at any time."],
      go: one ? "Remove from the class" : "Remove " + items.length + " students"
    }).then(function (v) {
      if (!v) return;
      return each(items, function (x) { return cmApp.removeStudent(x.id); }).then(function (rs) {
        var bad = failed(rs); cmRowSelect.clear(); ctx.reload();
        if (bad) { cmRowSelect.notice(bad); return; }
        cmRowSelect.notice("Removed " + (one ? (items[0].name || items[0].id) : items.length + " students") + " from the class.", { undo: function () { each(items, function (x) { return cmApp.restoreStudent(x.id); }).then(function () { ctx.reload(); cmRowSelect.notice("Put back."); }); } });
      });
    });
  }
  function removeEntries(ctx, items) {
    var withId = items.every(function (x) { return x.id; }), one = items.length === 1;
    var choices = withId ? [
      { value: "entry", label: one ? "Only this entry" : "Only these " + items.length + " entries", help: "The student stays in the class. Just the selected " + (one ? "row of " : "rows of ") + ctx.tab + " " + (one ? "is" : "are") + " set aside." },
      { value: "student", label: "The student, with everything", help: "The student leaves the class list, attendance, marks and totals (their quiz and check-in lines stay in the logs)." }
    ] : null;
    return cmRowSelect.confirm({
      title: one ? "Remove this entry?" : "Remove " + items.length + " entries?",
      lines: [withId ? list(items) : esc(items.length + (one ? " row" : " rows") + " of " + ctx.tab), "Nothing is deleted: the rows are set aside in Removed_Entries and you can undo this now."],
      choices: choices, go: "Remove"
    }).then(function (v) {
      if (!v) return;
      if (v === "student") return removeStudents(ctx, items);
      return cmApp.removeEntries(ctx.tab, items.map(function (x) { return { index: x.index, cells: x.cells }; })).then(function (r) {
        cmRowSelect.clear(); ctx.reload();
        if (!r || !r.ok) { cmRowSelect.notice((r && r.why) || "Not done."); return; }
        cmRowSelect.notice("Removed " + r.count + (r.count === 1 ? " entry." : " entries."), { undo: function () { cmApp.restoreEntries(r.batch).then(function () { ctx.reload(); cmRowSelect.notice("Put back."); }); } });
      });
    });
  }
  function restoreStudents(ctx, items) {
    return each(items, function (x) { return cmApp.restoreStudent(x.id); }).then(function (rs) { cmRowSelect.clear(); ctx.reload(); cmRowSelect.notice(failed(rs) || "Put back " + items.length + (items.length === 1 ? " student." : " students.")); });
  }
  function restoreBatches(ctx, items) {
    return each(items, function (x) { return cmApp.restoreEntries(x.cells[1]); }).then(function (rs) { cmRowSelect.clear(); ctx.reload(); cmRowSelect.notice(failed(rs) || "Put back."); });
  }

  function actions(ctx, items) {
    var out = [], one = items.length === 1, x = items[0];
    if (ctx.tab === "Removed_Students") return [{ label: "Restore" + (one ? "" : " " + items.length), run: function (it) { restoreStudents(ctx, it); } }];
    if (ctx.tab === "Removed_Entries") return [{ label: "Put back", run: function (it) { restoreBatches(ctx, it); } }];
    if (one && x.id && ctx.timeline) out.push({ label: "Open timeline", run: function (it) { ctx.timeline(it[0].id, it[0].name); } });
    if (ctx.student) out.push({ label: one ? "Remove row" : "Remove " + items.length + " rows", danger: true, run: function (it) { removeStudents(ctx, it); } });
    else out.push({ label: one ? "Remove row" : "Remove " + items.length + " rows", danger: true, run: function (it) { removeEntries(ctx, it); } });
    return out;
  }
  window.cmRowActions = { actions: actions };
})();
