/* Readable names for assessments and columns. Pure text function, no page, no server.
   Loaded files bring raw headings: a quiz code ("Quiz 26271"), a sheet name in capitals ("Quiz QUIZZES TAKEN") or a bare label ("Practice Intro").
   readable() only changes how a heading is SHOWN; the stored heading is never changed, so imports and exports still match on the raw text. */
(function (root) {
  "use strict";
  var KINDS = ["Quiz", "Practice", "Laboratory", "Lab", "Assignment", "Group assessment", "Group", "Test", "Exam", "Mock exam", "Attendance"];
  function sentence(s) { // CAPITALS or odd case to sentence case; short all-capital words (PHYS, ID) stay as they are
    var words = String(s).trim().split(/\s+/);
    var allCaps = words.length > 1 && words.every(function (w) { return !/[a-z]/.test(w); });
    if (!allCaps) return words.join(" ");
    return words.map(function (w, i) { return i === 0 ? w.charAt(0) + w.slice(1).toLowerCase() : w.toLowerCase(); }).join(" ");
  }
  function readable(heading) {
    var h = String(heading == null ? "" : heading).replace(/\s+/g, " ").trim(); if (!h) return "";
    var suffix = ""; var m = h.match(/^(.*?)\s*\((quiz|practice|attendance|session)\)$/i); if (m) { h = m[1]; suffix = " (" + m[2].toLowerCase() + ")"; }
    var kind = null; KINDS.forEach(function (k) { if (!kind && h.toLowerCase().indexOf(k.toLowerCase() + " ") === 0) kind = k; });
    if (!kind) return sentence(h) + suffix;
    var rest = h.slice(kind.length).trim();
    if (!rest) return kind + suffix;
    if (/^\d{4,}$/.test(rest)) return kind + " (code " + rest + ")" + suffix;      // a quiz code, not a number
    if (/^\d/.test(rest) || /^(week|session|lecture|day|class)\b/i.test(rest)) return h + suffix; // already readable: Lab 2 - Week 5, Lab week                                            // Lab 2 - Week 5: already readable
    if (/^(week\s*)?\d{1,3}$/i.test(rest)) return kind + " " + rest.replace(/^week\s*/i, "") + suffix; // Quiz 3
    return kind + ": " + sentence(rest) + suffix;                                      // Practice: Intro, Quiz: Quizzes taken
  }
  var api = { readable: readable };
  if (typeof module === "object" && module.exports) module.exports = api; else root.cmHeadings = api;
})(typeof window !== "undefined" ? window : globalThis);
