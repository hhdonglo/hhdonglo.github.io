/* No duplicate student IDs, ever. This is the one place that tidies IDs in the course's records.
   One responsibility: given a tab's rows, put every ID in its one form (ids.js), merge rows that turn out to be the same student,
   and describe each merge as a notice (both source rows, both names) so the lecturer can see it. Pure: rows in, rows and notices out.
   Rules: the first row of an ID stays; a later row of the same ID is merged into it (a blank cell is filled, a different value is NEVER
   overwritten) and recorded in the notice with its full original content, so nothing is lost. */
"use strict";
const { normalizeId } = require("../ids");

const blank = (v) => v === undefined || v === null || v === "";
const GRID_TABS = { Roster: "roster", Attendance: "attendance", Master: "marks", Scores: "marks", Totals: "marks", Access_Codes: "marks" };
// Log tabs have no uniqueness rule (one row per event); their ID column is only put in its one form.
const LOG_ID_COL = { "Form Responses 1": 2, Attempts: 1, Item_Log: 4, Diagnostic_Log: 4, Attendance_Log: 2, Presence: 1, Not_On_List: 1, Student_Notes: 1, Records: 1, Groups: 2, Group_Work: 4 };

function mergeCell(kind, a, b) { // returns {value, conflict}
  if (blank(a)) return { value: blank(b) ? a : b, conflict: false };
  if (blank(b) || a === b || String(a) === String(b)) return { value: a, conflict: false };
  if (kind === "attendance" && Number(a) <= 1 && Number(b) <= 1) return { value: Math.max(Number(a), Number(b)), conflict: false }; // present wins over absent
  return { value: a, conflict: true }; // two different values: the first stays, the other is reported
}

// rows: the tab with its header row first. Returns {rows, changed, notices}.
function tidyGrid(tab, rows) {
  const kind = GRID_TABS[tab]; if (!kind || !rows.length) return { rows, changed: false, notices: [] };
  const out = [rows[0]], at = new Map(), groups = new Map(); let changed = false;
  for (let i = 1; i < rows.length; i++) {
    const r = Array.isArray(rows[i]) ? rows[i].slice() : [];
    const raw = r[0], id = normalizeId(raw);
    if (!id) { out.push(r); continue; }
    if (String(raw) !== id) { r[0] = id; changed = true; }
    if (!at.has(id)) { at.set(id, out.length); out.push(r); continue; }
    // the same student again: merge into the first row, keep the evidence
    changed = true;
    const first = out[at.get(id)], g = groups.get(id) || groups.set(id, { id, tab, kind, entries: [{ row: at.get(id) + 1, rawId: first[0], cells: first.slice() }], conflicts: 0 }).get(id);
    g.entries.push({ row: i + 1, rawId: raw, cells: rows[i].slice() });
    for (let c = 1; c < Math.max(first.length, r.length); c++) { const m = mergeCell(kind, first[c], r[c]); if (m.value !== undefined) first[c] = m.value; if (m.conflict) g.conflicts++; }
  }
  const notices = [...groups.values()].map((g) => {
    const names = kind === "roster" ? [...new Set(g.entries.map((e) => String(e.cells[1] == null ? "" : e.cells[1]).trim()).filter(Boolean))] : [];
    return { id: g.id, tab, kind, entries: g.entries.map((e) => ({ row: e.row, rawId: String(e.rawId), name: kind === "roster" ? String(e.cells[1] == null ? "" : e.cells[1]).trim() : "", cells: e.cells })), names, namesDiffer: names.length > 1, conflicts: g.conflicts };
  });
  return { rows: out, changed, notices };
}

function tidyLog(tab, rows) {
  const col = LOG_ID_COL[tab]; if (col === undefined || rows.length < 2) return { rows, changed: false };
  let changed = false;
  for (let i = 1; i < rows.length; i++) { const r = rows[i]; if (!Array.isArray(r) || blank(r[col])) continue; const id = normalizeId(r[col]); if (id && String(r[col]) !== id) { r[col] = id; changed = true; } }
  return { rows, changed };
}

module.exports = { tidyGrid, tidyLog, GRID_TABS, LOG_ID_COL };
