/* The packaged-app smoke check (tools/smoke-packaged.js), run here on a layout shaped like the installer's resources folder
   with plain Node. The real run, with the installer's own Electron runtime, is a step of the build workflow. */
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { run } = require("../tools/smoke-packaged");

test("the smoke check opens a course database and keeps a student across a restart", () => {
  const res = fs.mkdtempSync(path.join(os.tmpdir(), "cm-res-"));
  fs.symlinkSync(path.join(__dirname, ".."), path.join(res, "app.asar"), "dir");
  fs.symlinkSync(path.join(__dirname, "..", ".."), path.join(res, "web"), "dir");
  const r = run(res, process.execPath);
  assert.ok(r.ok, r.out);
  assert.match(r.out, /SMOKE OK/);
});

test("the smoke check fails clearly when the runtime cannot load the app", () => {
  const r = run(path.join(os.tmpdir(), "cm-no-such-resources"), process.execPath);
  assert.equal(r.ok, false);
});

test("the build workflow runs the smoke check on every platform before uploading the installer", () => {
  const wf = fs.readFileSync(path.join(__dirname, "..", "..", "..", ".github", "workflows", "class-manager-app.yml"), "utf8");
  assert.ok(wf.indexOf("tools/smoke-packaged.js") > wf.indexOf("electron-builder") && wf.indexOf("tools/smoke-packaged.js") < wf.indexOf("upload-artifact"));
});

test("a relative dist folder works (this is how the build workflow calls it)", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "cm-dist-")), res = path.join(root, "dist", "linux-unpacked", "resources");
  const exe = process.platform === "win32" ? "class-manager.exe" : "class-manager";
  fs.mkdirSync(res, { recursive: true });
  fs.symlinkSync(path.join(__dirname, ".."), path.join(res, "app.asar"), "dir");
  fs.symlinkSync(path.join(__dirname, "..", ".."), path.join(res, "web"), "dir");
  fs.copyFileSync(process.execPath, path.join(root, "dist", "linux-unpacked", exe)); fs.chmodSync(path.join(root, "dist", "linux-unpacked", exe), 0o755);
  const { spawnSync } = require("child_process");
  const r = spawnSync(process.execPath, [path.join(__dirname, "..", "tools", "smoke-packaged.js"), "dist"], { cwd: root, encoding: "utf8" });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /SMOKE OK/);
});
