// Safeguard: a file whose student count is far larger than the others is probably a whole-course list, not the class being set up.
// Such a file is not ticked by default and is marked with a warning. Pure function, no file access.
"use strict";
const RATIO = 2.5; // larger than this many times the biggest other file
const MIN_OTHERS = 1;

// files: [{ id, summary: { students } }]. Returns the ids to warn about, with the sizes involved.
function oversized(files) {
  const counted = files.filter((f) => f.summary && f.summary.students > 0);
  const out = {};
  if (counted.length < MIN_OTHERS + 1) return out;
  counted.forEach((f) => {
    const others = counted.filter((x) => x !== f).map((x) => x.summary.students);
    const biggest = Math.max.apply(null, others);
    if (f.summary.students > biggest * RATIO) out[f.id] = { students: f.summary.students, others: biggest };
  });
  return out;
}
module.exports = { oversized, RATIO };
