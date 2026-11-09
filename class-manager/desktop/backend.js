/* Local backend for the Class Manager app.
   Runs the same server script as the Google version (apps_script/quiz_receiver.gs),
   unchanged, against a workbook stored on this computer instead of a Google Sheet.
   The small set of Google services the script uses is provided below. */
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const crypto = require("crypto");

const isDate = (v) => Object.prototype.toString.call(v) === "[object Date]"; // dates made inside the script come from another realm
function bytes(buf) { return Array.from(buf, (b) => (b > 127 ? b - 256 : b)); } // Apps Script byte arrays are signed

function createBackend(opts) {
  const WEB = opts.webRoot;              // where quizzes/ and apps_script/ live
  const FILE = opts.dataFile;            // workbook.json
  const log = opts.log || (() => {});

  // ---------- workbook on disk ----------
  let book = { sheets: [], props: {} };
  try {
    book = JSON.parse(fs.readFileSync(FILE, "utf8"), (k, v) => (v && typeof v === "object" && v.$d ? new Date(v.$d) : v));
    if (!Array.isArray(book.sheets)) book.sheets = [];
    if (!book.props) book.props = {};
  } catch (e) { /* first run: empty workbook */ }

  let dirty = false, timer = null;
  function touch() { dirty = true; if (!timer) timer = setTimeout(flush, 400); if (opts.onChange) opts.onChange(); }
  function flush() {
    timer = null; if (!dirty) return; dirty = false;
    const json = JSON.stringify(book, function (k, v) { const raw = this[k]; return isDate(raw) ? { $d: raw.toISOString() } : v; });
    fs.mkdirSync(path.dirname(FILE), { recursive: true });
    const tmp = FILE + ".tmp";
    fs.writeFileSync(tmp, json);
    fs.renameSync(tmp, FILE);
  }

  // ---------- SpreadsheetApp ----------
  const blank = (v) => v === undefined || v === null;
  function norm(v) { return blank(v) ? "" : v; }
  function Sheet(data) {
    const s = this;
    const rows = () => data.rows;
    function lastRow() { const r = rows(); for (let i = r.length - 1; i >= 0; i--) if (r[i] && r[i].some((v) => v !== "" && !blank(v))) return i + 1; return 0; }
    function lastCol() { let m = 0; rows().forEach((r) => { if (!r) return; for (let j = r.length - 1; j >= 0; j--) if (r[j] !== "" && !blank(r[j])) { m = Math.max(m, j + 1); break; } }); return m; }
    function cell(r, c) { const row = rows()[r - 1]; return row ? norm(row[c - 1]) : ""; }
    function put(r, c, v) {
      const R = rows(); while (R.length < r) R.push([]);
      const row = R[r - 1] || (R[r - 1] = []); while (row.length < c) row.push("");
      row[c - 1] = blank(v) ? "" : v; touch();
    }
    function Range(r, c, nr, nc) {
      nr = nr || 1; nc = nc || 1;
      if (r < 1 || c < 1 || nr < 1 || nc < 1) throw new Error("The coordinates of the range are outside the dimensions of the sheet.");
      let px = null;
      const rg = {
        getValue: () => cell(r, c),
        getValues: () => { const o = []; for (let i = 0; i < nr; i++) { const a = []; for (let j = 0; j < nc; j++) a.push(cell(r + i, c + j)); o.push(a); } return o; },
        getDisplayValues: () => rg.getValues().map((a) => a.map((v) => (isDate(v) ? fmtDate(v, v.getHours() || v.getMinutes() || v.getSeconds() ? "dd/MM/yyyy HH:mm:ss" : "dd/MM/yyyy") : String(v)))),
        setValue: (v) => { put(r, c, v); return px; },
        setValues: (vals) => {
          if (!Array.isArray(vals) || vals.length !== nr || vals.some((a) => !Array.isArray(a) || a.length !== nc)) throw new Error("The number of rows or columns in the data does not match the range.");
          vals.forEach((a, i) => a.forEach((v, j) => put(r + i, c + j, v))); return px;
        },
        clearContent: () => { for (let i = 0; i < nr; i++) for (let j = 0; j < nc; j++) if (rows()[r + i - 1]) put(r + i, c + j, ""); return px; },
        getRow: () => r, getColumn: () => c, getNumRows: () => nr, getNumColumns: () => nc
      };
      // Formatting has no meaning on disk: every set* call is accepted and ignored.
      px = new Proxy(rg, { get: (t, k) => (k in t ? t[k] : typeof k === "string" && /^(set|clear|merge|break|protect|activate)/.test(k) ? () => px : undefined) });
      return px;
    }
    let sp = null;
    Object.assign(s, {
      getName: () => data.name,
      getLastRow: lastRow, getLastColumn: lastCol,
      getMaxRows: () => Math.max(1000, rows().length), getMaxColumns: () => Math.max(26, lastCol()),
      insertRowsAfter: () => sp, insertColumnsAfter: () => sp,
      getRange: (r, c, nr, nc) => { if (typeof r === "string") throw new Error("A1 ranges are not supported"); return Range(r, c, nr, nc); },
      getDataRange: () => Range(1, 1, Math.max(1, lastRow()), Math.max(1, lastCol())),
      appendRow: (vals) => { const r = lastRow() + 1; vals.forEach((v, j) => put(r, j + 1, v)); return sp; },
      deleteRow: (r) => { rows().splice(r - 1, 1); touch(); return sp; },
      deleteRows: (r, n) => { rows().splice(r - 1, n); touch(); return sp; },
      deleteColumn: (c) => { rows().forEach((row) => row && row.splice(c - 1, 1)); touch(); return sp; },
      clear: () => { data.rows = []; touch(); return sp; },
      clearContents: () => { data.rows = []; touch(); return sp; },
      getSheetId: () => data.id
    });
    sp = new Proxy(s, { get: (t, k) => (k in t ? t[k] : typeof k === "string" && /^(set|hide|show|protect|activate|autoResize)/.test(k) ? () => sp : undefined) });
    return sp;
  }
  const sheetObjs = new Map();
  function sheetObj(d) { if (!sheetObjs.has(d)) sheetObjs.set(d, new Sheet(d)); return sheetObjs.get(d); }
  const ui = {
    alert: () => "YES", Button: { YES: "YES", NO: "NO", OK: "OK" }, ButtonSet: { YES_NO: "YES_NO", OK: "OK" },
    createMenu: function () { const m = { addItem: () => m, addSeparator: () => m, addToUi: () => {} }; return m; }
  };
  const spreadsheet = {
    getSheetByName: (n) => { const d = book.sheets.find((x) => x.name === n); return d ? sheetObj(d) : null; },
    insertSheet: (n) => {
      if (book.sheets.some((x) => x.name === n)) throw new Error('A sheet with the name "' + n + '" already exists.');
      const d = { name: n, id: book.sheets.length + 1, rows: [] }; book.sheets.push(d); touch(); return sheetObj(d);
    },
    getSheets: () => book.sheets.map(sheetObj),
    getName: () => "Class Manager (local)", getId: () => "local", getUrl: () => ""
  };
  const SpreadsheetApp = { getActiveSpreadsheet: () => spreadsheet, getActive: () => spreadsheet, getUi: () => ui, flush: () => {} };

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
    setProperty: (k, v) => { book.props[k] = String(v); touch(); return props; },
    deleteProperty: (k) => { delete book.props[k]; touch(); return props; },
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
      const full = path.normalize(path.join(WEB, p));
      let text = "", code = 404;
      if (full.startsWith(path.normalize(WEB + path.sep)) && fs.existsSync(full)) { text = fs.readFileSync(full, "utf8"); code = 200; }
      return { getContentText: () => text, getResponseCode: () => code };
    }
  };
  const ContentService = {
    MimeType: { JSON: "application/json", JAVASCRIPT: "text/javascript", TEXT: "text/plain" },
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
  vm.runInContext("ATT_GEO_MODE = 'off'; SITE = 'http://local';", ctx);
  vm.runInContext("NOTIFY_EMAIL = '';", ctx);

  // First run: create the tabs, the settings and a host key.
  if (!spreadsheet.getSheetByName("Key")) { ctx.setup(); log("local workbook created"); }
  flush();

  function asHost(f) { const k = ctx.hostOk_; ctx.hostOk_ = () => true; try { return f(); } finally { ctx.hostOk_ = k; flush(); } }

  function call(fn, params, postData) {
    const e = { parameter: params, parameters: Object.fromEntries(Object.entries(params).map(([k, v]) => [k, [v]])), postData: postData ? { contents: postData, type: "application/x-www-form-urlencoded" } : undefined };
    const out = ctx[fn](e);
    return out && typeof out.text === "string" ? out : ContentService.createTextOutput(out == null ? "" : String(out));
  }

  return {
    doGet: (params) => call("doGet", params),
    doPost: (params, raw) => call("doPost", params, raw),
    hostKey: () => String(spreadsheet.getSheetByName("Key").getRange(2, 10).getValue()),
    // Host key is held as a salted hash once it is changed from the dashboard; it cannot be shown then.
    hostKeyIsPlain: () => String(spreadsheet.getSheetByName("Key").getRange(2, 10).getValue()).indexOf("sha256:") !== 0,
    run: (name) => ctx[name](),
    // The app itself is trusted: it calls the script's own class list sync without the host key.
    rosterSync: (rows, replace) => asHost(() => ctx.rosterSync_({ rows: JSON.stringify(rows), mode: "apply", replace: replace ? "yes" : "" })),
    tabs: () => book.sheets.map((d) => ({ name: d.name, rows: sheetObj(d).getLastRow() })),
    tab: (name) => { const s = spreadsheet.getSheetByName(name); return s ? s.getDataRange().getDisplayValues() : null; },
    flush
  };
}

module.exports = { createBackend };
