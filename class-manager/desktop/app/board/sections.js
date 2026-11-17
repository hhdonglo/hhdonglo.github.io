/* Class Analytics board: the page's sections. Takes pieces of HTML already drawn elsewhere and places them under clear headings, once each,
   with a row of links to jump between sections. A section with no pieces is left out. Pure: strings in, string out. */
(function (root) {
  "use strict";
  var U = root.cmBoardUtil || require("./util");
  var ORDER = [
    ["overview", "Overview", "The class at a glance: key numbers, the lecture plan, progress over time and what the numbers say."],
    ["attendance", "Attendance", "Who is absent in a row, and which sessions were counted."],
    ["quizzes", "Quizzes", "How quiz results are spread, who took each quiz, how scores changed and how practice goes with results."],
    ["risk", "Risk and attention", "Who is at risk and why, and where attendance and quiz results are both low. Flags are suggestions for your review."],
    ["questions", "Questions", "Which questions are hard, which separate stronger from weaker students, and how each topic is going."],
    ["relations", "Relationships and trends", "What goes with what, and how the numbers move over the last sessions and quizzes."],
    ["actions", "Actions", "Where to put teaching time, support given and results by group."],
    ["privacy", "Privacy and records", "Term, student data and the audit log."]
  ];
  var FOOT = "privacy"; // not a tab: term, student data and the audit log stay at the bottom of every view
  // The tab bar. Each tab is one dashboard grid; only the chosen one is shown (interact.js switches them without redrawing).
  function nav(present, active) {
    return "<div class='bd-tabbar' role='tablist' aria-label='Class Analytics sections'>" + present.map(function (s) {
      return "<button type='button' role='tab' id='bt-" + s[0] + "' data-bd-pane='" + s[0] + "' aria-controls='sec-" + s[0] + "' aria-selected='" + (s[0] === active) + "'>" + U.esc(s[1]) + "</button>";
    }).join("") + "</div>";
  }
  function filled(parts, k) { return !!parts[k] && parts[k].join("").replace(/\s/g, "") !== ""; }
  // parts: { overview: [html, ...], attendance: [...], ... } in ORDER's keys. `active` is the chosen tab (the first when missing).
  // `between` is HTML placed under the tab bar and above the grids (the list of students behind a clicked number).
  function compose(parts, active, between) {
    var present = ORDER.filter(function (s) { return s[0] !== FOOT && filled(parts, s[0]); });
    if (!present.some(function (s) { return s[0] === active; })) active = present.length ? present[0][0] : "";
    var panes = present.map(function (s) {
      return "<section class='bd-sec bd-pane' id='sec-" + s[0] + "' role='tabpanel' aria-labelledby='bt-" + s[0] + "'" + (s[0] === active ? "" : " hidden") + "><div class='bd-sh'><h2>" + U.esc(s[1]) + "</h2><p>" + U.esc(s[2]) + "</p></div>" + parts[s[0]].join("") + "</section>";
    }).join("");
    var foot = filled(parts, FOOT) ? "<section class='bd-sec bd-foot-sec' id='sec-privacy' aria-labelledby='sh-privacy'><div class='bd-sh'><h2 id='sh-privacy'>Privacy and records</h2><p>" + U.esc(ORDER[ORDER.length - 1][2]) + "</p></div>" + parts[FOOT].join("") + "</section>" : "";
    return nav(present, active) + (between || "") + panes + foot;
  }
  var api = { ORDER: ORDER, compose: compose };
  if (typeof module === "object" && module.exports) module.exports = api; else root.cmBoardSections = api;
})(typeof window !== "undefined" ? window : globalThis);
