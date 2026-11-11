/* Class Manager: the Learning Progress screen, the student lookup (Cmd or Ctrl K) and the teaching sections of a student's record.
   Every figure comes from the server script (learningProgress_ and studentProfile_, through cmApp.progress and cmApp.studentStats);
   this file only lays the results out. Levels and suggestions are for the lecturer; students see only their own progress, on My results. */
(function () {
  "use strict";
  if (!window.cmApp || !cmApp.progress || !window.cmCharts) return;
  var $ = function (i) { return document.getElementById(i); };
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  var num = function (v, u) { return v === null || v === undefined || v === "" ? "–" : v + (u || ""); };
  var signed = function (v, u) { return v === null || v === undefined ? "–" : (v > 0 ? "+" : v < 0 ? "−" : "") + Math.abs(v) + (u || ""); };
  var LV = ["Secure", "Developing", "Beginning", "Not enough evidence"], LC = { "Secure": "g-on", "Developing": "g-hard", "Beginning": "g-need", "Not enough evidence": "g-none" };
  var lchip = function (l) { return "<span class='gchip " + (LC[l] || "") + "'>" + esc(l) + "</span>"; };
  function levelsBar(lv) {
    var tot = LV.reduce(function (a, k) { return a + (lv[k] || 0); }, 0) || 1;
    return "<div class='stackbar' role='img' aria-label='" + LV.map(function (k) { return (lv[k] || 0) + " " + k; }).join(", ") + "'>" + LV.map(function (k) { var n = lv[k] || 0; return n ? "<span class='" + LC[k] + "' style='flex:" + n + "' title='" + esc(k) + ": " + n + "'></span>" : ""; }).join("") + "</div>";
  }
  function legend() { return "<p class='note lv-legend'>" + LV.map(function (k) { return "<span><i class='" + LC[k] + "'></i>" + esc(k) + "</span>"; }).join("") + "</p>"; }
  function line(vals, labels, o) { // a small line chart of percentages over time
    o = o || {}; var W = o.w || 520, H = o.h || 120, pad = 28, base = H - 20, n = vals.length;
    if (!n) return "";
    var x = function (i) { return pad + (n === 1 ? (W - pad) / 2 : i * (W - pad - 10) / (n - 1)); }, y = function (v) { return base - (base - 8) * v / 100; };
    var s = "<svg class='bars' viewBox='0 0 " + W + " " + H + "' role='img' aria-label='" + esc(o.title || "") + "'>";
    [0, 50, 100].forEach(function (g) { s += "<line class='grid' x1='" + pad + "' x2='" + W + "' y1='" + y(g) + "' y2='" + y(g) + "'/><text class='ax' x='" + (pad - 4) + "' y='" + (y(g) + 4) + "' text-anchor='end'>" + g + "%</text>"; });
    s += "<polyline fill='none' stroke='var(--bar)' stroke-width='2.5' points='" + vals.map(function (v, i) { return x(i) + "," + y(v); }).join(" ") + "'/>";
    vals.forEach(function (v, i) { s += "<g><title>" + esc(labels[i]) + ": " + v + "%" + (o.extra ? " " + esc(o.extra[i]) : "") + "</title><circle cx='" + x(i) + "' cy='" + y(v) + "' r='4' fill='var(--bar)'/></g>"; if (n <= 8 || i % Math.ceil(n / 8) === 0) s += "<text class='ax' x='" + x(i) + "' y='" + (H - 4) + "' text-anchor='middle'>" + esc(String(labels[i]).slice(0, 5)) + "</text>"; });
    return s + "</svg>";
  }

  var data = null;
  function load() { return cmApp.progress().then(function (d) { data = d && d.ok ? d : null; if (!data) $("lp").innerHTML = "<p class='msg'>Learning progress could not be worked out" + (d && d.why ? ": " + esc(d.why) : "") + ".</p>"; return data; }); }
  function show(v) { if (v === "progress") load().then(function () { if (data) render(); }); }

  function render() {
    var d = data, D = d.discussion, h = "";
    // Ask, discuss, revise
    h += "<section class='card'><div class='card-head'><h3>Ask, discuss, revise</h3><span class='note'>Questions answered twice: before and after pair discussion</span></div>";
    if (!D.rounds) h += "<p class='note'>No second vote yet. In a live quiz, press <b>Discuss and vote again</b> on a question that splits the class: students explain their answers to a neighbour, then answer again. The movement appears here.</p>";
    else {
      h += "<div class='tiles4'><div><p class='lbl'>Correct before discussion</p><p class='tbig'>" + num(D.beforePct, "%") + "</p></div><div><p class='lbl'>Correct after</p><p class='tbig'>" + num(D.afterPct, "%") + "</p></div>" +
        "<div><p class='lbl'>Normalised gain</p><p class='tbig'>" + num(D.gain) + "</p><p class='note'>share of the possible improvement</p></div><div><p class='lbl'>Moved</p><p class='tbig'>" + D.wrongToRight + " <span class='note'>to right</span></p><p class='note'>" + D.rightToWrong + " from right to wrong, " + D.pairs + " paired answers</p></div></div>";
      h += "<div class='tbl ins-tbl short'><table><thead><tr><th>Date</th><th>Quiz</th><th>Question</th><th>Before</th><th>After</th><th>Gain</th><th>Wrong to right</th><th>Right to wrong</th></tr></thead><tbody>" +
        D.questions.map(function (q) { return "<tr><td>" + esc(q.date) + "</td><td>" + esc(q.week ? "Week " + q.week : q.code) + "</td><td>" + esc(q.qid || "Q" + q.q) + "</td><td>" + num(q.beforePct, "%") + "</td><td>" + num(q.afterPct, "%") + "</td><td>" + num(q.gain) + "</td><td>" + q.wrongToRight + "</td><td" + (q.rightToWrong > q.wrongToRight ? " class='flag'" : "") + ">" + q.rightToWrong + "</td></tr>"; }).join("") + "</tbody></table></div><p class='note'>" + esc(D.note) + " Discussion works best on questions that 30 to 70 per cent answer correctly at first.</p>";
    }
    h += "</section>";
    // Class overview charts (charts/): who is secure where, and the objective-by-student map
    h += "<section class='card'><div class='card-head'><h3>Mastery by objective</h3><span class='note'>Students at each level on every objective or lecture</span></div>" + cmCharts.masteryDistribution(d.outcomes) + "</section>";
    h += "<section class='card'><div class='card-head'><h3>Objective map</h3><span class='note'>Weakest students first. Click a row to open the student.</span></div>" + cmCharts.heatmap(d.students, d.outcomes) + "</section>";
    // Objectives
    var linked = d.outcomes.filter(function (o) { return o.linked; }), unl = d.outcomes.filter(function (o) { return !o.linked; });
    h += "<section class='card'><div class='card-head'><h3>Learning objectives</h3><button class='btn sm' type='button' data-win='outcomes.html'>Link questions to objectives</button></div>" +
      "<p class='note'>Each student's level on an objective comes from their latest answers on it: Secure at " + d.thresholds.secure + "% or more, Developing from " + d.thresholds.developing + "%, otherwise Beginning; fewer than " + d.minimum + " answers is not enough evidence. Gain is the change from a student's first answers on the objective to their latest.</p>" + legend();
    if (!linked.length) h += "<p class='note'>No question is linked to an objective yet, so progress is shown by lecture below. Open <b>Link questions to objectives</b>: suggestions are ready to accept.</p>";
    h += "<div class='tbl ins-tbl short'><table><thead><tr><th>Objective</th><th>Students</th><th>Answers</th><th>Mean now</th><th>Mean gain</th><th style='min-width:12rem'>Students by level</th></tr></thead><tbody>" +
      linked.concat(unl).map(function (o) { return "<tr><td class='obj'>" + esc(o.label) + "</td><td>" + o.students + "</td><td>" + o.answers + "</td><td>" + num(o.current, "%") + "</td><td>" + signed(o.gain, " pts") + (o.gainN ? " <span class='note'>(" + o.gainN + ")</span>" : "") + "</td><td>" + levelsBar(o.levels) + "</td></tr>"; }).join("") + "</tbody></table></div></section>";
    // Students
    var st = d.students.slice().sort(function (a, b) { return (a.current === null ? 999 : a.current) - (b.current === null ? 999 : b.current); });
    h += "<section class='card'><div class='card-head'><h3>Each student's progress</h3><span class='note'>Lowest current level first. Click a student, or press " + (/Mac/i.test(navigator.platform || "") ? "⌘K" : "Ctrl+K") + " anywhere to look one up.</span></div>" +
      "<div class='tbl ins-tbl'><table><thead><tr><th>Student</th><th>Answers</th><th>Started</th><th>Now</th><th>Gain</th><th>Level</th><th style='min-width:10rem'>Objectives by level</th><th>Discussion</th></tr></thead><tbody>" +
      st.map(function (s) { return "<tr tabindex='0' data-id='" + esc(s.id) + "'><td><b>" + esc(s.name || s.id) + "</b><span class='note'> " + esc(s.id) + "</span></td><td>" + s.answers + "</td><td>" + num(s.start, "%") + "</td><td>" + num(s.current, "%") + "</td><td>" + signed(s.gain, " pts") + "</td><td>" + lchip(s.level) + "</td><td>" + levelsBar(s.levels) + "</td><td>" + (s.discussion ? s.discussion.wrongToRight + " gained, " + s.discussion.rightToWrong + " lost" : "–") + "</td></tr>"; }).join("") + "</tbody></table></div></section>";
    // Groups and assignments
    var A = d.assignments;
    h += "<section class='card'><div class='card-head'><h3>Groups and group work</h3><span class='row'><button class='btn sm' type='button' data-win='groups.html'>Student groups</button><button class='btn sm' type='button' data-win='assignments.html'>Group assignments</button></span></div>";
    if (!A.length) h += "<p class='note'>No group assignment yet. Make groups under Student groups, then set a task for all or some of them under Group assignments.</p>";
    else h += "<div class='tbl ins-tbl short'><table><thead><tr><th>Assignment</th><th>Set</th><th>Submitted</th><th>On time</th><th>Marked</th><th>Members who gave their part</th><th>Low peer ratings</th><th>Objective before and after</th></tr></thead><tbody>" +
      A.map(function (a) { var m = a.measures, ba = m.beforeAfter; return "<tr><td><b>" + esc(a.title) + "</b>" + (a.status === "closed" ? " <span class='note'>closed</span>" : "") + "</td><td>" + esc(a.set) + "</td><td>" + m.submitted + " of " + m.allocated + "</td><td>" + m.onTime + "</td><td>" + m.marked + "</td><td>" + num(m.contribution, "%") + "</td><td" + (m.peerFlags ? " class='flag'" : "") + ">" + m.peerFlags + "</td><td>" + (ba ? num(ba.before, "%") + " → " + num(ba.after, "%") + " <span class='note'>(" + ba.beforeN + ", " + ba.afterN + ")</span>" : "–") + "</td></tr>"; }).join("") + "</tbody></table></div>";
    d.groupProgress.forEach(function (gs) {
      h += "<p class='lbl' style='margin-top:1rem'>" + esc(gs.set) + ": mean level now and mean gain of each group's members</p><div class='gp-row'>" + gs.groups.map(function (g) { return "<div class='gp-cell'><b>Group " + g.group + "</b><span>" + num(g.current, "%") + "</span><span class='note'>" + signed(g.gain, " pts") + " · " + g.withEvidence + " of " + g.members + " with evidence</span></div>"; }).join("") + "</div>";
    });
    h += "</section>";
    $("lp").innerHTML = h;
    $("lp").querySelectorAll("[data-win]").forEach(function (b) { b.addEventListener("click", function () { cmApp.openWindow(b.getAttribute("data-win")); }); });
  }

  /* ---- the teaching sections of a student's record (added under the statistics in the student window) ---- */
  function profileHtml(r) {
    var p = r.profile; if (!p || p.error) return p && p.error ? "<p class='note'>Progress could not be worked out: " + esc(p.error) + "</p>" : "";
    var P = p.progress, h = "";
    h += "<h3 class='sec'>Suggestions for you</h3><ul class='tips'>" + p.suggestions.map(function (t) { return "<li><span class='tk'>" + esc(t.kind) + "</span><span>" + esc(t.text) + "</span></li>"; }).join("") + "</ul>";
    h += "<div class='g2'><div><p class='lbl'>Strengths</p>" + (p.strengths.length ? "<ul class='plain'>" + p.strengths.map(function (o) { return "<li>" + esc(o.label) + " <span class='note'>" + o.current + "%, " + o.answers + " answers</span></li>"; }).join("") + "</ul>" : "<p class='note'>None secure yet with enough answers.</p>") + "</div>" +
      "<div><p class='lbl'>Areas to work on</p>" + (p.weak.length ? "<ul class='plain'>" + p.weak.map(function (o) { return "<li>" + esc(o.label) + " <span class='note'>" + o.current + "%, " + o.answers + " answers</span></li>"; }).join("") + "</ul>" : "<p class='note'>None stands out.</p>") + "</div></div>";
    h += "<h3 class='sec'>Progress by objective</h3><p class='note'>Started: the first answers on the objective. Now: the latest. " + P.overall.answers + " answers in all; overall " + num(P.overall.start, "%") + " at the start and " + num(P.overall.current, "%") + " now.</p>";
    if (P.timeline.length > 1) h += "<p class='lbl'>Proportion correct by week</p>" + line(P.timeline.map(function (t) { return t.pct; }), P.timeline.map(function (t) { return t.week; }), { title: "Proportion correct by week", extra: P.timeline.map(function (t) { return "(" + t.n + " answers)"; }) });
    h += P.outcomes.length ? "<div class='tbl ins-tbl short'><table><thead><tr><th>Objective</th><th>Answers</th><th>Started</th><th>Now</th><th>Gain</th><th>Level</th></tr></thead><tbody>" + P.outcomes.map(function (o) { return "<tr><td class='obj'>" + esc(o.label) + "</td><td>" + o.answers + "</td><td>" + num(o.start, "%") + "</td><td>" + num(o.current, "%") + "</td><td>" + signed(o.gain, " pts") + "</td><td>" + lchip(o.level) + "</td></tr>"; }).join("") + "</tbody></table></div>" : "<p class='note'>No answers yet.</p>";
    if (p.discussion) h += "<p class='note'>Ask, discuss, revise: " + p.discussion.pairs + (p.discussion.pairs === 1 ? " question" : " questions") + " answered twice; " + p.discussion.wrongToRight + " changed from wrong to right, " + p.discussion.rightToWrong + " from right to wrong.</p>";
    h += "<h3 class='sec'>Groups and group work</h3>";
    h += p.groups.length ? "<p>" + p.groups.map(function (g) { return esc(g.set) + ": Group " + g.group + " with " + esc(g.members.join(", ") || "no one else"); }).join("<br>") + "</p>" : "<p class='note'>Not in a group.</p>";
    if (p.groupWork.length) h += "<div class='tbl ins-tbl short'><table><thead><tr><th>Assignment</th><th>Group</th><th>Submitted</th><th>Mark</th><th>Their part</th><th>Peer rating</th></tr></thead><tbody>" + p.groupWork.map(function (g) { return "<tr><td>" + esc(g.title) + "</td><td>" + g.group + "</td><td>" + (g.submitted ? (g.late ? "late" : "yes") : "no") + "</td><td>" + (g.mark === null ? "–" : esc(g.mark) + (g.outOf !== "" ? " / " + esc(g.outOf) : "")) + "</td><td>" + (g.part ? esc(g.part) : "<span class='note'>not given</span>") + "</td><td" + (g.peerFlag ? " class='flag'" : "") + ">" + (g.peerAvg === null ? "–" : g.peerAvg + " of 2 (" + g.peerN + ")") + "</td></tr>"; }).join("") + "</tbody></table></div>";
    return h;
  }

  /* ---- the lookup ---- */
  var roster = [];
  function lookOpen() {
    var d = $("look-d"); if (!d) return;
    (window.cmInsights && cmInsights.students ? cmInsights.students() : Promise.resolve([])).then(function (list) {
      roster = list || [];
      $("look-list").innerHTML = roster.map(function (s) { return "<option value='" + esc(s.id) + "'>" + esc(s.name) + "</option>"; }).join("");
    });
    $("look-in").value = ""; $("look-msg").textContent = ""; d.showModal(); $("look-in").focus();
  }
  function lookGo() {
    var v = $("look-in").value.trim(), low = v.toLowerCase(), id = v.replace(/\D/g, "");
    var hit = roster.filter(function (s) { return s.id === id; })[0] || roster.filter(function (s) { return low && String(s.name).toLowerCase().indexOf(low) >= 0; })[0];
    if (!hit && id.length >= 4) hit = { id: id };
    if (!hit) { $("look-msg").textContent = "No student matches. Type a Student ID or part of a name."; return; }
    $("look-d").close(); if (window.cmInsights && cmInsights.open) cmInsights.open(hit.id);
  }
  document.addEventListener("keydown", function (e) {
    var mac = /Mac/i.test(navigator.platform || navigator.userAgent);
    if ((mac ? e.metaKey : e.ctrlKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === "k") { e.preventDefault(); lookOpen(); }
  });
  if ($("look-form")) $("look-form").addEventListener("submit", function (e) { e.preventDefault(); lookGo(); });
  ["look-btn", "look-top"].forEach(function (i) { if ($(i)) $(i).addEventListener("click", lookOpen); });
  if ($("look-x")) $("look-x").addEventListener("click", function () { $("look-d").close(); });
  // Rows with data-id (here and on the Students screen) open the student's record through insights.js.

  window.cmProgress = { show: show, profileHtml: profileHtml, lookup: lookOpen };
})();
