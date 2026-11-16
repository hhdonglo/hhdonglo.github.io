// Updating a class list that already has records: names corrected on the lecturer's say-so, and dropped students set aside (not deleted).
// Both work by ID, the unique key, so attendance, marks, quiz answers and access codes stay with the same student. Pure of Electron.
"use strict";
const { normalizeId } = require("../ids");
const removeStudent = require("../remove-student");

const idOf = (v) => normalizeId(v);

// Class list IDs that are not among the IDs being saved.
function droppedIds(backend, keepIds) {
  const keep = new Set(keepIds.map(idOf));
  return (backend.rawRows("Roster") || []).slice(1).map((r) => idOf(r && r[0])).filter((id) => id.length >= 4 && !keep.has(id));
}

// A student missing from the new list goes to Removed_Students with all their rows (Restore puts them back); logs are untouched.
function setAsideDropped(backend, keepIds) {
  const done = [];
  droppedIds(backend, keepIds).forEach((id) => { const r = removeStudent.remove(backend, id); if (r.ok) done.push({ id: r.id, name: r.name }); });
  return done;
}

// The lecturer chose these IDs to take the screenshot's name. Roster and Master follow; the ID and every record stay as they are.
function applyRenames(backend, students, ids) {
  const want = new Set((ids || []).map(idOf)), newName = {};
  students.forEach((s) => { if (want.has(s.id) && s.name) newName[s.id] = s.name; });
  const renamed = new Set();
  [["Roster", 1], ["Master", 1]].forEach(([tab]) => {
    const rows = backend.rawRows(tab); if (!rows) return;
    let touched = false;
    rows.forEach((r, i) => { const id = idOf(r && r[0]); if (i > 0 && newName[id] && String(r[1] || "") !== newName[id]) { r[1] = newName[id]; renamed.add(id); touched = true; } });
    if (touched) backend.setRows(tab, rows);
  });
  return renamed.size;
}

module.exports = { setAsideDropped, applyRenames, droppedIds };
