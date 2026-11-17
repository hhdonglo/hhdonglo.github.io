// The lecture list of Course and Content: "Lecture 1" to the last one, each with its title, files, quiz bank and a plain status.
// One responsibility: merge what the folder's names say (autoload/lecture-names.js), what the course lists (lectures.json) and the banks. Pure.
"use strict";
const { detect } = require("../autoload/lecture-names");

const FILE_FIELDS = ["slides", "handout", "tutorial", "supplement", "reference"];

// files: [{ rel }] from the folder scan; lectures: c.course.lectures() ([{ number, title, bank, slides... }]).
function overview(files, lectures) {
  const found = detect(files), by = {};
  found.lectures.forEach((l) => { by[l.number] = { files: l.files.slice(), kinds: l.kinds }; });
  const listed = {};
  (lectures || []).forEach((l) => { if (l.number >= 1) listed[l.number] = l; });
  const nums = new Set(Object.keys(by).map(Number).concat(Object.keys(listed).map(Number)));
  (lectures || []).forEach((l) => { if (l.bank && l.number >= 1) nums.add(l.number); });
  const last = Math.max(0, ...nums);
  const rows = [];
  for (let n = 1; n <= last; n++) {
    const d = by[n] || { files: [], kinds: {} }, l = listed[n] || {};
    const files = d.files.slice();
    FILE_FIELDS.forEach((k) => { if (l[k] && files.indexOf(l[k]) < 0 && !files.some((f) => f.split(/[\\/]/).pop() === String(l[k]).split(/[\\/]/).pop())) files.push(l[k]); });
    const bank = !!l.bank || !!(d.kinds && d.kinds.bank);
    const nonBank = files.filter((f) => !/(^|[\\/])quizzes[\\/]/i.test(f) && !/\.json$/i.test(f));
    const status = !nonBank.length && !bank ? "Nothing found" : !nonBank.length ? "No files" : !bank ? "No quiz bank" : "Complete";
    rows.push({ number: n, label: "Lecture " + n, title: l.title || "", files: nonBank, fileCount: nonBank.length, bank, status });
  }
  return { rows, last, gaps: rows.filter((r) => r.status === "Nothing found").map((r) => r.number), unplaced: found.unplaced };
}

module.exports = { overview };
