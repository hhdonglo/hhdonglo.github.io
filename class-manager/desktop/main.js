/* Class Manager desktop app.
   - Serves the class-manager pages from this computer on the local network, so students on the
     same Wi-Fi open the quiz and check-in pages on their phones.
   - Runs the quiz and attendance server on this computer (backend.js): results, attendance and
     marks are stored in a local workbook, created automatically on first launch.
   - Optional: sign in with Google to keep a copy of every tab in a Google Sheet in the lecturer's
     own Drive (google.js). */
"use strict";
const { app, BrowserWindow, ipcMain, shell, dialog, safeStorage } = require("electron");
const http = require("http");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { createBackend } = require("./backend");
const { createGoogle } = require("./google");
const { createAuthoring } = require("./authoring");

const WEB = app.isPackaged ? path.join(process.resourcesPath, "web") : path.join(__dirname, "..");
const DATA = () => path.join(app.getPath("userData"), "data");
const SETTINGS_FILE = () => path.join(app.getPath("userData"), "settings.json");
const DEFAULTS = { courseCode: "PHYS 143", courseTitle: "Mechanics and Thermal Physics", institution: "University of Ghana", scriptUrl: "", port: 8143 };
const TYPES = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".webp": "image/webp",
  ".pdf": "application/pdf", ".woff2": "font/woff2", ".webmanifest": "application/manifest+json"
};

let settings, server = null, port = 0, win = null, backend = null, google = null, authoring = null;

// ---------- settings ----------
function loadSettings() {
  try { return Object.assign({}, DEFAULTS, JSON.parse(fs.readFileSync(SETTINGS_FILE(), "utf8"))); } catch (e) { return Object.assign({}, DEFAULTS); }
}
function saveSettings(s) {
  const url = String(s.scriptUrl || "").trim();
  const clean = {
    courseCode: String(s.courseCode || "").slice(0, 40) || DEFAULTS.courseCode,
    courseTitle: String(s.courseTitle || "").slice(0, 120),
    institution: String(s.institution || "").slice(0, 120),
    scriptUrl: /^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(url) ? url : "",
    port: Math.min(65535, Math.max(1024, Number(s.port) || DEFAULTS.port))
  };
  fs.mkdirSync(app.getPath("userData"), { recursive: true });
  fs.writeFileSync(SETTINGS_FILE(), JSON.stringify(clean, null, 1));
  settings = Object.assign({}, DEFAULTS, clean);
}

// Google OAuth client of this build (registered once by the publisher; see desktop/README.md).
function oauthClient() {
  for (const f of [path.join(__dirname, "google-oauth.json"), path.join(app.getPath("userData"), "google-oauth.json")]) {
    try { const j = JSON.parse(fs.readFileSync(f, "utf8")); const c = j.installed || j; if (c.client_id) return c; } catch (e) { /* not set */ }
  }
  return {};
}
// Google sign-in tokens, encrypted with the system keychain where it is available.
const TOKENS = () => path.join(app.getPath("userData"), "google.bin");
function loadTokens() {
  try { const b = fs.readFileSync(TOKENS()); return JSON.parse(safeStorage.isEncryptionAvailable() ? safeStorage.decryptString(b) : b.toString("utf8")); } catch (e) { return {}; }
}
function saveTokens(o) {
  const s = JSON.stringify(o || {});
  fs.writeFileSync(TOKENS(), safeStorage.isEncryptionAvailable() ? safeStorage.encryptString(s) : Buffer.from(s, "utf8"), { mode: 0o600 });
}

// Anthropic API key for summaries and question generation, encrypted with the system keychain where it is available.
// It never leaves this computer except in requests to the Anthropic API.
const AKEY = () => path.join(app.getPath("userData"), "anthropic.bin");
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

// config.js is generated from the settings. Without an Apps Script address the pages use this computer's server.
function configJs(req) {
  const src = fs.readFileSync(path.join(WEB, "config.js"), "utf8");
  const host = /^[\w.:\[\]-]+$/.test(req.headers.host || "") ? req.headers.host : "127.0.0.1:" + port;
  const cm = { courseCode: settings.courseCode, courseTitle: settings.courseTitle, institution: settings.institution, scriptUrl: settings.scriptUrl || "http://" + host + "/exec", desktop: true };
  return "/* Generated by the Class Manager app from its Settings. */\nwindow.CM = " + JSON.stringify(cm, null, 1) + ";\n\n" + src.slice(src.indexOf("/* Helpers"));
}

