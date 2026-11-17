// What the lecturer decided about lecture files: which file is the handout, tutorial and so on, and edited descriptions.
// One responsibility: read and write data/lecture-files.json in the course folder (atomic write). Nothing here looks at the files themselves.
// Shape: { lectures: { "1": { files: { handout: "rel/path.pdf" | null }, description: "text" } } }. null means "taken off this lecture".
"use strict";
const fs = require("fs");
const path = require("path");

const file = (dir) => path.join(dir, "data", "lecture-files.json");

function read(dir) {
  try { const j = JSON.parse(fs.readFileSync(file(dir), "utf8")); return { lectures: j && typeof j.lectures === "object" && j.lectures ? j.lectures : {} }; } catch (e) { return { lectures: {} }; }
}
function write(dir, doc) {
  fs.mkdirSync(path.dirname(file(dir)), { recursive: true });
  const tmp = file(dir) + ".tmp"; fs.writeFileSync(tmp, JSON.stringify(doc, null, 1)); fs.renameSync(tmp, file(dir));
}
function entry(doc, n) { return doc.lectures[String(n)] || (doc.lectures[String(n)] = { files: {} }); }

// value: a relative path, null (taken off) or undefined (back to CM's own guess)
function setFile(dir, n, kind, value) {
  const doc = read(dir), e = entry(doc, n); e.files = e.files || {};
  if (value === undefined) delete e.files[kind]; else e.files[kind] = value;
  write(dir, doc); return e.files;
}
function getFile(dir, n, kind) { const e = read(dir).lectures[String(n)]; return e && e.files && Object.prototype.hasOwnProperty.call(e.files, kind) ? e.files[kind] : undefined; }
function setDescription(dir, n, text) {
  const doc = read(dir), e = entry(doc, n), t = String(text || "").trim().slice(0, 600);
  if (t) e.description = t; else delete e.description;
  write(dir, doc); return t;
}

module.exports = { read, setFile, getFile, setDescription, file };
