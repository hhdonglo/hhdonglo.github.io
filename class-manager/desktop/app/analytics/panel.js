/* Class Manager analytics panel: fetches the extra data, runs the analytics modules and fills the cards on the Overview (window.cmAnalyticsPanel).
   It also holds the Privacy and records card: term close, student export and erase, privacy notice, audit log, optional AI summary. Buttons use data-an attributes. */
(function (root) {
  "use strict";
  function use(g, f) { return root[g] || (typeof require === "function" ? require("./" + f) : null); }
  var V = use("cmAnalyticsView", "render"), esc = V.esc;
  function summaryCard(r, ex) {
    if (!r || !r.ok) return "";
    return "<section class='card acard'><h3>This week in the class</h3><p>" + esc(r.text) + "</p><p class='muted small'>" + (r.source === "ai" ? "Written by Claude from class totals only. No student names or answers were sent." : "Written on this computer from class totals. Nothing was sent anywhere.") + "</p>" +
      "<label class='small'><input type='checkbox' data-an='ai'" + (ex.aiSummary ? " checked" : "") + (ex.hasKey ? "" : " disabled") + "> Let Claude word this summary (class totals only)" + (ex.hasKey ? "" : " (needs an Anthropic key under Resources)") + "</label></section>";
  }
  function privacyCard(ex) {
    return "<section class='card acard' id='an-priv'><h3>Privacy and records</h3>" +
      "<p><b>Term:</b> " + (ex.termClosed ? "closed. Students can no longer check in or answer." : "open.") + " <button class='btn' type='button' data-an='term' data-closed='" + (ex.termClosed ? "0" : "1") + "'>" + (ex.termClosed ? "Reopen the term" : "Close the term") + "</button></p>" +
      "<p><label>Student ID <input id='an-id' inputmode='numeric' autocomplete='off' style='width:9rem'></label> <button class='btn' type='button' data-an='export'>Export this student's data</button> <button class='btn danger' type='button' data-an='erase'>Erase permanently</button></p>" +
      "<p class='muted small'>Erase removes the student's rows from every tab and cannot be undone. You will be asked to type the ID again. Each export, erase and term change is written to the audit log.</p>" +
      "<details><summary>Privacy notice shown to students</summary><p class='small'>Students read it at <code>/privacy.html</code>.</p><textarea id='an-notice' aria-label='Privacy notice text' rows='7' style='width:100%'>" + esc(ex.privacyNotice) + "</textarea><button class='btn' type='button' data-an='notice'>Save notice</button></details>" +
      "<details><summary>Audit log</summary><div id='an-log' class='small'>Loading</div></details><p id='an-msg' class='small' role='status'></p></section>";
  }
  function build(d, ex, sm) {
    var AI = use("cmItems", "items"), C = use("cmConcepts", "concepts"), I = use("cmInterventions", "interventions"), F = use("cmFairness", "fairness");
    var h = summaryCard(sm, ex);
    if (d.questions && d.questions.length) h += V.items(AI.analyse(d.questions));
    h += V.concepts(C.track(d.lectures || [], d.questions || [], null, d.rosterSize));
    h += V.interventions((ex.interventions || []).map(function (r) { return I.compare(r, d.students || []); }));
    h += V.fairness(F.byGroup(d.students || [], ex.cohorts || {}));
    return h + privacyCard(ex);
  }
  function mount(el, d) {
    if (!el || !root.cmApp || !cmApp.analyticsExtra) return;
    Promise.all([cmApp.analyticsExtra(), cmApp.weeklySummary()]).then(function (r) { el.innerHTML = "<div class='dgrid'>" + build(d, r[0], r[1]) + "</div>"; bind(el, d); }).catch(function () { el.innerHTML = ""; });
  }
  function say(t) { var m = document.getElementById("an-msg"); if (m) m.textContent = t; }
  function bind(el, d) {
    if (el._bound) return; el._bound = true;
    el.addEventListener("click", function (e) {
      var b = e.target.closest("[data-an]"); if (!b) return; var op = b.getAttribute("data-an"), idEl = document.getElementById("an-id"), id = idEl ? idEl.value.replace(/\D/g, "") : "";
      if (op === "term") cmApp.govern("term", { closed: b.getAttribute("data-closed") === "1" }).then(function () { mount(el, d); });
      else if (op === "export") cmApp.govern("export", { id: id }).then(function (r) { if (!r.ok) return say(r.why); var t = Object.keys(r.tabs).map(function (k) { return k + "\n" + r.tabs[k].map(function (x) { return x.join("\t"); }).join("\n"); }).join("\n\n"); var a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([t], { type: "text/plain" })); a.download = "student-" + id + ".txt"; a.click(); say("Exported " + Object.keys(r.tabs).length + " tabs."); });
      else if (op === "erase") { var c = prompt("This permanently erases student " + id + " from every tab. Type the ID to confirm."); if (c === null) return; cmApp.govern("erase", { id: id, confirm: c }).then(function (r) { say(r.ok ? "Erased " + r.rows + " rows." : r.why); }); }
      else if (op === "notice") cmApp.govern("notice", { text: document.getElementById("an-notice").value }).then(function () { say("Saved."); });
    });
    el.addEventListener("change", function (e) { if (e.target.getAttribute && e.target.getAttribute("data-an") === "ai") cmApp.govern("ai", { on: e.target.checked }).then(function () { mount(el, d); }); });
    el.addEventListener("toggle", function (e) { if (e.target.querySelector && e.target.open && e.target.querySelector("#an-log")) cmApp.govern("audit").then(function (r) { document.getElementById("an-log").innerHTML = r.log.length ? "<ul class='alist'>" + r.log.map(function (x) { return "<li>" + esc(x.when.slice(0, 16).replace("T", " ")) + ": " + esc(x.action) + (x.id ? " (" + esc(x.id) + ")" : "") + (x.detail ? ", " + esc(x.detail) : "") + "</li>"; }).join("") + "</ul>" : "Nothing recorded yet."; }); }, true);
  }
  var api = { build: build, mount: mount };
  if (typeof module === "object" && module.exports) module.exports = api; else root.cmAnalyticsPanel = api;
})(typeof window !== "undefined" ? window : globalThis);