function readBody(req, max) {
  return new Promise((resolve, reject) => {
    let n = 0; const parts = [];
    req.on("data", (c) => { n += c.length; if (n > max) { reject(new Error("too large")); req.destroy(); } else parts.push(c); });
    req.on("end", () => resolve(Buffer.concat(parts).toString("utf8")));
    req.on("error", reject);
  });
}

async function handle(req, res) {
  let u;
  try { u = new URL(req.url, "http://x"); } catch (e) { res.writeHead(400); return res.end(); }
  let p = decodeURIComponent(u.pathname);
  if (p === "/exec") {
    // The quiz and attendance server: same requests as the Google web app.
    try {
      const params = Object.fromEntries(u.searchParams);
      let out;
      if (req.method === "POST") {
        const raw = await readBody(req, 200000);
        Object.assign(params, Object.fromEntries(new URLSearchParams(raw)));
        out = backend.doPost(params, raw);
      } else out = backend.doGet(params);
      res.writeHead(200, { "Content-Type": out.mime + "; charset=utf-8", "Cache-Control": "no-store", "Access-Control-Allow-Origin": "*" });
      return res.end(out.text);
    } catch (e) {
      console.error(e); res.writeHead(500, { "Content-Type": "text/plain" }); return res.end("server error");
    }
  }
  if (req.method !== "GET" && req.method !== "HEAD") { res.writeHead(405); return res.end(); }
  if (p === "/") p = "/index.html";
  if (p === "/calendar.ics") { // the course calendar as a feed that calendar programs on the network can subscribe to
    const out = backend.doGet({ action: "calendar_ics", course: settings.courseCode + " calendar" });
    res.writeHead(200, { "Content-Type": "text/calendar; charset=utf-8", "Content-Disposition": 'inline; filename="calendar.ics"', "Cache-Control": "no-cache" });
    return res.end(out.text);
  }
  if (/^\/(quizzes\/lecture\d+|apps_script\/live_quizzes)\.json$/.test(p)) { // course banks with the lecturer's approved questions added
    const merged = authoring.siteFile(p);
    if (merged !== null) { res.writeHead(200, { "Content-Type": TYPES[".json"], "Cache-Control": "no-cache" }); return res.end(merged); }
  }
  if (p === "/config.js") { res.writeHead(200, { "Content-Type": TYPES[".js"], "Cache-Control": "no-store" }); return res.end(configJs(req)); }
  if (p.startsWith("/app/")) { // the app's own screens are for this computer only
    if (!isThisComputer(req)) { res.writeHead(403); return res.end("Not available"); }
    return sendFile(res, path.join(__dirname, "app", p.slice(5)), path.join(__dirname, "app"));
  }
  if (p.startsWith("/apps_script/") && !p.endsWith(".json")) { res.writeHead(404); return res.end(); }
  sendFile(res, path.join(WEB, p), WEB);
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
function listen(p) {
  return new Promise((resolve, reject) => {
    const s = http.createServer((q, r) => { handle(q, r).catch(() => { try { r.writeHead(500); r.end(); } catch (e) {} }); });
    s.once("error", reject);
    s.listen(p, "0.0.0.0", () => resolve(s));
  });
}
async function restartServer() {
  if (server) await new Promise((r) => server.close(() => r()));
  try { server = await listen(settings.port); } catch (e) { server = await listen(0); } // port in use: any free port
  port = server.address().port;
}

// ---------- windows ----------
function secureWindow(w) {
  w.removeMenu();
  w.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith(baseUrl()) && !/\.pdf($|[?#])/i.test(url)) return { action: "allow" };
    shell.openExternal(url); return { action: "deny" };
  });
  w.webContents.on("will-navigate", (e, url) => { if (!url.startsWith(baseUrl())) { e.preventDefault(); if (/^https?:/.test(url)) shell.openExternal(url); } });
}
function newWindow(page, w, h) {
  const bw = new BrowserWindow({ width: w || 1280, height: h || 860, title: "Class Manager", icon: path.join(WEB, "assets", "icon-512.png"),
    webPreferences: { preload: path.join(__dirname, "preload.js"), contextIsolation: true, sandbox: true, nodeIntegration: false } });
  secureWindow(bw); bw.loadURL(baseUrl() + page); return bw;
}

// ---------- the app's own screens ----------
function info() {
  return {
    settings, base: baseUrl(), version: app.getVersion(),
    addresses: lanAddresses().map((a) => "http://" + a.address + ":" + port + "/"),
    hostKey: backend.hostKeyIsPlain() ? backend.hostKey() : "",
    tabs: backend.tabs(), google: google.status(), dataFolder: DATA()
  };
}
function parseClassList(text) {
  // One student per line: ID, then an optional name, separated by a comma, semicolon or tab. A header line is skipped.
  return String(text || "").split(/\r?\n/).map((l) => l.split(/[,;\t]/).map((x) => x.replace(/^"|"$/g, "").trim()))
    .filter((r) => r[0] && /\d{4,12}/.test(r[0].replace(/\D/g, ""))).map((r) => [r[0].replace(/\D/g, ""), r[1] || ""]);
}
function csvCell(v) { v = String(v == null ? "" : v); return /[",\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }

ipcMain.handle("cm:info", () => info());
ipcMain.handle("cm:save", async (e, s) => {
  const before = settings.port; saveSettings(s);
  if (settings.port !== before) { await restartServer(); win.loadURL(baseUrl() + "app/home.html"); }
  return info();
});
ipcMain.handle("cm:openWindow", (e, page) => { if (/^[\w.-]+\.html([?#][\w=&#.-]*)?$/.test(page)) newWindow(page); });
ipcMain.handle("cm:openExternal", (e, url) => { if (/^https:\/\//.test(String(url))) shell.openExternal(url); });
ipcMain.handle("cm:classList", (e, text, replace) => {
  const rows = parseClassList(text);
  if (!rows.length) return { ok: false, why: "No student IDs found. Put one student per line: ID, then name if you wish." };
  return backend.rosterSync(rows, !!replace);
});
ipcMain.handle("cm:classListFile", async () => {
  const r = await dialog.showOpenDialog(win, { title: "Choose the class list", filters: [{ name: "Class list", extensions: ["csv", "txt", "tsv"] }], properties: ["openFile"] });
  if (r.canceled || !r.filePaths[0]) return null;
  return fs.readFileSync(r.filePaths[0], "utf8").slice(0, 2000000);
});
ipcMain.handle("cm:tab", (e, name) => backend.tab(String(name)));
ipcMain.handle("cm:export", async () => {
  const r = await dialog.showOpenDialog(win, { title: "Choose a folder for the results", properties: ["openDirectory", "createDirectory"] });
  if (r.canceled || !r.filePaths[0]) return null;
  const dir = path.join(r.filePaths[0], "Class Manager results " + new Date().toISOString().slice(0, 10));
  fs.mkdirSync(dir, { recursive: true });
  backend.tabs().forEach((t) => {
    const rows = backend.tab(t.name) || [];
    fs.writeFileSync(path.join(dir, t.name.replace(/[^\w .-]/g, "_") + ".csv"), "﻿" + rows.map((r) => r.map(csvCell).join(",")).join("\r\n"));
  });
  shell.openPath(dir);
  return dir;
});
ipcMain.handle("cm:openData", () => shell.openPath(DATA()));
ipcMain.handle("cm:run", (e, name) => { if (["refreshTotals", "rebuildMaster", "buildNamedAttendance"].includes(name)) { backend.run(name); backend.flush(); return true; } return false; });
ipcMain.handle("cm:googleSignIn", async () => { try { return await google.signIn().then(() => google.syncNow()); } catch (e) { return Object.assign(google.status(), { lastError: e.message }); } });
// ---------- resources and question authoring (app/author.html) ----------
const DOC_TYPES = [{ name: "Teaching material", extensions: ["pdf", "docx", "pptx", "md", "markdown", "txt"] }];
ipcMain.handle("cm:authStatus", () => authoring.status());
ipcMain.handle("cm:authSettings", (e, o) => authoring.setSettings(o || {}));
ipcMain.handle("cm:libList", () => authoring.listDocs());
ipcMain.handle("cm:libAdd", async (e, lecture) => {
  const r = await dialog.showOpenDialog(win, { title: "Add teaching material", filters: DOC_TYPES, properties: ["openFile", "multiSelections"] });
  if (r.canceled || !r.filePaths.length) return null;
  return authoring.addFiles(r.filePaths, lecture);
});
ipcMain.handle("cm:libAddPaths", (e, paths, lecture) => authoring.addFiles((paths || []).map(String), lecture)); // drag and drop
ipcMain.handle("cm:libRemove", (e, id) => authoring.removeDoc(String(id)));
ipcMain.handle("cm:libSet", (e, id, f) => authoring.setDoc(String(id), f || {}));
ipcMain.handle("cm:libPassages", (e, id) => authoring.docPassages(String(id)));
ipcMain.handle("cm:search", (e, q, o) => authoring.search(String(q || ""), o || {}));
ipcMain.handle("cm:summarise", async (e, id, mode) => { try { return { ok: true, doc: await authoring.summarise(String(id), mode) }; } catch (err) { return { ok: false, why: err.message }; } });
ipcMain.handle("cm:generate", async (e, o) => { try { return Object.assign({ ok: true }, await authoring.generate(o || {})); } catch (err) { return { ok: false, why: err.message }; } });
ipcMain.handle("cm:banks", () => authoring.banks());
ipcMain.handle("cm:bankTitle", (e, n, t) => { const r = authoring.setBankTitle(n, t); backend.dropSiteCache(); return r; });
ipcMain.handle("cm:drafts", () => authoring.listDrafts());
ipcMain.handle("cm:draftsAdd", (e, items, origin) => authoring.addDrafts(items, ["manual", "imported"].includes(origin) ? origin : "manual"));
ipcMain.handle("cm:draftUpdate", (e, did, f) => authoring.updateDraft(String(did), f || {}));
ipcMain.handle("cm:draftsReject", (e, dids) => authoring.rejectDrafts((dids || []).map(String)));
ipcMain.handle("cm:approve", (e, dids) => { const r = authoring.approve((dids || []).map(String), "review screen"); backend.dropSiteCache(); return r; });
ipcMain.handle("cm:withdraw", (e, id) => { const r = authoring.withdraw(String(id)); backend.dropSiteCache(); return r; });
ipcMain.handle("cm:importFile", async (e, defaults) => {
  const r = await dialog.showOpenDialog(win, { title: "Import questions", filters: [{ name: "Questions", extensions: ["docx", "pdf", "md", "markdown", "txt"] }], properties: ["openFile"] });
  if (r.canceled || !r.filePaths[0]) return null;
  try { return Object.assign({ ok: true }, await authoring.importFile(r.filePaths[0], defaults || {})); } catch (err) { return { ok: false, why: err.message }; }
});
ipcMain.handle("cm:importText", (e, text, defaults) => Object.assign({ ok: true }, authoring.importText(String(text || "").slice(0, 2000000), defaults || {})));
ipcMain.handle("cm:saveTemplate", async (e, kind) => {
  const ext = kind === "docx" ? "docx" : "md";
  const r = await dialog.showSaveDialog(win, { title: "Save the question template", defaultPath: "question-template." + ext });
  if (r.canceled || !r.filePath) return null;
  fs.copyFileSync(path.join(__dirname, "app", "question-template." + ext), r.filePath); shell.showItemInFolder(r.filePath); return r.filePath;
});
ipcMain.handle("cm:googleSignOut", () => google.signOut());
ipcMain.handle("cm:googleSync", () => google.syncNow());

// ---------- start ----------
app.whenReady().then(async () => {
  settings = loadSettings();
  const oc = oauthClient();
  google = createGoogle({
    clientId: oc.client_id || "", clientSecret: oc.client_secret || "",
    load: loadTokens, save: saveTokens, openBrowser: (u) => shell.openExternal(u), log: (m) => console.log("[google]", m),
    tabs: () => backend.tabs(), tab: (n) => backend.tab(n), title: () => "Class Manager: " + settings.courseCode + " results"
  });
  authoring = createAuthoring({ dir: path.join(app.getPath("userData"), "authoring"), webRoot: WEB, loadKey: loadApiKey, saveKey: saveApiKey,
    keyIsEncrypted: () => safeStorage.isEncryptionAvailable(), log: (m) => console.log("[authoring]", m) });
  backend = createBackend({ readSite: (rel) => authoring.siteFile(rel), webRoot: WEB, dataFile: path.join(DATA(), "workbook.json"), log: (m) => console.log("[backend]", m), onChange: () => google && google.changed() });
  await restartServer();
  win = new BrowserWindow({ width: 1200, height: 880, title: "Class Manager", icon: path.join(WEB, "assets", "icon-512.png"),
    webPreferences: { preload: path.join(__dirname, "preload.js"), contextIsolation: true, sandbox: true, nodeIntegration: false } });
  secureWindow(win);
  win.loadURL(baseUrl() + "app/home.html");
  app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) newWindow("app/home.html", 1200, 880); });
});
app.on("before-quit", () => { try { backend && backend.flush(); } catch (e) {} });
app.on("window-all-closed", () => { try { backend && backend.flush(); } catch (e) {} if (server) server.close(); app.quit(); });
