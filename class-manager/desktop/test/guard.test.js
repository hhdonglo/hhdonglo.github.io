"use strict";
// Location limit for check-ins, the oversized class list safeguard, and the reset default. Made-up numbers only.
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const { isPrivateAddress, guardFor } = require("../attendance-guard");
const { oversized } = require("../autoload/oversize");

test("private addresses are recognised", () => {
  ["192.168.1.20", "10.0.0.5", "172.16.4.4", "172.31.9.9", "::ffff:192.168.0.7", "127.0.0.1"].forEach((a) => assert.ok(isPrivateAddress(a), a));
  ["8.8.8.8", "172.32.0.1", "41.66.1.2"].forEach((a) => assert.ok(!isPrivateAddress(a), a));
});

test("Wi-Fi mode: check-in from outside the network is refused", () => {
  const g = guardFor({ remote: false, tunnelOn: false, action: "attend", remoteAddress: "41.66.1.2" }, {});
  assert.strictEqual(g.refuse.why, "not on network");
  assert.strictEqual(guardFor({ remote: false, tunnelOn: false, action: "attend", remoteAddress: "192.168.1.9" }, {}).refuse, null);
});

test("Internet mode turns the location check on, and the setting can turn it off", () => {
  assert.strictEqual(guardFor({ remote: true, tunnelOn: true, action: "attend", remoteAddress: "41.66.1.2" }, {}).geo, "enforce");
  assert.strictEqual(guardFor({ remote: true, tunnelOn: true, action: "attend", remoteAddress: "41.66.1.2" }, { geoInternet: false }).geo, "off");
});

test("a class list far larger than the other files is flagged", () => {
  const files = [{ id: 0, summary: { students: 140 } }, { id: 1, summary: { students: 138 } }, { id: 2, summary: { students: 1500 } }];
  const big = oversized(files);
  assert.deepStrictEqual(Object.keys(big), ["2"]);
  assert.strictEqual(Object.keys(oversized([{ id: 0, summary: { students: 140 } }, { id: 1, summary: { students: 150 } }])).length, 0);
  assert.strictEqual(Object.keys(oversized([{ id: 0, summary: { students: 1500 } }])).length, 0);
});

test("reset offers everything first and ticked", () => {
  const src = fs.readFileSync(path.join(__dirname, "../app/reset.js"), "utf8");
  assert.ok(/value='all' checked/.test(src));
  assert.ok(!/value='setup' checked/.test(src));
});

test("the host key is never printed in the page", () => {
  const html = fs.readFileSync(path.join(__dirname, "../app/home.html"), "utf8");
  assert.ok(!/id="key-show"/.test(html) && !/id="ct-lan"/.test(html));
  assert.ok(/id="live-menu"/.test(html) && /id="pw-d"/.test(html));
});
