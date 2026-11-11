// Scans a folder: lists the files (scan.js), reads only the new or changed ones (analyze.js), and returns what each holds.
// A rescan of an unchanged folder opens no file. Files are read one at a time so CM stays responsive.
"use strict";
const { listFiles } = require("./scan");
const { analyzeFile } = require("./analyze");

const tick = () => new Promise((r) => setImmediate(r));

// onProgress({ done, total, file, reading }) is called as the scan goes. -> { analyses, skipped, capped, reread }
async function scanFolder(root, store, opts) {
  opts = opts || {};
  const listed = await listFiles(root, opts.exclude);
  const analyses = []; let reread = 0, done = 0;
  for (const f of listed.files) {
    let a = opts.force ? null : store.get(f);
    if (!a) {
      if (opts.onProgress) opts.onProgress({ done, total: listed.files.length, file: f.rel, reading: true });
      a = await analyzeFile(f.path, root);
      store.put(f, a); reread++;
      await tick();
    }
    analyses.push(a); done++;
    if (opts.onProgress && done % 25 === 0) opts.onProgress({ done, total: listed.files.length, file: f.rel, reading: false });
  }
  store.prune(listed.files.map((f) => f.path));
  return { analyses, skipped: listed.skipped, capped: listed.capped, reread };
}

module.exports = { scanFolder };
