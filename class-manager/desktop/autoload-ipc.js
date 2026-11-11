// The folder import as the app's screens call it (cm:auto*): point at a folder, see what each file holds, pick, preview, import.
// This file only connects the screen to the modules in autoload/ and to the existing import (import-ipc.js, import-plan.js).
// Preview and import use the existing path, so they also back up first, never change a record that is there and add nothing twice.
"use strict";
const fs = require("fs");
const path = require("path");
const { createStore } = require("./autoload/store");
const { scanFolder } = require("./autoload/folder");
const { watch } = require("./autoload/scan");
const { mergeCleans, writeWorking } = require("./autoload/working");
const { planBookOf } = require("./autoload/extract");
const { mergeBooks } = require("./autoload/book");
const { readAny } = require("./autoload/read-file");
const { analyzeFile } = require("./autoload/analyze");
const { oversized } = require("./autoload/oversize");
const { plan } = require("./import-plan");
const { pending } = require("./import-ipc");

const localOf = (backend) => ({ read: (name) => backend.rows(name) });
const readJson = (f, d) => { try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch (e) { return d; } };

// What the screen needs to know about one analysed file.
const shown = (a, id) => ({ id, rel: a.rel, name: a.name, ok: a.ok, error: a.error, useful: a.useful, kinds: a.kinds, why: a.why, summary: a.summary, web: a.web, size: a.size,
  sheets: (a.sheets || []).map((s) => ({ name: s.name, role: s.role, status: s.status, note: s.note, columns: s.columns, rowsIn: s.rowsIn, rowsKept: s.rowsKept })) });

const flagBig = (files) => { const big = oversized(files); files.forEach((f) => { if (big[f.id]) f.big = big[f.id]; }); return files; }; // a file far bigger than the others is not ticked by default

