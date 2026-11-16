/* The class list (Roster tab) and what hangs off it: sync from an upload, tidy the other tabs to the list, add, remove or check one ID, and lecturer notes.
   A port of rosterSync_, rosterTidy_, rosterEdit_ (apps_script/src/00-core.gs) and studentNoteAdd_ (35-records.gs), with the same answers
   (test/class-list-parity.test.js). The host key is checked by the caller (sign-in module, later stage), as it is in the script's router. */
"use strict";
const { normalizeId } = require("../ids");
const { append, logLine } = require("./store");
const AC = require("./access-codes");

const ROSTER = "Roster", ATT = "Attendance", SCORES = "Scores", MASTER = "Master", NOTES = "Student_Notes", NOTES_HEAD = ["Timestamp", "Student ID", "Note", "By"];
const cell = (v) => (v == null ? "" : v);

function sync(store, p) {
  let rows;
  try { rows = typeof p.rows === "string" || p.rows == null ? JSON.parse(String(p.rows || "[]")) : p.rows; } catch (e) { return { ok: false, why: "could not read the list" }; }
  if (!Array.isArray(rows) || !rows.length) return { ok: false, why: "the list is empty" };
  if (rows.length > 5000) return { ok: false, why: "the list is too long (more than 5000 rows)" };
  const up = {}, order = []; let bad = 0;
  rows.forEach((r) => {
    const id = normalizeId(Array.isArray(r) ? r[0] : r);
    if (id.length < 4 || id.length > 12) { bad++; return; }
    if (!up[id]) { up[id] = Array.isArray(r) ? AC.cleanName(r[1]) : " "; order.push(id); } // " " = no name sent
  });
  if (!order.length) return { ok: false, why: "no valid student IDs in the list" };
  const apply = String(p.mode || "") === "apply";
  let sheet = (store.rows(ROSTER) || []).map((r) => r.slice());
  if (!sheet.length) sheet = [["Student ID", "Name"]];
  const have = {}, nameAt = {};
  sheet.forEach((r, i) => { const id = normalizeId(r[0]); if (id.length >= 4) { have[id] = 1; if (!String(cell(r[1])).trim()) nameAt[id] = i + 1; } });
  const added = order.filter((id) => !have[id]).map((id) => [id, up[id].trim()]);
  let named = 0; Object.keys(nameAt).forEach((id) => { if (up[id] && up[id].trim()) named++; });
  const missing = Object.keys(have).filter((id) => !up[id]).length, replace = String(p.replace || "") === "yes"; let removed = 0;
  if (replace && apply && missing) {
    const keep = [];
    sheet.forEach((r, i) => { const id = normalizeId(r[0]); if (i === 0 && id.length < 4) keep.push(r); else if (id.length >= 4 && up[id]) keep.push(r); else removed++; });
    sheet = keep;
  }
  if (apply && added.length) added.forEach((a) => sheet.push(a));
  if (apply && named) {
    sheet = sheet.map((r, i) => {
      const id = normalizeId(r[0]); let c = r[1] == null ? "" : r[1];
      if (i === 0 && !String(c).trim()) c = "Name";
      if (id.length >= 4 && !String(r[1] == null ? "" : r[1]).trim() && up[id] && up[id].trim()) c = up[id].trim();
      const w = r.slice(); w[1] = c; return w;
    });
  }
  if (apply) { store.setRows(ROSTER, sheet); logLine(store, "roster:sync", added.length + " added"); }
  return { ok: true, mode: apply ? "apply" : "dry", replace, added: added.length, namesFilled: named, unchanged: order.length - added.length, missing, removed: replace ? (apply ? removed : missing) : 0, skipped: bad, total: order.length };
}

// Removes the rows of IDs not on the list from one tab, but only rows with no marks. firstRow is 1-based; markFrom the first column that holds marks.
function tidyTab(store, tab, firstRow, markFrom, isMark, onRoster, apply) {
  const out = { rows: 0, kept: 0 }, rows = store.rows(tab);
  if (!rows || rows.length < firstRow) return out;
  const keep = rows.slice(0, firstRow - 1);
  rows.slice(firstRow - 1).forEach((r) => {
    const id = normalizeId(r[0]);
    if (id.length < 4 || onRoster[id]) { keep.push(r); return; }
    let marked = false; for (let j = markFrom; j < r.length; j++) if (isMark(cell(r[j]))) { marked = true; break; }
    if (marked) { out.kept++; keep.push(r); } else out.rows++;
  });
  if (apply && out.rows) store.setRows(tab, keep);
  return out;
}
function tidy(store, p) {
  const apply = String(p.mode || "") === "apply", roster = {}; AC.rosterRows(store).forEach((r) => { roster[r[0]] = 1; });
  if (!Object.keys(roster).length) return { ok: false, why: "the Roster is empty, so nothing is tidied" };
  const nonZero = (v) => v !== "" && v !== 0 && String(v).trim() !== "0", nonBlank = (v) => String(v).trim() !== "";
  const a = tidyTab(store, ATT, 2, 1, nonZero, roster, apply), s = tidyTab(store, SCORES, 4, 4, nonBlank, roster, apply), m = tidyTab(store, MASTER, 2, 3, nonBlank, roster, apply);
  if (apply) logLine(store, "roster:tidy", (a.rows + s.rows + m.rows) + " rows");
  return { ok: true, mode: apply ? "apply" : "dry", attendance: a.rows, scores: s.rows, master: m.rows, keptWithMarks: a.kept + s.kept + m.kept, rosterSize: Object.keys(roster).length };
}

function edit(store, p) {
  const id = normalizeId(p.id), op = String(p.op || "");
  if (id.length < 4 || id.length > 12) return { ok: false, why: "a Student ID has 4 to 12 digits" };
  if (op !== "add" && op !== "remove" && op !== "check") return { ok: false, why: "unknown operation" };
  let sheet = (store.rows(ROSTER) || []).map((r) => r.slice());
  if (!sheet.length) sheet = [["Student ID"]];
  let at = -1, n = 0;
  sheet.forEach((r, i) => { const x = normalizeId(r[0]); if (x.length >= 4) { n++; if (x === id && at < 0) at = i; } });
  if (op === "check") return { ok: true, onRoster: at >= 0, rosterSize: n };
  if (op === "add") { if (at >= 0) return { ok: true, changed: false, rosterSize: n }; sheet.push([id, AC.cleanName(p.name).trim()]); n++; }
  else { if (at < 0) return { ok: true, changed: false, rosterSize: n }; sheet.splice(at, 1); n--; }
  store.setRows(ROSTER, sheet); logLine(store, "roster:" + op, "1");
  return { ok: true, changed: true, rosterSize: n };
}

function noteAdd(store, id, text) {
  id = normalizeId(id); text = String(text || "").trim().slice(0, 1000);
  if (!id || !text) return { ok: false, why: "a student and a note are needed" };
  if (!AC.rosterRows(store).some((r) => normalizeId(r[0]) === id)) return { ok: false, why: "that ID is not on the class list" };
  append(store, NOTES, NOTES_HEAD, [store.now(), id, text, "lecturer"]);
  return { ok: true };
}

module.exports = { sync, tidy, edit, noteAdd };
