/* Frozen columns: run with `npm test` in class-manager/desktop (Node 20 or later, no Electron needed).
   Static checks that keep the Student ID and Name columns frozen without covering the data beside them. */
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const app = path.join(__dirname, "..", "app");
const read = (f) => fs.readFileSync(path.join(app, f), "utf8");
const css = read("frozen-cols.css");

test("Name starts exactly where the ID column ends, and both have a fixed width", () => {
  assert.match(css, /\.frz \.fz2\{left:var\(--fz1\)/);
  assert.match(css, /\.frz \.fz1\{left:0;width:var\(--fz1\);min-width:var\(--fz1\);max-width:var\(--fz1\)/);
  assert.match(css, /\.frz \.fz2\{[^}]*width:var\(--fz2\);min-width:var\(--fz2\);max-width:var\(--fz2\)/);
});

test("frozen cells are solid and sit above the cells that scroll under them", () => {
  assert.match(css, /\.frz \.fz1,\.frz \.fz2\{[^}]*background:var\(--fz-bg\)/);
  const z = (sel) => Number(new RegExp(sel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\{[^}]*z-index:(\\d+)").exec(css)[1]);
  assert.ok(z(".frz .fz1,.frz .fz2") > 1);
  assert.ok(z(".frz thead th.fz1,.frz thead th.fz2") > z(".frz tr.band th"), "frozen headers above the group row");
  assert.ok(z(".frz tr.band th.fz1,.frz tr.band th.fz2") > z(".frz thead th.fz1,.frz thead th.fz2"));
});

test("the Grades table uses the shared style, with ID and Name frozen in the header", () => {
  const js = read("grades-view.js");
  assert.match(js, /class='gt frz'/);
  assert.doesNotMatch(js, /class='band'/, "one header row only: the date columns need no group band");
  assert.match(js, /"__id", "Student ID", "fz1"/);
  assert.match(js, /"__name", "Name", "fz2"/);
  assert.doesNotMatch(js, /stick1|stick2/);
});

test("home.html loads the shared style and keeps no private copy of the frozen rules", () => {
  const html = read("home.html");
  assert.match(html, /<link rel="stylesheet" href="frozen-cols\.css">/);
  assert.doesNotMatch(html, /stick1|stick2|7\.2rem/);
});

test("home.html style block has balanced braces (an unclosed @media once hid the Grades table rules on wide windows)", () => {
  const style = /<style>([\s\S]*?)<\/style>/.exec(read("home.html"))[1].replace(/\/\*[\s\S]*?\*\//g, "").replace(/url\("[^"]*"\)/g, "");
  let depth = 0;
  for (const ch of style) { if (ch === "{") depth++; if (ch === "}") depth--; assert.ok(depth >= 0, "extra closing brace"); }
  assert.equal(depth, 0, "unclosed block in home.html style");
});
