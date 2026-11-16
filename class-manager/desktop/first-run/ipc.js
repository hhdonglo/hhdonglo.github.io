// First-run calls: where setup stands (cm:firstRunState), and the course folder step (cm:bankFolder*).
"use strict";
const path = require("path");
const fs = require("fs");
const { stageOf } = require("./stages");
const bank = require("./bank-folder");

function register({ on, dialog, winOf, courseDirOf, stageFor }) {
  const chosen = new Map(); // course id -> the folder the lecturer picked
  on("cm:firstRunState", (c) => Object.assign(stageFor(c), { hasKey: !!(c.authoring.status() || {}).hasKey, banks: c.course.bankNumbers() }));
  on("cm:bankFolderPick", async (c, e) => {
    const r = await dialog.showOpenDialog(winOf(e), { title: "Choose the course folder", properties: ["openDirectory"] });
    if (r.canceled || !r.filePaths[0]) return null;
    chosen.set(c.id, r.filePaths[0]);
    return bank.plan(r.filePaths[0], courseDirOf(c));
  });
  on("cm:bankFolderLoad", (c) => {
    const folder = chosen.get(c.id);
    if (!folder || !fs.existsSync(folder)) return { ok: false, why: "Choose the course folder first." };
    c.backups && c.backups.make("before loading quizzes from a folder");
    const r = bank.load(folder, courseDirOf(c), c.course);
    c.backend.dropSiteCache && c.backend.dropSiteCache();
    return Object.assign({ ok: true, folder: path.basename(folder) }, r);
  });
}

module.exports = { register };
