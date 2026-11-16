/* The Duplicate IDs card: the two calls it makes (id-notices-ipc.js) and the card itself (app/id-notices.js). */
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { createBackend } = require("../backend");
const { register } = require("../id-notices-ipc");

const WEB = path.resolve(__dirname, "..", "..");
const tmp = (p) => fs.mkdtempSync(path.join(os.tmpdir(), p));

function setup() {
  const b = createBackend({ webRoot: WEB, dataFile: path.join(tmp("cm-idn-"), "workbook.json"), log: () => {} });
  b.sheet("Roster", true).clear();
  b.sheet("Roster").getRange(1, 1, 3, 2).setValues([["Student ID", "Name"], ["20004444", "Ama"], ["020004444.0", "Ama B"]]);
  b.flush();
  const calls = {}; register({ on: (ch, fn) => { calls[ch] = (...a) => fn({ backend: b }, {}, ...a); } });
  return { b, calls };
}

test("the card's calls list the notice with both rows and record the chosen name", () => {
  const { b, calls } = setup();
  const l = calls["cm:idNotices"]();
  assert.equal(l.ok, true); assert.equal(l.notices.length, 1);
  assert.equal(l.notices[0].entries.length, 2, "both source rows are listed");
  assert.deepEqual(l.notices[0].names.sort(), ["Ama", "Ama B"]);
  assert.equal(calls["cm:idResolve"]("Roster", "20004444", "Ama B").ok, true);
  assert.equal(calls["cm:idNotices"]().notices.length, 0);
  assert.equal(b.students.get("20004444").name, "Ama B");
  b.close();
});

test("an invalid ID is refused and nothing changes", () => {
  const { b, calls } = setup();
  assert.equal(calls["cm:idResolve"]("Roster", "../x", "Bad").ok, false);
  assert.equal(calls["cm:idNotices"]().notices.length, 1);
  b.close();
});

test("the card is wired into the Class Roster screen and the app", () => {
  const home = fs.readFileSync(path.join(__dirname, "..", "app", "home.html"), "utf8");
  assert.ok(home.includes('id="id-notices"') && home.includes('src="id-notices.js"'));
  const pre = fs.readFileSync(path.join(__dirname, "..", "preload.js"), "utf8");
  assert.ok(pre.includes("cm:idNotices") && pre.includes("cm:idResolve"));
});
