/* Class Manager: the "Course details found" card of Load from a folder.
   Shows each detail CM found in the files, which file it came from, and lets the lecturer correct it before it is saved to Course details.
   A detail the course already has is not ticked, so nothing is replaced unless the lecturer ticks it. */
(function (root) {
  "use strict";
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  var TYPE = { start: "date", end: "date", week: "number" };

  function html(fields, topics, existing) {
    topics = (topics || []).filter(function (t) { return (existing || []).indexOf(t.week) < 0; });
    if ((!fields || !fields.length) && !topics.length) return "<p class='note'>No course details (course code, title, lecturer, semester, dates or class times) were found in these files. You can fill them in under Course details.</p>";
    return "<section class='card' id='fc-card' aria-labelledby='fc-h'><h3 id='fc-h'>Course details found</h3>" +
      "<p class='note'>CM found these in your files. Correct anything that is wrong, untick what you do not want, then save. Details the course already has are not ticked.</p>" +
      "<div class='fc-rows'>" + fields.map(function (f) {
        var has = !!f.current, id = "fc-" + f.key;
        return "<div class='fc-row'><label><input type='checkbox' class='fc-on' data-key='" + esc(f.setting) + "'" + (has && f.current !== f.value ? "" : " checked") + "> " + esc(f.label) + "</label> " +
          "<input class='f fc-val' id='" + id + "' data-key='" + esc(f.setting) + "' type='" + (TYPE[f.key] || "text") + "' value='" + esc(f.value) + "' aria-label='" + esc(f.label) + "'>" +
          "<span class='note'>from " + esc(f.from) + (f.worked ? " (worked out from the first day)" : "") + (has && f.current !== f.value ? "; the course has “" + esc(f.current) + "”" : "") + "</span></div>";
      }).join("") + "</div>" +
      (topics.length ? "<p><label><input type='checkbox' id='fc-topics' data-topics='" + esc(JSON.stringify(topics)) + "' checked> Add the " + topics.length + " weekly topic(s) found as lecture titles</label> <span class='note'>from " + esc(topics[0].from) + ". Lectures that already exist are not changed.</span></p><ol class='note'>" + topics.slice(0, 14).map(function (t) { return "<li value='" + t.week + "'>" + esc(t.title) + "</li>"; }).join("") + (topics.length > 14 ? "<li>and " + (topics.length - 14) + " more</li>" : "") + "</ol>" : "") +
      "<p class='row'><button class='btn' type='button' id='fc-save'>Save these course details</button> <span class='note' id='fc-msg' role='status'></span></p></section>";
  }

  // Connects the card's save button inside `rootEl`.
  function wire(rootEl) {
    var b = rootEl.querySelector("#fc-save"); if (!b) return;
    b.onclick = function () {
      var values = {};
      Array.prototype.forEach.call(rootEl.querySelectorAll(".fc-on"), function (c) { if (c.checked) values[c.getAttribute("data-key")] = rootEl.querySelector(".fc-val[data-key='" + c.getAttribute("data-key") + "']").value; });
      var msg = rootEl.querySelector("#fc-msg"); b.disabled = true;
      var tp = rootEl.querySelector("#fc-topics"), topics = tp && tp.checked ? JSON.parse(tp.getAttribute("data-topics")) : [];
      cmApp.autoCourseSave({ values: values, topics: topics }).then(function (r) { b.disabled = false; msg.textContent = r && r.ok ? "Saved" + (r.topicsAdded ? " (" + r.topicsAdded + " lecture title(s) added)" : "") + ". Check them under Course details." : (r && r.why) || "Not saved."; },
        function (e) { b.disabled = false; msg.textContent = "Not saved: " + (e && e.message); });
    };
  }
  root.cmFolderCourse = { html: html, wire: wire };
})(window);
