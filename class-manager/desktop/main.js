/* Class Manager desktop app.
   - Serves the class-manager pages from this computer on the local network, so students on the
     same Wi-Fi open the quiz and check-in pages on their phones.
   - Runs the quiz and attendance server on this computer (backend.js): results, attendance and
     marks are stored in a local workbook, created automatically on first launch.
   - Optional: sign in with Google to keep a copy of every tab in a Google Sheet in the lecturer's
     own Drive (google.js).
   - Many courses at once (courses.js): each course has its own folder, workbook, settings, Google Sheet
     and pages under /c/<id>/. Every window belongs to one course, read from its address, and every
     request from it acts on that course only. */
"use strict";
const { app, BrowserWindow, Menu, ipcMain, shell, dialog, safeStorage } = require("electron");
const http = require("http");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { createBackend } = require("./backend");
const { createGoogle } = require("./google");
const { createLinkedFolder } = require("./linked-folder");
const { createCourseSync } = require("./sync/course-sync");
const { createAuthoring } = require("./authoring");
const { createTunnel, createLimiter } = require("./tunnel");
const { createCourse } = require("./course");
const { readTable } = require("./table");
const names = require("./names");
const excel = require("./excel");
const webImport = require("./import-ipc");
const { execFile } = require("child_process");
const courses = require("./courses");
const { SECURITY_DEFAULTS, cleanSecurity, lecturerRefusal } = require("./access");
const { createVault, createBackups, exportFile, importFile } = require("./vault");

const WEB = app.isPackaged ? path.join(process.resourcesPath, "web") : path.join(__dirname, "..");
const ROOT = () => app.getPath("userData");
const SETTINGS_FILE = () => path.join(ROOT(), "settings.json"); // the app's own settings: port and text size
const TEMPLATES = app.isPackaged ? path.join(process.resourcesPath, "web", "templates") : path.join(__dirname, "..", "templates");
const DEFAULTS = { courseCode: "", courseTitle: "", institution: "", lecturer: "", semester: "", startDate: "", endDate: "", contact: "", accent: "", logo: "", notice: "", noticeLinkLabel: "", noticeLinkUrl: "",
  scriptUrl: "", setupSeen: false }; // one course's settings
const APP_DEFAULTS = Object.assign({ port: 8143, zoom: 1 }, SECURITY_DEFAULTS);
const TYPES = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".webp": "image/webp",
  ".pdf": "application/pdf", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation", ".md": "text/markdown; charset=utf-8", ".txt": "text/plain; charset=utf-8", ".woff2": "font/woff2", ".webmanifest": "application/manifest+json"
};

let appSettings, server = null, port = 0, win = null, registry = null;
const ctxs = new Map(); // course id -> { id, settings, course, authoring, backend, google }, made on first use
let tunnel = null, tunnelServer = null, tunnelPort = 0;
let vault = null; // encrypts each course's workbook on disk (vault.js), made when the app is ready
const BACKUP_EVERY_MS = 4 * 3600000;
function makeVault() {
  const kc = safeStorage.isEncryptionAvailable();
  return createVault({ keyFile: path.join(ROOT(), "data.key"), protected: kc,
    protect: (b) => (kc ? safeStorage.encryptString(b.toString("base64")) : Buffer.from(b.toString("base64"), "utf8")),
    unprotect: (b) => Buffer.from(kc ? safeStorage.decryptString(b) : b.toString("utf8"), "base64") });
}
const allowRemote = createLimiter(240); // requests per minute per visitor through the internet address

// ---------- settings ----------
function loadAppSettings() {
  const s = Object.assign({}, APP_DEFAULTS, readJson(SETTINGS_FILE(), {}));
  return Object.assign({ port: Math.min(65535, Math.max(1024, Number(s.port) || APP_DEFAULTS.port)), zoom: clampZoom(s.zoom) }, cleanSecurity(s));
}
function saveAppSettings(o) {
  appSettings = Object.assign({ port: o.port == null ? appSettings.port : Math.min(65535, Math.max(1024, Number(o.port) || APP_DEFAULTS.port)), zoom: clampZoom(o.zoom == null ? appSettings.zoom : o.zoom) }, cleanSecurity(o, appSettings));
  fs.mkdirSync(ROOT(), { recursive: true });
  fs.writeFileSync(SETTINGS_FILE(), JSON.stringify(appSettings, null, 1));
}
function readJson(f, d) { try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch (e) { return d; } }
function loadCourseSettings(id) { return Object.assign({}, DEFAULTS, readJson(registry.dirs(id).settings, {})); }
// Saves one course's settings. Fields left out keep their value.
function saveSettings(c, s) {
  const settings = c.settings;
  const url = String(s.scriptUrl == null ? settings.scriptUrl || "" : s.scriptUrl).trim();
  const txt = (k, n) => String(s[k] == null ? settings[k] || "" : s[k]).trim().slice(0, n);
  const day = (k) => (/^\d{4}-\d{2}-\d{2}$/.test(String(s[k] == null ? settings[k] || "" : s[k])) ? String(s[k] == null ? settings[k] : s[k]) : "");
  const clean = {
    courseCode: txt("courseCode", 40), courseTitle: txt("courseTitle", 120), institution: txt("institution", 120),
    lecturer: txt("lecturer", 120), semester: txt("semester", 80), startDate: day("startDate"), endDate: day("endDate"),
    contact: txt("contact", 160), notice: txt("notice", 400), noticeLinkLabel: txt("noticeLinkLabel", 80),
    noticeLinkUrl: /^https:\/\/[^\s"<>]+$/.test(txt("noticeLinkUrl", 400)) ? txt("noticeLinkUrl", 400) : "",
    accent: /^#[0-9a-f]{6}$/i.test(String(s.accent == null ? settings.accent : s.accent)) ? String(s.accent == null ? settings.accent : s.accent) : "",
    logo: s.logo == null ? settings.logo || "" : String(s.logo),
    setupSeen: s.setupSeen == null ? !!settings.setupSeen : !!s.setupSeen,
    scriptUrl: /^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(url) ? url : ""
  };
  const f = registry.dirs(c.id).settings;
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, JSON.stringify(clean, null, 1));
  c.settings = Object.assign({}, DEFAULTS, clean);
  registry.update(c.id, { code: clean.courseCode, title: clean.courseTitle, term: clean.semester }); // the course list shows the same names
}
// What the app's screens see as "settings": the course's settings with the app's port.
const shownSettings = (c) => Object.assign({}, c.settings, { port: appSettings.port });

// Google OAuth client of this build (registered once by the publisher; see desktop/README.md).
function oauthClient() {
  for (const f of [path.join(__dirname, "google-oauth.json"), path.join(ROOT(), "google-oauth.json")]) {
    try { const j = JSON.parse(fs.readFileSync(f, "utf8")); const c = j.installed || j; if (c.client_id) return c; } catch (e) { /* not set */ }
  }
  return {};
}
// Google sign-in tokens, encrypted with the system keychain where it is available.
// One sign-in for the app; each course keeps the address of its own Google Sheet in the same file (courses.js).
const TOKENS = () => path.join(ROOT(), "google.bin");
function loadTokens() {
  try { const b = fs.readFileSync(TOKENS()); return JSON.parse(safeStorage.isEncryptionAvailable() ? safeStorage.decryptString(b) : b.toString("utf8")); } catch (e) { return {}; }
}
function saveTokens(o) {
  const s = JSON.stringify(o || {});
  fs.writeFileSync(TOKENS(), safeStorage.isEncryptionAvailable() ? safeStorage.encryptString(s) : Buffer.from(s, "utf8"), { mode: 0o600 });
}

