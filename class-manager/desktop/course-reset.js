// Reset one course. Nothing is deleted unless the lecturer asks for that: the chosen parts of the course's folder are moved into a "reset-<time>" folder
// beside them, and can be moved back (restore). The caller takes a backup first and checks the typed confirmation (main.js).
//   "setup": course details, the course's content (lectures, materials), approved questions and the library, and files made by "Load from a folder".
//            The class list, scores and attendance stay.
//   "all":   the same, and every record the course keeps, so the course starts empty and looks new: the database (class list, student table,
//            attendance sessions and check-ins, quiz and practice logs, assignments, groups, messages, announcements, audit log, access codes,
//            device records, mailbox keys, safe-retry receipts), the lecturer's notes, every earlier backup of the course, and the
//            synchronisation state. Course data are one database per course, so no other course is touched. If the course is linked to a
//            place, the class list and attendance are switched to "this computer only" so that nothing is pulled back in; the copies already
//            in that place are the lecturer's own files and are not touched.
//   opts.discardUndo: also delete the moved-aside copy (the reset cannot then be undone).
// Only fs and path; no Electron, so it is tested in plain Node (test/course-reset.test.js).
"use strict";
const fs = require("fs");
const path = require("path");

const SETUP = ["settings.json", "course", "authoring", "working", "autoload.json"];
const RECORDS = ["data", "notes", "backups", "sync-state.bin", "sync-device.json"];
const SCOPES = { setup: SETUP, all: SETUP.concat(RECORDS) };
// Plain words for the confirmation screen: exactly what the chosen scope moves.
const DESCRIPTIONS = {
  setup: ["Course details", "Lectures and materials", "Approved questions and the library", "Files made by Load from a folder"],
  all: ["Course details", "Lectures and materials", "Approved questions and the library", "Files made by Load from a folder", "The class list and the student table",
    "Attendance sessions and check-ins", "Quiz, practice and mock exam results", "Assignments, groups and marks", "Messages, announcements and the audit log",
    "Lecturer notes", "Access codes and device records", "Mailbox keys", "Every earlier backup of this course", "Synchronisation state"]
};
const describe = (scope) => (DESCRIPTIONS[scope] || []).slice();

// Stops a linked place from putting records back: the class list and attendance go to "this computer only".
function unlinkRecordSync(base) {
  const f = path.join(base, "linked-folder.json");
  try { const c = JSON.parse(fs.readFileSync(f, "utf8")); c.items = Object.assign({}, c.items, { classList: "local", attendance: "local" }); fs.writeFileSync(f, JSON.stringify(c, null, 1), { mode: 0o600 }); return true; }
  catch (e) { return false; }
}
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
  const unlinked = scope === "all" ? unlinkRecordSync(base) : false;
  fs.writeFileSync(path.join(dir, "reset.json"), JSON.stringify({ scope, items: moved, made: (opts.now || new Date()).toISOString() }));
  if (opts.discardUndo) { fs.rmSync(dir, { recursive: true, force: true }); return { ok: true, name: null, moved, discarded: true, unlinked }; }
  return { ok: true, name, moved, unlinked };
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

module.exports = { resetCourse, listResets, restoreReset, describe, SCOPES };
