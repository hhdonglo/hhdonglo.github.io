/* Reading a student ID from a cell of a class list file. One responsibility: say what an ID cell is, and never guess.
   "22583439", " 22583439 ", 22583439.0 (what Excel adds) and "022583439" are the same ID (ok).
   "2.2583439E7" (Excel's scientific form), "22583439.5", "2258 3439 and 2258 3440", a number with letters, or one with fewer than 4 or more than 12 digits
   cannot be read with certainty (ambiguous): CM lists them for the lecturer to correct and never saves a guess.
   An empty cell is not an ID at all (blank). Works in the page (window.cmIdReview) and in Node (require). Pure. */
(function (root) {
  "use strict";
  function read(raw) {
    var s = String(raw == null ? "" : raw).trim();
    if (s === "") return { status: "blank", id: "" };
    var plain = s.replace(/\.0+$/, "");
    if (/^\d{4,12}$/.test(plain)) return { status: "ok", id: plain.replace(/^0+(?=\d)/, "") };
    if (/^\d+(\.\d+)?e[+-]?\d+$/i.test(s)) return { status: "ambiguous", id: "", why: "written in scientific form (Excel has shortened the number); retype the ID" };
    if (/^\d+\.\d*[1-9]\d*$/.test(s)) return { status: "ambiguous", id: "", why: "has a decimal part" };
    if (/^\d+$/.test(plain)) return { status: "ambiguous", id: "", why: (plain.length < 4 ? "has fewer" : "has more") + " than the 4 to 12 digits an ID needs" };
    if (/\d/.test(s)) return { status: "ambiguous", id: "", why: "mixes digits with other characters" };
    return { status: "blank", id: "" }; // text with no digits (a heading or a note): not an ID
  }
  var api = { read: read };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.cmIdReview = api;
})(typeof window !== "undefined" ? window : this);