// Anthropic API key for summaries and question generation, encrypted with the system keychain where it is available.
// It never leaves this computer except in requests to the Anthropic API.
const AKEY = () => path.join(ROOT(), "anthropic.bin");
function loadApiKey() {
  try { const b = fs.readFileSync(AKEY()); return safeStorage.isEncryptionAvailable() ? safeStorage.decryptString(b) : b.toString("utf8"); } catch (e) { return ""; }
}
function saveApiKey(k) {
  if (!k) { try { fs.unlinkSync(AKEY()); } catch (e) { /* none */ } return; }
  fs.writeFileSync(AKEY(), safeStorage.isEncryptionAvailable() ? safeStorage.encryptString(k) : Buffer.from(k, "utf8"), { mode: 0o600 });
}

// ---------- network ----------
function lanAddresses() {
  const out = [];
  for (const [name, list] of Object.entries(os.networkInterfaces())) for (const a of list || []) {
    if (a.family === "IPv4" && !a.internal && !/^169\.254\./.test(a.address)) out.push({ name, address: a.address });
  }
  const rank = (a) => (/^(wi-?fi|wlan|en0|wlp)/i.test(a.name) ? 0 : /^(192\.168|10\.|172\.(1[6-9]|2\d|3[01]))/.test(a.address) ? 1 : 2);
  return out.sort((a, b) => rank(a) - rank(b));
}
function baseUrl() { const lan = lanAddresses()[0]; return "http://" + (lan ? lan.address : "127.0.0.1") + ":" + port + "/"; }
function isThisComputer(req) {
  const ra = String(req.socket.remoteAddress || "").replace(/^::ffff:/, "");
  return ra === "127.0.0.1" || ra === "::1" || lanAddresses().some((a) => a.address === ra);
}

// config.js is generated from the course's settings. Without an Apps Script address the pages use this computer's server.
function publicUrl() { const t = tunnel && tunnel.status(); return t && t.state === "on" ? t.url.replace(/\/?$/, "/") : ""; }
function configJs(c, req, remote, r) {
  const src = fs.readFileSync(path.join(WEB, "config.js"), "utf8");
  const host = /^[\w.:\[\]-]+$/.test(req.headers.host || "") ? req.headers.host : "127.0.0.1:" + port;
  const s = c.settings;
  const cm = { courseId: c.id, courseCode: s.courseCode, courseTitle: s.courseTitle, institution: s.institution, lecturer: s.lecturer, semester: s.semester,
    contact: s.contact, accent: s.accent, logo: s.logo, notice: s.notice ? { text: s.notice, linkLabel: s.noticeLinkLabel, linkUrl: s.noticeLinkUrl } : null,
    scriptUrl: s.scriptUrl || (remote ? "https://" : "http://") + host + (r.prefixed ? r.prefix : "/") + "exec", desktop: true };
  if (publicUrl()) cm.publicBase = publicUrl() + r.prefix.slice(1); // QR codes and links for students use the internet address while it is on
  // Every course but the default one keeps its own browser storage on students' phones and in the app's windows.
  return courses.configScript(src, cm, c.id === registry.defaultId() ? "" : "cm@" + c.id + ":");
}

function readBody(req, max) {
  return new Promise((resolve, reject) => {
    let n = 0; const parts = [];
    req.on("data", (c) => { n += c.length; if (n > max) { reject(new Error("too large")); req.destroy(); } else parts.push(c); });
    req.on("end", () => resolve(Buffer.concat(parts).toString("utf8")));
    req.on("error", reject);
  });
}

async function handle(req, res, remote) {
  if (remote) { // came through the internet address: never the app's own screens, and a limit per visitor
    const who = String(req.headers["cf-connecting-ip"] || req.headers["x-forwarded-for"] || "?").split(",")[0].trim();
    if (tunnel) tunnel.note("request", who);
    if (!allowRemote(who)) { if (tunnel) tunnel.note("limited"); res.writeHead(429, { "Content-Type": "text/plain", "Retry-After": "60" }); return res.end("Too many requests. Wait a minute and try again."); }
  }
  let u;
  try { u = new URL(req.url, "http://x"); } catch (e) { res.writeHead(400); return res.end(); }
  let raw;
  try { raw = decodeURIComponent(u.pathname); } catch (e) { res.writeHead(400); return res.end(); }
  if (raw.startsWith("/app/") && !remote && isThisComputer(req)) { // the app's screens always belong to a course
    res.writeHead(302, { Location: "/c/" + registry.active() + raw + u.search }); return res.end();
  }
  // Which course: /c/<id>/... or, without the prefix, the default course. Archived and unknown courses are not served.
  const r = registry.route(raw);
  if (r.redirect) { res.writeHead(302, { Location: r.redirect }); return res.end(); }
  if (r.notFound) { res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }); return res.end("This course is not available on this computer."); }
  const c = ctx(r.id);
  let p = r.rest;
  if (p === "/exec") {
    // The quiz and attendance server of this course: same requests as the Google web app.
    try {
      const params = Object.fromEntries(u.searchParams);
      let out;
      if (req.method === "POST") {
        const body = await readBody(req, 200000);
        Object.assign(params, Object.fromEntries(new URLSearchParams(body)));
        const refused = lecturerRefusal(params, { remote, thisComputer: !remote && isThisComputer(req) }, appSettings);
        if (refused) { if (tunnel && remote) tunnel.note("lecturer"); res.writeHead(200, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }); return res.end(JSON.stringify(refused)); }
        out = c.backend.doPost(params, body);
      } else out = c.backend.doGet(params);
      res.writeHead(200, { "Content-Type": out.mime + "; charset=utf-8", "Cache-Control": "no-store", "Access-Control-Allow-Origin": "*" });
      return res.end(out.text);
    } catch (e) {
      console.error(e); res.writeHead(500, { "Content-Type": "text/plain" }); return res.end("server error");
    }
  }
  if (req.method !== "GET" && req.method !== "HEAD") { res.writeHead(405); return res.end(); }
  if (p === "/") p = "/index.html";
  if (p === "/calendar.ics") { // the course calendar as a feed that calendar programs on the network can subscribe to
    const out = c.backend.doGet({ action: "calendar_ics", course: (c.settings.courseCode || "Class") + " calendar" });
    res.writeHead(200, { "Content-Type": "text/calendar; charset=utf-8", "Content-Disposition": 'inline; filename="calendar.ics"', "Cache-Control": "no-cache" });
    return res.end(out.text);
  }
  if (/^\/(quizzes\/lecture\d+|apps_script\/live_quizzes)\.json$/.test(p)) { // course banks with the lecturer's approved questions added
    const merged = c.authoring.siteFile(p);
    if (merged !== null) { res.writeHead(200, { "Content-Type": TYPES[".json"], "Cache-Control": "no-cache" }); return res.end(merged); }
  }
  if (p === "/data/portal.json") { // titles, handouts and practice lists follow the course's lectures and banks
    const extra = c.authoring.banks().filter((b) => b.base + b.added > 0).map((b) => b.lecture);
    res.writeHead(200, { "Content-Type": TYPES[".json"], "Cache-Control": "no-cache" }); return res.end(JSON.stringify(c.course.portal(extra)));
  }
  if (p === "/config.js") { res.writeHead(200, { "Content-Type": TYPES[".js"], "Cache-Control": "no-store" }); return res.end(configJs(c, req, remote, r)); }
  if (p.startsWith("/app/")) { // the app's own screens are for this computer only
    if (remote || !isThisComputer(req)) { res.writeHead(403); return res.end("Not available"); }
    return sendFile(res, path.join(__dirname, "app", p.slice(5)), path.join(__dirname, "app"));
  }
  if (p.startsWith("/apps_script/") && !p.endsWith(".json")) { res.writeHead(404); return res.end(); }
  if (/(^|\/)\.(git|env|ssh|DS_Store)(\/|$)/i.test(p)) { res.writeHead(404); return res.end(); } // a linked folder may be a repository
  const file = c.course.resolve(p);
  if (file) return sendFile(res, file, path.dirname(file));
  const tpl = c.course.page(p);
  if (tpl !== null) { res.writeHead(200, { "Content-Type": TYPES[".html"], "Cache-Control": "no-cache" }); return res.end(tpl); }
  res.writeHead(404, { "Content-Type": "text/plain" }); res.end("Not found");
}
function sendFile(res, file, root) {
  const full = path.normalize(file);
  if (!full.startsWith(path.normalize(root + path.sep))) { res.writeHead(403); return res.end(); }
  fs.stat(full, (err, st) => {
    if (err || !st.isFile()) { res.writeHead(404, { "Content-Type": "text/plain" }); return res.end("Not found"); }
    res.writeHead(200, { "Content-Type": TYPES[path.extname(full).toLowerCase()] || "application/octet-stream", "Content-Length": st.size, "Cache-Control": "no-cache" });
    fs.createReadStream(full).pipe(res);
  });
}
function listen(p, host, remote) {
  return new Promise((resolve, reject) => {
    const s = http.createServer((q, r) => { handle(q, r, remote).catch(() => { try { r.writeHead(500); r.end(); } catch (e) {} }); });
    s.once("error", reject);
    s.listen(p, host || "0.0.0.0", () => resolve(s));
  });
}
// The internet address reaches only this second server, which listens on this computer alone and marks every request as remote.
async function startTunnel() {
  if (!tunnelServer) { tunnelServer = await listen(0, "127.0.0.1", true); tunnelPort = tunnelServer.address().port; }
  return tunnel.start(tunnelPort, { hours: appSettings.tunnelHours });
}
function stopTunnel() { return tunnel ? tunnel.stop() : { state: "off" }; }
async function restartServer() {
  if (server) await new Promise((r) => server.close(() => r()));
  try { server = await listen(appSettings.port); } catch (e) { server = await listen(0); } // port in use: any free port
  port = server.address().port;
}

