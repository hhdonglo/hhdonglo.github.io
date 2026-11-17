// The lecture list of Course and Content: "Lecture 1" to the last one, each with its title, files, quiz bank and a plain status.
// One responsibility: merge what the folder's names say (autoload/lecture-names.js), what the course lists (lectures.json) and the banks. Pure.
"use strict";
const { detect } = require("../autoload/lecture-names");

const FILE_FIELDS = ["slides", "handout", "tutorial", "supplement", "reference"];

// Copies CM keeps for safety are not course material: a lecture must not count them again.
const COPIES = /(^|[\\/])(backups?|removed|trash|undo|working|quarantine|old|archive|_?previews?)([\\/]|$)/i;
const KIND_KEYS = ["slides", "handout", "tutorial", "supplement", "reference"];

// The same file name found twice (a copy in another folder) is one file.
function distinct(files) {
  const seen = new Set(), out = [];
  (files || []).forEach((f) => {
    const rel = typeof f === "string" ? f : f.rel;
    if (COPIES.test(rel)) return;
    const key = rel.split(/[\\/]/).pop().toLowerCase();
    if (seen.has(key)) return; seen.add(key); out.push(rel);
  });
  return out;
}

// files: [{ rel }] from the folder scan; lectures: c.course.lectures() ([{ number, title, summary, bank, slides... }]);
// bankCounts: { number: questions } when known. Lecture 0 (an introduction) is listed only when the course lists it.
function overview(files, lectures, bankCounts) {
  const found = detect(distinct(files)), by = {}, counts = bankCounts || {};
  found.lectures.forEach((l) => { by[l.number] = { files: l.files.slice(), kinds: l.kinds }; });
  const listed = {};
  (lectures || []).forEach((l) => { if (l.number >= 0) listed[l.number] = l; });
  const nums = new Set(Object.keys(by).map(Number).concat(Object.keys(listed).map(Number)));
  (lectures || []).forEach((l) => { if (l.bank && l.number >= 1) nums.add(l.number); });
  const last = Math.max(0, ...nums);
  const rows = [];
  for (let n = listed[0] ? 0 : 1; n <= last; n++) {
    const d = by[n] || { files: [], kinds: {} }, l = listed[n] || {};
    const files = d.files.slice();
    FILE_FIELDS.forEach((k) => { if (l[k] && files.indexOf(l[k]) < 0 && !files.some((f) => f.split(/[\\/]/).pop() === String(l[k]).split(/[\\/]/).pop())) files.push(l[k]); });
    const bank = !!l.bank || !!(d.kinds && d.kinds.bank) || counts[n] > 0;
    const nonBank = files.filter((f) => !/(^|[\\/])quizzes[\\/]/i.test(f) && !/\.json$/i.test(f));
    const status = !nonBank.length && !bank ? "Nothing found" : !nonBank.length ? "No files" : !bank ? "No quiz bank" : "Complete";
    const chips = {};
    KIND_KEYS.forEach((k) => { chips[k] = !!l[k] || !!(d.kinds && d.kinds[k]); });
    rows.push({ number: n, label: n === 0 ? "Introduction" : "Lecture " + n, title: n === 0 ? "" : l.title || "", description: String(l.summary || "").trim(), chips, questions: counts[n] || 0, files: nonBank, fileCount: nonBank.length, bank, status });
  }
  return { rows, last, gaps: rows.filter((r) => r.number >= 1 && r.status === "Nothing found").map((r) => r.number), unplaced: found.unplaced };
}

module.exports = { overview, distinct };
