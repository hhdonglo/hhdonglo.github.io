/* Compares the LMS roster with CM's class list and says what would change. Nothing is changed here.
   CM's class list stays the source of truth: students the LMS has and CM lacks are offered for adding (only if the lecturer agrees);
   students CM has and the LMS lacks are listed and never removed; a different name is flagged and the existing name is kept. */
"use strict";
const { clean } = require("./ids");

// classRows: the Roster tab as rows (first row the heading; ID in column 1, name in column 2).
function planRoster(students, classRows) {
  const mine = new Map();
  (classRows || []).slice(1).forEach((r) => { const id = clean(r[0]); if (id) mine.set(id, String(r[1] || "").trim()); });
  const theirs = new Map(students.map((s) => [s.id, s.name]));
  const toAdd = students.filter((s) => !mine.has(s.id));
  const nameDiffers = students.filter((s) => mine.has(s.id) && s.name && mine.get(s.id) && mine.get(s.id).toLowerCase() !== s.name.toLowerCase())
    .map((s) => ({ id: s.id, cm: mine.get(s.id), lms: s.name }));
  const notInLms = [...mine.keys()].filter((id) => !theirs.has(id));
  return { toAdd, nameDiffers, notInLms, matched: students.length - toAdd.length, total: students.length };
}

module.exports = { planRoster };
