/* Builds the file a lecturer uploads to the LMS gradebook: one row per student, one column per chosen assessment.
   Only the student ID (as the LMS names it) and the points go into the file; no other student data. A student with no score gets an empty cell,
   never a zero. Layout comes from the LMS profile (profiles.js). */
"use strict";
const profiles = require("./profiles");
const { listAssessments, scoresFor } = require("./assessments");

const cell = (v) => { v = String(v == null ? "" : v); return /[",\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };

function buildGradebook(master, columns, profileId, opts) {
  const o = opts || {}, g = profiles.get(profileId).gradebook, assess = listAssessments(master).filter((a) => columns.includes(a.column));
  const scores = scoresFor(master, assess.map((a) => a.column));
  const names = new Map((master || []).slice(1).map((r) => [String(r[0]).replace(/\D/g, ""), String(r[1] || "")]));
  const head = [g.idHeader].concat(g.nameHeader ? [g.nameHeader] : [], assess.map((a) => g.columnName(a.name)), g.endMarker ? [g.endMarker[0]] : []);
  const only = o.ids ? new Set(o.ids) : null;
  const rows = [], missing = [];
  scores.forEach((mine, id) => {
    if (only && !only.has(id)) return;
    const vals = assess.map((a) => (mine[a.column] ? mine[a.column].score : ""));
    if (vals.every((v) => v === "")) { missing.push(id); return; }
    rows.push([id].concat(g.nameHeader ? [names.get(id) || ""] : [], vals, g.endMarker ? [g.endMarker[1]] : []));
  });
  const csv = [head].concat(rows).map((r) => r.map(cell).join(",")).join("\r\n") + "\r\n";
  return { csv, students: rows.length, noScores: missing.length, assessments: assess.map((a) => ({ name: a.name, outOf: a.outOf })) };
}

module.exports = { buildGradebook };
