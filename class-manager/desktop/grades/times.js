/* Times in the records, as milliseconds. Records hold a time as a date, as ISO text, as milliseconds, or (imported files) as dd/mm/yyyy text.
   One responsibility: read any of these, or return null. Dates are shown the same way everywhere (shown()). */
"use strict";

function toMs(v) {
  if (v === null || v === undefined || v === "") return null;
  if (v instanceof Date || Object.prototype.toString.call(v) === "[object Date]") { const t = v.getTime(); return isNaN(t) ? null : t; }
  if (v && typeof v === "object" && v.$d) return toMs(v.$d);
  if (typeof v === "number") return v > 1e11 ? v : null; // milliseconds; small numbers are marks, not times
  const s = String(v).trim();
  let m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/.exec(s);
  if (m) return new Date(+m[3], +m[2] - 1, +m[1], +(m[4] || 0), +m[5] || 0, +(m[6] || 0)).getTime();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) { const t = Date.parse(s); return isNaN(t) ? null : t; }
  return null;
}

const p2 = (n) => String(n).padStart(2, "0");
// "12 Nov 2026, 14:05": short, the same in every table, the computer's own time zone.
function shown(ms) {
  if (ms === null || ms === undefined) return "";
  const d = new Date(ms), mon = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][d.getMonth()];
  return d.getDate() + " " + mon + " " + d.getFullYear() + ", " + p2(d.getHours()) + ":" + p2(d.getMinutes());
}

// "12 Nov 2026": the date alone, used for the heading of a quiz or an attendance session.
function shownDate(ms) { return ms === null || ms === undefined ? "" : shown(ms).split(",")[0]; }

module.exports = { toMs, shown, shownDate };
