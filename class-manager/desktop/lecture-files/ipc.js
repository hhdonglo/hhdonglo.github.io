// The lecture file calls of Course and Content. One responsibility: connect the screen to build.js, peek.js and actions.js.
"use strict";
const fs = require("fs");
const path = require("path");
const store = require("./store");
const { build } = require("./build");
const { peekAll } = require("./peek");
const { isDocumentType, ext } = require("./types");
const { readDocx } = require("../autoload/read-file");
const { bankCounts } = require("../lecture-progress/ipc");

// on, dialog, winOf, shell as in main.js; dirOf(c) is the course folder; linkedOf(c) is true when the course reads a folder of the lecturer's.
function register({ on, dialog, winOf, shell, dirOf, linkedOf }) {
  const actions = (c) => require("./actions").create({ dir: dirOf(c), course: c.course, linked: !!linkedOf(c) });
  const fresh = async (c) => { const o = await overviewOf(c); return Object.assign({ ok: true }, o); };

  async function overviewOf(c) {
    const dir = dirOf(c), files = (await require("../autoload/scan").listFiles(dir, [path.join(dir, "removed")])).files;
    const wanted = files.filter((f) => isDocumentType(f.rel)).map((f) => ({ rel: f.rel, path: f.path }));
    const peeks = await peekAll(wanted, 4);
    return build({ files: files.map((f) => ({ rel: f.rel, size: f.size })), peeks, lectures: c.course.lectures(), counts: bankCounts(c), saved: store.read(dir).lectures });
  }
  on("cm:lectureOverview", async (c) => { try { return await fresh(c); } catch (e) { return { ok: false, why: e.message }; } });

  on("cm:lectureFileView", async (c, e, rel) => { // what to show when a chip is clicked
    const dir = dirOf(c), f = actions(c).abs(String(rel || ""));
    if (!f || !isDocumentType(rel) || !fs.existsSync(f)) return { ok: false, why: "The file was not found." };
    if (ext(rel) === ".pdf") return { ok: true, type: "pdf", url: "/" + String(rel).split(path.sep).join("/").split("/").map(encodeURIComponent).join("/") };
    try { return { ok: true, type: "text", text: (await readDocx(f)).text }; } catch (err) { return { ok: false, why: "This Word file could not be read: " + err.message }; }
  });
  on("cm:lectureFileUpdate", async (c, e, rel) => { // open in its own program to edit; the screen reads it again afterwards
    const f = actions(c).abs(String(rel || ""));
    if (!f || !fs.existsSync(f)) return { ok: false, why: "The file was not found." };
    const err = await shell.openPath(f); return err ? { ok: false, why: err } : { ok: true };
  });
  on("cm:lectureFileChoose", (c, e, n, kind, rel) => actions(c).choose(Number(n), String(kind), String(rel || "")));
  on("cm:lectureFileReplace", async (c, e, n, kind) => {
    const r = await dialog.showOpenDialog(winOf(e), { title: "Choose the new file (PDF or Word)", filters: [{ name: "PDF or Word", extensions: ["pdf", "docx"] }], properties: ["openFile"] });
    if (r.canceled || !r.filePaths[0]) return null;
    try { return actions(c).replace(Number(n), String(kind), r.filePaths[0]); } catch (err) { return { ok: false, why: err.message }; }
  });
  on("cm:lectureFileDetach", (c, e, n, kind, rel, alsoRemove) => { const a = actions(c); return alsoRemove ? a.remove(Number(n), String(kind), String(rel || "")) : a.detach(Number(n), String(kind), String(rel || "")); });
  on("cm:lectureFileUndo", (c) => actions(c).undo());
  on("cm:lectureDescription", (c, e, n, text) => actions(c).describe(Number(n), text));
}

module.exports = { register };
