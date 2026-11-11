// Reset one course's configuration. Nothing is deleted: the chosen parts of the course's folder are moved into a "reset-<time>" folder
// beside them, and can be moved back (restore). The caller takes a backup first and checks the typed confirmation (main.js).
//   "setup": course details, the course's content (lectures, materials), approved questions and the library, and files made by "Load from a folder".
//            The class list, scores and attendance stay.
//   "all":   the same, and the records (class list, scores, attendance, access codes), so the course starts empty.
// Only fs and path; no Electron, so it is tested in plain Node (test/course-reset.test.js).
"use strict";
const fs = require("fs");
const path = require("path");

const SETUP = ["settings.json", "course", "authoring", "working", "autoload.json"];
const SCOPES = { setup: SETUP, all: SETUP.concat(["data"]) };
const stamp = (d) => { const p = (n, w) => String(n).padStart(w || 2, "0"); return "reset-" + d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + "-" + p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds()) + p(d.getMilliseconds(), 3); };

function readManifest(dir) { try { return JSON.parse(fs.readFileSync(path.join(dir, "reset.json"), "utf8")); } catch (e) { return null; } }

// base: the course's folder. linked: the course reads its content from the lecturer's own folder, which is never touched.
function resetCourse(base, scope, opts) {
  opts = opts || {};
  if (!SCOPES[scope]) return { ok: false, why: "Choose what to reset." };
  const name = stamp(opts.now || new Date()), dir = path.join(base, name), moved = [];
  fs.mkdirSync(dir, { recursive: true });
  for (const item of SCOPES[scope]) {
    if (item === "course" && opts.linked) continue;
    const from = path.join(base, item);
    if (!fs.existsSync(from)) continue;
    fs.renameSync(from, path.join(dir, item));
    moved.push(item);
  }
  fs.writeFileSync(path.join(dir, "reset.json"), JSON.stringify({ scope, items: moved, made: (opts.now || new Date()).toISOString() }));
  return { ok: true, name, moved };
}

function listResets(base) {
  let names = [];
  try { names = fs.readdirSync(base).filter((n) => /^reset-\d{8}-\d{9}$/.test(n)).sort().reverse(); } catch (e) { /* none */ }
  return names.map((n) => Object.assign({ name: n }, readManifest(path.join(base, n)) || { scope: "?", items: [], made: "" })).filter((r) => r.items.length);
}

// Moves an earlier reset back. What is there now (if anything) is moved aside into a new reset folder first, so a restore can itself be undone.
function restoreReset(base, name, opts) {
  if (!/^reset-\d{8}-\d{9}$/.test(String(name))) return { ok: false, why: "No such reset." };
  const dir = path.join(base, name), m = readManifest(dir);
  if (!m) return { ok: false, why: "That reset cannot be found." };
  const present = m.items.filter((i) => fs.existsSync(path.join(base, i)));
  let aside = null;
  if (present.length) {
    aside = stamp(new Date((opts && opts.now ? opts.now.getTime() : Date.now()) + 1));
    const adir = path.join(base, aside); fs.mkdirSync(adir, { recursive: true });
    present.forEach((i) => fs.renameSync(path.join(base, i), path.join(adir, i)));
    fs.writeFileSync(path.join(adir, "reset.json"), JSON.stringify({ scope: m.scope, items: present, made: new Date().toISOString(), note: "set aside by a restore" }));
  }
  m.items.forEach((i) => fs.renameSync(path.join(dir, i), path.join(base, i)));
  try { fs.unlinkSync(path.join(dir, "reset.json")); fs.rmdirSync(dir); } catch (e) { /* leave the folder if it is not empty */ }
  return { ok: true, restored: m.items, setAside: aside };
}

module.exports = { resetCourse, listResets, restoreReset, SCOPES };
