/* Lecture progress: lectures held against the semester target. One responsibility: the arithmetic and the wording, no files and no store.
   Everything is worked out from plain values, so the card, the banner and the notification all show the same answer (status() is the one function).
   Dates are "YYYY-MM-DD" strings. A lecture is held on a date; two sessions on one date are one lecture.
   See lecture-progress/README.md for what counts as held. */
"use strict";

const DAY = 86400000;
const toMs = (s) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || "")); return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) : NaN; };
const plural = (n, one, many) => n + " " + (n === 1 ? one : many);

// Number of scheduled teaching days (weekday numbers 0 = Sunday ... 6) in [from, to] inclusive.
function slotsBetween(fromMs, toMsv, days) {
  let n = 0;
  for (let t = fromMs; t <= toMsv; t += DAY) if (days.indexOf(new Date(t).getUTCDay()) >= 0) n++;
  return n;
}

function cleanDays(days) {
  const list = Array.isArray(days) ? days : String(days || "").split(",");
  return list.map((d) => String(d).trim()).filter((d) => /^[0-6]$/.test(d)).map(Number).filter((d, i, a) => a.indexOf(d) === i).sort();
}

// What counts: held dates minus cancelled dates (a cancelled date never counts, even if attendance was taken).
function countHeld(heldDates, cancelledDates) {
  const bad = new Set(cancelledDates || []);
  return [...new Set(heldDates || [])].filter((d) => !bad.has(d) && !isNaN(toMs(d))).sort();
}

/* p: { target, start, end, days, heldDates, cancelledDates, today }
   Returns { state, target, held, left, expected, behind, ahead, weekNow, weeksTotal, weeksLeft, perWeek, headline, detail, key }.
   state: none (no target), count (target but no dates), notstarted, ontrack, ahead, behind, met, ended. */
function status(p) {
  const target = Math.max(0, Math.min(200, Math.floor(Number(p.target) || 0)));
  const held = countHeld(p.heldDates, p.cancelledDates);
  const out = { state: "none", target, held: held.length, left: Math.max(0, target - held.length), expected: null, behind: 0, ahead: 0, weekNow: null, weeksTotal: null, weeksLeft: null, perWeek: 0, headline: "", detail: "", key: "" };
  if (!target) { out.headline = "No lecture target set"; out.detail = held.length ? "CM has counted " + plural(held.length, "lecture", "lectures") + " held. Set the number planned for the semester to see how many are left." : "Set the number of lectures planned for the semester under Course settings."; return out; }
  const s = toMs(p.start), e = toMs(p.end), t = toMs(p.today);
  const days = cleanDays(p.days), dated = !isNaN(s) && !isNaN(e) && e >= s && !isNaN(t);
  const total = plural(target, "lecture", "lectures");
  if (held.length >= target) { out.state = "met"; out.headline = "Target met: " + held.length + " of " + target + " lectures held"; out.detail = held.length > target ? plural(held.length - target, "lecture", "lectures") + " more than planned." : "No lectures left."; out.key = "met"; return out; }
  if (!dated) { out.state = "count"; out.headline = held.length + " of " + target + " lectures held, " + out.left + " left"; out.detail = "Set the first and last day of teaching under Course settings and CM will tell you whether you are on course."; out.key = "count"; return out; }

  const totalDays = Math.round((e - s) / DAY) + 1;
  out.weeksTotal = Math.ceil(totalDays / 7);
  out.weekNow = t < s ? 0 : Math.min(out.weeksTotal, Math.floor((t - s) / DAY / 7) + 1);
  const daysBefore = Math.max(0, Math.min(totalDays, Math.round((t - s) / DAY))); // days of the semester before today
  let expected;
  if (days.length) {
    const allSlots = slotsBetween(s, e, days);
    const before = t <= s ? 0 : slotsBetween(s, Math.min(e, t - DAY), days);
    expected = Math.min(target, allSlots ? Math.round(target * before / allSlots) : 0); // the target spread over the real timetable
  } else expected = Math.min(target, Math.floor(target * daysBefore / totalDays));
  out.expected = expected;
  const remDays = t > e ? 0 : Math.round((e - Math.max(t, s)) / DAY) + 1;
  out.weeksLeft = remDays ? Math.ceil(remDays / 7) : 0;

  if (t > e) { out.state = "ended"; out.behind = out.left; out.headline = "Semester ended with " + held.length + " of " + target + " lectures held"; out.detail = plural(out.left, "lecture", "lectures") + " short of the target."; out.key = "ended:" + held.length; return out; }
  if (t < s) { out.state = "notstarted"; out.headline = "Teaching has not started: " + total + " planned"; out.detail = "First day of teaching is " + p.start + "."; out.key = "notstarted"; return out; }
  out.behind = Math.max(0, expected - held.length); out.ahead = Math.max(0, held.length - expected);
  const wk = "week " + out.weekNow + " of " + out.weeksTotal;
  if (out.behind > 0) {
    out.state = "behind"; out.perWeek = Math.ceil(out.behind / Math.max(1, out.weeksLeft));
    out.headline = "Behind target: " + plural(out.behind, "lecture", "lectures") + " behind";
    out.detail = "Held " + held.length + " of " + target + ", expected " + expected + " by " + wk + ". To catch up, add " + plural(out.behind, "extra session", "extra sessions") + " in the remaining " + plural(out.weeksLeft, "week", "weeks") + (out.behind > 1 && out.weeksLeft > 1 ? " (about " + out.perWeek + " a week)" : "") + ".";
  } else if (out.ahead > 0) { out.state = "ahead"; out.headline = "Ahead of target by " + plural(out.ahead, "lecture", "lectures"); out.detail = "Held " + held.length + " of " + target + ", expected " + expected + " by " + wk + "."; }
  else { out.state = "ontrack"; out.headline = "On track"; out.detail = "Held " + held.length + " of " + target + ", expected " + expected + " by " + wk + "."; }
  out.key = out.state + ":" + held.length + ":" + expected; // changes when a lecture is saved or the expected number moves, so a dismissed banner returns
  return out;
}

module.exports = { status, cleanDays, countHeld, toMs };
