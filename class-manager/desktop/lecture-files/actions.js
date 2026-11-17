// What the lecturer can do with a lecture file: choose another file for a role, replace it, take it off the lecture, move it to Removed, undo.
// One responsibility: these changes, saved through store.js (and the course's own lecture list). Nothing is deleted for good:
// "Replace" keeps the old file where it is, and "Remove" moves the file to removed/ in the course folder (where the lecture list does not look).
// A linked folder is the lecturer's own folder: CM never moves or deletes files there, it only stops using them.
"use strict";
const fs = require("fs");
const path = require("path");
const store = require("./store");
const { KINDS } = require("./classify");
const { ext, isDocumentType } = require("./types");

const inside = (root, full) => path.normalize(full).startsWith(path.normalize(root + path.sep));
const safeName = (s) => String(s).replace(/[^\w.\- ]+/g, "_").slice(-120);

function create({ dir, course, linked }) {
  let last = null; // the one thing Undo can reverse
  const kindOk = (k) => KINDS.includes(k);
  const abs = (rel) => { const f = path.join(dir, rel); return inside(dir, f) ? f : null; };
  const previous = (n, kind, rel) => ({ n, kind, was: rel ? rel : store.getFile(dir, n, kind) }); // rel: the file in use now, put back by Undo

  function choose(n, kind, rel) { // a different existing file for this role
    if (!kindOk(kind)) return { ok: false, why: "Unknown kind of file." };
    const f = rel && abs(rel);
    if (!f || !isDocumentType(rel) || !fs.existsSync(f)) return { ok: false, why: "That file is not a PDF or Word file in this course." };
    last = Object.assign(previous(n, kind), { type: "choose" });
    store.setFile(dir, n, kind, rel); return { ok: true };
  }
  function replace(n, kind, src) { // a new file from anywhere on this computer; the old one stays on disk
    if (!kindOk(kind)) return { ok: false, why: "Unknown kind of file." };
    if (!isDocumentType(src)) return { ok: false, why: "Only PDF and Word files can be lecture documents." };
    const folder = "files/lecture_" + Number(n);
    fs.mkdirSync(path.join(dir, folder), { recursive: true });
    let name = safeName(path.basename(src)), i = 2;
    while (fs.existsSync(path.join(dir, folder, name))) name = safeName(path.basename(src, ext(src))) + "-" + (i++) + ext(src);
    fs.copyFileSync(src, path.join(dir, folder, name));
    last = Object.assign(previous(n, kind), { type: "replace", copied: folder + "/" + name });
    store.setFile(dir, n, kind, folder + "/" + name); return { ok: true, rel: folder + "/" + name };
  }
  function detach(n, kind, rel) { // off the lecture; the file stays where it is
    if (!kindOk(kind)) return { ok: false, why: "Unknown kind of file." };
    last = Object.assign(previous(n, kind, rel), { type: "detach" });
    store.setFile(dir, n, kind, null);
    return { ok: true };
  }
  function remove(n, kind, rel) { // off the lecture and out of the way: moved to removed/, never deleted
    if (linked) return Object.assign(detach(n, kind, rel), { moved: false, note: "This course reads a folder of yours, so the file stays there. It is no longer used for this lecture." });
    const f = rel && abs(rel);
    if (!f || !fs.existsSync(f)) return { ok: false, why: "The file was not found." };
    const to = path.join(dir, "removed", "lecture_" + Number(n), Date.now() + "-" + path.basename(f));
    detach(n, kind, rel);
    fs.mkdirSync(path.dirname(to), { recursive: true }); fs.renameSync(f, to);
    last.moved = { from: f, to }; last.type = "remove";
    return { ok: true, moved: true };
  }
  function undo() {
    if (!last) return { ok: false, why: "Nothing to undo." };
    const l = last; last = null;
    if (l.moved && fs.existsSync(l.moved.to)) { fs.mkdirSync(path.dirname(l.moved.from), { recursive: true }); fs.renameSync(l.moved.to, l.moved.from); }
    if (l.type === "replace" && l.copied) fs.rmSync(path.join(dir, l.copied), { force: true }); // the copy CM just made, nothing of the lecturer's
    store.setFile(dir, l.n, l.kind, l.was);
    return { ok: true, n: l.n, kind: l.kind };
  }
  const describe = (n, text) => ({ ok: true, text: store.setDescription(dir, n, text) });
  return { choose, replace, detach, remove, undo, describe, abs };
}

module.exports = { create };
