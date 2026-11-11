/* Class Manager dashboard: the rules. Plain data in, plain data out. No page, no server, no AI.
   Input is the class statistics the Insight screens already use (classStats_ in the server script) and the setup steps.
   The same file runs in CM window (window.cmDash) and in Node (the tests). Small samples are always amber with the reason. */
(function (root) {
  "use strict";
  var MIN_STUDENTS = 10; // fewer answers than this is a small sample
  var LIGHTS = { good: "lt-good", watch: "lt-watch", bad: "lt-bad", none: "lt-none" };

  // Traffic light for a percentage. good >= hi, bad < lo, otherwise watch; no value is grey.
  function light(v, lo, hi) { if (v === null || v === undefined) return LIGHTS.none; return v >= hi ? LIGHTS.good : v < lo ? LIGHTS.bad : LIGHTS.watch; }
  function lastN(xs, n) { return xs.slice(Math.max(0, xs.length - n)); }
  function plural(n, one, many) { return n + " " + (n === 1 ? one : many); }

  // The three setup steps, as a count and a percentage for the progress bar.
  function setupProgress(st) {
    var steps = [["course", "Course details", "course"], ["classList", "Class list", "class"], ["materials", "Course materials", "materials"]];
    if (!st || !st.steps) return { done: 3, of: 3, pct: 100, complete: true, steps: [] }; // setup not known yet: show nothing rather than a false reminder
    var done = steps.filter(function (s) { return st && st.steps && st.steps[s[0]]; }).length;
    return { done: done, of: steps.length, pct: Math.round(100 * done / steps.length), complete: done === steps.length,
      steps: steps.map(function (s) { return { key: s[0], label: s[1], setup: s[2], done: !!(st && st.steps && st.steps[s[0]]) }; }) };
  }

  // The four cards at the top: Students, Attendance, Learning, At risk. Each has a value, a sentence and a light.
  function statCards(d) {
    var a = d.attendance || {}, L = d.learning || {}, groups = d.groups || {}, students = d.students || [];
    var atRisk = students.filter(function (s) { return s.group === "Disengaged" || s.group === "Needs a check-in" || s.missedInARow >= (d.thresholds ? d.thresholds.misses : 2); }).length;
    var learnLight = L.verdict === "Learning" ? LIGHTS.good : L.verdict === "Mixed" ? LIGHTS.watch : L.verdict === "Not yet learning" ? LIGHTS.bad : LIGHTS.none;
    var small = d.rosterSize > 0 && d.rosterSize < MIN_STUDENTS;
    var riskShare = d.rosterSize ? 100 * atRisk / d.rosterSize : null;
    return [
      { key: "students", label: "Students", value: String(d.rosterSize || 0), text: d.rosterSize ? "on the class list" : "none on the class list yet", light: d.rosterSize ? LIGHTS.good : LIGHTS.bad },
      { key: "attendance", label: "Attendance", value: a.rate === null || a.rate === undefined ? "–" : a.rate + "%", text: a.sessions ? plural(a.sessions, "session", "sessions") + " submitted" : "no session submitted yet",
        light: small ? LIGHTS.watch : light(a.rate, 60, 80), reason: small ? "Small class: fewer than " + MIN_STUDENTS + " students." : "" },
      { key: "learning", label: "Learning", value: L.verdict || "Not enough data", text: L.confidence ? "confidence: " + L.confidence : "needs two released quizzes", light: learnLight },
      { key: "risk", label: "At risk", value: String(atRisk), text: atRisk ? "students to check in with" : "no one flagged", light: riskShare === null ? LIGHTS.none : riskShare >= 25 ? LIGHTS.bad : riskShare > 0 ? LIGHTS.watch : LIGHTS.good }
    ];
  }

  // Who needs attention first, with the reason. Highest priority first, at most `max` entries.
  function priorityQueue(d, max) {
    var th = d.thresholds || { misses: 2 }, out = [];
    (d.students || []).forEach(function (s) {
      var score = 0, why = [];
      if (s.missedInARow >= th.misses) { score += 40 + 5 * s.missedInARow; why.push("missed " + s.missedInARow + " sessions in a row"); }
      if (s.group === "Working hard but struggling") { score += 35; why.push("working hard but struggling"); }
      if (s.group === "Disengaged") { score += 30; why.push("disengaged"); }
      if (s.group === "Needs a check-in") { score += 25; why.push("needs a check-in"); }
      if (s.change !== null && s.change !== undefined && s.change <= -15) { score += 20; why.push("last quiz fell by " + Math.abs(s.change) + " points"); }
      if (score) out.push({ id: s.id, name: s.name || s.id, score: score, why: why });
    });
    out.sort(function (x, y) { return y.score - x.score || String(x.name).localeCompare(String(y.name)); });
    return out.slice(0, max || 5);
  }

  // "What do I need to do today?": up to four actions in a fixed order, each with the screen it opens.
  function todayCard(d, setup, live) {
    var acts = [], sp = setupProgress(setup), a = d.attendance || {}, L = d.learning || {};
    if (!sp.complete) { var next = sp.steps.filter(function (s) { return !s.done; })[0]; acts.push({ text: "Finish setting up: " + next.label.toLowerCase(), go: "setup:" + next.setup, label: "Open" }); }
    if (live && live.attendance && live.attendance.status === "Closed") acts.push({ text: "Submit the attendance you closed", go: "view:class", label: "Review" });
    else if (live && live.attendance && live.attendance.status === "Open") acts.push({ text: "Attendance is open: " + live.attendance.present + " checked in", go: "view:class", label: "Open" });
    var q = priorityQueue(d, 3);
    if (q.length) acts.push({ text: plural(q.length, "student needs", "students need") + " a check-in, starting with " + q[0].name, go: "view:students", label: "See students" });
    if (L.action && L.verdict && L.verdict !== "Not enough data") acts.push({ text: L.action, go: "view:progress", label: "See progress" });
    if (!acts.length && d.rosterSize) acts.push({ text: a.sessions ? "Nothing urgent. Take attendance at the next class." : "Take attendance at your next class to start the record.", go: "view:class", label: "Class Tools" });
    return acts.slice(0, 4);
  }

  // Short trends. A trend needs three points; with fewer it says so instead of drawing a line.
  function trends(d) {
    var a = d.attendance || {}, qz = d.quizzes || [];
    var series = [
      { key: "attendance", label: "Attendance", unit: "%", vals: (a.bySession || []).map(function (x) { return x.rate; }) },
      { key: "quiz", label: "Quiz mean", unit: "%", vals: qz.map(function (q) { return q.stats ? q.stats.mean : null; }) },
      { key: "engagement", label: "Quiz participation", unit: "%", vals: qz.map(function (q) { return q.participation; }) },
      { key: "gain", label: "Learning gain", unit: " points", vals: qz.map(function (q, i) { var f = qz[0] && qz[0].stats ? qz[0].stats.mean : null; return q.stats && f !== null && i > 0 ? Math.round(10 * (q.stats.mean - f)) / 10 : null; }) }
    ];
    return series.map(function (s) {
      var v = lastN(s.vals.filter(function (x) { return x !== null && x !== undefined; }), 8), last = v.length ? v[v.length - 1] : null, first = v.length ? v[0] : null;
      return { key: s.key, label: s.label, unit: s.unit, vals: v, enough: v.length >= 3, last: last, change: v.length >= 3 ? Math.round(10 * (last - first)) / 10 : null };
    });
  }

  // One card for the class: the worst of the lights, with the sentence that explains it.
  function health(d) {
    var cards = statCards(d), reasons = [], worst = LIGHTS.good;
    cards.forEach(function (c) {
      if (c.light === LIGHTS.bad) { worst = LIGHTS.bad; reasons.push(c.label + ": " + c.value + ", " + c.text); }
      else if (c.light === LIGHTS.watch) { if (worst !== LIGHTS.bad) worst = LIGHTS.watch; reasons.push(c.label + ": " + c.value + (c.reason ? ". " + c.reason : ", " + c.text)); }
    });
    var none = cards.every(function (c) { return c.light === LIGHTS.none; });
    return { light: none ? LIGHTS.none : worst, word: none ? "Not enough data" : worst === LIGHTS.good ? "Healthy" : worst === LIGHTS.watch ? "Keep an eye" : "Needs attention", reasons: reasons };
  }

  // Rules-based insights in plain sentences. Never says more than the numbers show.
  function insights(d) {
    var a = d.attendance || {}, out = [], small = d.rosterSize > 0 && d.rosterSize < MIN_STUDENTS;
    if (a.earlierRate !== null && a.earlierRate !== undefined && a.recentRate !== null && a.sessions >= 4) {
      var diff = Math.round(10 * (a.recentRate - a.earlierRate)) / 10;
      if (diff <= -10) out.push("Attendance fell by " + Math.abs(diff) + " points in the last three sessions.");
      else if (diff >= 10) out.push("Attendance rose by " + diff + " points in the last three sessions.");
    }
    (d.targets || []).slice(0, 2).forEach(function (t) { out.push(t.title + (t.small ? " (small sample)" : "") + ": " + t.evidence); });
    var q = priorityQueue(d, 50).length;
    if (q) out.push(plural(q, "student shows", "students show") + " signs worth a conversation.");
    if (small) out.push("The class has fewer than " + MIN_STUDENTS + " students, so percentages move a lot with one student.");
    return out.slice(0, 5);
  }

  var api = { MIN_STUDENTS: MIN_STUDENTS, LIGHTS: LIGHTS, light: light, setupProgress: setupProgress, statCards: statCards, priorityQueue: priorityQueue, todayCard: todayCard, trends: trends, health: health, insights: insights };
  if (typeof module === "object" && module.exports) module.exports = api; else root.cmDash = Object.assign(root.cmDash || {}, api);
})(typeof window !== "undefined" ? window : globalThis);
