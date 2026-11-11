// The web import as CM's screens call it (cm:import*): choose a file, preview what it would add, apply it.
// The preview and the apply use the same plan (import-plan.js); the apply plans again from the stored file, so it matches the workbook as it is then.
"use strict";
const path = require("path");
const { readBook } = require("./xlsx-book");
const { plan } = require("./import-plan");
const { apply } = require("./import-apply");

const options = (o) => ({ onlyClassList: true, addMissing: !!(o && o.addMissing) });
const localOf = (backend) => ({ read: (name) => backend.rows(name) });

const pending = new Map(); // course id -> { name, book }: the file chosen, kept in memory only and never copied. Shared with autoload-ipc.js, which fills it from a folder.

function register({ on, dialog, winOf, shell }) {

  on("cm:importPick", async (c, e) => {
    const r = await dialog.showOpenDialog(winOf(e), { title: "Choose the results exported from the web version", properties: ["openFile"],
      filters: [{ name: "Excel workbook or CSV", extensions: ["xlsx", "csv"] }] });
    if (r.canceled || !r.filePaths[0]) return null;
    try {
      const book = await readBook(r.filePaths[0], (p) => { try { e.sender.send("cm:importProgress", p); } catch (x) { /* the window closed */ } }); // progress for the screen; the reader gives way between chunks, so CM stays responsive
      pending.set(c.id, { name: path.basename(r.filePaths[0]), book });
      return { ok: true, name: pending.get(c.id).name, report: plan(book, localOf(c.backend), options()).report };
    } catch (err) { return { ok: false, why: err.message }; }
  });

  on("cm:importPlan", (c, e, o) => { // the same file again, with the options changed
    const p = pending.get(c.id);
    return p ? { ok: true, name: p.name, report: plan(p.book, localOf(c.backend), options(o)).report } : { ok: false, why: "Choose a file first." };
  });

  on("cm:importApply", (c, e, o) => {
    const p = pending.get(c.id);
    if (!p) return { ok: false, why: "Choose a file first." };
    try {
      const made = plan(p.book, localOf(c.backend), options(o));
      if (!made.report.changes) return { ok: true, nothing: true, report: made.report };
      c.backend.flush();
      const backup = c.backups.make("before web import"); // the records as they were, to restore if this was a mistake
      if (backup && backup.ok === false) return { ok: false, why: "A backup could not be made first, so nothing was imported: " + backup.why };
      const done = apply(made.ops, c.backend, { addToClassList: (rows) => c.backend.rosterSync(rows, false), rebuild: () => { c.backend.rebuildMarks(); c.backend.buildFromRoster(); } });
      c.backend.flush();
      pending.delete(c.id);
      return { ok: true, done, backup: backup && backup.name ? backup.name : "", report: made.report };
    } catch (err) { return { ok: false, why: err.message }; }
  });

  on("cm:importTemplate", async (c, e) => { // the start template, to fill in and load again
    const r = await dialog.showSaveDialog(winOf(e), { title: "Save the template", defaultPath: "class-manager-template.xlsx", filters: [{ name: "Excel workbook", extensions: ["xlsx"] }] });
    if (r.canceled || !r.filePath) return null;
    try { require("fs").writeFileSync(r.filePath, await require("./excel").writeXlsx(require("./import-template").templateSheets())); if (shell) shell.showItemInFolder(r.filePath); return { ok: true, file: r.filePath }; }
    catch (err) { return { ok: false, why: err.message }; }
  });

  on("cm:importForget", (c) => { pending.delete(c.id); return true; });
}

module.exports = { register, pending };
