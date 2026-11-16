/* The lecturer password is saved: it survives a restart and a full course Reset (it belongs to the lecturer, not to a course). */
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { createBackend } = require("../backend");
const { resetCourse } = require("../course-reset");

const WEB = path.resolve(__dirname, "..", "..");
const open = (base) => createBackend({ webRoot: WEB, dataFile: path.join(base, "data", "workbook.json"), log: () => {} });
const check = (b, key) => JSON.parse(b.doPost({ action: "hostcheck", hostkey: key }, "action=hostcheck").text).ok;

test("password set in CM is kept after restart, and after a full Reset, as a salted hash", () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "cm-pw-")); fs.mkdirSync(path.join(base, "data"));
  let b = open(base);
  assert.equal(b.setPasswordAsOwner("river stone lantern 42").ok, true);
  b.close(); b = open(base);
  assert.equal(check(b, "river stone lantern 42"), true, "kept across restart");
  assert.match(String(b.tab("Key")[1][9]), /^pw1:\d+:[0-9a-f-]+:[0-9a-f]{64}$/);
  const keep = b.tab("Key"); b.close();
  resetCourse(base, "all");
  b = open(base);
  assert.equal(check(b, "river stone lantern 42"), false, "a bare reset loses it (why main.js carries the Key tab)");
  b.setRows("Key", keep); b.flush(); b.close(); b = open(base);
  assert.equal(check(b, "river stone lantern 42"), true, "carried across Reset");
  b.close();
});
