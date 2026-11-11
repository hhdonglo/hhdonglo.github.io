/* The desktop server's access rules (access.js) and the lifecycle of the internet address (tunnel.js).
   Run with `npm test` in class-manager/desktop. The tunnel test uses a stand-in for cloudflared, so it needs no network. */
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { cleanSecurity, lecturerRefusal, SECURITY_DEFAULTS } = require("../access");
const { createTunnel } = require("../tunnel");

test("lecturer requests through the internet address are refused unless the lecturer allows them", () => {
  const lect = { action: "class_stats", hostkey: "s1.h.host.x.y" };
  assert.equal(lecturerRefusal({ action: "status", code: "26271" }, { remote: true }, SECURITY_DEFAULTS), null, "students are not affected");
  assert.equal(lecturerRefusal(lect, { remote: true }, SECURITY_DEFAULTS).ok, false);
  assert.equal(lecturerRefusal(lect, { remote: true }, { lecturerOnline: true }), null);
  assert.equal(lecturerRefusal(lect, { remote: false, thisComputer: false }, SECURITY_DEFAULTS), null, "the local network is allowed by default");
  assert.equal(lecturerRefusal(lect, { remote: false, thisComputer: false }, { lecturerFrom: "computer" }).ok, false);
  assert.equal(lecturerRefusal(lect, { remote: false, thisComputer: true }, { lecturerFrom: "computer" }), null);
});

test("security settings keep only known values", () => {
  assert.deepEqual(cleanSecurity({}), SECURITY_DEFAULTS);
  assert.deepEqual(cleanSecurity({ tunnelHours: 7, lecturerFrom: "anywhere", lecturerOnline: "yes" }), SECURITY_DEFAULTS);
  assert.deepEqual(cleanSecurity({ tunnelHours: 0, lecturerFrom: "computer", lecturerOnline: true }), { tunnelHours: 0, lecturerFrom: "computer", lecturerOnline: true });
  assert.deepEqual(cleanSecurity({ tunnelHours: 2 }, { lecturerFrom: "computer" }), { tunnelHours: 2, lecturerFrom: "computer", lecturerOnline: false }, "fields left out keep their value");
});

test("the internet address stops by itself after the set time, and counts what arrives", { skip: process.platform === "win32" }, async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cm-tun-"));
  const fake = path.join(dir, "cloudflared");
  fs.writeFileSync(fake, "#!/usr/bin/env node\nconsole.error('INF https://test-quick-tunnel.trycloudflare.com');setInterval(()=>{},1000);\n", { mode: 0o755 });
  process.env.CM_CLOUDFLARED = fake;
  try {
    const t = createTunnel({ dir });
    await t.start(1, { hours: 0.0005 }); // about two seconds
    for (let i = 0; i < 50 && t.status().state !== "on"; i++) await new Promise((r) => setTimeout(r, 50));
    const on = t.status();
    assert.equal(on.state, "on"); assert.ok(on.stopsAt > Date.now());
    t.note("request", "1.2.3.4"); t.note("request", "1.2.3.4"); t.note("request", "5.6.7.8"); t.note("limited"); t.note("lecturer");
    assert.deepEqual(t.status().counts, { requests: 3, visitors: 2, limited: 1, lecturer: 1 });
    for (let i = 0; i < 80 && t.status().state !== "off"; i++) await new Promise((r) => setTimeout(r, 50));
    assert.equal(t.status().state, "off");
    assert.match(t.status().note, /stopped automatically/);
  } finally { delete process.env.CM_CLOUDFLARED; }
});
