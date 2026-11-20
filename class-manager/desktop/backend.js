/* Local backend for the Class Manager app.
   Runs the same server script as the Google version (apps_script/quiz_receiver.gs),
   unchanged, against a workbook stored on this computer instead of a Google Sheet.
   The small set of Google services the script uses is provided below. */
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const crypto = require("crypto");
const { openCourse } = require("./db/migrate");
const moduleAccess = require("./module-access");
const moduleConfig = require("./db/module-config");
const { scopedStore } = require("./rules/analytics-scope");
const { createWorkbookAdapter } = require("./workbook-adapter");
const { toJson } = require("./db/codec");
const { createStudents } = require("./db/students");
const { createNotices } = require("./db/notices");
const { tidyGrid, tidyLog, GRID_TABS, LOG_ID_COL } = require("./db/id-guard");
const { normalizeId } = require("./ids");

const isDate = (v) => Object.prototype.toString.call(v) === "[object Date]"; // dates made inside the script come from another realm
function bytes(buf) { return Array.from(buf, (b) => (b > 127 ? b - 256 : b)); } // Apps Script byte arrays are signed

function createBackend(opts) {
  const WEB = opts.webRoot;              // where quizzes/ and apps_script/ live
  const FILE = opts.dataFile;            // workbook.json
  const log = opts.log || (() => {});
  const vault = opts.vault || null;      // vault.js: the workbook is encrypted on disk when a vault is given

  // ---------- course database on disk (db/store.js; the old workbook.json is imported by db/migrate.js) ----------
  const dbFile = opts.dbFile || path.join(path.dirname(FILE), "course.db");
  const opened = openCourse({ dbFile, jsonFile: FILE, vault, log, initialModules: opts.initialModules });
  const db = opened.db, book = opened.book, loadProblem = opened.loadProblem;
  if (!book.props) book.props = {};
  const students = createStudents(db, vault); // the student table: unique IDs, kept equal to the Roster tab
  const rosterTab = () => book.sheets.find((x) => x.name === "Roster");
  const notices = createNotices(db, vault); // duplicate ID notices (db/notices.js)

  // No duplicate IDs: every ID in its one form, rows of the same student merged, each merge reported (db/id-guard.js).
  // Runs when the class list, a mark grid or a log has changed, before anything reads them, and once when the course opens (old data).
  let idDirty = true;
  function tidyIds() {
    if (!idDirty) return; idDirty = false;
    for (const d of book.sheets) {
      if (GRID_TABS[d.name]) { const r = tidyGrid(d.name, d.rows); if (r.changed) { d.rows = r.rows; dirty.add(d); } r.notices.forEach((n) => notices.record(n)); }
      else if (LOG_ID_COL[d.name] !== undefined) { if (tidyLog(d.name, d.rows).changed) dirty.add(d); }
    }
    if (dirty.size && !timer) timer = setTimeout(() => { try { flush(); } catch (e) { /* logged */ } }, 400);
  }

  let dirty = new Set(), propsDirty = false, timer = null, version = Math.floor(Math.random() * 1e6) * 1000; // random start, so a new backend (reset, other course) never repeats a stamp; // version counts every change to the workbook: the screens poll it to redraw graphs
  // data: the tab that changed (or "props" for settings); only changed tabs are written.
  const idRelevant = (d) => d && d !== "props" && !!(GRID_TABS[d.name] || LOG_ID_COL[d.name] !== undefined);
  function touch(data) { version++; if (!data || idRelevant(data)) idDirty = true; if (data === "props") propsDirty = true; else if (data) dirty.add(data); else { book.sheets.forEach((d) => dirty.add(d)); propsDirty = true; } if (!timer) timer = setTimeout(() => { try { flush(); } catch (e) { /* logged; kept to try again */ } }, 400); if (opts.onChange) opts.onChange(); }
  function flush() {
    timer = null; tidyIds(); if (!dirty.size && !propsDirty) return;
    const d = dirty, p = propsDirty; dirty = new Set(); propsDirty = false;
    try { db.save(book, d, p); const rt = rosterTab(); if (rt && d.has(rt)) students.sync(rt.rows); } catch (e) { d.forEach((x) => dirty.add(x)); propsDirty = propsDirty || p; log("could not save: " + e.message); throw e; }
  }

  const { SpreadsheetApp, spreadsheet, sheetObj } = createWorkbookAdapter({ book, touch, isDate, fmtDate });

  // ---------- other services ----------
  const store = new Map();
  const cache = {
    get: (k) => { const e = store.get(k); if (!e) return null; if (e.t < Date.now()) { store.delete(k); return null; } return e.v; },
    put: (k, v, sec) => { store.set(k, { v: String(v), t: Date.now() + 1000 * Math.min(21600, sec || 600) }); },
    remove: (k) => { store.delete(k); },
    removeAll: (ks) => { (ks || []).forEach((k) => store.delete(k)); },
    getAll: (ks) => { const o = {}; (ks || []).forEach((k) => { const v = cache.get(k); if (v !== null) o[k] = v; }); return o; },
    putAll: (o, sec) => { Object.keys(o).forEach((k) => cache.put(k, o[k], sec)); }
  };
  const props = {
    getProperty: (k) => (k in book.props ? book.props[k] : null),
    setProperty: (k, v) => { book.props[k] = String(v); touch("props"); return props; },
    deleteProperty: (k) => { delete book.props[k]; touch("props"); return props; },
    getProperties: () => Object.assign({}, book.props)
  };
  const lock = { waitLock: () => {}, tryLock: () => true, releaseLock: () => {}, hasLock: () => true };
  function pad(n) { return ("0" + n).slice(-2); }
  function fmtDate(d, f) {
    d = isDate(d) ? d : new Date(d);
    return String(f).replace(/yyyy|MM|dd|HH|mm|ss/g, (t) => ({ yyyy: d.getFullYear(), MM: pad(d.getMonth() + 1), dd: pad(d.getDate()), HH: pad(d.getHours()), mm: pad(d.getMinutes()), ss: pad(d.getSeconds()) }[t]));
  }
  const Utilities = {
    DigestAlgorithm: { SHA_256: "sha256", MD5: "md5", SHA_1: "sha1" }, Charset: { UTF_8: "utf8" },
    computeDigest: (alg, v) => bytes(crypto.createHash(alg).update(String(v), "utf8").digest()),
    computeHmacSha256Signature: (v, k) => bytes(crypto.createHmac("sha256", String(k)).update(String(v), "utf8").digest()),
    getUuid: () => crypto.randomUUID(),
    formatDate: (d, tz, f) => fmtDate(d, f),
    sleep: () => {}
  };
  const UrlFetchApp = {
    // The script reads the public question banks from the site; here they are next to the pages.
    fetch: (url) => {
      const p = decodeURIComponent(new URL(url).pathname).replace(/^\/+/, "");
      const merged = opts.readSite ? opts.readSite(p) : null; // approved questions added to the course banks
      if (merged !== null && merged !== undefined) return { getContentText: () => merged, getResponseCode: () => 200 };
      const full = opts.resolve ? opts.resolve(p) : path.normalize(path.join(WEB, p));
      let text = "", code = 404;
      if (full && (opts.resolve || full.startsWith(path.normalize(WEB + path.sep))) && fs.existsSync(full)) { text = fs.readFileSync(full, "utf8"); code = 200; }
      return { getContentText: () => text, getResponseCode: () => code };
    }
  };
  const ContentService = {
    MimeType: { JSON: "application/json", JAVASCRIPT: "text/javascript", TEXT: "text/plain", ICAL: "text/calendar" },
    createTextOutput: (t) => { const o = { text: String(t == null ? "" : t), mime: "text/plain" }; o.setMimeType = (m) => { o.mime = m; return o; }; o.getContent = () => o.text; return o; }
  };
  const ctx = {
    SpreadsheetApp, Utilities, UrlFetchApp, ContentService,
    CacheService: { getScriptCache: () => cache, getDocumentCache: () => cache },
    PropertiesService: { getScriptProperties: () => props, getDocumentProperties: () => props },
    LockService: { getScriptLock: () => lock, getDocumentLock: () => lock },
    MailApp: { sendEmail: () => {}, getRemainingDailyQuota: () => 0 }, // reports stay in the Reports tab
    Session: { getScriptTimeZone: () => Intl.DateTimeFormat().resolvedOptions().timeZone },
    Logger: { log: (m) => log(String(m)) },
    console
  };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(WEB, "apps_script", "quiz_receiver.gs"), "utf8"), ctx, { filename: "quiz_receiver.gs" });
  // Phones on a local http address cannot share their location, so the location check is off here.
  vm.runInContext("ATT_GEO_MODE = 'off'; SITE = 'http://local'; ATT_LINK_GRACE_SLOTS = 1;", ctx); // a link is good for 30 to 60 s, so a forwarded link or a photo of the screen soon goes stale
  vm.runInContext("NOTIFY_EMAIL = '';", ctx);

  // First run: create the tabs, the settings and a host key.
  if (!spreadsheet.getSheetByName("Key")) { ctx.setup(); log("local workbook created"); }
  if (rosterTab()) students.sync(rosterTab().rows);
  touch(); flush(); // the first run, and an import, are written at once

  function asHost(f) { const k = ctx.hostOk_; ctx.hostOk_ = () => true; try { return f(); } finally { ctx.hostOk_ = k; flush(); } }

  // A phone, a file or the mailbox may write an ID in another form; the script always receives it in the one form.
  const ID_PARAMS = ["id", "student", "studentid", "sid"];
  // Only a value that is a number is a student ID ("id" is also used for assignment and message IDs, which are not).
  const looksLikeStudentId = (v) => /^\s*\d[\d\s]*(\.0+)?\s*$/.test(String(v));
  function idParams(p) { const o = Object.assign({}, p); ID_PARAMS.forEach((k) => { if (typeof o[k] === "string" && looksLikeStudentId(o[k])) o[k] = normalizeId(o[k]); }); return o; }
  function idBody(raw) { try { const u = new URLSearchParams(raw); ID_PARAMS.forEach((k) => { if (u.has(k) && looksLikeStudentId(u.get(k))) u.set(k, normalizeId(u.get(k))); }); return u.toString(); } catch (e) { return raw; } }

  function call(fn, params, postData) {
    tidyIds(); params = idParams(params); if (postData) postData = idBody(postData);
    const e = { parameter: params, parameters: Object.fromEntries(Object.entries(params).map(([k, v]) => [k, [v]])), postData: postData ? { contents: postData, type: "application/x-www-form-urlencoded" } : undefined };
    const out = ctx[fn](e);
    return out && typeof out.text === "string" ? out : ContentService.createTextOutput(out == null ? "" : String(out));
  }

  let enabledModules = opened.enabledModules;
  const refusal = (params, isPost) => moduleAccess.refusal(enabledModules, moduleAccess.requestModule(params, isPost));
  function guardRequest(run, params, isPost) {
    const denied = refusal(params, isPost);
    if (denied) {
      const body = JSON.stringify(denied);
      const callback = !isPost && /^[A-Za-z_][A-Za-z0-9_]*$/.test(params.callback || "") ? params.callback : "";
      return ContentService.createTextOutput(callback ? callback + "(" + body + ")" : body)
        .setMimeType(callback ? "application/javascript" : "application/json");
    }
    return moduleAccess.filterReply(params, run(), enabledModules);
  }

  const api = {
    doGet: (params) => call("doGet", params),
    doPost: (params, raw) => call("doPost", params, raw),
    version: () => version,
    hostKey: () => String(spreadsheet.getSheetByName("Key").getRange(2, 10).getValue()),
    // Host key is held as a salted hash once it is changed from the dashboard; it cannot be shown then.
    hostKeyIsPlain: () => String(spreadsheet.getSheetByName("Key").getRange(2, 10).getValue()).indexOf("sha256:") !== 0,
    run: (name) => ctx[name](),
    setGeoMode: (mode) => { ctx.ATT_GEO_MODE = mode === "enforce" ? "enforce" : "off"; }, // per request: see attendance-guard.js
    // The person at this computer chooses the password without the old one (app screens only; apps_script/src/06-password.gs).
    setPasswordAsOwner: (pw) => { const r = ctx.ownerSetPassword_(pw); flush(); return r; },
    passwordStatus: () => ctx.passwordStatus_(),
    // Class statistics: computed by the script itself (classStats_, studentStats_), with the lecturer's thresholds.
    stats: (p) => asHost(() => ctx.classStats_(Object.assign({}, p || {}))),
    studentNote: (id, text) => { const r = asHost(() => ctx.studentNoteAdd_(id, text)); flush(); return r; },
    studentStats: (p) => asHost(() => ctx.studentStats_(Object.assign({}, p || {}))),
    // Learning Progress: objectives, ask-discuss-revise evidence, group work and each student's progress (learningProgress_).
    progress: (p) => asHost(() => ctx.learningProgress_(Object.assign({}, p || {}))),
    // CM itself is trusted: it calls the script's own class list sync without the host key.
    // A class list that names an ID twice is reported with both rows before the script merges it (it keeps the first).
    rosterSync: (rows, replace) => { try { tidyGrid("Roster", [["Student ID", "Name"]].concat(rows || [])).notices.forEach((n) => notices.record(n)); } catch (e) { /* the merge itself still happens */ } return asHost(() => ctx.rosterSync_({ rows: JSON.stringify(rows), mode: "apply", replace: replace ? "yes" : "" })); },
    // After questions are approved: the script must read the banks again rather than its five-minute copy.
    dropSiteCache: () => { for (const k of [...store.keys()]) if (k.indexOf("site:") === 0) store.delete(k); },
    loadProblem: () => loadProblem,
    // The workbook as the web import writes to it (import-apply.js): a tab by name, created when asked, and a tab's values with their types.
    sheet: (name, create) => spreadsheet.getSheetByName(name) || (create ? spreadsheet.insertSheet(name) : null),
    rows: (name) => { tidyIds(); const s = spreadsheet.getSheetByName(name); return s && s.getLastRow() ? s.getDataRange().getValues() : null; },
    // After an import: Master, Scores and Totals are worked out again from the records, as the script itself does.
    buildFromRoster: () => { const r = require("./build-from-roster").buildFromRoster({ sheet: (n, c) => spreadsheet.getSheetByName(n) || (c ? spreadsheet.insertSheet(n) : null), rows: (n) => { const t = spreadsheet.getSheetByName(n); return t && t.getLastRow() ? t.getDataRange().getValues() : null; } }); flush(); return r; },
    rebuildMarks: () => asHost(() => { ctx.rebuildMaster(); ctx.refreshTotals(); }),
    tabs: () => book.sheets.map((d) => ({ name: d.name, rows: sheetObj(d).getLastRow() })),
    // For course synchronisation (sync/records.js): the raw rows of a tab, and replacing a tab's rows.
    rawRows: (name) => { tidyIds(); const d = book.sheets.find((x) => x.name === name); return d ? d.rows.map((r) => (r || []).slice()) : null; },
    setRows: (name, rows) => { let d = book.sheets.find((x) => x.name === name); if (!d) { d = { name, id: book.sheets.length + 1, rows: [] }; book.sheets.push(d); } d.rows = rows.map((r) => r.slice()); touch(d); },
    tab: (name) => { tidyIds(); const s = spreadsheet.getSheetByName(name); return s ? s.getDataRange().getDisplayValues() : null; },
    flush,
    // The whole course as workbook text (db/codec.js format): what backups and backup files hold.
    exportText: () => { flush(); return toJson({ sheets: book.sheets.map((x) => ({ name: x.name, id: x.id, rows: x.rows })), props: book.props }); },
    close: () => { try { flush(); } finally { clearTimeout(timer); db.close(); } },
    students,
    // Duplicate ID notices: open ones, and the lecturer's answer (the right name). Nothing is merged or changed without being reported here.
    idNotices: () => { tidyIds(); return notices.list(); },
    resolveIdNotice: (tab, id, name) => { tidyIds(); if (tab === "Roster" && name) { const d = rosterTab(); if (d) { const row = d.rows.find((r, i) => i > 0 && normalizeId(r && r[0]) === normalizeId(id)); if (row) { row[1] = String(name); touch(d); } } } const ok = notices.resolve(tab, normalizeId(id), name); flush(); return ok; },
    // Secrets kept sealed beside the records (for example the mailbox keys): never in settings.json, never in an export.
    // A script setting (what PropertiesService holds): read and written by the rules/ modules.
    prop: (k) => (k in book.props ? book.props[k] : null),
    setProp: (k, v) => { if (v == null) delete book.props[k]; else book.props[k] = String(v); touch("props"); }, // null removes the setting
    secret: (k) => ("cm.secret." + k in book.props ? book.props["cm.secret." + k] : null),
    setSecret: (k, v) => { book.props["cm.secret." + k] = String(v); touch("props"); },
    receipts: { get: (k) => { const r = db.raw.prepare("SELECT response FROM receipt WHERE ckey = ?").get(String(k)); return r ? r.response : null; }, put: (k, text) => { db.raw.prepare("INSERT OR IGNORE INTO receipt(ckey, response, at) VALUES(?, ?, ?)").run(String(k), String(text), Date.now()); }, prune: (days) => db.raw.prepare("DELETE FROM receipt WHERE at < ?").run(Date.now() - days * 86400000) },
    enabledModules: () => enabledModules.slice(),
    saveModules: ids => { enabledModules = moduleConfig.save(db, ids); version++; return enabledModules.slice(); },
    moduleRefusal: refusal,
    databaseInfo: () => Object.assign({ file: dbFile }, db.counts())
  };
  // The engine: "script" (the Apps Script, run here) or "js" (the rules/ modules through rules/router.js). Both answer the same requests; "js" needs no script.
  api.site = (p) => { const r = UrlFetchApp.fetch("http://local" + p); if (r.getResponseCode() !== 200) throw new Error("not found: " + p); return JSON.parse(r.getContentText()); }; // the course's JSON files, for the rules
  const engine = opts.engine || process.env.CM_ENGINE || "js";
  const { createRouter } = require("./rules/router"), { fromBackend } = require("./rules/store");
  const site = api.site;
  let router;
  const rules = () => router || (router = createRouter({ store: fromBackend(api), site, version: String(ctx.SCRIPT_VERSION), geoMode: () => ctx.ATT_GEO_MODE, enabledModules: api.enabledModules }));
  const runRules = (params, post) => {
    tidyIds();
    try { const r = (post ? rules().post : rules().get)(idParams(params)); return ContentService.createTextOutput(r.text).setMimeType(r.mime); }
    finally { flush(); }
  };
  if (engine === "js") {
    api.doGet = params => runRules(params, false);
    api.doPost = params => runRules(params, true);
    // The methods the app screens call directly (not through a page request) use the same rules.
    const R = { AU: require("./rules/auth"), CL: require("./rules/class-list"), L: require("./rules/learning") };
    const st = fromBackend(api), ro = () => ({ site, random: () => crypto.randomUUID(), counters: R.AU.memoryCounters(() => new Date()) });
    const done = (f) => { try { return f(); } finally { flush(); } };
    api.setPasswordAsOwner = (pw) => done(() => R.AU.ownerSetPassword(st, pw, ro()));
    api.passwordStatus = () => R.AU.passwordStatus(st);
    api.studentNote = (id, text) => done(() => R.L.noteAdd(st, id, text));
    api.rosterSync = (rows, replace) => { try { tidyGrid("Roster", [["Student ID", "Name"]].concat(rows || [])).notices.forEach((n) => notices.record(n)); } catch (e) { /* the merge itself still happens */ } return done(() => R.CL.sync(st, { rows: JSON.stringify(rows), mode: "apply", replace: replace ? "yes" : "" })); };
    api.engine = "js";
  } else api.engine = "script";
  const fullModuleCount = require("./module-registry").defaultModules().length;
  const useScopedRules = () => engine === "js" || api.enabledModules().length !== fullModuleCount;
  const analyticsStore = () => scopedStore(fromBackend(api), api.enabledModules());
  const classStats = require("./rules/class-stats").classStats, progress = require("./rules/progress");
  const versionOfRules = String(ctx.SCRIPT_VERSION);
  const analyticsOptions = { site };
  const legacy = { stats: api.stats, studentStats: api.studentStats, progress: api.progress };
  api.analyticsStats = p => classStats(analyticsStore(), { ...p }, versionOfRules, analyticsOptions);
  api.stats = p => useScopedRules() ? api.analyticsStats(p) : legacy.stats(p);
  api.studentStats = p => useScopedRules() ? progress.studentStats(analyticsStore(), { ...p }, analyticsOptions, versionOfRules) : legacy.studentStats(p);
  api.progress = p => useScopedRules() ? progress.learningProgress(analyticsStore(), { ...p }, analyticsOptions) : legacy.progress(p);
  const analyticsActions = new Set(["class_stats", "student_stats", "learning_progress", "insights", "outcomes", "my_results"]);
  const { doGet, doPost } = api;
  api.doGet = (params = {}) => guardRequest(() => engine !== "js" && useScopedRules() && analyticsActions.has(params.action) ?
    runRules(params, false) : doGet(params), params, false);
  api.doPost = (params = {}, raw) => {
    const effective = Object.assign({}, params, raw ? Object.fromEntries(new URLSearchParams(raw)) : {});
    return guardRequest(() => {
      if (engine !== "js" && effective.action === "calendar_edit" && effective.kind) {
        try { return rules().post(idParams(effective)); } finally { flush(); }
      }
      if (engine !== "js" && useScopedRules() && analyticsActions.has(effective.action)) return runRules(effective, true);
      return doPost(effective, raw);
    }, effective, true);
  };
  return api;
}

module.exports = { createBackend };
