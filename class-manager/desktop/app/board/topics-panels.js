/* Class Analytics board, topic part: the page parts. Each function turns topics-model.js results into an HTML string. No calculation here.
   Colours: green, gold and red appear only as the mastery bands (they carry meaning); everything else is the board's orange and ink. */
(function (root) {
  "use strict";
  var U = root.cmBoardUtil || require("./util"), TM = root.cmBoardTopicsModel || require("./topics-model"), C = U.COLOR, has = U.has;
  var BAND_COLOR = { well: C.good, developing: C.gold, attention: C.bad, early: "#B8BFCC" };
  function head(title, note) { return "<div class='bd-head'><h3>" + U.esc(title) + "</h3>" + (note ? "<span>" + U.esc(note) + "</span>" : "") + "</div>"; }
  function empty(text) { return "<p class='bd-empty'>" + U.esc(text) + "</p>"; }

  function bandKey() { return "<p class='bd-key'>" + ["well", "developing", "attention", "early"].map(function (b) { return "<span><i style='background:" + BAND_COLOR[b] + "'></i>" + U.esc(TM.BAND_NAME[b]) + "</span>"; }).join("") + "</p>"; }

  // One bar per topic, longest need first (lowest % at the top); each row says how many answers and students it rests on.
  function masteryPanel(d) {
    var m = TM.mastery(d);
    if (!m.topics.length) return head("Topic mastery", "") + empty("Topics appear once released quiz or practice answers are linked to lectures. Run a live quiz and release it, or have students practise with their ID.");
    var rows = m.topics.slice().sort(function (a, b) { return (has(a.pct) ? a.pct : 101) - (has(b.pct) ? b.pct : 101); });
    return head("Topic mastery", U.plural(m.answers, "answer", "answers") + " across the semester") +
      "<ul class='bd-tbars'>" + rows.map(function (t) {
        var w = has(t.pct) ? Math.max(2, t.pct) : 0, sb = t.studentBands;
        return "<li><span class='bd-tl' title='" + U.esc(t.title ? t.label + ": " + t.title : t.label) + "'>" + U.esc(U.short(t.label + (t.title ? ": " + t.title : ""), 30)) + "</span>" +
          "<span class='bd-tb' role='img' aria-label='" + U.esc(t.label + " " + (has(t.pct) ? t.pct + " percent correct" : "no figure") + ", " + TM.BAND_NAME[t.band]) + "'><i style='width:" + w + "%;background:" + BAND_COLOR[t.band] + "'></i></span>" +
          "<span class='bd-tp'>" + (has(t.pct) ? t.pct + "%" : "–") + "</span>" +
          "<span class='bd-tn'>" + U.plural(t.students, "student", "students") + ", " + t.answers + " answers" + (t.small ? " <b class='bd-small'>few answers</b>" : "") + (sb ? "; " + sb.well + " well, " + sb.developing + " developing, " + sb.attention + " need attention" : "") + "</span></li>";
      }).join("") + "</ul>" + bandKey() +
      "<p class='bd-foot'>Well mastered is 70% or more, needs attention is under 50%. A topic needs " + (d.topics.cutoffs ? d.topics.cutoffs.minTopicAnswers : 10) + " answers before a band is shown." + (m.unmapped ? " " + U.plural(m.unmapped, "answer is", "answers are") + " for questions with no lecture and not counted." : "") + "</p>";
  }

  function heat(v) { return has(v) ? v >= 70 ? "bd-h3" : v >= 50 ? "bd-h2" : "bd-h1" : "bd-h0"; }
  // Topic by quiz grid: the % correct of each topic in each live quiz that has question-level records.
  function overTimePanel(d) {
    var g = TM.overTime(d), tr = TM.trend(d);
    if (!g.rows.length) return head("Mastery by topic over time", "") + empty("This needs question-level records from at least one live quiz run in CM. Quizzes imported as totals have no per-question data.");
    return head("Mastery by topic over time", "% correct in each quiz") +
      "<div class='bd-scroll'><table class='bd-heat'><thead><tr><th>Topic</th>" + g.quizzes.map(function (q) { return "<th>" + U.esc(U.short(q, 12)) + "</th>"; }).join("") + "</tr></thead><tbody>" +
      g.rows.map(function (r) { return "<tr><th scope='row'>" + U.esc(U.short(r.label, 16)) + "</th>" + r.values.map(function (v, i) { return "<td class='" + heat(v) + "' title='" + U.esc(r.label + ", " + g.quizzes[i] + ": " + (has(v) ? v + "% from " + r.answers[i] + " answers" : "not asked, or under 5 answers")) + "'>" + (has(v) ? Math.round(v) : "·") + "</td>"; }).join("") + "</tr>"; }).join("") + "</tbody></table></div>" +
      "<p class='bd-foot'>" + (tr.change !== null ? "Class quiz average " + (tr.change >= 0 ? "+" : "−") + Math.abs(tr.change) + " points from " + U.esc(U.short(tr.first.quiz, 16)) + " to " + U.esc(U.short(tr.last.quiz, 16)) + ". " : "") + "A dot means the topic was not asked in that quiz, or had under 5 answers. Each quiz covers different lectures, so a change can also be a change in difficulty.</p>";
  }

  function scatter(c) {
    var W = 260, H = 150, L = 30, B = 22, T = 8, R = 8, pts = c.points || [];
    if (!pts.length) return "";
    var xs = pts.map(function (p) { return p[0]; }), ys = pts.map(function (p) { return p[1]; }), x0 = Math.min.apply(null, xs), x1 = Math.max.apply(null, xs), y0 = Math.min.apply(null, ys), y1 = Math.max.apply(null, ys);
    var sx = function (v) { return L + (W - L - R) * (x1 === x0 ? 0.5 : (v - x0) / (x1 - x0)); }, sy = function (v) { return H - B - (H - B - T) * (y1 === y0 ? 0.5 : (v - y0) / (y1 - y0)); };
    return "<svg class='bd-scat' viewBox='0 0 " + W + " " + H + "' role='img' aria-label='" + U.esc(c.label + ": " + c.text) + "'><line x1='" + L + "' x2='" + (W - R) + "' y1='" + (H - B) + "' y2='" + (H - B) + "' stroke='" + C.grid + "'/><line x1='" + L + "' x2='" + L + "' y1='" + T + "' y2='" + (H - B) + "' stroke='" + C.grid + "'/>" +
      pts.map(function (p) { return "<circle cx='" + sx(p[0]).toFixed(1) + "' cy='" + sy(p[1]).toFixed(1) + "' r='3' fill='" + C.orange + "' fill-opacity='.45'/>"; }).join("") +
      "<text class='bd-ax' x='" + L + "' y='" + (H - 6) + "'>" + U.r1(x0) + "</text><text class='bd-ax' x='" + (W - R) + "' y='" + (H - 6) + "' text-anchor='end'>" + U.r1(x1) + "</text><text class='bd-ax' x='" + (L - 4) + "' y='" + (T + 8) + "' text-anchor='end'>" + U.r1(y1) + "</text><text class='bd-ax' x='" + (L - 4) + "' y='" + (H - B) + "' text-anchor='end'>" + U.r1(y0) + "</text></svg>";
  }
  function corrCard(c) { return "<div class='bd-corr'><h4>" + U.esc(c.label) + "</h4>" + scatter(c) + "<p class='bd-ct'>" + U.esc(c.text) + "</p>" + (c.caution ? "<p class='bd-small'>" + U.esc(c.caution) + "</p>" : "") + "</div>"; }
  function correlationPanel(d) {
    var co = TM.correlations(d);
    if (d.analytics && !co.main.length && !co.topicPairs.length) return "";
    return head("What goes with what", "Association, not proof of cause") + "<div class='bd-corrs'>" + co.main.map(corrCard).join("") + "</div>" +
      (co.topicPairs.length ? "<h4 class='bd-sub'>Topics that go together</h4><ul class='bd-pairs'>" + co.topicPairs.map(function (c) { return "<li><b>" + U.esc(c.label) + "</b> <span>" + U.esc(c.text) + "</span>" + (c.caution ? " <span class='bd-small'>" + U.esc(c.caution) + "</span>" : "") + "</li>"; }).join("") + "</ul><p class='bd-foot'>The three strongest of " + co.topicPairsTotal + " topic pairs with at least " + TM.MIN_PAIRS + " students having both.</p>" : "<p class='bd-foot'>Topic pairs appear once at least " + TM.MIN_PAIRS + " students have answered both topics.</p>");
  }

  // The panels, in one block placed under the board's first grid. Each carries an id so it can be redrawn alone.
  function html(d) {
    return "<div class='bd-grid bd-topics'><section class='bd-card bd-w3' id='bd-tmast' aria-label='Topic mastery'>" + masteryPanel(d) + "</section>" +
      "<section class='bd-card' id='bd-tover' aria-label='Mastery by topic over time'>" + overTimePanel(d) + "</section>" +
      "<section class='bd-card bd-w4' id='bd-tcorr' aria-label='What goes with what'>" + correlationPanel(d) + "</section></div>";
  }
  var api = { html: html, masteryPanel: masteryPanel, overTimePanel: overTimePanel, correlationPanel: correlationPanel, BAND_COLOR: BAND_COLOR };
  if (typeof module === "object" && module.exports) module.exports = api; else root.cmBoardTopics = api;
})(typeof window !== "undefined" ? window : globalThis);
