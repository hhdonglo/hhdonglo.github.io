/* Reads an LMS roster export (rows of cells, first row the headings) into students: { id, name }.
   The ID column is found by the LMS profile's names (profiles.js) or chosen by the lecturer. A row without a valid ID is skipped and counted.
   Two rows with the same ID are one student: the first is kept and the repeat is reported, never added twice. */
"use strict";
const { clean } = require("./ids");
const profiles = require("./profiles");

const norm = (s) => String(s == null ? "" : s).trim().toLowerCase();
const indexOf = (head, names) => { for (const n of names) { const i = head.indexOf(n); if (i >= 0) return i; } return -1; };

function findColumns(head, profileId) {
  const p = profiles.get(profileId), h = head.map(norm);
  const id = indexOf(h, p.idColumns);
  const names = p.nameColumns.map((n) => h.indexOf(n)).filter((i) => i >= 0);
  return { id, names };
}

function readRoster(rows, opts) {
  const o = opts || {};
  const out = { students: [], skipped: 0, repeats: [], problem: "" };
  if (!rows || rows.length < 2) { out.problem = "The file has no students."; return out; }
  const found = findColumns(rows[0], o.profile);
  const idCol = o.idColumn != null ? o.idColumn : found.id;
  if (idCol < 0) { out.problem = "No student ID column was found. Choose which column holds the ID."; out.columns = rows[0]; return out; }
  const nameCols = o.nameColumns || found.names, seen = new Set();
  rows.slice(1).forEach((r) => {
    if (!r || !r.some((c) => String(c).trim())) return;
    const id = clean(r[idCol]);
    if (!id) { out.skipped++; return; }
    if (seen.has(id)) { out.repeats.push(id); return; }
    seen.add(id);
    out.students.push({ id, name: nameCols.map((i) => String(r[i] || "").trim()).filter(Boolean).join(" ") });
  });
  out.columns = rows[0];
  return out;
}

module.exports = { readRoster, findColumns };
