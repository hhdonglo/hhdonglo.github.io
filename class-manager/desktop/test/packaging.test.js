/* Packaging: every file that the app loads from its own folder must be listed in package.json "build.files",
   or the installed app stops at start-up with "Cannot find module". Run with `npm test` in class-manager/desktop. */
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const DIR = path.resolve(__dirname, "..");
const pkg = JSON.parse(fs.readFileSync(path.join(DIR, "package.json"), "utf8"));
const listed = new Set(pkg.build.files);

function localRequires(file) { // "./name" required by a file, as files of this folder
  const text = fs.readFileSync(path.join(DIR, file), "utf8"), out = new Set();
  text.replace(/require\(\s*["']\.\/([\w.-]+)["']\s*\)/g, (m, name) => { out.add(name.endsWith(".js") ? name : name + ".js"); return ""; });
  return [...out];
}

test("every module the app loads is packaged", () => {
  const seen = new Set(), todo = ["main.js", "preload.js"];
  while (todo.length) {
    const f = todo.pop();
    if (seen.has(f)) continue;
    seen.add(f);
    assert.ok(listed.has(f), f + " is loaded by the app but missing from package.json build.files");
    localRequires(f).forEach((r) => { if (fs.existsSync(path.join(DIR, r))) todo.push(r); });
  }
});
