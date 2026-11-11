/* Courses: one Class Manager installation runs many courses at once.
   - courses.json in CM's data folder is the registry: one entry per course (id, code, title, term,
     where its content lives, archived or not), the course CM last showed, and the default course.
   - Every course has its own folder, courses/<id>/, holding its settings (course details, Apps Script address),
     its workbook (class list, attendance, quizzes, groups, assignments, objectives, messages), its authoring
     library and its course content. Nothing is shared between courses: a student in two courses has two
     records, two access codes and two phone registrations.
   - A course's content (lectures, files, question banks) can instead live in a folder chosen by the lecturer,
     for example a local copy of a GitHub repository. Student records never go into that folder.
   - The server serves each course under /c/<id>/. Addresses without the prefix serve the default course,
     so links and QR codes printed before courses existed keep working.
   This module has no Electron dependency, so it is tested with plain Node (test/courses.test.js). */
"use strict";
const fs = require("fs");
const path = require("path");

const ID_RE = /^[a-z0-9][a-z0-9-]{0,39}$/;
const APP_KEYS = ["port", "zoom"]; // settings that belong to CM, not to a course
const LEGACY_DIRS = ["data", "course", "authoring", "course.previous"]; // the single-course layout before 0.8.0

function readJson(f, d) { try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch (e) { return d; } }
function writeJson(f, o) { fs.mkdirSync(path.dirname(f), { recursive: true }); const t = f + ".tmp"; fs.writeFileSync(t, JSON.stringify(o, null, 1)); fs.renameSync(t, f); }
function exists(f) { try { fs.statSync(f); return true; } catch (e) { return false; } }
function slug(s) { return String(s || "").toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 32).replace(/-+$/, ""); }
const clip = (v, n) => String(v == null ? "" : v).trim().slice(0, n);

// ---------- migration from the single-course layout ----------
// Before 0.8.0 CM kept one course directly in its data folder: settings.json (app and course settings
// together), data/workbook.json, course/ and authoring/. On the first start of 0.8.0 they move into the first
// course's folder. Every step is a rename inside the same folder, and the registry is written last, so a
// migration that is interrupted simply continues at the next start. Nothing is copied and nothing is deleted.
function migrateLegacy(root, log) {
  log = log || (() => {});
  const REG = path.join(root, "courses.json");
  if (exists(REG)) return { migrated: null };
  const settingsFile = path.join(root, "settings.json");
  const s = readJson(settingsFile, null);
  const hasCourseSettings = !!(s && Object.keys(s).some((k) => APP_KEYS.indexOf(k) < 0));
  const legacy = hasCourseSettings || LEGACY_DIRS.some((d) => exists(path.join(root, d)));
  if (!legacy) return { migrated: null };
  const id = slug(s && s.courseCode) || "course-1";
  const dir = path.join(root, "courses", id);
  fs.mkdirSync(dir, { recursive: true });
  const courseSettings = {}, appSettings = {};
  Object.keys(s || {}).forEach((k) => { (APP_KEYS.indexOf(k) >= 0 ? appSettings : courseSettings)[k] = s[k]; });
  if (!exists(path.join(dir, "settings.json"))) writeJson(path.join(dir, "settings.json"), courseSettings);
  for (const d of LEGACY_DIRS) {
    const from = path.join(root, d), to = path.join(dir, d);
    if (exists(from) && !exists(to)) fs.renameSync(from, to);
  }
  const now = new Date().toISOString();
  writeJson(REG, { version: 1, active: id, defaultId: id,
    courses: [{ id, code: clip(s && s.courseCode, 40), title: clip(s && s.courseTitle, 120), term: clip(s && s.semester, 80), source: { kind: "app" }, archived: false, created: now, migrated: now }] });
  writeJson(settingsFile, appSettings);
  log("moved the existing course into courses/" + id);
  return { migrated: id };
}

// Google sign-in is one account for the whole app; each course has its own Google Sheet.
// Old token files held one sheetId: it becomes the sheet of the course that was migrated.
function migrateTokens(t, id) {
  t = Object.assign({}, t || {});
  t.sheets = Object.assign({}, t.sheets || {});
  if (t.sheetId && id && !t.sheets[id]) t.sheets[id] = { sheetId: t.sheetId, sheetUrl: t.sheetUrl || "" };
  delete t.sheetId; delete t.sheetUrl;
  return t;
}
function courseTokens(all, id) { // what google.js sees for one course
  const sh = (all && all.sheets && all.sheets[id]) || {};
  return all && all.refresh ? { refresh: all.refresh, email: all.email || "", sheetId: sh.sheetId || "", sheetUrl: sh.sheetUrl || "" } : { sheetId: sh.sheetId || "", sheetUrl: sh.sheetUrl || "" };
}
function storeCourseTokens(all, id, o) { // google.js saved its state for one course
  all = migrateTokens(all, "");
  o = o || {};
  all.refresh = o.refresh || ""; all.email = o.refresh ? o.email || "" : "";
  if (o.sheetId) all.sheets[id] = { sheetId: o.sheetId, sheetUrl: o.sheetUrl || "" };
  if (!all.refresh) { delete all.refresh; delete all.email; }
  return all;
}

