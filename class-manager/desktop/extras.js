/* Data the analytics cards need beyond the class statistics. Pure of Electron: works on a backend with rawRows(tab) and setRows(tab, rows).
   - cohorts: the Group column of the Roster tab (column 3), keyed by student ID. Used only to compare teaching groups.
   - interventions: support the lecturer gave (Interventions tab: ID, kind, date, quizzes held at the time, student IDs, note).
   The ID is the unique key. */
"use strict";
const TAB = "Interventions", HEAD = ["Record", "Kind", "Date", "Quizzes held", "Student IDs", "Note"];
const digits = (v) => String(v == null ? "" : v).replace(/\D/g, "");

function cohorts(backend) {
  const rows = backend.rawRows("Roster") || [], out = {};
  rows.slice(1).forEach((r) => { const id = digits(r[0]), g = String(r[2] == null ? "" : r[2]).trim(); if (id && g) out[id] = g; });
  return out;
}
function interventions(backend) {
  return (backend.rawRows(TAB) || []).slice(1).filter((r) => r[0]).map((r) => ({ id: String(r[0]), kind: String(r[1] || ""), date: String(r[2] || ""), afterQuiz: Number(r[3]) || 0, ids: String(r[4] || "").split(/[,\s]+/).map(digits).filter(Boolean), note: String(r[5] || "") }));
}
function addIntervention(backend, rec, quizzesHeld, now) {
  const ids = (rec.ids || []).map(digits).filter(Boolean), kind = String(rec.kind || "").trim().slice(0, 60);
  if (!ids.length) return { ok: false, why: "Choose at least one student." };
  if (!kind) return { ok: false, why: "Say what support was given." };
  const rows = backend.rawRows(TAB) || [HEAD.slice()], id = "I" + rows.length;
  rows.push([id, kind, (now ? now() : new Date()).toISOString().slice(0, 10), quizzesHeld || 0, ids.join(","), String(rec.note || "").slice(0, 300)]);
  backend.setRows(TAB, rows);
  return { ok: true, id };
}
module.exports = { cohorts, interventions, addIntervention, TAB };
