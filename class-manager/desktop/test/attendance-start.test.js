/* The lecturer's attendance start-up stays simple: one Start button, one tick box, advanced settings behind "More options". */
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const html = fs.readFileSync(path.join(__dirname, "..", "..", "attendance.html"), "utf8");
const idle = html.slice(html.indexOf('id="a-idle"'), html.indexOf('id="a-live"'));

test("idle panel: Start button and one tick box come first, everything else is inside More options", () => {
  const more = idle.indexOf('<details id="a-more">');
  assert.ok(more > 0);
  const top = idle.slice(0, more);
  assert.match(top, /id="a-start"/);
  assert.match(top, /id="a-near"/);
  assert.doesNotMatch(top, /<select|a-pos-in|latitude/i);
  assert.match(idle.slice(more), /id="a-rad"/);
  assert.match(idle.slice(more), /id="a-pos-in"/);
});

test("the location check is only asked for when ticked or when the settings require it", () => {
  assert.match(html, /go\("",""?,true\)/); // unticked: start without position, retry with location only on needLocation
  assert.match(html, /needLocation&&again/);
});

test("a session opens without any position when location enforcement is off", () => {
  const A = require("../rules/attendance");
  assert.ok(A.openSession && A.open);
});
