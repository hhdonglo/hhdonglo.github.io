// Builds the snapshot an assistant may read: the allowed tabs of one course with student IDs replaced by pseudonyms and
// names removed, unless the lecturer chooses otherwise. Pure functions: nothing here touches the disk or Electron.
"use strict";
const { ALLOWED_TABS, kindOf } = require("./policy");
const { createPseudonyms } = require("./pseudonym");

const VERSION = 1;

// opts: { course: {code,title,term}, salt, includeNames, realIds, readTab(name) -> rows|null, now }
function buildSnapshot(opts) {
  const pseudo = createPseudonyms(opts.salt);
  const tables = {};
  for (const name of ALLOWED_TABS) {
    const rows = opts.readTab(name);
    if (!rows || rows.length < 1) continue;
    const head = rows[0].map(String);
    const kinds = head.map(kindOf);
    const keep = kinds.map((k, i) => (k === "drop" ? false : k === "name" ? !!opts.includeNames : head[i] !== ""));
    // Attendance has one column per date: those headings are dates, kept as they are.
    const pick = (r) => r.map((v, i) => (keep[i] ? (kinds[i] === "id" && !opts.realIds ? pseudo.of(v) : String(v == null ? "" : v)) : null)).filter((v, i) => keep[i]);
    tables[name] = { columns: head.filter((h, i) => keep[i]), rows: rows.slice(1).filter((r) => r.some((v) => String(v).trim() !== "")).map(pick) };
  }
  return {
    cm: "Class Manager snapshot", version: VERSION, generated: new Date(opts.now || Date.now()).toISOString(),
    course: { code: String((opts.course && opts.course.code) || ""), title: String((opts.course && opts.course.title) || ""), term: String((opts.course && opts.course.term) || "") },
    privacy: { studentIds: opts.realIds ? "real" : "pseudonyms", names: opts.includeNames ? "included" : "removed" },
    tables, students: pseudo.known()
  };
}

// What the lecturer is shown before anything is saved: tables, columns, counts and the first two rows of each.
function preview(snap) {
  return {
    course: snap.course, privacy: snap.privacy, students: snap.students,
    tables: Object.keys(snap.tables).map((n) => ({ name: n, rows: snap.tables[n].rows.length, columns: snap.tables[n].columns, sample: snap.tables[n].rows.slice(0, 2) }))
  };
}

module.exports = { buildSnapshot, preview, VERSION };
