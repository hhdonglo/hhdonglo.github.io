// main.js must load without a ReferenceError (0.19.0 shipped with a handler placed above the declaration of `on`).
// Electron is replaced by a stand-in that records what main.js registers, so this runs without a display.
const test = require("node:test"), assert = require("node:assert"), Module = require("node:module"), path = require("node:path");

function standIn() {
  const handlers = new Set();
  const fn = () => proxy();
  const proxy = () => new Proxy(function () {}, { get: (t, k) => (k === "then" ? undefined : k === "handle" ? (ch) => handlers.add(ch) : proxy()), apply: () => proxy(), construct: () => proxy() });
  const electron = new Proxy({}, { get: (t, k) => (k === "ipcMain" ? { handle: (ch) => handlers.add(ch), on() {}, once() {}, removeHandler() {} } : k === "app" ? { whenReady: () => new Promise(() => {}), on() {}, once() {}, getPath: () => require("node:os").tmpdir(), getVersion: () => "0", requestSingleInstanceLock: () => true, quit() {}, setName() {}, commandLine: { appendSwitch() {} }, isPackaged: false } : proxy()) });
  return { electron, handlers };
}

test("main.js loads and registers every cm: handler once", () => {
  const { electron, handlers } = standIn();
  const load = Module._load;
  Module._load = function (req, ...rest) { return req === "electron" ? electron : load.call(this, req, ...rest); };
  const file = path.join(__dirname, "../main.js");
  try { delete require.cache[file]; require(file); } finally { Module._load = load; delete require.cache[file]; }
  for (const ch of ["cm:info", "cm:stamp", "cm:folderDetails", "cm:removeStudent", "cm:restoreStudent"]) assert.ok(handlers.has(ch), ch + " is registered");
});