function register({ on, dialog, winOf, shell, dirOf }) {
  const state = new Map(); // course id -> { folder, analyses, watcher }
  const wdir = (c) => path.join(dirOf(c), "working");
  const cfg = (c) => path.join(dirOf(c), "autoload.json");
  const get = (c) => { if (!state.has(c.id)) state.set(c.id, { folder: readJson(cfg(c), {}).folder || "", analyses: [], watcher: null }); return state.get(c.id); };

  async function scan(c, e, force) {
    const s = get(c);
    if (!s.folder || !fs.existsSync(s.folder)) return { ok: false, why: s.folder ? "The folder cannot be found: " + s.folder : "Choose a folder first." };
    const store = createStore(wdir(c));
    const r = await scanFolder(s.folder, store, { force, exclude: [wdir(c)], onProgress: (p) => { try { e.sender.send("cm:autoProgress", p); } catch (x) { /* the window closed */ } } });
    s.analyses = r.analyses;
    return { ok: true, folder: s.folder, files: flagBig(r.analyses.map((a, i) => shown(a, i))), skipped: r.skipped, capped: r.capped, reread: r.reread, watching: !!s.watcher };
  }

  on("cm:autoState", (c) => { const s = get(c); return { folder: s.folder, watching: !!s.watcher, workingFolder: wdir(c) }; });

  on("cm:autoPick", async (c, e) => {
    const r = await dialog.showOpenDialog(winOf(e), { title: "Choose the folder that holds your class files", properties: ["openDirectory"] });
    if (r.canceled || !r.filePaths[0]) return null;
    const s = get(c); if (s.watcher) { s.watcher.stop(); s.watcher = null; }
    s.folder = r.filePaths[0]; s.analyses = [];
    fs.mkdirSync(path.dirname(cfg(c)), { recursive: true }); fs.writeFileSync(cfg(c), JSON.stringify({ folder: s.folder }));
    return scan(c, e, true);
  });

  on("cm:autoPickFiles", async (c, e) => { // one or more files instead of a folder: the same reading, the same preview and the same import
    const r = await dialog.showOpenDialog(winOf(e), { title: "Choose the files", properties: ["openFile", "multiSelections"],
      filters: [{ name: "Class files", extensions: ["xlsx", "csv", "tsv", "txt", "md", "docx", "pdf"] }] });
    if (r.canceled || !r.filePaths.length) return null;
    const s = get(c), root = path.dirname(r.filePaths[0]); s.analyses = [];
    for (const f of r.filePaths.slice(0, 50)) s.analyses.push(await analyzeFile(f, root));
    return { ok: true, folder: root, files: flagBig(s.analyses.map((a, i) => shown(a, i))), skipped: { other: 0, tooBig: 0, hidden: 0 }, capped: false, reread: s.analyses.length, watching: false };
  });

  on("cm:autoScan", (c, e, o) => scan(c, e, !!(o && o.force)));

  on("cm:autoWatch", (c, e, yes) => {
    const s = get(c);
    if (s.watcher) { s.watcher.stop(); s.watcher = null; }
    if (yes && s.folder) { s.watcher = watch(s.folder, () => { try { e.sender.send("cm:autoChanged"); } catch (x) { /* closed */ } }, [wdir(c)]); if (!s.watcher.ok) s.watcher = null; }
    return { watching: !!s.watcher };
  });

  // Chosen files -> the working file is written, and the existing import is previewed on what they hold.
  on("cm:autoPlan", async (c, e, o) => {
    const s = get(c), chosen = ((o && o.ids) || []).map((i) => s.analyses[i]).filter((a) => a && a.ok && a.useful);
    if (!chosen.length) return { ok: false, why: "Choose at least one file that holds usable data." };
    try {
      const merged = mergeCleans(chosen.map((a) => a.clean));
      const working = await writeWorking(wdir(c), merged, chosen.map((a) => a.rel));
      const webBooks = [];
      for (const a of chosen.filter((x) => x.web)) webBooks.push((await readAny(a.path)).sheets); // the web export's own tabs, read again from the original (read only)
      const plain = mergeCleans(chosen.filter((x) => !x.web).map((a) => a.clean));
      const book = mergeBooks(webBooks.concat([planBookOf([], { web: false, clean: plain })]));
      const name = chosen.length === 1 ? chosen[0].name : chosen.length + " files from the folder";
      pending.set(c.id, { name, book });
      const hasList = book.some((sh) => /^roster$/i.test(sh.name));
      const opts = { onlyClassList: true, addMissing: o && o.addMissing != null ? !!o.addMissing : hasList };
      pending.get(c.id).addMissing = opts.addMissing;
      const report = plan(book, localOf(c.backend), opts).report;
      const seen = new Set(report.students.conflicts.map((x) => x.id)); // names that differ between the chosen files themselves are flagged too
      merged.conflicts.filter((x) => !seen.has(x.id)).slice(0, 50).forEach((x) => { report.students.conflicts.push(x); report.students.nameConflicts++; });
      return { ok: true, name, working, addMissing: opts.addMissing, report };
    } catch (err) { return { ok: false, why: err.message }; }
  });

  // Quiz questions found in the chosen files go to the review queue (Author, Drafts), where each is approved before students see it.
  on("cm:autoQuestions", (c, e, o) => {
    const s = get(c), chosen = ((o && o.ids) || []).map((i) => s.analyses[i]).filter((a) => a && a.ok && a.clean && a.clean.questions.length);
    if (!chosen.length) return { ok: false, why: "None of the chosen files holds quiz questions." };
    try {
      let added = 0, flagged = 0;
      chosen.forEach((a) => { const r = c.authoring.importText(a.clean.questions.join("\n\n"), {}, a.name), items = r.items.filter((q) => q.q && q.options.length >= 2); const d = c.authoring.addDrafts(items, "imported"); added += d.length; flagged += r.items.length - items.length; });
      return { ok: true, added, flagged };
    } catch (err) { return { ok: false, why: err.message }; }
  });

  on("cm:autoExport", async (c, e) => { // the clean working file, saved where the lecturer chooses
    const src = path.join(wdir(c), "working-file.xlsx");
    if (!fs.existsSync(src)) return { ok: false, why: "There is no working file yet. Choose files and press Preview first." };
    const r = await dialog.showSaveDialog(winOf(e), { title: "Save the working file", defaultPath: "class-working-file.xlsx", filters: [{ name: "Excel workbook", extensions: ["xlsx"] }] });
    if (r.canceled || !r.filePath) return null;
    try { fs.copyFileSync(src, r.filePath); if (shell) shell.showItemInFolder(r.filePath); return { ok: true, file: r.filePath }; } catch (err) { return { ok: false, why: err.message }; }
  });

  on("cm:autoOpenWorking", (c) => { fs.mkdirSync(wdir(c), { recursive: true }); return shell.openPath(wdir(c)); });
}

module.exports = { register };