// ---------- zoom ----------
// One text size for every window, kept between 80% and 200% and remembered in the settings.
// It is set again on every page load, so a zoom left over from an earlier version never shrinks the app.
const ZOOM_STEPS = [0.8, 0.9, 1, 1.1, 1.25, 1.4, 1.6, 1.8, 2];
function clampZoom(z) { z = Number(z) || 1; return Math.min(2, Math.max(0.8, Math.round(z * 100) / 100)); }
function applyZoom(w) { try { w.webContents.setZoomFactor(clampZoom(appSettings.zoom)); } catch (e) {} }
function setZoom(dir) {
  const now = clampZoom(appSettings.zoom);
  let next = 1;
  if (dir > 0) next = ZOOM_STEPS.find((z) => z > now + 0.001) || 2;
  else if (dir < 0) next = ZOOM_STEPS.slice().reverse().find((z) => z < now - 0.001) || 0.8;
  saveAppSettings({ zoom: next });
  for (const w of BrowserWindow.getAllWindows()) applyZoom(w);
}
function zoomKeys(w) {
  w.webContents.on("before-input-event", (e, input) => {
    if (input.type !== "keyDown" || !(input.control || input.meta) || input.alt) return;
    const k = input.key;
    if (k === "=" || k === "+" || input.code === "NumpadAdd") { e.preventDefault(); setZoom(1); }
    else if (k === "-" || k === "_" || input.code === "NumpadSubtract") { e.preventDefault(); setZoom(-1); }
    else if (k === "0" || input.code === "Numpad0") { e.preventDefault(); setZoom(0); }
  });
  w.webContents.on("did-finish-load", () => applyZoom(w));
  w.webContents.on("zoom-changed", (e, d) => setZoom(d === "in" ? 1 : -1)); // Ctrl or Cmd with the mouse wheel or trackpad
}
function appMenu() {
  const mac = process.platform === "darwin";
  const zoomItems = [
    { label: "Actual Size", accelerator: "CmdOrCtrl+0", registerAccelerator: false, click: () => setZoom(0) },
    { label: "Zoom In", accelerator: "CmdOrCtrl+Plus", registerAccelerator: false, click: () => setZoom(1) },
    { label: "Zoom Out", accelerator: "CmdOrCtrl+-", registerAccelerator: false, click: () => setZoom(-1) },
    { type: "separator" }, { role: "togglefullscreen" }
  ];
  const tpl = [];
  if (mac) tpl.push({ role: "appMenu" });
  tpl.push({ role: "editMenu" }, { label: "View", submenu: zoomItems }, { role: "windowMenu" });
  Menu.setApplicationMenu(Menu.buildFromTemplate(tpl));
}

// ---------- windows ----------
function secureWindow(w) {
  w.removeMenu();
  zoomKeys(w);
  w.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith(baseUrl()) && !/\.pdf($|[?#])/i.test(url)) return { action: "allow" };
    shell.openExternal(url); return { action: "deny" };
  });
  w.webContents.on("will-navigate", (e, url) => { if (!url.startsWith(baseUrl())) { e.preventDefault(); if (/^https?:/.test(url)) shell.openExternal(url); } });
}
function newWindow(page, w, h) {
  const bw = new BrowserWindow({ width: w || 1280, height: h || 860, title: "Class Manager", icon: path.join(__dirname, "app", "icon-512.png"),
    webPreferences: { preload: path.join(__dirname, "preload.js"), contextIsolation: true, sandbox: true, nodeIntegration: false } });
  secureWindow(bw); bw.loadURL(baseUrl() + page); return bw;
}

