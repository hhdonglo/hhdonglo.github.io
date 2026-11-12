/* Removing a student from the class, and putting the student back. Pure of Electron: works on a backend with rawRows(tab) and setRows(tab, rows).
   Remove takes the student's row out of the tabs that list the class (Roster, Attendance, Master, Scores, Totals) and keeps those rows,
   untouched, in the Removed_Students tab (one row per student: when, ID, name, then the rows as text). Nothing is deleted: the logs of check-ins,
   quiz answers, records and notes are not changed, so Restore puts everything back exactly as it was. The ID is the unique key throughout. */
"use strict";

const CLASS_TABS = ["Roster", "Attendance", "Master", "Scores", "Totals"]; // the student's ID is in the first column of each
const KEPT = "Removed_Students";
const HEAD = ["Removed", "Student ID", "Name", "Rows kept (restores the student)"];
const digits = (v) => String(v == null ? "" : v).replace(/\D/g, "");
const isId = (id) => id.length >= 4 && id.length <= 12;

function remove(backend, idIn, now) {
  const id = digits(idIn);
  if (!isId(id)) return { ok: false, why: "That is not a student ID." };
  const kept = {}; let name = "";
  CLASS_TABS.forEach((tab) => {
    const rows = backend.rawRows(tab); if (!rows) return;
    const mine = [], rest = rows.filter((r, i) => { if (i > 0 && digits(r[0]) === id) { mine.push(r); return false; } return true; });
    if (!mine.length) return;
    kept[tab] = mine; backend.setRows(tab, rest);
    if (!name) name = String(mine[0][tab === "Roster" || tab === "Master" ? 1 : 0] || "").trim();
  });
  if (!Object.keys(kept).length) return { ok: false, why: "That student is not on the class list." };
  const old = backend.rawRows(KEPT) || [HEAD.slice()];
  old.push([(now ? now() : new Date()).toISOString(), id, name, JSON.stringify(kept)]);
  backend.setRows(KEPT, old);
  return { ok: true, id, name };
}

function restore(backend, idIn) {
  const id = digits(idIn), rows = backend.rawRows(KEPT);
  if (!rows) return { ok: false, why: "No student has been removed." };
  let at = -1; for (let i = rows.length - 1; i > 0; i--) if (digits(rows[i][1]) === id) { at = i; break; }
  if (at < 0) return { ok: false, why: "That student is not in the removed list." };
  let kept; try { kept = JSON.parse(rows[at][3]); } catch (e) { return { ok: false, why: "The removed record could not be read." }; }
  Object.keys(kept).forEach((tab) => {
    const cur = backend.rawRows(tab) || [];
    if (!cur.some((r, i) => i > 0 && digits(r[0]) === id)) backend.setRows(tab, cur.concat(kept[tab])); // never a second row for one ID
  });
  backend.setRows(KEPT, rows.filter((r, i) => i !== at));
  return { ok: true, id, name: String(rows[at][2] || "") };
}

const removed = (backend) => (backend.rawRows(KEPT) || []).slice(1).map((r) => ({ when: r[0], id: digits(r[1]), name: String(r[2] || "") }));

module.exports = { remove, restore, removed, CLASS_TABS, KEPT };
