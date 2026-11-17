/* Class Analytics board: one small line icon per card or finding. Decorative (the words say the same). */
(function (root) {
  "use strict";
  var P = {
    students: "<circle cx='9' cy='8' r='3'/><path d='M3 19c0-3.3 2.7-6 6-6s6 2.7 6 6'/><circle cx='17' cy='9' r='2.2'/><path d='M16 14c2.8 0 5 2 5 5'/>",
    attendance: "<rect x='4' y='5' width='16' height='15' rx='2.5'/><path d='M4 10h16M8 3v4M16 3v4M9 15l2 2 4-4'/>",
    quiz: "<path d='M4 17l5-5 4 3 7-8'/><path d='M15 7h5v5'/>",
    practice: "<path d='M13 3L5 14h6l-1 7 8-11h-6z'/>",
    risk: "<path d='M12 4l9 16H3z'/><path d='M12 10v4M12 17.5v.5'/>",
    bars: "<path d='M5 20V11M12 20V5M19 20v-7'/>", trend: "<path d='M4 17l5-5 4 3 7-8'/>", pie: "<circle cx='12' cy='12' r='8'/><path d='M12 4v8h8'/>",
    spark: "<path d='M12 3l2 6 6 2-6 2-2 6-2-6-6-2 6-2z'/>", alert: "<path d='M12 4l9 16H3z'/><path d='M12 10v4'/>", bolt: "<path d='M13 3L5 14h6l-1 7 8-11h-6z'/>"
  };
  function icon(name, cls) { return "<svg class='" + (cls || "bd-ico") + "' viewBox='0 0 24 24' aria-hidden='true'>" + (P[name] || "") + "</svg>"; }
  var api = { icon: icon };
  if (typeof module === "object" && module.exports) module.exports = api; else root.cmBoardIcons = api;
})(typeof window !== "undefined" ? window : globalThis);