// ---------- courses ----------
// One context per course, made on first use and kept while the app runs, so a class can go on in one course
// (students checking in, a quiz running) while the lecturer looks at another.
function makeCtx(id) {
  const d = registry.dirs(id);
  const c = { id, settings: loadCourseSettings(id) };
  c.course = createCourse({ dir: d.course, web: WEB, templates: TEMPLATES });
  c.authoring = createAuthoring({ dir: d.authoring, webRoot: WEB, resolve: c.course.resolve, bankNumbers: c.course.bankNumbers, loadKey: loadApiKey, saveKey: saveApiKey,
    keyIsEncrypted: () => safeStorage.isEncryptionAvailable(), log: (m) => console.log("[authoring " + id + "]", m) });
  const oc = oauthClient();
  c.google = createGoogle({
    clientId: oc.client_id || "", clientSecret: oc.client_secret || "",
    load: () => courses.courseTokens(loadTokens(), id), save: (o) => saveTokens(courses.storeCourseTokens(loadTokens(), id, o)),
    openBrowser: (u) => shell.openExternal(u), log: (m) => console.log("[google " + id + "]", m),
    tabs: () => c.backend.tabs(), tab: (n) => c.backend.tab(n), title: () => "Class Manager: " + (c.settings.courseCode || "class") + " results"
  });
  c.backend = createBackend({ readSite: (rel) => c.authoring.siteFile(rel), webRoot: WEB, resolve: c.course.resolve, dataFile: d.workbook, vault,
    log: (m) => console.log("[backend " + id + "]", m), onChange: () => { if (c.google) c.google.changed(); if (c.sync) c.sync.changed(); } });
  c.backups = createBackups({ dir: path.join(d.root, "backups"), workbook: d.workbook, vault });
  c.linked = createLinkedFolder({ dir: d.root, label: () => c.settings.courseCode || id, content: () => backupContent(c), protect: vault.protectBytes, unprotect: vault.unprotectBytes, protected: vault.protected });
  c.sync = createCourseSync({ dir: d.root, contentDir: d.course, notesDir: path.join(d.root, "notes"), linked: c.linked, backend: c.backend, vault, deviceName: require("os").hostname(), log: (m) => console.log("[sync " + id + "]", m) });
  c.sync.start(); // local and online at the same time: a round now, then every two minutes, and a few seconds after each change
  try { c.lastBackup = c.backups.make(""); } catch (e) { c.lastBackup = { ok: false, why: e.message }; } // a backup each time the course is opened, checked at once
  return c;
}
function ctx(id) {
  if (!ctxs.has(id)) ctxs.set(id, makeCtx(id));
  return ctxs.get(id);
}
function closeCtx(id) { // after the course's folder changes: saved now, made again on next use
  const c = ctxs.get(id); if (!c) return;
  try { c.sync.stop(); } catch (e) {}
  try { c.backend.flush(); } catch (e) {}
  ctxs.delete(id);
}
// The course a window belongs to, from its address (/c/<id>/...). A window never acts on another course.
function ctxOf(e) {
  const id = registry.idFromUrl(e.sender.getURL()) || registry.active();
  return ctx(id);
}
const winOf = (e) => BrowserWindow.fromWebContents(e.sender) || win;
// An IPC handler that receives the window's course first.
const on = (ch, fn) => ipcMain.handle(ch, (e, ...a) => fn(ctxOf(e), e, ...a));
const coursePrefix = (c) => "c/" + c.id + "/";
const studentHome = (c) => baseUrl() + coursePrefix(c);
function tunnelFor(c) { // the internet address of this course's pages
  const t = tunnel ? Object.assign({}, tunnel.status()) : { state: "off" };
  if (t.url) t.url = t.url.replace(/\/?$/, "/") + coursePrefix(c);
  return t;
}
// What is happening in class right now in one course: the open (or latest) attendance session and any quiz in progress.
// Read straight from the course's workbook; nothing is estimated.
function liveOf(c) {
  const out = { attendance: null, quizzes: [], roster: 0 };
  const backend = c.backend;
  try {
    const st = backend.run("attStatus_");
    const ses = st && st.session;
    const ctl = backend.tab("Attendance_Control") || [];
    const open = ctl.slice(1).filter((r) => String(r[2]).trim() === "Open").pop();
    if (ses) out.attendance = { label: ses.label, status: ses.status, present: ses.present || 0, waiting: ses.waiting || 0, notOnList: ses.notOnList || 0,
      rosterSize: ses.rosterSize || 0, opened: open ? String(open[3]) : "" };
  } catch (e) { /* no attendance tabs yet */ }
  try { const r = backend.tab("Roster"); out.roster = r ? Math.max(0, r.filter((x) => String(x[0]).trim()).length - 1) : 0; } catch (e) {}
  try {
    const rows = (backend.tab("Quiz_Control") || []).slice(1), pres = (backend.tab("Presence") || []).slice(1), now = Date.now();
    for (const r of rows) {
      const code = String(r[0]).trim().toUpperCase(); let state = String(r[1]).trim().toLowerCase();
      if (state === "running" && String(r[15]).trim().toLowerCase() === "timed" && now >= Number(r[3])) state = "ended";
      if (!code || ["lobby", "running", "paused"].indexOf(state) < 0) continue;
      const ids = new Set(pres.filter((p) => String(p[3]).trim().toUpperCase() === code).map((p) => String(p[1]).trim()));
      out.quizzes.push({ code, title: String(r[9] || ""), state, joined: ids.size, updated: String(r[10] || "") });
    }
  } catch (e) { /* no quiz yet */ }
  return out;
}
// The course list for the dropdown. A course that is not loaded has nothing running.
function courseList(current) {
  return registry.list().map((x) => {
    let live = false;
    if (ctxs.has(x.id) && !x.archived) { try { const l = liveOf(ctxs.get(x.id)); live = !!((l.attendance && l.attendance.status === "Open") || l.quizzes.length); } catch (e) {} }
    return { id: x.id, code: x.code, title: x.title, term: x.term, archived: !!x.archived, source: x.source, current: x.id === current, live, isDefault: x.id === registry.defaultId(),
      repo: x.source && x.source.kind === "folder" ? repoInfo(x.source.path) : null };
  });
}
// A linked folder that is a Git repository: its remote address and branch, read from .git without running Git.
function repoInfo(dir) {
  try {
    const cfg = fs.readFileSync(path.join(dir, ".git", "config"), "utf8");
    const m = cfg.match(/\[remote "origin"\][^[]*?url\s*=\s*(\S+)/);
    const head = fs.readFileSync(path.join(dir, ".git", "HEAD"), "utf8").trim();
    const b = head.match(/^ref: refs\/heads\/(.+)$/);
    return { url: m ? m[1].replace(/^git@github\.com:/, "https://github.com/").replace(/\.git$/, "") : "", branch: b ? b[1] : "" };
  } catch (e) { return null; }
}
// The screen a course opens on: its setup until that has been seen once, then the home screen.
const startPage = (c) => coursePrefix(c) + (c.settings.setupSeen ? "app/home.html" : "app/setup.html");

// ---------- the app's own screens ----------
function info(c) {
  return {
    settings: shownSettings(c), base: studentHome(c), version: app.getVersion(), courseId: c.id,
    addresses: lanAddresses().map((a) => "http://" + a.address + ":" + port + "/" + coursePrefix(c)),
    tunnel: tunnelFor(c),
    hostKey: c.backend.hostKeyIsPlain() ? c.backend.hostKey() : "",
    tabs: c.backend.tabs(), google: c.google.status(), dataFolder: registry.dirs(c.id).root, contentFolder: registry.dirs(c.id).course, setup: setupState(c)
  };
}
// What the first-launch setup of a course still needs. Every step can be skipped and finished later.
function setupState(c) {
  const roster = (c.backend.tabs().find((t) => t.name === "Roster") || { rows: 1 }).rows - 1;
  const steps = {
    course: !!c.settings.courseCode,
    classList: roster > 0,
    materials: c.course.hasContent() || c.authoring.listDocs().length > 0
  };
  return { steps, roster: Math.max(0, roster), complete: steps.course && steps.classList && steps.materials, seen: !!c.settings.setupSeen };
}
function parseClassList(text) {
  // One student per line: ID, then an optional name (or first name and last name), separated by a comma, semicolon or tab. A header line is skipped.
  return String(text || "").split(/\r?\n/).map((l) => l.split(/[,;\t]/).map((x) => x.replace(/^"|"$/g, "").trim()))
    .filter((r) => r[0] && /\d{4,12}/.test(r[0].replace(/\D/g, ""))).map((r) => [r[0].replace(/\D/g, ""), names.rowName(r)]);
}
function csvCell(v) { v = String(v == null ? "" : v); return /[",\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }

on("cm:info", (c) => info(c));
on("cm:live", (c) => liveOf(c));
// Class statistics for the In Class summary and the Class Statistics screen, computed in the backend from the course's workbook.
const statOpts = (o) => { const p = {}; for (const k of ["effort", "perf", "idle", "misses", "id"]) if (o && o[k] !== undefined && o[k] !== "") p[k] = String(o[k]).slice(0, 20); return p; };
on("cm:stats", (c, e, o) => { try { return c.backend.stats(statOpts(o)); } catch (err) { return { ok: false, why: err.message }; } });
on("cm:studentStats", (c, e, o) => { try { return c.backend.studentStats(statOpts(o)); } catch (err) { return { ok: false, why: err.message }; } });
on("cm:progress", (c) => { try { return c.backend.progress({}); } catch (err) { return { ok: false, why: err.message }; } });
on("cm:tunnelStart", async (c) => { await startTunnel(); return tunnelFor(c); });
ipcMain.handle("cm:readme", () => shell.openPath(app.isPackaged ? path.join(process.resourcesPath, "README.txt") : path.join(__dirname, "README.txt")));
on("cm:tunnelStop", (c) => { stopTunnel(); return tunnelFor(c); });
on("cm:security", () => cleanSecurity({}, appSettings));
on("cm:saveSecurity", (c, e, s) => { saveAppSettings(cleanSecurity(s || {}, appSettings)); if (tunnel) tunnel.setHours(appSettings.tunnelHours); return cleanSecurity({}, appSettings); });
on("cm:save", async (c, e, s) => {
  s = s || {};
  const before = appSettings.port;
  if (s.scriptUrl != null) saveSettings(c, { scriptUrl: s.scriptUrl }); // the Apps Script address belongs to the course
  if (s.port != null) saveAppSettings({ port: s.port });
  if (appSettings.port !== before) { await restartServer(); for (const w of BrowserWindow.getAllWindows()) { const id = registry.idFromUrl(w.webContents.getURL()) || registry.active(); w.loadURL(baseUrl() + startPage(ctx(id))); } }
  return info(c);
});
on("cm:openWindow", (c, e, page) => { if (/^[\w.-]+\.html([?#][\w=&#.-]*)?$/.test(page)) newWindow(coursePrefix(c) + page); });
ipcMain.handle("cm:openExternal", (e, url) => { if (/^https:\/\//.test(String(url))) shell.openExternal(url); });
on("cm:classList", (c, e, text, replace) => {
  const rows = parseClassList(text);
  if (!rows.length) return { ok: false, why: "No student IDs found. Put one student per line: ID, then name if you wish." };
  return c.backend.rosterSync(rows, !!replace);
});
on("cm:classListFile", async (c, e) => {
  const r = await dialog.showOpenDialog(winOf(e), { title: "Choose the class list", filters: [{ name: "Class list", extensions: ["csv", "txt", "tsv"] }], properties: ["openFile"] });
  if (r.canceled || !r.filePaths[0]) return null;
  return fs.readFileSync(r.filePaths[0], "utf8").slice(0, 2000000);
});

// ---------- the course list: add, rename, archive, switch, link a folder ----------
on("cm:courses", (c) => ({ current: c.id, list: courseList(c.id) }));
on("cm:addCourse", async (c, e, o) => {
  o = o || {};
  const code = String(o.code || "").trim();
  if (!code) return { ok: false, why: "Give the course a code, for example PHYS 101." };
  const n = registry.add({ code, title: o.title, term: o.term });
  const nc = ctx(n.id);
  saveSettings(nc, { courseCode: code, courseTitle: String(o.title || ""), semester: String(o.term || "") });
  if (o.copyFrom && registry.get(String(o.copyFrom))) { // reuse another course's details (institution, lecturer, contact, colour); never its students
    const src = ctx(String(o.copyFrom)).settings;
    saveSettings(nc, { institution: src.institution, lecturer: src.lecturer, contact: src.contact, accent: src.accent });
  }
  return { ok: true, id: n.id, url: baseUrl() + startPage(nc) };
});
on("cm:updateCourse", (c, e, id, o) => {
  id = String(id || ""); o = o || {};
  if (!registry.get(id)) return { ok: false, why: "No such course." };
  if (o.code != null && !String(o.code).trim()) return { ok: false, why: "The course code cannot be empty." };
  saveSettings(ctx(id), { courseCode: o.code, courseTitle: o.title, semester: o.term });
  return { ok: true, list: courseList(c.id) };
});
on("cm:archiveCourse", (c, e, id, archived) => {
  id = String(id || "");
  const r = registry.setArchived(id, !!archived);
  if (!r.ok) return r;
  if (archived) closeCtx(id); // its pages stop being served; its records stay in its folder
  return { ok: true, list: courseList(c.id), url: id === c.id && archived ? baseUrl() + startPage(ctx(registry.active())) : "" };
});
on("cm:switchCourse", (c, e, id) => {
  id = String(id || "");
  if (!registry.setActive(id)) return { ok: false, why: "That course is archived or does not exist." };
  return { ok: true, url: baseUrl() + startPage(ctx(id)) };
});
on("cm:linkFolder", async (c, e, id, unlink) => {
  id = String(id || c.id);
  if (!registry.get(id)) return { ok: false, why: "No such course." };
  if (unlink) { closeCtx(id); registry.setSource(id, { kind: "app" }); return { ok: true, list: courseList(c.id) }; }
  const r = await dialog.showOpenDialog(winOf(e), { title: "Choose the folder that holds this course's lectures and files", properties: ["openDirectory", "createDirectory"] });
  if (r.canceled || !r.filePaths[0]) return null;
  const other = registry.list().find((x) => x.id !== id && x.source && x.source.kind === "folder" && path.resolve(x.source.path) === path.resolve(r.filePaths[0]));
  if (other) return { ok: false, why: "That folder is already linked to " + (other.code || other.id) + ". Each course needs its own folder." };
  try { closeCtx(id); registry.setSource(id, { kind: "folder", path: r.filePaths[0] }); } catch (err) { return { ok: false, why: err.message }; }
  ctx(id).backend.dropSiteCache();
  return { ok: true, list: courseList(c.id) };
});
// A linked folder that is a Git repository: bring it up to date with git pull (fast-forward only, never a merge).
on("cm:pullCourse", (c, e, id) => new Promise((resolve) => {
  const x = registry.get(String(id || c.id));
  if (!x || !x.source || x.source.kind !== "folder") return resolve({ ok: false, why: "This course is not linked to a folder." });
  if (!repoInfo(x.source.path)) return resolve({ ok: false, why: "The linked folder is not a Git repository." });
  execFile("git", ["-C", x.source.path, "pull", "--ff-only"], { timeout: 60000 }, (err, out, errOut) => {
    if (err) return resolve({ ok: false, why: err.code === "ENOENT" ? "Git is not installed on this computer. Update the folder with your usual Git program." : String(errOut || err.message).trim().slice(0, 400) });
    if (ctxs.has(x.id)) ctxs.get(x.id).backend.dropSiteCache();
    resolve({ ok: true, message: String(out || "").trim().slice(0, 400) || "Up to date." });
  });
}));

// ---------- course setup (app/setup.html) ----------
on("cm:setup", (c) => ({ settings: shownSettings(c), setup: setupState(c), lectures: c.course.lectures(), kinds: c.course.KINDS, portal: c.course.portal(), courseId: c.id, linked: registry.dirs(c.id).linked }));
on("cm:saveCourse", (c, e, o) => {
  o = o || {}; const keep = Object.assign({}, o); delete keep.scriptUrl; delete keep.setupSeen; delete keep.port;
  saveSettings(c, keep);
  c.course.setCourseInfo({ courseCode: c.settings.courseCode, contacts: o.contacts, currentWeek: o.currentWeek });
  return { settings: shownSettings(c), setup: setupState(c) };
});
on("cm:setupSeen", (c) => { saveSettings(c, { setupSeen: true }); return setupState(c); });
on("cm:chooseLogo", async (c, e, clear) => {
  try {
    if (clear) { c.course.setLogo(""); saveSettings(c, { logo: "" }); return { ok: true, logo: "" }; }
    const r = await dialog.showOpenDialog(winOf(e), { title: "Choose a logo", filters: [{ name: "Image", extensions: ["png", "jpg", "jpeg", "svg", "webp"] }], properties: ["openFile"] });
    if (r.canceled || !r.filePaths[0]) return null;
    const logo = c.course.setLogo(r.filePaths[0]); saveSettings(c, { logo }); return { ok: true, logo };
  } catch (err) { return { ok: false, why: err.message }; }
});
webImport.register({ on, dialog, winOf, shell }); // cm:import*: bring results exported from the web version into this course
ipcMain.handle("cm:tableFile", async (e) => { // a class list as rows, from CSV, a text file or Excel (.xlsx)
  const r = await dialog.showOpenDialog(winOf(e), { title: "Choose the class list", filters: [{ name: "Class list", extensions: ["csv", "xlsx", "txt", "tsv"] }], properties: ["openFile"] });
  if (r.canceled || !r.filePaths[0]) return null;
  try { return { ok: true, name: path.basename(r.filePaths[0]), rows: await readTable(r.filePaths[0]) }; } catch (err) { return { ok: false, why: err.message }; }
});
ipcMain.handle("cm:tableText", (e, text) => ({ ok: true, rows: require("./table").splitText(String(text || "").slice(0, 2000000)) }));
on("cm:classRows", (c, e, rows, replace) => { // rows already mapped to [ID, name] or [ID, first name, last name]
  const clean = (rows || []).map((r) => [String(r[0] || "").replace(/\D/g, ""), names.rowName(r).slice(0, 120)]).filter((r) => /^\d{4,12}$/.test(r[0]));
  if (!clean.length) return { ok: false, why: "No student IDs found in the chosen column. Student IDs must have 4 to 12 digits." };
  const r = c.backend.rosterSync(clean, !!replace);
  if (r && r.ok) r.built = c.backend.buildFromRoster(); // a row for every student in Attendance, Master and Scores, ready for the first session
  return r;
});
ipcMain.handle("cm:sampleClassList", async (e) => { // the class list template, as Excel by default or CSV if the lecturer picks .csv
  const r = await dialog.showSaveDialog(winOf(e), { title: "Save the class list template", defaultPath: "class-list-template.xlsx",
    filters: [{ name: "Excel workbook", extensions: ["xlsx"] }, { name: "CSV file", extensions: ["csv"] }] });
  if (r.canceled || !r.filePath) return null;
  const rows = excel.classListTemplate()[0].rows;
  if (path.extname(r.filePath).toLowerCase() === ".csv") fs.writeFileSync(r.filePath, "\uFEFF" + rows.map((x) => x.map(csvCell).join(",")).join("\r\n") + "\r\n");
  else fs.writeFileSync(r.filePath, await excel.writeXlsx(excel.classListTemplate()));
  shell.showItemInFolder(r.filePath); return r.filePath;
});
on("cm:lectures", (c) => c.course.lectures());
on("cm:saveLecture", (c, e, o) => { const r = c.course.saveLecture(o || {}); c.backend.dropSiteCache(); return r; });
on("cm:removeLecture", (c, e, n) => { const r = c.course.removeLecture(Number(n)); c.backend.dropSiteCache(); return r; });
on("cm:lectureFile", async (c, e, n, kind, remove) => {
  if (remove) return c.course.removeLectureFile(Number(n), String(kind));
  const r = await dialog.showOpenDialog(winOf(e), { title: "Choose the file", filters: [{ name: "Lecture file", extensions: ["pdf", "docx", "pptx", "md", "txt"] }], properties: ["openFile"] });
  if (r.canceled || !r.filePaths[0]) return null;
  try { return c.course.addLectureFile(Number(n), String(kind), r.filePaths[0]); } catch (err) { return { ok: false, why: err.message }; }
});
on("cm:importPack", async (c, e) => {
  if (registry.dirs(c.id).linked) return { ok: false, why: "This course reads its content from a linked folder, so a course pack cannot replace it. Add a new course for the pack, or unlink the folder first." };
  const r = await dialog.showOpenDialog(winOf(e), { title: "Import a course pack", filters: [{ name: "Course pack", extensions: ["zip"] }], properties: ["openFile"] });
  if (r.canceled || !r.filePaths[0]) return null;
  try {
    const out = await c.course.importPack(r.filePaths[0]);
    const keep = { scriptUrl: c.settings.scriptUrl, setupSeen: c.settings.setupSeen };
    const ps = Object.assign({}, out.settings);
    delete ps.port; delete ps.zoom;
    if (ps.notice && typeof ps.notice === "object") { ps.noticeLinkLabel = ps.notice.linkLabel || ""; ps.noticeLinkUrl = ps.notice.linkUrl || ""; ps.notice = ps.notice.text || ""; }
    ps.logo = ["png", "jpg", "jpeg", "svg", "webp"].map((x) => "course-logo." + x).find((f) => c.course.resolve(f)) || "";
    saveSettings(c, Object.assign({}, DEFAULTS, ps, keep));
    c.backend.dropSiteCache();
    return { ok: true, name: out.name, files: out.files, settings: shownSettings(c) };
  } catch (err) { return { ok: false, why: err.message }; }
});
on("cm:exportPack", async (c, e) => {
  const name = ((c.settings.courseCode || "course").replace(/[^\w-]+/g, "-") + "-course-pack.zip").toLowerCase();
  const r = await dialog.showSaveDialog(winOf(e), { title: "Export the course as a course pack", defaultPath: name });
  if (r.canceled || !r.filePath) return null;
  try { await c.course.exportPack(r.filePath, c.settings); shell.showItemInFolder(r.filePath); return { ok: true, file: r.filePath }; } catch (err) { return { ok: false, why: err.message }; }
});
on("cm:tab", (c, e, name) => c.backend.tab(String(name)));
on("cm:export", async (c, e) => {
  const r = await dialog.showOpenDialog(winOf(e), { title: "Choose a folder for the results", properties: ["openDirectory", "createDirectory"] });
  if (r.canceled || !r.filePaths[0]) return null;
  const label = (c.settings.courseCode || c.id).replace(/[^\w .-]+/g, "_");
  const dir = path.join(r.filePaths[0], "Class Manager results " + label + " " + new Date().toISOString().slice(0, 10));
  fs.mkdirSync(dir, { recursive: true });
  c.backend.tabs().forEach((t) => {
    const rows = names.withNameColumns(c.backend.tab(t.name) || []);
    fs.writeFileSync(path.join(dir, t.name.replace(/[^\w .-]/g, "_") + ".csv"), "﻿" + rows.map((r) => r.map(csvCell).join(",")).join("\r\n"));
  });
  shell.openPath(dir);
  return dir;
});
// Every tab of the current course in one Excel workbook. Only this course's records are read.
on("cm:exportExcel", async (c, e) => {
  const label = (c.settings.courseCode || c.id).replace(/[^\w .-]+/g, "_");
  const r = await dialog.showSaveDialog(winOf(e), { title: "Save the results as Excel", defaultPath: "Class Manager results " + label + " " + new Date().toISOString().slice(0, 10) + ".xlsx", filters: [{ name: "Excel workbook", extensions: ["xlsx"] }] });
  if (r.canceled || !r.filePath) return null;
  try { fs.writeFileSync(r.filePath, await excel.writeXlsx(excel.resultsSheets(c.backend.tabs(), (n) => names.withNameColumns(c.backend.tab(n))))); shell.showItemInFolder(r.filePath); return { ok: true, file: r.filePath }; }
  catch (err) { return { ok: false, why: err.message }; }
});
// A table a screen has already drawn (for example the Students list), saved as a one-sheet Excel workbook.
on("cm:saveExcel", async (c, e, name, rows) => {
  const file = String(name || "table").replace(/[^\w .-]+/g, "_").slice(0, 80) + ".xlsx";
  const r = await dialog.showSaveDialog(winOf(e), { title: "Save as Excel", defaultPath: file, filters: [{ name: "Excel workbook", extensions: ["xlsx"] }] });
  if (r.canceled || !r.filePath) return null;
  const clean = names.withNameColumns(Array.isArray(rows) ? rows : []).slice(0, 20000).map((x) => (Array.isArray(x) ? x : []).slice(0, 200).map((v) => (typeof v === "number" ? v : String(v == null ? "" : v).slice(0, 32000))));
  try { fs.writeFileSync(r.filePath, await excel.writeXlsx([{ name: String(name || "Sheet1"), rows: clean }])); shell.showItemInFolder(r.filePath); return { ok: true, file: r.filePath }; }
  catch (err) { return { ok: false, why: err.message }; }
});
on("cm:openData", (c) => shell.openPath(registry.dirs(c.id).root));
// ---- protection at rest and backups (vault.js) ----
function backupInfo(c) {
  return { protected: vault.protected, list: c.backups.list().slice(0, 30), last: c.lastBackup || null, loadProblem: c.backend.loadProblem(), keep: require("./vault").KEEP_AUTO };
}
function reopenCourse(c) { // after a restore: the course is made again from the restored workbook, and its windows reload
  closeCtx(c.id); const n = ctx(c.id);
  for (const w of BrowserWindow.getAllWindows()) { try { if ((registry.idFromUrl(w.webContents.getURL()) || registry.active()) === c.id) w.webContents.reload(); } catch (e) {} }
  return n;
}
on("cm:backups", (c) => backupInfo(c));
on("cm:backupNow", (c) => { c.backend.flush(); c.lastBackup = c.backups.make("manual"); return backupInfo(c); });
on("cm:backupCheck", (c, e, name) => c.backups.verify(String(name || "")));
on("cm:backupRestore", (c, e, name) => {
  try { const v = c.backups.verify(String(name || "")); if (!v.ok) return { ok: false, why: v.why };
    const text = c.backups.read(String(name)); closeCtx(c.id); const r = c.backups.restoreText(text); reopenCourse(c); return Object.assign(r, backupInfo(ctx(c.id))); }
  catch (err) { return { ok: false, why: err.message }; }
});
function backupContent(c) { // the course's records and settings as one object, for a backup file or a linked-folder copy
  c.backend.flush();
  return { kind: "class-manager-backup", version: app.getVersion(), course: c.id, made: new Date().toISOString(), settings: c.settings, workbook: vault.decode(fs.readFileSync(registry.dirs(c.id).workbook)) };
}
function restoreContent(c, content) { // after the passphrase and the content have been checked
  closeCtx(c.id);
  const out = c.backups.restoreText(content.workbook);
  if (content.settings && typeof content.settings === "object") saveSettings(c, Object.assign({}, content.settings, { scriptUrl: c.settings.scriptUrl })); // the course details travel with the records; the server address stays this computer's
  reopenCourse(c);
  return Object.assign(out, { from: content.course, made: content.made }, backupInfo(ctx(c.id)));
}
on("cm:backupExport", async (c, e, pass) => {
  try {
    const buf = exportFile(backupContent(c), pass);
    const label = (c.settings.courseCode || c.id).replace(/[^\w .-]+/g, "_");
    const r = await dialog.showSaveDialog(winOf(e), { title: "Save a backup of this course", defaultPath: "Class Manager backup " + label + " " + new Date().toISOString().slice(0, 10) + ".cmbackup", filters: [{ name: "Class Manager backup", extensions: ["cmbackup"] }] });
    if (r.canceled || !r.filePath) return null;
    fs.writeFileSync(r.filePath, buf, { mode: 0o600 });
    importFile(fs.readFileSync(r.filePath), pass); // read back with the passphrase before saying it is done
    return { ok: true, file: r.filePath };
  } catch (err) { return { ok: false, why: err.message }; }
});
on("cm:backupImport", async (c, e, pass) => {
  try {
    const r = await dialog.showOpenDialog(winOf(e), { title: "Restore this course from a backup file", properties: ["openFile"], filters: [{ name: "Class Manager backup", extensions: ["cmbackup"] }] });
    if (r.canceled || !r.filePaths[0]) return null;
    return restoreContent(c, importFile(fs.readFileSync(r.filePaths[0]), pass)); // checks the passphrase and the content before anything changes
  } catch (err) { return { ok: false, why: err.message }; }
});
// ---------- linked folder (linked-folder.js) ----------
on("cm:linkedState", (c) => c.linked.state());
on("cm:linkedChoose", async (c, e) => {
  const r = await dialog.showOpenDialog(winOf(e), { title: "Choose the folder to keep copies in", properties: ["openDirectory", "createDirectory"] });
  return r.canceled || !r.filePaths[0] ? null : { folder: r.filePaths[0], provider: require("./storage-providers").detect(r.filePaths[0]) };
});
on("cm:linkedLink", async (c, e, spec, pass, auto) => { try { return await c.linked.link(spec, pass, auto); } catch (err) { return { ok: false, why: err.message }; } });
on("cm:linkedCopy", async (c, e, pass) => { try { c.backend.flush(); const r = await c.linked.copyNow(pass); return Object.assign({}, await c.linked.state(), { result: r }); } catch (err) { return { ok: false, why: err.message }; } });
on("cm:linkedUnlink", (c) => c.linked.unlink());
on("cm:linkedOpen", async (c) => { const s = await c.linked.state(); return s.linked && s.folder ? shell.openPath(s.folder) : ""; });
on("cm:syncState", (c) => c.sync.state());
on("cm:syncItems", async (c, e, o) => { try { c.sync.setItems(o); return await c.sync.state(); } catch (err) { return { ok: false, why: err.message }; } });
on("cm:syncNow", async (c, e, pass) => { c.backend.flush(); const r = await c.sync.syncNow(pass); return Object.assign({}, await c.sync.state(), { result: r }); });
on("cm:openNotes", (c) => { const d = path.join(registry.dirs(c.id).root, "notes"); fs.mkdirSync(d, { recursive: true }); return shell.openPath(d); });
on("cm:linkedRestore", async (c, e, name, pass) => { try { return restoreContent(c, await c.linked.open(String(name || ""), pass)); } catch (err) { return { ok: false, why: err.message }; } });
on("cm:openContent", (c) => { const d = registry.dirs(c.id).course; fs.mkdirSync(d, { recursive: true }); return shell.openPath(d); });
on("cm:run", (c, e, name) => { if (["refreshTotals", "rebuildMaster", "buildNamedAttendance"].includes(name)) { c.backend.run(name); c.backend.flush(); return true; } return false; });
// Lost both the lecturer password and the recovery code: the person at this computer may reset it (password-reset path, see README "Lecturer password").
on("cm:resetPassword", async (c, e) => {
  const r = await dialog.showMessageBox(winOf(e), { type: "warning", buttons: ["Reset password", "Cancel"], defaultId: 1, cancelId: 1, title: "Reset the lecturer password",
    message: "Reset the lecturer password for this course?", detail: "A temporary key is shown on the home screen, the recovery code is removed and every lecturer sign-in ends. Choose a new password straight afterwards." });
  if (r.response !== 0) return false;
  c.backend.run("resetHostKey"); c.backend.flush(); return true;
});
on("cm:googleSignIn", async (c) => { try { return await c.google.signIn().then(() => c.google.syncNow()); } catch (e) { return Object.assign(c.google.status(), { lastError: e.message }); } });
// ---------- resources and question authoring (app/author.html) ----------
const DOC_TYPES = [{ name: "Teaching material", extensions: ["pdf", "docx", "pptx", "md", "markdown", "txt"] }];
on("cm:authStatus", (c) => c.authoring.status());
on("cm:authSettings", (c, e, o) => c.authoring.setSettings(o || {}));
on("cm:libList", (c) => c.authoring.listDocs());
on("cm:libAdd", async (c, e, lecture) => {
  const r = await dialog.showOpenDialog(winOf(e), { title: "Add teaching material", filters: DOC_TYPES, properties: ["openFile", "multiSelections"] });
  if (r.canceled || !r.filePaths.length) return null;
  return c.authoring.addFiles(r.filePaths, lecture);
});
on("cm:libAddPaths", (c, e, paths, lecture) => c.authoring.addFiles((paths || []).map(String), lecture)); // drag and drop
on("cm:libRemove", (c, e, id) => c.authoring.removeDoc(String(id)));
on("cm:libSet", (c, e, id, f) => c.authoring.setDoc(String(id), f || {}));
on("cm:libPassages", (c, e, id) => c.authoring.docPassages(String(id)));
on("cm:search", (c, e, q, o) => c.authoring.search(String(q || ""), o || {}));
on("cm:summarise", async (c, e, id, mode) => { try { return { ok: true, doc: await c.authoring.summarise(String(id), mode) }; } catch (err) { return { ok: false, why: err.message }; } });
on("cm:generate", async (c, e, o) => { try { return Object.assign({ ok: true }, await c.authoring.generate(o || {})); } catch (err) { return { ok: false, why: err.message }; } });
on("cm:banks", (c) => c.authoring.banks());
on("cm:bankTitle", (c, e, n, t) => { const r = c.authoring.setBankTitle(n, t); c.backend.dropSiteCache(); return r; });
on("cm:drafts", (c) => c.authoring.listDrafts());
on("cm:draftsAdd", (c, e, items, origin) => c.authoring.addDrafts(items, ["manual", "imported"].includes(origin) ? origin : "manual"));
on("cm:draftUpdate", (c, e, did, f) => c.authoring.updateDraft(String(did), f || {}));
on("cm:draftsReject", (c, e, dids) => c.authoring.rejectDrafts((dids || []).map(String)));
on("cm:approve", (c, e, dids) => { const r = c.authoring.approve((dids || []).map(String), "review screen"); c.backend.dropSiteCache(); return r; });
on("cm:withdraw", (c, e, id) => { const r = c.authoring.withdraw(String(id)); c.backend.dropSiteCache(); return r; });
on("cm:importFile", async (c, e, defaults) => {
  const r = await dialog.showOpenDialog(winOf(e), { title: "Import questions", filters: [{ name: "Questions", extensions: ["docx", "pdf", "md", "markdown", "txt"] }], properties: ["openFile"] });
  if (r.canceled || !r.filePaths[0]) return null;
  try { return Object.assign({ ok: true }, await c.authoring.importFile(r.filePaths[0], defaults || {})); } catch (err) { return { ok: false, why: err.message }; }
});
on("cm:importText", (c, e, text, defaults) => Object.assign({ ok: true }, c.authoring.importText(String(text || "").slice(0, 2000000), defaults || {})));
ipcMain.handle("cm:saveTemplate", async (e, kind) => {
  const ext = kind === "docx" ? "docx" : "md";
  const r = await dialog.showSaveDialog(winOf(e), { title: "Save the question template", defaultPath: "question-template." + ext });
  if (r.canceled || !r.filePath) return null;
  fs.copyFileSync(path.join(__dirname, "app", "question-template." + ext), r.filePath); shell.showItemInFolder(r.filePath); return r.filePath;
});
on("cm:googleSignOut", (c) => c.google.signOut());
on("cm:googleSync", (c) => c.google.syncNow());

// ---------- start ----------
function flushAll() { for (const c of ctxs.values()) { try { c.backend.flush(); } catch (e) {} } }
function backupAll(reason) { for (const c of ctxs.values()) { try { c.backend.flush(); c.lastBackup = c.backups.make(reason); Promise.resolve(c.linked.auto()).catch((e) => console.log("[linked " + c.id + "]", e.message)); } catch (e) { c.lastBackup = { ok: false, why: e.message }; } } }
let closingBackupDone = false;
app.whenReady().then(async () => {
  // Before 0.8.0 the app held one course; it becomes the first course here, with all of its records.
  const mig = courses.migrateLegacy(ROOT(), (m) => console.log("[courses]", m));
  if (mig.migrated) { try { const t = loadTokens(); if (t.sheetId) saveTokens(courses.migrateTokens(t, mig.migrated)); } catch (e) {} }
  registry = courses.createRegistry(ROOT());
  registry.ensureOne();
  vault = makeVault();
  setInterval(() => backupAll(""), BACKUP_EVERY_MS).unref();
  appSettings = loadAppSettings();
  await restartServer();
  tunnel = createTunnel({ dir: path.join(ROOT(), "tunnel"),
    onChange: () => { for (const w of BrowserWindow.getAllWindows()) { try { const id = registry.idFromUrl(w.webContents.getURL()) || registry.active(); w.webContents.send("cm:tunnel", tunnelFor(ctx(id))); } catch (e) {} } } });
  appMenu();
  win = new BrowserWindow({ width: 1280, height: 860, minWidth: 900, minHeight: 600, title: "Class Manager", icon: path.join(__dirname, "app", "icon-512.png"),
    webPreferences: { preload: path.join(__dirname, "preload.js"), contextIsolation: true, sandbox: true, nodeIntegration: false } });
  secureWindow(win);
  win.loadURL(baseUrl() + startPage(ctx(registry.active())));
  app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) newWindow(startPage(ctx(registry.active())), 1280, 860); });
});
app.on("before-quit", () => { if (!closingBackupDone) { closingBackupDone = true; backupAll("close"); } else flushAll(); try { stopTunnel(); } catch (e) {} });
app.on("window-all-closed", () => { flushAll(); try { stopTunnel(); } catch (e) {} if (server) server.close(); app.quit(); });
