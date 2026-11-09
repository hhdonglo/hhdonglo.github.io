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
const { createTunnel, createLimiter } = require("./tunnel");
const { createCourse } = require("./course");
const { readTable } = require("./table");

const WEB = app.isPackaged ? path.join(process.resourcesPath, "web") : path.join(__dirname, "..");
const DATA = () => path.join(app.getPath("userData"), "data");
const SETTINGS_FILE = () => path.join(app.getPath("userData"), "settings.json");
const TEMPLATES = app.isPackaged ? path.join(process.resourcesPath, "web", "templates") : path.join(__dirname, "..", "templates");
const DEFAULTS = { courseCode: "", courseTitle: "", institution: "", lecturer: "", semester: "", startDate: "", endDate: "", contact: "", accent: "", logo: "", notice: "", noticeLinkLabel: "", noticeLinkUrl: "",
  scriptUrl: "", port: 8143, setupSeen: false };
const TYPES = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".webp": "image/webp",
  ".pdf": "application/pdf", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation", ".md": "text/markdown; charset=utf-8", ".txt": "text/plain; charset=utf-8", ".woff2": "font/woff2", ".webmanifest": "application/manifest+json"
};

let settings, server = null, port = 0, win = null, backend = null, google = null, authoring = null;
let course = null;
let tunnel = null, tunnelServer = null, tunnelPort = 0;
const allowRemote = createLimiter(240); // requests per minute per visitor through the internet address

// ---------- settings ----------
function loadSettings() {
  try { return Object.assign({}, DEFAULTS, JSON.parse(fs.readFileSync(SETTINGS_FILE(), "utf8"))); } catch (e) { return Object.assign({}, DEFAULTS); }
}
function saveSettings(s) {
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
function publicUrl() { const t = tunnel && tunnel.status(); return t && t.state === "on" ? t.url : ""; }
function configJs(req, remote) {
  const src = fs.readFileSync(path.join(WEB, "config.js"), "utf8");
  const host = /^[\w.:\[\]-]+$/.test(req.headers.host || "") ? req.headers.host : "127.0.0.1:" + port;
  const cm = { courseCode: settings.courseCode, courseTitle: settings.courseTitle, institution: settings.institution, lecturer: settings.lecturer, semester: settings.semester,
    contact: settings.contact, accent: settings.accent, logo: settings.logo, notice: settings.notice ? { text: settings.notice, linkLabel: settings.noticeLinkLabel, linkUrl: settings.noticeLinkUrl } : null,
    scriptUrl: settings.scriptUrl || (remote ? "https://" : "http://") + host + "/exec", desktop: true };
  if (publicUrl()) cm.publicBase = publicUrl(); // QR codes and links for students use the internet address while it is on
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

async function handle(req, res, remote) {
  if (remote) { // came through the internet address: never the app's own screens, and a limit per visitor
    const who = String(req.headers["cf-connecting-ip"] || req.headers["x-forwarded-for"] || "?").split(",")[0].trim();
    if (!allowRemote(who)) { res.writeHead(429, { "Content-Type": "text/plain", "Retry-After": "60" }); return res.end("Too many requests. Wait a minute and try again."); }
  }
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
    const out = backend.doGet({ action: "calendar_ics", course: (settings.courseCode || "Class") + " calendar" });
    res.writeHead(200, { "Content-Type": "text/calendar; charset=utf-8", "Content-Disposition": 'inline; filename="calendar.ics"', "Cache-Control": "no-cache" });
    return res.end(out.text);
  }
  if (/^\/(quizzes\/lecture\d+|apps_script\/live_quizzes)\.json$/.test(p)) { // course banks with the lecturer's approved questions added
    const merged = authoring.siteFile(p);
    if (merged !== null) { res.writeHead(200, { "Content-Type": TYPES[".json"], "Cache-Control": "no-cache" }); return res.end(merged); }
  }
  if (p === "/data/portal.json") { // titles, handouts and practice lists follow the course's lectures and banks
    const extra = authoring.banks().filter((b) => b.base + b.added > 0).map((b) => b.lecture);
    res.writeHead(200, { "Content-Type": TYPES[".json"], "Cache-Control": "no-cache" }); return res.end(JSON.stringify(course.portal(extra)));
  }
  if (p === "/config.js") { res.writeHead(200, { "Content-Type": TYPES[".js"], "Cache-Control": "no-store" }); return res.end(configJs(req, remote)); }
  if (p.startsWith("/app/")) { // the app's own screens are for this computer only
    if (remote || !isThisComputer(req)) { res.writeHead(403); return res.end("Not available"); }
    return sendFile(res, path.join(__dirname, "app", p.slice(5)), path.join(__dirname, "app"));
  }
  if (p.startsWith("/apps_script/") && !p.endsWith(".json")) { res.writeHead(404); return res.end(); }
  const file = course.resolve(p);
  if (file) return sendFile(res, file, path.dirname(file));
  const tpl = course.page(p);
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
  return tunnel.start(tunnelPort);
}
function stopTunnel() { return tunnel ? tunnel.stop() : { state: "off" }; }
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
  const bw = new BrowserWindow({ width: w || 1280, height: h || 860, title: "Class Manager", icon: path.join(__dirname, "app", "icon-512.png"),
    webPreferences: { preload: path.join(__dirname, "preload.js"), contextIsolation: true, sandbox: true, nodeIntegration: false } });
  secureWindow(bw); bw.loadURL(baseUrl() + page); return bw;
}

