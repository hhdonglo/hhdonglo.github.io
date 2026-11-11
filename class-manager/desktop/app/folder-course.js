/* Class Manager: the "Course details found" card of Load from a folder.
   Shows each detail CM found in the files, which file it came from, and lets the lecturer correct it before it is saved to Course details.
   A detail the course already has is not ticked, so nothing is replaced unless the lecturer ticks it. */
(function (root) {
  "use strict";
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  var TYPE = { start: "date", end: "date", week: "number" };

  function html(fields) {
    if (!fields || !fields.length) return "<p class='note'>No course details (course code, title, lecturer, semester, dates or class times) were found in these files. You can fill them in under Course details.</p>";
    return "<section class='card' id='fc-card' aria-labelledby='fc-h'><h3 id='fc-h'>Course details found</h3>" +
      "<p class='note'>CM found these in your files. Correct anything that is wrong, untick what you do not want, then save. Details the course already has are not ticked.</p>" +
      "<div class='fc-rows'>" + fields.map(function (f) {
        var has = !!f.current, id = "fc-" + f.key;
        return "<div class='fc-row'><label><input type='checkbox' class='fc-on' data-key='" + esc(f.setting) + "'" + (has && f.current !== f.value ? "" : " checked") + "> " + esc(f.label) + "</label> " +
          "<input class='f fc-val' id='" + id + "' data-key='" + esc(f.setting) + "' type='" + (TYPE[f.key] || "text") + "' value='" + esc(f.value) + "' aria-label='" + esc(f.label) + "'>" +
          "<span class='note'>from " + esc(f.from) + (f.worked ? " (worked out from the first day)" : "") + (has && f.current !== f.value ? "; the course has “" + esc(f.current) + "”" : "") + "</span></div>";
      }).join("") + "</div>" +
      "<p class='row'><button class='btn' type='button' id='fc-save'>Save these course details</button> <span class='note' id='fc-msg' role='status'></span></p></section>";
  }

  // Connects the card's save button inside `rootEl`.
  function wire(rootEl) {
    var b = rootEl.querySelector("#fc-save"); if (!b) return;
    b.onclick = function () {
      var values = {};
      Array.prototype.forEach.call(rootEl.querySelectorAll(".fc-on"), function (c) { if (c.checked) values[c.getAttribute("data-key")] = rootEl.querySelector(".fc-val[data-key='" + c.getAttribute("data-key") + "']").value; });
      var msg = rootEl.querySelector("#fc-msg"); b.disabled = true;
      cmApp.autoCourseSave({ values: values }).then(function (r) { b.disabled = false; msg.textContent = r && r.ok ? "Saved. Check them under Course details." : (r && r.why) || "Not saved."; },
        function (e) { b.disabled = false; msg.textContent = "Not saved: " + (e && e.message); });
    };
  }
  root.cmFolderCourse = { html: html, wire: wire };
})(window);
