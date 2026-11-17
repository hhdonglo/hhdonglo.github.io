/* IDs that are not on the class list: finding rows already in the record tabs, setting them aside, and keeping the review list.
   One responsibility: protect the roster rule (the class list alone decides who has a row). Works on a backend with rawRows(tab) and setRows(tab, rows).
   - scan: rows in Master, Scores, Attendance and Totals whose ID is not on the Roster, and whether each is blank (no records at all).
   - setAside / restore: moves chosen rows into Offlist_Rows_Kept (nothing is deleted; restore puts them back). The lecturer chooses and confirms.
   - flag: the review list (Flagged_IDs): each ID not on the class list, the file it came from and when, never twice for the same ID and file. */
"use strict";

const TABS = [["Master", 3], ["Scores", 1], ["Attendance", 1], ["Totals", 1]]; // tab, first column that holds a record (columns before it are ID, name, time)
const KEPT = "Offlist_Rows_Kept", KEPT_HEAD = ["Set aside", "Student ID", "Tab", "Row"];
const FLAGS = "Flagged_IDs", FLAG_HEAD = ["First seen", "Student ID", "Why", "Source file"];
const digits = (v) => String(v == null ? "" : v).replace(/\D/g, "");
const isId = (id) => id.length >= 4 && id.length <= 12;
const empty = (v) => v === "" || v == null;

const rosterIds = (b) => new Set((b.rawRows("Roster") || []).slice(1).map((r) => digits(r[0])).filter(isId));

function scan(b) {
  const roster = rosterIds(b), out = new Map();
  if (!roster.size) return { ok: true, rows: [], blank: 0, withRecords: 0 };
  TABS.forEach(([tab, from]) => (b.rawRows(tab) || []).forEach((r) => {
    const id = digits(r[0]); if (!isId(id) || roster.has(id)) return;
    const blank = (r || []).slice(from).every(empty), cur = out.get(id) || { id, tabs: [], blank: true };
    cur.tabs.push(tab); cur.blank = cur.blank && blank; out.set(id, cur);
  }));
  const rows = [...out.values()];
  return { ok: true, rows, blank: rows.filter((x) => x.blank).length, withRecords: rows.filter((x) => !x.blank).length };
}

function setAside(b, ids, now) {
  const want = new Set((ids || []).map(digits).filter(isId)), roster = rosterIds(b);
  if (!roster.size) return { ok: false, why: "There is no class list, so nothing can be told apart." };
  const kept = [], when = (now ? now() : new Date()).toISOString();
  TABS.forEach(([tab]) => {
    const rows = b.rawRows(tab); if (!rows) return;
    const rest = rows.filter((r, i) => { const id = digits(r[0]); if (i > 0 && want.has(id) && !roster.has(id)) { kept.push([when, id, tab, JSON.stringify(r)]); return false; } return true; });
    if (rest.length !== rows.length) b.setRows(tab, rest);
  });
  if (!kept.length) return { ok: false, why: "None of those IDs has a row in the tables." };
  b.setRows(KEPT, (b.rawRows(KEPT) || [KEPT_HEAD.slice()]).concat(kept));
  return { ok: true, rows: kept.length, ids: new Set(kept.map((k) => k[1])).size };
}

function restore(b) { // puts every set-aside row back, unless the ID is on the class list now or already has a row there
  const kept = b.rawRows(KEPT); if (!kept || kept.length < 2) return { ok: false, why: "Nothing has been set aside." };
  let back = 0;
  kept.slice(1).forEach(([, id, tab, json]) => {
    const cur = b.rawRows(tab) || []; if (cur.some((r, i) => i > 0 && digits(r[0]) === id)) return;
    try { b.setRows(tab, cur.concat([JSON.parse(json)])); back++; } catch (e) { /* unreadable row stays in the kept tab */ }
  });
  b.setRows(KEPT, [KEPT_HEAD.slice()]);
  return { ok: true, rows: back };
}

// ids: [{id, why}] found in a file; file: its name. Appends only what is new. Returns how many were added.
function flag(b, ids, file, now) {
  const rows = b.rawRows(FLAGS) || [FLAG_HEAD.slice()], have = new Set(rows.slice(1).map((r) => digits(r[1]) + "|" + r[3])), when = (now ? now() : new Date()).toISOString();
  const add = (ids || []).filter((x) => !have.has(digits(x.id) + "|" + file)).map((x) => [when, digits(x.id), x.why || "not on the class list", file]);
  if (add.length) b.setRows(FLAGS, rows.concat(add));
  return add.length;
}

// The review list counted honestly: each ID once however many files it came from. The same ID in two files is two entries but one ID.
const flagSummary = (list) => { const ids = new Set(list.map((x) => digits(x.id))), files = new Set(list.map((x) => x.file)); return { ids: ids.size, files: files.size, entries: list.length }; };

const flagged = (b) => (b.rawRows(FLAGS) || []).slice(1).map((r) => ({ when: r[0], id: r[1], why: r[2], file: r[3] }));

module.exports = { scan, setAside, restore, flag, flagged, flagSummary, KEPT, FLAGS };
