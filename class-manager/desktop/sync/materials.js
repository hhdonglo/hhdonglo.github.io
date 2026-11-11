/* Course materials and lecturer notes from the linked place. In the place they sit, readable, in
   Class Manager/<course>/materials/ (course files: lectures, slides, banks, in the layout of the course folder)
   and Class Manager/<course>/notes/ (lecturer notes: any files). Pull copies what is new or different from the place
   to this computer's course folder (materials) and notes folder (notes); it never deletes a local file and never
   overwrites a file that was changed here after the last pull (it is kept, and the place's version is saved beside it
   as <name>.from-cloud). Push sends this computer's files up in the same way.
   These files are NOT encrypted: they are for course materials and notes, never student data.
   The place is { rawList(dir) -> [{name, bytes, dir?}], rawGet(path), rawPut(path, buf) }. Pure of Electron. */
"use strict";
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const MAX_FILES = 2000, MAX_BYTES = 50 * 1024 * 1024;
const SAFE = /^[^\\/\0]+$/; // one path segment
const hash = (b) => crypto.createHash("sha256").update(b).digest("hex");
const inside = (root, full) => path.normalize(full).startsWith(path.normalize(root + path.sep));

async function walkPlace(place, rel, out) {
  if (out.length > MAX_FILES) throw new Error("Too many files in the linked storage (limit " + MAX_FILES + ").");
  for (const e of await place.rawList(rel)) {
    if (!SAFE.test(e.name) || e.name === "." || e.name === ".." || e.name.startsWith(".")) continue;
    const p = rel ? rel + "/" + e.name : e.name;
    if (e.dir) await walkPlace(place, p, out); else out.push({ path: p, bytes: e.bytes || 0 });
  }
  return out;
}
function walkLocal(dir, rel, out) {
  let list = []; try { list = fs.readdirSync(path.join(dir, rel), { withFileTypes: true }); } catch (e) { return out; }
  for (const d of list) {
    if (d.name.startsWith(".") || d.name.endsWith(".from-cloud")) continue;
    const p = rel ? rel + "/" + d.name : d.name;
    if (d.isDirectory()) walkLocal(dir, p, out); else if (d.isFile()) out.push(p);
  }
  return out;
}

// Pull one folder. state: { path -> hash at the last pull }, updated. Returns counts.
async function pull(place, remoteDir, localDir, state) {
  const files = await walkPlace(place, remoteDir, []);
  let got = 0, kept = 0, same = 0;
  for (const f of files) {
    const rel = f.path.slice(remoteDir.length + 1), dest = path.join(localDir, ...rel.split("/"));
    if (!inside(localDir, dest)) continue;
    if (f.bytes > MAX_BYTES) continue;
    const buf = Buffer.from(await place.rawGet(f.path));
    const h = hash(buf); let cur = null; try { cur = fs.readFileSync(dest); } catch (e) { /* new */ }
    if (cur && hash(cur) === h) { state[f.path] = h; same++; continue; }
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    if (cur && state[f.path] && hash(cur) !== state[f.path]) { fs.writeFileSync(dest + ".from-cloud", buf); kept++; continue; } // changed here since the last pull
    if (cur && !state[f.path]) { fs.writeFileSync(dest + ".from-cloud", buf); kept++; continue; } // a different file was already here
    fs.writeFileSync(dest, buf); state[f.path] = h; got++;
  }
  return { got, kept, same };
}
// Push one folder: files that are new here, or changed here, go up; files in the place that were not changed here are left.
async function push(place, remoteDir, localDir, state) {
  const have = new Map((await walkPlace(place, remoteDir, [])).map((f) => [f.path, f.bytes]));
  let sent = 0, same = 0;
  for (const rel of walkLocal(localDir, "", [])) {
    const rp = remoteDir + "/" + rel, buf = fs.readFileSync(path.join(localDir, ...rel.split("/")));
    if (buf.length > MAX_BYTES) continue;
    if (have.has(rp) && have.get(rp) === buf.length && state[rp] === hash(buf)) { same++; continue; }
    await place.rawPut(rp, buf); state[rp] = hash(buf); sent++;
  }
  return { sent, same };
}
module.exports = { pull, push, walkPlace, walkLocal, MAX_FILES, MAX_BYTES };
