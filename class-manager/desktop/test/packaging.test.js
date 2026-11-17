/* Packaging: every file that the app loads from its own folder must be listed in package.json "build.files",
   or the installed app stops at start-up with "Cannot find module". Run with `npm test` in class-manager/desktop. */
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const DIR = path.resolve(__dirname, "..");
const pkg = JSON.parse(fs.readFileSync(path.join(DIR, "package.json"), "utf8"));
const files = pkg.build.files;

// The package takes every file of this folder except the ones excluded here (a hand-kept list of files went stale and broke the installer).
const excluded = (f) => files.filter((g) => g[0] === "!").some((g) => { const p = g.slice(1); return p.endsWith("/**") ? f.startsWith(p.slice(0, -2)) : p.startsWith("**/*.") ? f.endsWith(p.slice(4)) : f === p; });
function localRequires(file) { // relative requires of a file, as paths inside this folder
  const text = fs.readFileSync(path.join(DIR, file), "utf8"), out = new Set(), re = /require\(\s*["'](\.{1,2}\/[^"']+)["']\s*\)/g;
  let m; while ((m = re.exec(text))) { const base = path.posix.normalize(path.posix.join(path.posix.dirname(file), m[1])); [base, base + ".js", base + "/index.js"].some((c) => fs.existsSync(path.join(DIR, c)) && fs.statSync(path.join(DIR, c)).isFile() && out.add(c)); }
  return [...out];
}

test("the package takes everything and excludes only tests, tools and notes", () => {
  assert.equal(files[0], "**/*");
  assert.ok(!excluded("first-run/stages.js") && !excluded("relay/address.json") && !excluded("app/home.html"));
  assert.ok(excluded("test/x.test.js") && excluded("README.md"));
});

test("every module the app loads is packaged", () => {
  const seen = new Set(), todo = ["main.js", "preload.js"];
  while (todo.length) {
    const f = todo.pop();
    if (seen.has(f)) continue;
    seen.add(f);
    assert.ok(!excluded(f), f + " is loaded by the app but excluded by package.json build.files");
    localRequires(f).forEach((r) => todo.push(r));
  }
});