// ---------- the app's own screens ----------
function info() {
  return {
    settings, base: baseUrl(), version: app.getVersion(),
    addresses: lanAddresses().map((a) => "http://" + a.address + ":" + port + "/"),
    tunnel: tunnel ? tunnel.status() : { state: "off" },
    hostKey: backend.hostKeyIsPlain() ? backend.hostKey() : "",
    tabs: backend.tabs(), google: google.status(), dataFolder: DATA(), setup: setupState()
  };
}
// What the first-launch setup still needs. Every step can be skipped and finished later.
function setupState() {
  const roster = (backend.tabs().find((t) => t.name === "Roster") || { rows: 1 }).rows - 1;
  const steps = {
    course: !!settings.courseCode,
    classList: roster > 0,
    materials: course.hasContent() || authoring.listDocs().length > 0
  };
  return { steps, roster: Math.max(0, roster), complete: steps.course && steps.classList && steps.materials, seen: !!settings.setupSeen };
}
function parseClassList(text) {
  // One student per line: ID, then an optional name, separated by a comma, semicolon or tab. A header line is skipped.
  return String(text || "").split(/\r?\n/).map((l) => l.split(/[,;\t]/).map((x) => x.replace(/^"|"$/g, "").trim()))
    .filter((r) => r[0] && /\d{4,12}/.test(r[0].replace(/\D/g, ""))).map((r) => [r[0].replace(/\D/g, ""), r[1] || ""]);
}
function csvCell(v) { v = String(v == null ? "" : v); return /[",\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }

ipcMain.handle("cm:info", () => info());
ipcMain.handle("cm:tunnelStart", () => startTunnel());
ipcMain.handle("cm:readme", () => shell.openPath(app.isPackaged ? path.join(process.resourcesPath, "README.txt") : path.join(__dirname, "README.txt")));
ipcMain.handle("cm:tunnelStop", () => stopTunnel());
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
// ---------- course setup (app/setup.html) ----------
ipcMain.handle("cm:setup", () => ({ settings, setup: setupState(), lectures: course.lectures(), kinds: course.KINDS, portal: course.portal() }));
ipcMain.handle("cm:saveCourse", (e, o) => {
  o = o || {}; saveSettings(Object.assign({}, o, { port: settings.port }));
  course.setCourseInfo({ courseCode: settings.courseCode, contacts: o.contacts, currentWeek: o.currentWeek });
  return { settings, setup: setupState() };
});
ipcMain.handle("cm:setupSeen", () => { saveSettings({ setupSeen: true, port: settings.port }); return setupState(); });
ipcMain.handle("cm:chooseLogo", async (e, clear) => {
  try {
    if (clear) { course.setLogo(""); saveSettings({ logo: "", port: settings.port }); return { ok: true, logo: "" }; }
    const r = await dialog.showOpenDialog(win, { title: "Choose a logo", filters: [{ name: "Image", extensions: ["png", "jpg", "jpeg", "svg", "webp"] }], properties: ["openFile"] });
    if (r.canceled || !r.filePaths[0]) return null;
    const logo = course.setLogo(r.filePaths[0]); saveSettings({ logo, port: settings.port }); return { ok: true, logo };
  } catch (err) { return { ok: false, why: err.message }; }
});
ipcMain.handle("cm:tableFile", async () => { // a class list as rows, from CSV, a text file or Excel (.xlsx)
  const r = await dialog.showOpenDialog(win, { title: "Choose the class list", filters: [{ name: "Class list", extensions: ["csv", "xlsx", "txt", "tsv"] }], properties: ["openFile"] });
  if (r.canceled || !r.filePaths[0]) return null;
  try { return { ok: true, name: path.basename(r.filePaths[0]), rows: await readTable(r.filePaths[0]) }; } catch (err) { return { ok: false, why: err.message }; }
});
ipcMain.handle("cm:tableText", (e, text) => ({ ok: true, rows: require("./table").splitText(String(text || "").slice(0, 2000000)) }));
ipcMain.handle("cm:classRows", (e, rows, replace) => { // rows already mapped to [ID, name]
  const clean = (rows || []).map((r) => [String(r[0] || "").replace(/\D/g, ""), String(r[1] || "").trim().slice(0, 120)]).filter((r) => /^\d{4,12}$/.test(r[0]));
  if (!clean.length) return { ok: false, why: "No student IDs found in the chosen column. Student IDs must have 4 to 12 digits." };
  return backend.rosterSync(clean, !!replace);
});
ipcMain.handle("cm:sampleClassList", async () => {
  const r = await dialog.showSaveDialog(win, { title: "Save a sample class list", defaultPath: "class-list-template.csv" });
  if (r.canceled || !r.filePath) return null;
  fs.writeFileSync(r.filePath, "\ufeffStudent ID,Name\r\n10000001,First Student\r\n10000002,Second Student\r\n10000003,Third Student\r\n");
  shell.showItemInFolder(r.filePath); return r.filePath;
});
ipcMain.handle("cm:lectures", () => course.lectures());
ipcMain.handle("cm:saveLecture", (e, o) => { const r = course.saveLecture(o || {}); backend.dropSiteCache(); return r; });
ipcMain.handle("cm:removeLecture", (e, n) => { const r = course.removeLecture(Number(n)); backend.dropSiteCache(); return r; });
ipcMain.handle("cm:lectureFile", async (e, n, kind, remove) => {
  if (remove) return course.removeLectureFile(Number(n), String(kind));
  const r = await dialog.showOpenDialog(win, { title: "Choose the file", filters: [{ name: "Lecture file", extensions: ["pdf", "docx", "pptx", "md", "txt"] }], properties: ["openFile"] });
  if (r.canceled || !r.filePaths[0]) return null;
  try { return course.addLectureFile(Number(n), String(kind), r.filePaths[0]); } catch (err) { return { ok: false, why: err.message }; }
});
ipcMain.handle("cm:importPack", async () => {
  const r = await dialog.showOpenDialog(win, { title: "Import a course pack", filters: [{ name: "Course pack", extensions: ["zip"] }], properties: ["openFile"] });
  if (r.canceled || !r.filePaths[0]) return null;
  try {
    const out = await course.importPack(r.filePaths[0]);
    const keep = { port: settings.port, scriptUrl: settings.scriptUrl, setupSeen: settings.setupSeen };
    const ps = Object.assign({}, out.settings);
    if (ps.notice && typeof ps.notice === "object") { ps.noticeLinkLabel = ps.notice.linkLabel || ""; ps.noticeLinkUrl = ps.notice.linkUrl || ""; ps.notice = ps.notice.text || ""; }
    ps.logo = ["png", "jpg", "jpeg", "svg", "webp"].map((x) => "course-logo." + x).find((f) => course.resolve(f)) || "";
    saveSettings(Object.assign({}, DEFAULTS, ps, keep));
    backend.dropSiteCache();
    return { ok: true, name: out.name, files: out.files, settings };
  } catch (err) { return { ok: false, why: err.message }; }
});
ipcMain.handle("cm:exportPack", async () => {
  const name = ((settings.courseCode || "course").replace(/[^\w-]+/g, "-") + "-course-pack.zip").toLowerCase();
  const r = await dialog.showSaveDialog(win, { title: "Export the course as a course pack", defaultPath: name });
  if (r.canceled || !r.filePath) return null;
  try { await course.exportPack(r.filePath, settings); shell.showItemInFolder(r.filePath); return { ok: true, file: r.filePath }; } catch (err) { return { ok: false, why: err.message }; }
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
    tabs: () => backend.tabs(), tab: (n) => backend.tab(n), title: () => "Class Manager: " + (settings.courseCode || "class") + " results"
  });
  course = createCourse({ dir: path.join(app.getPath("userData"), "course"), web: WEB, templates: TEMPLATES });
  authoring = createAuthoring({ dir: path.join(app.getPath("userData"), "authoring"), webRoot: WEB, resolve: course.resolve, bankNumbers: course.bankNumbers, loadKey: loadApiKey, saveKey: saveApiKey,
    keyIsEncrypted: () => safeStorage.isEncryptionAvailable(), log: (m) => console.log("[authoring]", m) });
  backend = createBackend({ readSite: (rel) => authoring.siteFile(rel), webRoot: WEB, resolve: course.resolve, dataFile: path.join(DATA(), "workbook.json"), log: (m) => console.log("[backend]", m), onChange: () => google && google.changed() });
  await restartServer();
  tunnel = createTunnel({ dir: path.join(app.getPath("userData"), "tunnel"),
    onChange: (st) => { for (const w of BrowserWindow.getAllWindows()) { try { w.webContents.send("cm:tunnel", st); } catch (e) {} } } });
  win = new BrowserWindow({ width: 1200, height: 880, title: "Class Manager", icon: path.join(__dirname, "app", "icon-512.png"),
    webPreferences: { preload: path.join(__dirname, "preload.js"), contextIsolation: true, sandbox: true, nodeIntegration: false } });
  secureWindow(win);
  win.loadURL(baseUrl() + (settings.setupSeen ? "app/home.html" : "app/setup.html"));
  app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) newWindow("app/home.html", 1200, 880); });
});
app.on("before-quit", () => { try { backend && backend.flush(); } catch (e) {} try { stopTunnel(); } catch (e) {} });
app.on("window-all-closed", () => { try { backend && backend.flush(); } catch (e) {} try { stopTunnel(); } catch (e) {} if (server) server.close(); app.quit(); });
