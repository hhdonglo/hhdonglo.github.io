/* A clean heading for an attendance session, whatever the file called it.
   One responsibility: "03/11/2026", "03/11/2026 #2", "Attendance Tue Nov 03 2026 00:00:00 GMT+0000 (...)" or an ISO date all become "3 Nov 2026" (a second session that day: "3 Nov 2026 #2").
   sessionDate() gives the same date as 2026-11-03 for the charts. Text that is not a date is returned trimmed, so nothing is lost. Pure. */
"use strict";
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const nice = (d, m, y) => Number(d) + " " + MON[Number(m) - 1] + " " + y;

// {d, m, y, n, rest}: the date parts found in a heading, and the session number of that day.
function parts(raw) {
  let s = String(raw == null ? "" : raw).trim(), n = 1;
  const k = /\s*#(\d+)\s*$/.exec(s); if (k) { s = s.slice(0, k.index).trim(); n = Number(k[1]); }
  s = s.replace(/^attendance\s+/i, "");
  let m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(s); if (m) return { d: +m[1], m: +m[2], y: +m[3], n, rest: s };
  m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s); if (m) return { d: +m[3], m: +m[2], y: +m[1], n, rest: s };
  m = /^(?:[A-Z][a-z]{2}\s+)?([A-Z][a-z]{2})\s+(\d{1,2})\s+(\d{4})\b/.exec(s); // Tue Nov 03 2026 00:00:00 GMT+0000 (...)
  if (m && MON.indexOf(m[1]) >= 0) return { d: +m[2], m: MON.indexOf(m[1]) + 1, y: +m[3], n, rest: s };
  return { d: 0, n, rest: s };
}
function sessionLabel(raw) { const p = parts(raw); return (p.d ? nice(p.d, p.m, p.y) : p.rest) + (p.n > 1 ? " #" + p.n : ""); }
// "2026-11-03" for a heading that holds a date, else "".
function sessionDate(raw) { const p = parts(raw), z = (x) => String(x).padStart(2, "0"); return p.d ? p.y + "-" + z(p.m) + "-" + z(p.d) : ""; }

module.exports = { sessionLabel, sessionDate };
