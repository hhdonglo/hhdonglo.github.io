/* Class Manager: the Insight screens (Class Overview, Students, Attendance, Quizzes and Questions).
   Every figure comes from the backend (classStats_ and studentStats_ in the server script, through cmApp.stats);
   this file only lays the results out. The engagement groups are suggestions for the lecturer and never reach students. */
(function () {
  "use strict";
  if (!window.cmApp || !cmApp.stats) return;
  var $ = function (i) { return document.getElementById(i); };
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } }
  var num = function (v, unit) { return v === null || v === undefined || v === "" ? "–" : v + (unit || ""); };
  var signed = function (v, unit) { return v === null || v === undefined ? "–" : (v > 0 ? "+" : v < 0 ? "−" : "") + Math.abs(v) + (unit || ""); };
  var plural = function (n, one, many) { return n + " " + (n === 1 ? one : many); };

  var DEF = { effort: 70, perf: 50, idle: 14, misses: 2 };
  function th() { var t = {}; try { t = JSON.parse(store("cm-th") || "{}") || {}; } catch (e) { t = {}; } return Object.assign({}, DEF, t); }
  var GROUPS = ["On track", "Working hard but struggling", "Disengaged", "Needs a check-in", "Not enough data"];
  var GCLASS = { "On track": "g-on", "Working hard but struggling": "g-hard", "Disengaged": "g-dis", "Needs a check-in": "g-need", "Not enough data": "g-none" };
  var VCLASS = { "Learning": "v-yes", "Mixed": "v-mixed", "Not yet learning": "v-no", "Not enough data": "v-none" };
  var VMARK = { "Learning": "↑", "Mixed": "↕", "Not yet learning": "↓", "Not enough data": "·" };
  var chip = function (g) { return "<span class='gchip " + (GCLASS[g] || "") + "'>" + esc(g) + "</span>"; };
  var vchip = function (v) { return "<span class='vchip " + (VCLASS[v] || "") + "'><b aria-hidden='true'>" + VMARK[v] + "</b>" + esc(v) + "</span>"; };
  var arrow = function (v) { return v > 0 ? "<span class='sig up' title='Improving'>↑</span>" : v < 0 ? "<span class='sig down' title='Falling'>↓</span>" : "<span class='sig flat' title='No clear change'>→</span>"; };

  // A plain bar chart in SVG: one series, a recessive 0, 50 and 100 grid, a tooltip on each bar, labels thinned when crowded.
  function bars(vals, labels, o) {
    o = o || {}; var max = o.max || Math.max(1, Math.max.apply(null, vals.map(function (v) { return v || 0; })));
    var W = o.w || 600, H = o.h || 160, pad = 26, base = H - 22, n = vals.length, bw = n ? (W - pad - 8) / n : 0, every = Math.ceil(n / (o.labels || 10));
    var s = "<svg class='bars' viewBox='0 0 " + W + " " + H + "' role='img' aria-label='" + esc(o.title || "") + "'>";
    (o.grid || (o.unit === "%" ? [0, max / 2, max] : [0, max])).forEach(function (g) { var y = base - (base - 8) * g / max; s += "<line class='grid' x1='" + pad + "' x2='" + W + "' y1='" + y + "' y2='" + y + "'/><text class='ax' x='" + (pad - 4) + "' y='" + (y + 4) + "' text-anchor='end'>" + Math.round(g) + (o.unit || "") + "</text>"; });
    vals.forEach(function (v, i) {
      var w = Math.max(2, Math.min(bw - 3, 56)), x = pad + 4 + i * bw + (bw - 3 - w) / 2, h = v === null ? 0 : Math.max(v ? 2 : 0, (base - 8) * v / max), y = base - h;
      s += "<g class='bar" + (o.hi === i ? " hi" : "") + "'><title>" + esc(labels[i]) + ": " + (v === null ? "no data" : v + (o.unit || "")) + (o.extra ? " " + esc(o.extra[i]) : "") + "</title>" +
        "<rect class='hit' x='" + (pad + 4 + i * bw) + "' y='0' width='" + Math.max(2, bw) + "' height='" + base + "'/>" +
        "<path d='M" + x + "," + base + "V" + (y + Math.min(3, h)) + "q0,-" + Math.min(3, h) + " " + Math.min(3, w / 2) + ",-" + Math.min(3, h) + "H" + (x + w - Math.min(3, w / 2)) + "q" + Math.min(3, w / 2) + ",0 " + Math.min(3, w / 2) + "," + Math.min(3, h) + "V" + base + "Z'/></g>";
      if (i % every === 0) s += "<text class='ax' x='" + (x + w / 2) + "' y='" + (H - 6) + "' text-anchor='middle'>" + esc(o.short ? o.short(labels[i]) : labels[i]) + "</text>";
    });
    return s + "<line class='base' x1='" + pad + "' x2='" + W + "' y1='" + base + "' y2='" + base + "'/></svg>";
  }
  function stack(counts) { // the engagement groups as one bar with a legend
    var tot = GROUPS.reduce(function (a, g) { return a + (counts[g] || 0); }, 0) || 1;
    return "<div class='stackbar' role='img' aria-label='Engagement groups'>" + GROUPS.map(function (g) { var n = counts[g] || 0; return n ? "<span class='" + GCLASS[g] + "' style='flex:" + n + "' title='" + esc(g) + ": " + n + "'></span>" : ""; }).join("") + "</div>" +
      "<ul class='legend'>" + GROUPS.map(function (g) { var n = counts[g] || 0; return n || g !== "Not enough data" ? "<li><button type='button' class='lg' data-group='" + esc(g) + "'><i class='" + GCLASS[g] + "'></i>" + esc(g) + " <b>" + n + "</b></button></li>" : ""; }).join("") + "</ul>";
  }
  var shortDate = function (l) { var m = /^(\d\d)\/(\d\d)/.exec(l); return m ? m[1] + "/" + m[2] : l.replace(/^Week /, "W"); };
  var tile = function (lbl, big, sub, extra) { return "<div class='card tile'><p class='lbl'>" + lbl + "</p><p class='tbig'>" + big + "</p><p class='note'>" + sub + "</p>" + (extra || "") + "</div>"; };

  var data = null, loading = null, cur = "overview";
  function load(force) {
    if (loading && !force) return loading;
    loading = cmApp.stats(th()).then(function (d) { loading = null; if (d && d.ok) { data = d; } else if (d) { data = null; err(d.why); } return data; }, function (e) { loading = null; err(e && e.message); });
    return loading;
  }
  function err(why) { ["ov", "st", "at", "qz"].forEach(function (i) { $(i).innerHTML = "<p class='msg'>The statistics could not be worked out" + (why ? ": " + esc(why) : "") + ".</p>"; }); }
  function show(view) {
    cur = view;
    if (["overview", "students", "attendance", "quizzes"].indexOf(view) < 0) return;
    load().then(function () { if (data) render(view); });
  }
  function render(view) {
    if (view === "overview") overview(); else if (view === "students") students(); else if (view === "attendance") attendance(); else quizzes();
  }

  /* ---- Class Overview ---- */
  function overview() {
    var d = data, s = d.summary, L = d.learning, a = d.attendance;
    $("ov-sub").textContent = "How the class is doing, from attendance, live quizzes and practice. " + plural(d.rosterSize, "student", "students") + " on the class list. Updated " + new Date(d.generated).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) + ".";
    if (!d.rosterSize) { $("ov").innerHTML = "<div class='card empty'><h3>No class yet</h3><p>Add the class list under Class Roster. The overview fills in as you take attendance and run quizzes.</p></div>"; return; }
    var h = "";
    // Is the class learning?
    h += "<section class='card verdict " + (VCLASS[L.verdict] || "") + "' aria-labelledby='vh'><div class='v-main'><p class='lbl' id='vh'>Is the class learning?</p>" +
      "<p class='v-word'>" + vchip(L.verdict) + (L.confidence ? "<span class='note'>Confidence: " + esc(L.confidence) + "</span>" : "") + "</p>" +
      "<p class='v-act'><b>Suggested:</b> " + esc(L.action) + "</p>" +
      (L.smallSample.length ? "<p class='note warnline'>Small sample: " + esc(L.smallSample.join("; ")) + ".</p>" : "") +
      "<details class='note'><summary>What a verdict needs</summary><p>" + esc(L.minimum) + " " + esc(L.notMeasured) + "</p></details></div>" +
      "<div class='v-ev'><p class='lbl'>Evidence</p>" + (L.signals.length ? "<ul class='sigs'>" + L.signals.map(function (g) { return "<li>" + arrow(g.value) + "<div><b>" + esc(g.title) + (g.direct ? "" : " <span class='note'>(supporting)</span>") + "</b><span class='note'>" + esc(g.text) + "</span></div></li>"; }).join("") + "</ul>" : "<p class='note'>No evidence yet.</p>") + "</div>" +
      "<div class='v-top'><p class='lbl'>By topic</p>" + (L.topics.length ? "<ul class='topics'>" + L.topics.map(function (t) { return "<li title='" + esc(t.evidence) + "'><span>" + esc(t.label) + (t.small ? " <span class='note'>(few answers)</span>" : "") + "</span>" + vchip(t.verdict) + "<span class='note tnum'>" + num(t.pct, "%") + (t.gain !== null ? " · " + signed(t.gain) + " on repeat" : "") + "</span></li>"; }).join("") + "</ul>" : "<p class='note'>Topics appear once questions are answered.</p>") + "</div></section>";
    // Tiles
    var trend = a.earlierRate !== null ? signed(Math.round(10 * (a.recentRate - a.earlierRate)) / 10, " points") + " in the last three sessions" : (a.sessions ? plural(a.sessions, "session", "sessions") + " submitted" : "No session submitted yet");
    var lq = s.lastQuiz;
    h += "<div class='tiles4'>" +
      tile("Attendance", num(a.rate, "%"), trend, a.sessions ? bars(a.bySession.map(function (x) { return x.rate; }), a.bySession.map(function (x) { return x.label; }), { max: 100, unit: "%", h: 70, labels: 0, grid: [0, 100], title: "Attendance by session" }) : "") +
      tile("Latest quiz", lq ? num(lq.stats.mean, "%") : "–", lq ? esc(lq.quiz) + ": median " + num(lq.stats.median, "%") + ", " + plural(lq.students, "student", "students") + (lq.completion !== null ? ", " + lq.completion + "% finished" : "") : "No quiz released yet",
        d.quizzes.length ? bars(d.quizzes.map(function (q) { return q.stats.mean; }), d.quizzes.map(function (q) { return q.quiz; }), { max: 100, unit: "%", h: 70, labels: 0, grid: [0, 100], title: "Mean score by quiz" }) : "") +
      "<div class='card tile'><p class='lbl'>Engagement (suggested)</p>" + stack(d.groups) + "</div>" +
      tile("Absent in a row", String(s.missedInARow), "students missed the last " + d.thresholds.misses + " or more sessions", s.missedInARow ? "<button class='link' type='button' data-goview='attendance'>See who</button>" : "") +
      "</div>";
    // Areas to target and the change over time
    h += "<div class='ov2'><section class='card'><div class='card-head'><h3>Areas to target</h3><span class='note'>Ranked, with the evidence</span></div>" +
      (d.targets.length ? "<ol class='targets'>" + d.targets.slice(0, 7).map(target).join("") + "</ol>" : "<p class='note'>Nothing stands out yet.</p>") + "</section>" +
      "<section class='card'><div class='card-head'><h3>How the class is changing</h3></div>" +
      "<p class='lbl'>Attendance by session</p>" + (a.sessions ? bars(a.bySession.map(function (x) { return x.rate; }), a.bySession.map(function (x) { return x.label; }), { max: 100, unit: "%", h: 150, short: shortDate, title: "Attendance by session" }) : "<p class='note'>No session submitted yet.</p>") +
      "<p class='lbl' style='margin-top:1rem'>Mean quiz score</p>" + (d.quizzes.length ? bars(d.quizzes.map(function (q) { return q.stats.mean; }), d.quizzes.map(function (q) { return q.quiz; }), { max: 100, unit: "%", h: 150, short: shortDate, title: "Mean score by quiz", extra: d.quizzes.map(function (q) { return "(" + q.students + " students)"; }) }) : "<p class='note'>No quiz released yet.</p>") +
      "</section></div>";
    $("ov").innerHTML = h;
  }
  function target(t) {
    return "<li><span class='tk'>" + esc(t.kind) + "</span><div><b>" + esc(t.title) + "</b>" + (t.small ? " <span class='note warnline'>small sample</span>" : "") +
      "<p class='note'>" + esc(t.evidence) + " <span class='tnum'>(n = " + t.n + ")</span></p><p class='todo-a'>" + esc(t.action) + "</p>" +
      (t.group ? "<button class='link' type='button' data-group='" + esc(t.group) + "'>See the students</button>" : "") + "</div></li>";
  }

  /* ---- Students ---- */
  var filt = "", sortK = "group", sortD = 1;
  var COLS = [["name", "Student"], ["group", "Suggested group"], ["attendance", "Attendance"], ["missedInARow", "Missed in a row"], ["arrivalMedian", "Arrival (median min)"],
    ["quizzesTaken", "Quizzes taken"], ["quizAverage", "Quiz average"], ["change", "Last change"], ["percentile", "Percentile"], ["practiceRecent", "Practice (recent)"], ["practiceMinutes", "Practice minutes"]];
  function students() {
    var d = data, t = d.thresholds;
    ["effort", "perf", "idle", "misses"].forEach(function (k) { $("th-" + k).value = t[k]; });
    var rows = d.students.filter(function (s) { return !filt || s.group === filt; });
    rows.sort(function (a, b) {
      var x = a[sortK], y = b[sortK];
      if (sortK === "group") { x = GROUPS.indexOf(a.group); y = GROUPS.indexOf(b.group); if (x === y) { x = a.effort; y = b.effort; } }
      if (x === null || x === undefined) return 1; if (y === null || y === undefined) return -1;
      return (typeof x === "string" ? x.localeCompare(y) : x - y) * sortD;
    });
    var h = "<div class='row gfilter' role='group' aria-label='Filter by group'><button type='button' class='gf" + (filt ? "" : " on") + "' data-group=''>All <b>" + d.students.length + "</b></button>" +
      GROUPS.map(function (g) { return d.groups[g] || g !== "Not enough data" ? "<button type='button' class='gf" + (filt === g ? " on" : "") + "' data-group='" + esc(g) + "'><i class='" + GCLASS[g] + "'></i>" + esc(g) + " <b>" + (d.groups[g] || 0) + "</b></button>" : ""; }).join("") + "</div>";
    h += "<div class='tbl ins-tbl'><table><thead><tr>" + COLS.map(function (c) { return "<th scope='col' tabindex='0' data-k='" + c[0] + "'" + (c[0] === sortK ? " aria-sort='" + (sortD > 0 ? "ascending" : "descending") + "'" : "") + ">" + c[1] + "</th>"; }).join("") + "</tr></thead><tbody>" +
      rows.map(function (s) {
        return "<tr tabindex='0' data-id='" + esc(s.id) + "' title='" + esc(s.why.join("; ")) + "'><td><b>" + esc(s.name || s.id) + "</b><span class='note'> " + esc(s.id) + "</span></td><td>" + chip(s.group) + "</td><td>" + num(s.attendance, "%") + "</td><td" + (s.missedInARow >= t.misses ? " class='flag'" : "") + ">" + s.missedInARow + "</td><td>" + num(s.arrivalMedian) +
          "</td><td>" + s.quizzesTaken + " of " + d.quizzes.length + "</td><td>" + num(s.quizAverage, "%") + "</td><td>" + signed(s.change) + "</td><td>" + num(s.percentile) + "</td><td>" + s.practiceRecent + "</td><td>" + s.practiceMinutes + "</td></tr>";
      }).join("") + "</tbody></table></div><p class='note'>Click a student for the full record. Percentile is the share of classmates with a lower quiz average. Practice (recent) counts attempts in the last " + t.idle + " days.</p>";
    $("st").innerHTML = h;
  }
  function studentOpen(id) {
    cmApp.studentStats(Object.assign({ id: id }, th())).then(function (r) {
      if (!r || !r.ok) { $("stu-body").innerHTML = "<h2 id='stu-h'>Student " + esc(id) + "</h2><p class='msg'>" + esc(r && r.why ? "Not found: " + r.why + "." : "The record could not be read.") + "</p>"; if (!$("stu-d").open) $("stu-d").showModal(); return; }
      var s = r.student, h = "<h2 id='stu-h'>" + esc(s.name || s.id) + " <span class='note'>" + esc(s.id) + "</span></h2><p>" + chip(s.group) + " <span class='note'>Suggested, for your review: " + esc(s.why.join("; ")) + ".</span></p>";
      h += "<div class='kv4'><div><p class='lbl'>Attendance</p><p class='tbig'>" + num(s.attendance, "%") + "</p><p class='note'>" + s.present + " of " + s.sessions + " sessions; " + (s.missedInARow ? s.missedInARow + " missed in a row" : "present at the last session") + "</p></div>" +
        "<div><p class='lbl'>Quiz average</p><p class='tbig'>" + num(s.quizAverage, "%") + "</p><p class='note'>" + s.quizzesTaken + " taken; percentile " + num(s.percentile) + "</p></div>" +
        "<div><p class='lbl'>Practice</p><p class='tbig'>" + s.practiceAttempts + "</p><p class='note'>attempts, " + s.practiceMinutes + " min; last " + (s.lastPractice || "never") + "</p></div></div>";
      h += "<p class='lbl'>Sessions</p><div class='marks'>" + s.marks.map(function (m, i) { return "<span class='" + (m === 1 ? "m-in" : m === 0 ? "m-out" : "m-na") + "' title='" + esc(r.sessions[i] || "") + ": " + (m === 1 ? "present" : m === 0 ? "absent" : "not counted") + "'>" + (m === 1 ? "✓" : m === 0 ? "✕" : "·") + "</span>"; }).join("") + "</div>";
      if (s.trajectory.length) h += "<p class='lbl'>Quiz results</p>" + bars(s.trajectory.map(function (x) { return x.pct; }), s.trajectory.map(function (x) { return x.quiz; }), { max: 100, unit: "%", h: 120, short: shortDate, title: "Quiz results" });
      if (r.mastery.length) h += "<p class='lbl'>Proportion correct by lecture</p>" + bars(r.mastery.map(function (x) { return x.pct; }), r.mastery.map(function (x) { return x.lecture === 0 ? "Intro" : "Lecture " + x.lecture; }), { max: 100, unit: "%", h: 110, short: function (l) { return l.replace("Lecture ", "L"); }, title: "Proportion correct by lecture", extra: r.mastery.map(function (x) { return "(" + x.right + " of " + x.asked + ")"; }) });
      if (r.revisit.length) h += "<p class='lbl'>Questions to revisit</p><p class='note'>" + r.revisit.map(function (q) { return esc(q.id) + " (" + esc(q.from) + ")"; }).join(", ") + "</p>";
      if (window.cmProgress) h += cmProgress.profileHtml(r); // progress by objective, group work and suggestions (progress.js)
      $("stu-body").innerHTML = h; if (!$("stu-d").open) $("stu-d").showModal(); $("stu-d").scrollTop = 0;
    });
  }

  /* ---- Attendance ---- */
  function attendance() {
    var d = data, a = d.attendance, t = d.thresholds;
    if (!a.sessions) { $("at").innerHTML = "<div class='card empty'><h3>No session submitted yet</h3><p>Take attendance under Class Tools, then submit it. Rates, trends and arrival times appear here.</p></div>"; return; }
    var miss = d.students.filter(function (s) { return s.missedInARow >= t.misses; }).sort(function (x, y) { return y.missedInARow - x.missedInARow; });
    var h = "<div class='tiles4'>" + tile("Term rate", num(a.rate, "%"), plural(a.sessions, "session", "sessions")) + tile("Last session", num(a.lastRate, "%"), esc(a.bySession[a.bySession.length - 1].label)) +
      tile("Last three against earlier", a.earlierRate !== null ? signed(Math.round(10 * (a.recentRate - a.earlierRate)) / 10, " pts") : "–", a.earlierRate !== null ? a.recentRate + "% against " + a.earlierRate + "%" : "Needs four sessions or more") +
      tile("Median arrival", num(a.arrival.median, " min"), "after the check-in opened") + "</div>";
    h += "<div class='ov2'><section class='card'><h3>Rate by session</h3>" + bars(a.bySession.map(function (x) { return x.rate; }), a.bySession.map(function (x) { return x.label; }), { max: 100, unit: "%", h: 180, short: shortDate, title: "Attendance by session", extra: a.bySession.map(function (x) { return "(" + x.present + " of " + x.counted + ")"; }) }) + "</section>" +
      "<section class='card'><h3>Arrival after the check-in opened</h3><p class='note'>Students' own check-ins only. If you open the check-in at the start of the lecture, this shows lateness.</p>" +
      "<div class='g2'><div><p class='lbl'>All sessions</p>" + bars(a.arrival.bands.map(function (b) { return b.n; }), a.arrival.bands.map(function (b) { return b.label; }), { w: 320, h: 150, labels: 5, short: function (l) { return l.replace(" min", "").replace(" or more", "+").replace(" to ", "–").replace("Under ", "<"); }, title: "Arrival, all sessions" }) + "</div>" +
      "<div><p class='lbl'>Last session</p>" + bars(a.arrival.latest.map(function (b) { return b.n; }), a.arrival.latest.map(function (b) { return b.label; }), { w: 320, h: 150, labels: 5, short: function (l) { return l.replace(" min", "").replace(" or more", "+").replace(" to ", "–").replace("Under ", "<"); }, title: "Arrival, last session" }) + "</div></div></section></div>";
    h += "<section class='card'><div class='card-head'><h3>Missed " + t.misses + " or more sessions in a row</h3><span class='note'>Threshold under Students, Engagement rules</span></div>" +
      (miss.length ? "<div class='tbl ins-tbl short'><table><thead><tr><th>Student</th><th>Missed in a row</th><th>Longest run</th><th>Attendance</th><th>Suggested group</th></tr></thead><tbody>" + miss.map(function (s) { return "<tr tabindex='0' data-id='" + esc(s.id) + "'><td><b>" + esc(s.name || s.id) + "</b></td><td class='flag'>" + s.missedInARow + "</td><td>" + s.longestMissed + "</td><td>" + num(s.attendance, "%") + "</td><td>" + chip(s.group) + "</td></tr>"; }).join("") + "</tbody></table></div>" : "<p class='note'>No one at present.</p>") + "</section>";
    $("at").innerHTML = h;
  }

  /* ---- Quizzes and Questions ---- */
  var qsel = -1;
  function quizzes() {
    var d = data;
    if (!d.quizzes.length && !d.questions.length) { $("qz").innerHTML = "<div class='card empty'><h3>No quiz released yet</h3><p>Run a live quiz under Class Tools and release the results. Score distributions and question statistics appear here.</p></div>"; return; }
    if (qsel < 0 || qsel >= d.quizzes.length) qsel = d.quizzes.length - 1;
    var q = d.quizzes[qsel], h = "";
    if (q) {
      var st = q.stats;
      h += "<div class='row qpick' role='group' aria-label='Choose a quiz'>" + d.quizzes.map(function (x, i) { return "<button type='button' class='gf" + (i === qsel ? " on" : "") + "' data-q='" + i + "'>" + esc(x.quiz) + "</button>"; }).join("") + "</div>";
      h += "<div class='ov2'><section class='card'><div class='card-head'><h3>" + esc(q.quiz) + "</h3><span class='note'>" + esc(q.date) + "</span></div>" +
        "<dl class='stats'><div><dt>Mean</dt><dd>" + num(st.mean, "%") + "</dd></div><div><dt>Median</dt><dd>" + num(st.median, "%") + "</dd></div><div><dt>Standard deviation</dt><dd>" + num(st.sd) + "</dd></div>" +
        "<div><dt>Middle half</dt><dd>" + num(st.q1, "%") + " to " + num(st.q3, "%") + "</dd></div><div><dt>Range</dt><dd>" + num(st.min, "%") + " to " + num(st.max, "%") + "</dd></div><div><dt>Students</dt><dd>" + st.n + "</dd></div>" +
        "<div><dt>Finished, of those who joined</dt><dd>" + num(q.completion, "%") + "</dd></div><div><dt>Class who took part</dt><dd>" + num(q.participation, "%") + "</dd></div><div><dt>Items left blank</dt><dd>" + num(q.unanswered, "%") + "</dd></div></dl></section>" +
        "<section class='card'><h3>Score distribution</h3>" + bars(st.hist, ["0–9%", "10–19%", "20–29%", "30–39%", "40–49%", "50–59%", "60–69%", "70–79%", "80–89%", "90–100%"], { h: 180, title: "Score distribution", short: function (l) { return l.split("–")[0]; }, extra: st.hist.map(function () { return "students"; }) }) + "<p class='note'>Students in each band of 10 percentage points.</p></section></div>";
    }
    h += "<section class='card'><div class='card-head'><h3>Questions</h3><span class='note'>Live quizzes, practice and the mock exam. The correct option is outlined.</span></div><div class='tbl ins-tbl'><table><thead><tr><th>Question</th><th>Answers</th><th>% correct</th><th>Difficulty</th><th>Options chosen in live quizzes</th><th>Shared wrong answer</th><th>Discrimination</th><th>Confident and wrong</th><th>Blank</th></tr></thead><tbody>" +
      d.questions.slice().sort(function (a, b) { return (a.pct === null ? 101 : a.pct) - (b.pct === null ? 101 : b.pct); }).map(function (x) {
        var tot = ["A", "B", "C", "D", "E"].reduce(function (a, L) { return a + x.dist[L]; }, 0) || 1;
        var dist = "<div class='opts'>" + ["A", "B", "C", "D", "E"].map(function (L) { var n = x.dist[L]; return "<span class='opt" + (L === x.key ? " key" : "") + (x.misconception && L === x.misconception.option ? " mis" : "") + "' title='" + L + ": " + n + (L === x.key ? " (correct)" : "") + "'><i style='height:" + Math.round(100 * n / tot) + "%'></i><b>" + L + "</b></span>"; }).join("") + "</div>";
        return "<tr><td><b>" + esc(x.id) + "</b></td><td>" + x.answers + "</td><td>" + num(x.pct, "%") + "</td><td>" + esc(x.label || "–") + "</td><td>" + dist + "</td><td>" + (x.misconception ? esc(x.misconception.option) + " (" + x.misconception.share + "%)" + (x.misconception.persists ? " <span class='note'>persists</span>" : "") : "–") + "</td><td" + (x.discrimination !== null && x.discrimination < 0.2 ? " class='flag'" : "") + ">" + num(x.discrimination) + "</td><td>" + x.confidentWrong + "</td><td>" + x.blank + "</td></tr>";
      }).join("") + "</tbody></table></div><p class='note'>Difficulty needs 10 answers. Discrimination compares the top and bottom 27% of the class on the rest of the quiz; below 0.2 the question may need its wording or key checked.</p></section>";
    $("qz").innerHTML = h;
  }

  /* ---- events ---- */
  document.addEventListener("click", function (e) {
    var t = e.target.closest ? e.target : null; if (!t) return;
    var g = t.closest("[data-group]"); if (g && data) { filt = g.getAttribute("data-group"); if (window.cmGo) cmGo("students"); else students(); if (cur === "students") students(); return; }
    var q = t.closest("[data-q]"); if (q) { qsel = +q.getAttribute("data-q"); quizzes(); return; }
    var th0 = t.closest("#st th[data-k]"); if (th0) { var k = th0.getAttribute("data-k"); sortD = k === sortK ? -sortD : 1; sortK = k; students(); return; }
    var tr = t.closest("tr[data-id]"); if (tr) studentOpen(tr.getAttribute("data-id"));
  });
  document.addEventListener("keydown", function (e) {
    if (e.key !== "Enter" && e.key !== " ") return;
    var tr = e.target.closest && e.target.closest("tr[data-id]"); if (tr) { e.preventDefault(); studentOpen(tr.getAttribute("data-id")); return; }
    var th0 = e.target.closest && e.target.closest("#st th[data-k]"); if (th0) { e.preventDefault(); th0.click(); }
  });
  $("th-apply").addEventListener("click", function () {
    var t = {}; ["effort", "perf", "idle", "misses"].forEach(function (k) { var v = $("th-" + k).value; if (v !== "") t[k] = Number(v); });
    store("cm-th", JSON.stringify(t)); load(true).then(function () { if (data) render(cur); });
  });
  $("th-reset").addEventListener("click", function () { store("cm-th", "{}"); load(true).then(function () { if (data) render(cur); }); });
  $("st-csv").addEventListener("click", function () {
    if (!data) return;
    var cell = function (v) { v = String(v == null ? "" : v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
    var lines = [["Student ID", "Name", "Suggested group", "Reasons", "Attendance %", "Missed in a row", "Arrival median min", "Quizzes taken", "Quiz average %", "Last change", "Percentile", "Practice attempts", "Practice recent", "Practice minutes"].join(",")]
      .concat(data.students.map(function (s) { return [s.id, s.name, s.group, s.why.join("; "), s.attendance, s.missedInARow, s.arrivalMedian, s.quizzesTaken, s.quizAverage, s.change, s.percentile, s.practiceAttempts, s.practiceRecent, s.practiceMinutes].map(cell).join(","); }));
    var a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/csv" })); a.download = "class-students.csv"; document.body.appendChild(a); a.click(); a.remove();
  });
  // Fresh figures every minute while an Insight screen is open.
  setInterval(function () { if (document.visibilityState === "visible" && ["overview", "students", "attendance", "quizzes"].indexOf(cur) >= 0) load(true).then(function () { if (data && !document.querySelector("dialog[open]")) render(cur); }); }, 60000);
  window.cmInsights = { show: show, reload: function () { return load(true).then(function () { if (data) render(cur); }); }, open: studentOpen,
    students: function () { return load().then(function () { return data ? data.students.map(function (s) { return { id: s.id, name: s.name }; }) : []; }); } };
})();
