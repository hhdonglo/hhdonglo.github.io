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
  function nav(present) {
    return "<nav class='bd-nav' aria-label='Class Analytics sections'>" + present.map(function (s) { return "<a href='#sec-" + s[0] + "'>" + U.esc(s[1]) + "</a>"; }).join("") + "</nav>";
  }
  // parts: { overview: [html, ...], attendance: [...], ... } in ORDER's keys.
  function compose(parts) {
    var present = ORDER.filter(function (s) { return parts[s[0]] && parts[s[0]].join("").replace(/\s/g, "") !== ""; });
    return nav(present) + present.map(function (s) {
      return "<section class='bd-sec' id='sec-" + s[0] + "' aria-labelledby='sh-" + s[0] + "'><div class='bd-sh'><h2 id='sh-" + s[0] + "'>" + U.esc(s[1]) + "</h2><p>" + U.esc(s[2]) + "</p></div>" + parts[s[0]].join("") + "</section>";
    }).join("");
  }
  var api = { ORDER: ORDER, compose: compose };
  if (typeof module === "object" && module.exports) module.exports = api; else root.cmBoardSections = api;
})(typeof window !== "undefined" ? window : globalThis);
