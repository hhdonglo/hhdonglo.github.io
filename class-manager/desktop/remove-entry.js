/* Removing single entries (rows) from any tab, and putting them back. Pure of Electron: works on a backend with tab(name), rawRows(tab) and setRows(tab, rows).
   A row is named by its position and the text shown for it (so a table that changed since it was drawn is refused, never a wrong row removed).
   Nothing is deleted: the rows are kept, untouched, in Removed_Entries (one line per row: when, batch, tab, position, the row as text) and Restore puts them back.
   Removing a whole student is a different action (remove-student.js); the student tabs use that. */
"use strict";

const KEPT = "Removed_Entries";
const HEAD = ["Removed", "Batch", "Tab", "Position", "Row kept (restores the entry)"];
const PROTECTED = [KEPT, "Removed_Students"]; // restored, not removed

const same = (a, b) => a.length === b.length && a.every((v, i) => String(v == null ? "" : v) === String(b[i] == null ? "" : b[i]));

// picks: [{ index, cells }] with index counted in the rows the screen shows (the header is row 0).
function remove(backend, tab, picks, now) {
  tab = String(tab || "");
  if (!tab || PROTECTED.includes(tab)) return { ok: false, why: "Entries in this tab are restored, not removed." };
  const shown = backend.tab(tab), raw = backend.rawRows(tab);
  if (!shown || !raw) return { ok: false, why: "That tab does not exist." };
  const list = (Array.isArray(picks) ? picks : []).map((p) => ({ index: Number(p && p.index), cells: (p && p.cells) || [] }));
  if (!list.length) return { ok: false, why: "Nothing is selected." };
  for (const p of list) {
    if (!(p.index >= 1 && p.index < shown.length)) return { ok: false, why: "The table has changed. Reload it and select again." };
    if (!same(shown[p.index], p.cells)) return { ok: false, why: "The table has changed. Reload it and select again." };
  }
  const batch = (now ? now() : new Date()).toISOString(), when = batch;
  const idx = list.map((p) => p.index).sort((a, b) => a - b).filter((v, i, a) => i === 0 || v !== a[i - 1]);
  const kept = backend.rawRows(KEPT) || [HEAD.slice()];
  idx.forEach((i) => kept.push([when, batch, tab, i, JSON.stringify(raw[i])]));
  backend.setRows(tab, raw.filter((r, i) => idx.indexOf(i) < 0));
  backend.setRows(KEPT, kept);
  return { ok: true, count: idx.length, batch, tab };
}

// Puts back every row of one batch, in their old order and positions.
function restore(backend, batch) {
  const kept = backend.rawRows(KEPT); if (!kept) return { ok: false, why: "No entry has been removed." };
  const mine = kept.filter((r, i) => i > 0 && String(r[1]) === String(batch));
  if (!mine.length) return { ok: false, why: "That removal is not in the list." };
  const tabs = {};
  mine.forEach((r) => { (tabs[r[2]] = tabs[r[2]] || []).push({ at: Number(r[3]), row: JSON.parse(r[4]) }); });
  Object.keys(tabs).forEach((tab) => {
    const cur = (backend.rawRows(tab) || [[]]).map((r) => r.slice());
    tabs[tab].sort((a, b) => a.at - b.at).forEach((x) => cur.splice(Math.min(x.at, cur.length), 0, x.row));
    backend.setRows(tab, cur);
  });
  backend.setRows(KEPT, kept.filter((r, i) => i === 0 || String(r[1]) !== String(batch)));
  return { ok: true, count: mine.length };
}

// What the lecturer can still put back, newest first.
function removed(backend) {
  const by = {}; (backend.rawRows(KEPT) || []).slice(1).forEach((r) => { const b = by[r[1]] = by[r[1]] || { batch: r[1], when: r[0], tab: r[2], count: 0 }; b.count++; });
  return Object.values(by).sort((a, b) => String(b.when).localeCompare(String(a.when)));
}

module.exports = { remove, restore, removed, KEPT, PROTECTED };
