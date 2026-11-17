/* Lecture schedule: which lectures should be covered by now, which comes next and which were missed. One responsibility: turn the
   numbers from rules/lecture-progress.js (held, expected) and the course's lecture list into named lectures. Pure, no files.
   Lectures are taken in order: when 4 lectures are held, Lectures 1 to 4 are counted as covered. Titles and summaries come only from the
   course's lecture list (Course and Content); a lecture without a title is shown by its number alone, nothing is invented. */
"use strict";

// lectures: [{ number, title, summary }] from c.course.lectures(). Returns the lecture or a bare number entry.
function describe(number, lectures) {
  const l = (lectures || []).find((x) => x && Number(x.number) === number) || {};
  return { number, label: "Lecture " + number, title: String(l.title || ""), summary: String(l.summary || "") };
}

/* p: { state, target, held, expected } (a status() result), lectures. Returns { due, next, missed }:
   due    the lecture that should have been taught by now (expected), or null before teaching starts or without dates;
   next   the first lecture not yet held (held + 1), or null when the target is met;
   missed Lectures held + 1 up to expected, in order; empty when on track or ahead. */
function plan(p, lectures) {
  const none = { due: null, next: null, missed: [] };
  if (!p || !(p.target > 0)) return none;
  const held = Math.max(0, Math.floor(p.held || 0)), target = Math.floor(p.target);
  const expected = p.expected == null ? null : Math.max(0, Math.min(target, Math.floor(p.expected)));
  const out = { due: expected ? describe(expected, lectures) : null, next: held < target ? describe(held + 1, lectures) : null, missed: [] };
  if (expected != null && held < expected) for (let n = held + 1; n <= expected; n++) out.missed.push(describe(n, lectures));
  return out;
}

module.exports = { plan, describe };
