// Reads the outline and information files of a course folder and suggests the course details (code, title, term, lecturer, institution...).
// Used when a folder is linked to a course: CM fills the blank boxes and shows what it found and in which file; the lecturer corrects and saves.
// Only reads. Reads at most 12 small files, outline-like names first. The finding itself is course-details.js (pure).
"use strict";
const { listFiles } = require("./scan");
const { readAny } = require("./read-file");
const { findDetails, FIELDS } = require("./course-details");

const LIKELY = /outline|syllabus|course|overview|info|readme|schedule|plan|handbook|module/i;
const MAX_FILES = 12, MAX_BYTES = 8 * 1000 * 1000;

const hintsOf = (r) => {
  const rows = [];
  (r.sheets || []).slice(0, 6).forEach((sh) => (sh.rows || []).slice(0, 30).forEach((row) => rows.push(row.slice(0, 12).map((v) => (v instanceof Date ? v : String(v == null ? "" : v).slice(0, 160))))));
  return { rows: rows.slice(0, 120), text: String(r.text || "").slice(0, 60000) };
};

// -> { ok, read: [file names], fields: [{ key, label, setting, value, from }] }
async function detailsOfFolder(root, now) {
  const listed = await listFiles(root);
  const rank = (f) => (LIKELY.test(f.rel) ? 0 : 1) * 10 + f.rel.split(/[\\/]/).length; // outline-like names first, shallow before deep
  const pick = listed.files.filter((f) => f.size <= MAX_BYTES).sort((a, b) => rank(a) - rank(b) || a.rel.localeCompare(b.rel)).slice(0, MAX_FILES);
  const items = [];
  for (const f of pick) { try { const h = hintsOf(await readAny(f.path)); if (h.text || h.rows.length) items.push({ file: f.rel, rows: h.rows, text: h.text }); } catch (e) { /* a file that cannot be read is skipped */ } }
  const found = findDetails(items, now || new Date());
  return { ok: true, read: items.map((i) => i.file), fields: FIELDS.filter((f) => found[f[0]]).map((f) => ({ key: f[0], label: f[1], setting: f[2], value: found[f[0]].value, from: found[f[0]].from })) };
}

module.exports = { detailsOfFolder };
