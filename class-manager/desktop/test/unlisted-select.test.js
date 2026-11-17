/* The Unlisted IDs card keeps what the lecturer ticked and typed when the list refreshes (the cause of "Select at least one student first."). */
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const S = require("../app/unlisted-select");

const item = (id, status) => ({ id, name: "", status: status || "waiting", signIns: 1, attendance: [], quizzes: [] });

test("ticks and typed names survive a refresh; IDs that are gone are forgotten", () => {
  const k = S.create(), a = [item("10417910"), item("104191740")];
  assert.equal(k.changed(a), true);
  k.tick("10417910", true); k.type("104191740", "Aman");
  assert.equal(k.changed(a.map((x) => Object.assign({}, x))), false, "an identical list is not redrawn, so nothing is wiped");
  k.prune([item("10417910", "waiting"), item("104191740")]);
  assert.equal(k.isTicked("10417910"), true); assert.equal(k.nameFor("104191740", "x"), "Aman"); assert.equal(k.nameFor("10417910", "AMA"), "AMA");
  const b = [a[0], Object.assign(item("104191740"), { signIns: 6 })];
  assert.equal(k.changed(b), true, "a new sign-in redraws"); k.prune(b);
  assert.equal(k.isTicked("10417910"), true, "and the tick is still there");
  k.prune([a[1]]); assert.equal(k.isTicked("10417910"), false);
  k.tick("104191740", true); k.clearTicks(); assert.equal(k.isTicked("104191740"), false);
});

test("the screen reads the ticks from the memory, loads it before the card, and discards through one confirmation", () => {
  const dir = path.join(__dirname, "..", "app"), ui = fs.readFileSync(path.join(dir, "unlisted.js"), "utf8"), home = fs.readFileSync(path.join(dir, "home.html"), "utf8");
  assert.ok(home.indexOf("unlisted-select.js") > 0 && home.indexOf("unlisted-select.js") < home.indexOf('"unlisted.js"'));
  assert.ok(ui.includes("keep.isTicked") && ui.includes("keep.tick") && ui.includes("keep.changed"));
  assert.ok(ui.includes("cmApp.unlistedReject(ids, act === \"discard\""));
});
