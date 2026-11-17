/* Lectures held, from the course's own records. One responsibility: find the held and cancelled dates and keep the lecturer's corrections.
   Held dates come from attendance sessions that were closed (or submitted), so there is one source of truth and no double counting;
   the lecturer's own marks (held, make-up, cancelled) are kept as the setting "lecture_log" in the course database.
   The numbers and wording are in rules/lecture-progress.js. See lecture-progress/README.md. */
"use strict";
const P = require("./lecture-progress");

const CTL = "Attendance_Control", LOG_PROP = "lecture_log";
const pad = (n) => String(n).padStart(2, "0");
const localDay = (d) => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
const validDay = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s)) && !isNaN(P.toMs(s));

function readMarks(store) {
  try { const l = JSON.parse(store.prop(LOG_PROP) || "[]"); return Array.isArray(l) ? l.filter((m) => m && validDay(m.date) && ["held", "makeup", "cancelled"].indexOf(m.kind) >= 0) : []; } catch (e) { return []; }
}
function writeMarks(store, marks) { store.setProp(LOG_PROP, marks.length ? JSON.stringify(marks) : null); }

// Dates of attendance sessions that were closed or submitted. An open or discarded session is not a lecture held.
function attendanceDays(store) {
  const rows = store.rows(CTL) || [];
  const out = [];
  rows.slice(1).forEach((r) => {
    const status = String(r[2] || "").trim();
    if (status !== "Closed" && status !== "Submitted") return;
    const d = new Date(r[3]);
    if (!isNaN(d.getTime())) out.push(localDay(d));
  });
  return out;
}

function today(store) { return localDay(store.now()); }

// The lecturer's choice on one date: "held" (also for a make-up), "cancelled", or null to remove the mark. Returns the new list.
function mark(store, date, kind) {
  if (!validDay(date)) return { ok: false, why: "That date is not valid." };
  if (kind !== null && ["held", "makeup", "cancelled"].indexOf(kind) < 0) return { ok: false, why: "Unknown mark." };
  const marks = readMarks(store).filter((m) => m.date !== date);
  if (kind) marks.push({ date, kind });
  marks.sort((a, b) => (a.date < b.date ? -1 : 1));
  writeMarks(store, marks);
  return { ok: true };
}

// settings: { lectureTarget, startDate, endDate, teachingDays }. Returns the status plus the dated list for the screen.
function report(store, settings, todayDay) {
  const marks = readMarks(store), att = attendanceDays(store);
  const held = att.concat(marks.filter((m) => m.kind !== "cancelled").map((m) => m.date));
  const cancelled = marks.filter((m) => m.kind === "cancelled").map((m) => m.date);
  const st = P.status({ target: settings.lectureTarget, start: settings.startDate, end: settings.endDate, days: settings.teachingDays, heldDates: held, cancelledDates: cancelled, today: todayDay || today(store) });
  const bad = new Set(cancelled), by = {};
  att.forEach((d) => { by[d] = "attendance"; });
  marks.forEach((m) => { if (m.kind !== "cancelled") by[m.date] = m.kind === "makeup" ? "make-up" : "marked held"; });
  const days = Object.keys(by).filter((d) => !bad.has(d)).map((d) => ({ date: d, how: by[d], counted: true }));
  cancelled.forEach((d) => days.push({ date: d, how: "cancelled", counted: false }));
  days.sort((a, b) => (a.date < b.date ? 1 : -1));
  return Object.assign(st, { days, notify: !!settings.lectureNotify });
}

module.exports = { report, mark, attendanceDays, readMarks };
