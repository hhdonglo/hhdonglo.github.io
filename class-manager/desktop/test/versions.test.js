/* Versions that must agree, so nothing is released or deployed half-updated:
   - the app version in package.json is the one STRUCTURE.md says is current;
   - the server script's version string equals the one in the source module (the Control Centre page that compared them is removed);
   - if the server script changed, its version string changed too (apps_script/version-lock.js). */
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const lock = require("../../apps_script/version-lock");

const CM = path.resolve(__dirname, "..", "..");
const read = (...p) => fs.readFileSync(path.join(CM, ...p), "utf8");

test("package.json and STRUCTURE.md name the same current version", () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "package.json"), "utf8")).version;
  const m = read("STRUCTURE.md").match(/\*\*Current version: (\d+\.\d+\.\d+)\*\*/);
  assert.ok(m, 'STRUCTURE.md must contain a line "**Current version: X.Y.Z**"');
  assert.equal(m[1], pkg, "update the line in STRUCTURE.md when the version in package.json changes");
});

test("the script version is well formed and equal in the source module and in the built file", () => {
  const built = lock.current().version;
  assert.match(built, /^\d{4}-\d{2}-\d{2}-[a-z]+-\d+$/);
  assert.equal(read("apps_script", "src", "60-portal.gs").match(/var SCRIPT_VERSION = '([^']+)'/)[1], built);
});

test("a changed server script has a new version string", () => {
  const now = lock.current(), was = lock.locked();
  if (now.hash === was.hash) return assert.equal(now.version, was.version);
  assert.notEqual(now.version, was.version, "The server script changed but SCRIPT_VERSION did not. Bump it in apps_script/src/60-portal.gs, rebuild, then run: node apps_script/version-lock.js (and send Hope the redeploy steps)");
  assert.fail("The script and its version changed: run `node apps_script/version-lock.js` to record the new version, then commit version-lock.json");
});
