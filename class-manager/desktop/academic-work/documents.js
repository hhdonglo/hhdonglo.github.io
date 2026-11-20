"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { randomUUID } = require("node:crypto");

function inspectFile(file) {
  const ext = path.extname(file).toLowerCase();
  const title = path.basename(file);
  if (ext === ".pdf") {
    const descriptor = fs.openSync(file, "r");
    const header = Buffer.alloc(1024);
    try { fs.readSync(descriptor, header); } finally { fs.closeSync(descriptor); }
    if (header.subarray(0, 5).toString("ascii") !== "%PDF-") throw new Error("The linked file is not a valid PDF.");
    return { kind: "pdf", title };
  }
  if (![".txt", ".md", ".csv", ".log"].includes(ext)) throw new Error("The reader supports PDF and plain text files.");
  const descriptor = fs.openSync(file, "r");
  try {
    const buf = Buffer.alloc(512 * 1024 + 1), size = fs.readSync(descriptor, buf);
    return { kind: "text", title, text: buf.subarray(0, Math.min(size, buf.length - 1)).toString("utf8"), truncated: size === buf.length };
  } finally { fs.closeSync(descriptor); }
}

async function openDocument(file, BrowserWindow, parent) {
  const result = inspectFile(file);
  if (result.kind === "text") return result;
  const win = new BrowserWindow({ parent, width: 1120, height: 820, title: result.title,
    webPreferences: { plugins: true, nodeIntegration: false, contextIsolation: true, sandbox: true, partition: "academic-pdf-" + randomUUID() } });
  win.removeMenu();
  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  const url = pathToFileURL(file).href;
  win.webContents.on("will-navigate", (e, target) => { if (target.split("#")[0] !== url) e.preventDefault(); });
  win.webContents.session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  win.webContents.session.webRequest.onBeforeRequest({ urls: ["http://*/*", "https://*/*"] }, (_details, callback) => callback({ cancel: true }));
  try { await win.loadURL(url); } catch (error) { win.destroy(); throw error; }
  return result;
}

module.exports = { inspectFile, openDocument };
