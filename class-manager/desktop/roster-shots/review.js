// The one check every roster entering CM goes through: IDs are read without guessing, and the ID is the unique key.
// The same ID with the same name is one student (repeats merged, counted). The same ID with two different names is a conflict that is reported,
// never merged silently. The same name under different IDs is allowed (two students). Pure (no disk, no Electron).
// The Class Roster page is the only place a roster is entered (roster-shots/README.md); this file says what is safe to save.
"use strict";
const idReview = require("../app/id-review");
const { normalizeId } = require("../ids");

const clean = (s) => String(s == null ? "" : s).replace(/\s+/g, " ").trim();
const nameKey = (s) => clean(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\p{L}\s]/gu, "").replace(/\s+/g, " ").trim();

// found:  [{ id, name, shot }] as read from the screenshots.
// onList: { names: { id: name } } the class list as it is now (an ID already there is never changed by a screenshot).
// choices: { id: name } the lecturer's pick for an ID that was read with two names.
// Returns { students, merged, conflicts, ambiguous, differsFromList, alreadyOnList }.
//  students         one row per ID, ready to save: { id, name, shots }
//  merged           the same student seen more than once: kept once
//  conflicts        one ID read with different names: { id, names }, held out until a name is chosen
//  ambiguous        IDs that cannot be read with certainty: never saved until corrected
//  differsFromList  an ID already on the list with a different name: the list keeps its name
//  alreadyOnList    IDs already on the list (saving again adds nothing)
function review(found, onList, choices) {
  const byId = new Map(), ambiguous = [];
  (found || []).forEach((f, i) => {
    const r = idReview.read(f && f.id), name = clean(f && f.name);
    if (r.status === "blank") return;
    if (r.status === "ambiguous") { ambiguous.push({ raw: String(f.id), name, why: r.why, shot: f.shot || "", index: i }); return; }
    const id = normalizeId(r.id), prev = byId.get(id);
    if (!prev) { byId.set(id, { id, names: name ? [name] : [], shots: f.shot ? [f.shot] : [], seen: 1, unclear: !!f.unclear }); return; }
    prev.seen++; if (f.unclear) prev.unclear = true; if (f.shot && !prev.shots.includes(f.shot)) prev.shots.push(f.shot);
    if (name && !prev.names.some((n) => nameKey(n) === nameKey(name))) prev.names.push(name);
  });
  const listed = (onList && onList.names) || {}, have = new Set(Object.keys(listed).map(normalizeId));
  const pick = choices || {}, students = [], merged = [], conflicts = [], differsFromList = [], alreadyOnList = [];
  byId.forEach((s) => {
    if (s.seen > 1 && s.names.length <= 1) merged.push({ id: s.id, seen: s.seen });
    let name = s.names[0] || "";
    if (s.names.length > 1) {
      const chosen = clean(pick[s.id]);
      if (!chosen || !s.names.some((n) => clean(n) === chosen)) { conflicts.push({ id: s.id, names: s.names }); return; }
      name = chosen;
    }
    students.push({ id: s.id, name, shots: s.shots, unclear: s.unclear });
    if (have.has(s.id)) {
      alreadyOnList.push(s.id);
      const cur = clean(listed[s.id]); if (cur && name && nameKey(cur) !== nameKey(name)) differsFromList.push({ id: s.id, listName: cur, shotName: name });
    }
  });
  return { students, merged, conflicts, ambiguous, differsFromList, alreadyOnList };
}

module.exports = { review, clean, nameKey };
