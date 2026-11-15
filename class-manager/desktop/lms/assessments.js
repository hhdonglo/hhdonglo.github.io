/* Reads CM's Master tab (Student ID | Name | Last updated | one column per assessment, cells "score / out of")
   into assessments and per-student scores. The student ID is the key; the heading is the assessment's name. */
"use strict";
const { clean } = require("./ids");

const FIRST_ASSESSMENT = 3; // columns before this are ID, name and last updated

function parseCell(v) {
  const m = String(v == null ? "" : v).match(/^\s*(-?\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)\s*$/);
  return m ? { score: Number(m[1]), outOf: Number(m[2]) } : null;
}

// The assessments, in column order, with how many students have a score for each.
function listAssessments(master) {
  if (!master || !master.length) return [];
  return master[0].slice(FIRST_ASSESSMENT).map((h, k) => {
    const col = FIRST_ASSESSMENT + k;
    const cells = master.slice(1).map((r) => parseCell(r[col])).filter(Boolean);
    return { column: col, name: String(h || "").trim(), scored: cells.length, outOf: cells.length ? cells[0].outOf : 0 };
  }).filter((a) => a.name);
}

// scores for chosen columns: Map id -> { [column]: { score, outOf } }
function scoresFor(master, columns) {
  const out = new Map();
  (master || []).slice(1).forEach((r) => {
    const id = clean(r[0]); if (!id) return;
    const mine = {};
    columns.forEach((c) => { const p = parseCell(r[c]); if (p) mine[c] = p; });
    out.set(id, mine);
  });
  return out;
}

module.exports = { listAssessments, scoresFor, parseCell, FIRST_ASSESSMENT };