// ---------- the registry ----------
function createRegistry(root) {
  const REG = path.join(root, "courses.json");
  let doc = readJson(REG, null);
  if (!doc || !Array.isArray(doc.courses)) doc = { version: 1, active: "", defaultId: "", courses: [] };
  const save = () => writeJson(REG, doc);

  const all = () => doc.courses.map((c) => Object.assign({}, c, { source: Object.assign({}, c.source || { kind: "app" }) }));
  const find = (id) => doc.courses.find((c) => c.id === id) || null;
  const get = (id) => { const c = find(id); return c ? all().find((x) => x.id === id) : null; };
  const open = () => doc.courses.filter((c) => !c.archived);

  function uniqueId(base) {
    base = slug(base) || "course";
    let id = base, n = 2;
    while (find(id) || exists(path.join(root, "courses", id))) id = base + "-" + n++;
    return id;
  }
  function add(o) {
    o = o || {};
    const id = uniqueId(o.code || "course-" + (doc.courses.length + 1));
    const c = { id, code: clip(o.code, 40), title: clip(o.title, 120), term: clip(o.term, 80), source: { kind: "app" }, archived: false, created: new Date().toISOString() };
    doc.courses.push(c);
    if (!doc.defaultId) doc.defaultId = id;
    if (!doc.active) doc.active = id;
    fs.mkdirSync(path.join(root, "courses", id), { recursive: true });
    save();
    return get(id);
  }
  // The id never changes, so students' links to the course keep working after a rename.
  function update(id, o) {
    const c = find(id); if (!c) return null;
    ["code", "title", "term"].forEach((k, i) => { if (o && o[k] != null) c[k] = clip(o[k], [40, 120, 80][i]); });
    save(); return get(id);
  }
  function setArchived(id, on) {
    const c = find(id); if (!c) return { ok: false, why: "No such course." };
    if (on && !c.archived && open().length <= 1) return { ok: false, why: "At least one course must stay open. Add another course before archiving this one." };
    c.archived = !!on;
    if (on && doc.active === id) doc.active = open()[0].id;
    save(); return { ok: true, active: doc.active };
  }
  function setActive(id) {
    const c = find(id); if (!c || c.archived) return false;
    doc.active = id; save(); return true;
  }
  function active() { const c = find(doc.active); return c && !c.archived ? c.id : (open()[0] || {}).id || ""; }
  function defaultId() { return doc.defaultId && find(doc.defaultId) ? doc.defaultId : (doc.courses[0] || {}).id || ""; }

  // Where a course's content lives: CM's own folder (default) or a folder the lecturer linked.
  function setSource(id, src) {
    const c = find(id); if (!c) return null;
    if (src && src.kind === "folder") {
      const p = path.resolve(String(src.path || ""));
      const mine = path.join(root, "courses") + path.sep;
      if (!src.path || p.startsWith(mine)) throw new Error("Choose a folder outside CM's data folder.");
      c.source = { kind: "folder", path: p };
    } else c.source = { kind: "app" };
    save(); return get(id);
  }
  function dirs(id) {
    if (!ID_RE.test(String(id || ""))) throw new Error("Not a course id: " + id);
    const c = find(id);
    const base = path.join(root, "courses", id);
    const linked = c && c.source && c.source.kind === "folder" && c.source.path;
    return { root: base, settings: path.join(base, "settings.json"), data: path.join(base, "data"), workbook: path.join(base, "data", "workbook.json"),
      authoring: path.join(base, "authoring"), course: linked ? c.source.path : path.join(base, "course"), linked: !!linked };
  }
  // Which course a path on the server belongs to. /c/<id>/... is that course; any other path is the default course.
  function route(pathname) {
    const p = String(pathname || "/");
    const m = p.match(/^\/c\/([^/]*)(\/.*)?$/);
    let id, rest, prefixed = !!m;
    if (m) { id = m[1]; rest = m[2]; if (!rest) return { redirect: "/c/" + id + "/" }; }
    else { id = defaultId(); rest = p; }
    const c = ID_RE.test(id) ? find(id) : null;
    if (!c || c.archived) return { notFound: true };
    return { id, rest, prefixed, prefix: "/c/" + id + "/" };
  }
  function idFromUrl(u) {
    try { const r = route(new URL(u).pathname); return r.id || ""; } catch (e) { return ""; }
  }
  function ensureOne() { if (!open().length) add({}); if (!doc.active || !find(doc.active) || find(doc.active).archived) { doc.active = open()[0].id; save(); } return active(); }

  return { list: all, get, add, update, setArchived, setActive, active, defaultId, setSource, dirs, route, idFromUrl, ensureOne, file: REG };
}

// ---------- config.js for one course ----------
// The pages read window.CM from config.js. For every course but the default one, the browser storage the
// pages use (remembered student ID, access code, phone token, lecturer sign-in) is kept under the course's
// own name, so a phone that opens two courses keeps two separate records.
function storageGuard(prefix) {
  // Storage objects store any property assigned to them, so the methods are replaced on Storage.prototype.
  return "(function(){var P=" + JSON.stringify(prefix) + ";try{if(window.__cmStore)return;window.__cmStore=P;var S=window.Storage&&Storage.prototype;if(!S)return;" +
    "var g=S.getItem,t=S.setItem,r=S.removeItem;" +
    "S.getItem=function(k){return g.call(this,P+k)};S.setItem=function(k,v){return t.call(this,P+k,v)};S.removeItem=function(k){return r.call(this,P+k)}}catch(e){}})();\n";
}
function configScript(src, cm, storagePrefix) {
  const i = src.indexOf("/* Helpers");
  return "/* Generated by the Class Manager app from the course's settings. */\n" + (storagePrefix ? storageGuard(storagePrefix) : "") +
    "window.CM = " + JSON.stringify(cm, null, 1) + ";\n\n" + (i >= 0 ? src.slice(i) : "");
}

module.exports = { createRegistry, migrateLegacy, migrateTokens, courseTokens, storeCourseTokens, configScript, slug, APP_KEYS, ID_RE };
