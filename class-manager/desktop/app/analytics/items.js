/* Class Manager analytics: item analysis. Which questions to review, from the question statistics (questionStats_ in the server script).
   A question needs MIN answers before it is judged. Plain data in, plain data out. Runs in the CM window (window.cmItems) and in Node. */
(function (root) {
  "use strict";
  var MIN = 10;
  var E = root.cmEvidence || (typeof require === "function" ? require("./evidence") : null);
  function judge(q) {
    var n = q.answers || 0, out = { id: q.id, lecture: q.lecture, answers: n, pct: q.pct, discrimination: q.discrimination, flags: [], group: "fine" };
    if (n < MIN) { out.group = "small"; out.flags.push("Fewer than " + MIN + " answers, too early to judge"); return out; }
    var keyN = q.dist && q.key ? q.dist[q.key] || 0 : null;
    if (q.key && q.wrongTopN > keyN && q.live >= MIN) { out.flags.push("More students chose " + q.wrongTop + " than the keyed answer " + q.key + ": check the key and the wording"); out.group = "review"; }
    if (q.discrimination !== null && q.discrimination !== undefined && q.discrimination < 0) { out.flags.push("Stronger students did worse on it than weaker ones: check the key"); out.group = "review"; }
    else if (q.discrimination !== null && q.discrimination !== undefined && q.discrimination < 0.1) { out.flags.push("It does not separate stronger from weaker students"); if (out.group === "fine") out.group = "review"; }
    if (q.pct !== null && q.pct <= 20) { out.flags.push("Only " + q.pct + "% answered correctly: very hard, or unclear"); if (out.group === "fine") out.group = "hard"; }
    if (q.pct !== null && q.pct >= 90) { out.flags.push(q.pct + "% answered correctly: very easy"); if (out.group === "fine") out.group = "easy"; }
    if (q.confidentWrong >= 3 && q.confAnswered && q.confidentWrong / q.confAnswered >= 0.2) { out.flags.push("Many students were sure and wrong: a likely misconception"); if (out.group === "fine") out.group = "review"; }
    out.confidence = E ? E.confidence(n) : null;
    return out;
  }
  // -> { items, groups: {review, hard, easy, fine, small: [ids]}, points: [{id, x: % correct, y: discrimination}] }
  function analyse(questions) {
    var items = (questions || []).map(judge), groups = { review: [], hard: [], easy: [], fine: [], small: [] };
    items.forEach(function (i) { groups[i.group].push({ id: i.id, flags: i.flags }); });
    return { items: items, groups: groups, points: items.filter(function (i) { return i.pct !== null && i.discrimination !== null && i.discrimination !== undefined; }).map(function (i) { return { id: i.id, x: i.pct, y: i.discrimination, group: i.group }; }) };
  }
  var api = { MIN: MIN, judge: judge, analyse: analyse };
  if (typeof module === "object" && module.exports) module.exports = api; else root.cmItems = api;
})(typeof window !== "undefined" ? window : globalThis);
