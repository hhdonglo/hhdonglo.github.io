/* The lecturer's password (apps_script/src/06-password.gs): set, change, recover, reset, and the limits. */
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { classroom } = require("./classroom");

const PW1 = "river stone lantern 42", PW2 = "a different phrase 77";
const keyCell = (c) => c.backend.tab("Key")[1][9];

test("a new workbook has a temporary key, and says no password is chosen yet", () => {
  const c = classroom();
  const s = c.call({ action: "password_status" });
  assert.deepEqual([s.ok, s.chosen, s.recovery], [true, false, false]);
  assert.equal(c.call({ action: "hostcheck", hostkey: c.key }).ok, true);
});

test("first password: stored only as a slow hash, a recovery code is shown once, and the old key stops working", () => {
  const c = classroom();
  const r = c.call({ action: "setkey", hostkey: c.key, newkey: PW1 });
  assert.equal(r.ok, true);
  assert.match(r.recovery, /^[A-Z2-9]{5}(-[A-Z2-9]{5}){3}$/);
  assert.match(keyCell(c), /^pw1:\d+:[0-9a-f-]+:[0-9a-f]{64}$/);
  assert.ok(!keyCell(c).includes(PW1));
  const stored = JSON.stringify(c.backend.tabs()) + JSON.stringify(c.backend.tab("Key"));
  assert.ok(!stored.includes(r.recovery.replace(/-/g, "")), "the recovery code is not kept in the Key tab");
  assert.equal(c.call({ action: "hostcheck", hostkey: c.key }).ok, false);
  assert.equal(c.call({ action: "hostcheck", hostkey: PW1 }).ok, true);
  const s = c.call({ action: "password_status" });
  assert.deepEqual([s.chosen, s.recovery], [true, true]);
  assert.equal(c.reopen().call({ action: "hostcheck", hostkey: PW1 }).ok, true, "survives a restart");
});

test("a password that is too short, padded with spaces, repeated or unchanged is refused", () => {
  const c = classroom();
  for (const bad of ["short", "  padded password  ", "aaaaaaaaaaaa"]) {
    const r = c.call({ action: "setkey", hostkey: c.key, newkey: bad });
    assert.equal(r.ok, false); assert.ok(r.why);
  }
  assert.equal(c.call({ action: "setkey", hostkey: c.key, newkey: c.key }).ok, false, "the temporary key cannot be kept");
  assert.equal(c.call({ action: "hostcheck", hostkey: c.key }).ok, true, "nothing changed");
});

test("change: needs the current password; a new recovery code replaces the old one; old sessions end", () => {
  const c = classroom();
  const first = c.call({ action: "setkey", hostkey: c.key, newkey: PW1 });
  assert.equal(c.call({ action: "setkey", hostkey: "wrong password here", newkey: PW2 }).ok, false);
  const sess = c.call({ action: "hostcheck", hostkey: PW1 })._session;
  const second = c.call({ action: "setkey", hostkey: PW1, newkey: PW2 });
  assert.equal(second.ok, true);
  assert.notEqual(second.recovery, first.recovery);
  assert.equal(c.call({ action: "hostcheck", hostkey: sess }).ok, false, "the old session ended");
  assert.equal(c.call({ action: "hostcheck", hostkey: PW1 }).ok, false);
  assert.equal(c.call({ action: "hostcheck", hostkey: PW2 }).ok, true);
  assert.equal(c.call({ action: "password_recover", recovery: first.recovery, newkey: "x".repeat(12) + "y" }).ok, false, "the old recovery code no longer works");
  assert.equal(c.call({ action: "setkey", hostkey: PW2, newkey: PW2 }).ok, false, "unchanged is refused");
  // changing while signed in with a session also works
  const s2 = c.call({ action: "hostcheck", hostkey: PW2 })._session;
  assert.equal(c.call({ action: "setkey", hostkey: s2, newkey: PW1 }).ok, true);
});

test("recover: the recovery code sets a new password without the old one, once", () => {
  const c = classroom();
  const r = c.call({ action: "setkey", hostkey: c.key, newkey: PW1 });
  const typed = r.recovery.toLowerCase().replace(/-/g, " ");
  const rec = c.call({ action: "password_recover", recovery: typed, newkey: PW2 });
  assert.equal(rec.ok, true);
  assert.notEqual(rec.recovery, r.recovery);
  assert.equal(c.call({ action: "hostcheck", hostkey: PW1 }).ok, false);
  assert.equal(c.call({ action: "hostcheck", hostkey: PW2 }).ok, true);
  assert.equal(c.call({ action: "password_recover", recovery: r.recovery, newkey: PW1 }).ok, false, "a used code is dead");
  assert.equal(c.get({ action: "password_recover", recovery: rec.recovery, newkey: PW1 }).ok, false, "not by GET");
});

test("recover: a weak new password is refused and the code stays valid", () => {
  const c = classroom();
  const r = c.call({ action: "setkey", hostkey: c.key, newkey: PW1 });
  assert.equal(c.call({ action: "password_recover", recovery: r.recovery, newkey: "short" }).ok, false);
  assert.equal(c.call({ action: "password_recover", recovery: r.recovery, newkey: PW2 }).ok, true);
});

test("wrong passwords lock sign-in after the limit, and the right one is then refused until the wait ends", () => {
  const c = classroom();
  c.call({ action: "setkey", hostkey: c.key, newkey: PW1 });
  for (let i = 0; i < 10; i++) assert.equal(c.call({ action: "hostcheck", hostkey: "wrong-" + i }).ok, false);
  assert.equal(c.call({ action: "hostcheck", hostkey: PW1 }).ok, false, "locked");
});

test("wrong recovery codes are limited, and a locked-out guesser cannot recover", () => {
  const c = classroom();
  const r = c.call({ action: "setkey", hostkey: c.key, newkey: PW1 });
  for (let i = 0; i < 5; i++) assert.equal(c.call({ action: "password_recover", recovery: "AAAAA-BBBBB-CCCCC-DDDD" + i, newkey: PW2 }).ok, false);
  const r2 = c.call({ action: "password_recover", recovery: r.recovery, newkey: PW2 });
  assert.equal(r2.ok, false);
  assert.match(r2.why, /Too many/);
});

test("reset by the owner: a temporary key, no recovery code, every sign-in ended", () => {
  const c = classroom({ students: 1 });
  c.call({ action: "setkey", hostkey: c.key, newkey: PW1 });
  const sess = c.call({ action: "hostcheck", hostkey: PW1 })._session;
  const msg = c.backend.run("resetHostKey");
  const tmp = /Temporary key: (\w+) /.exec(msg)[1];
  assert.equal(c.call({ action: "hostcheck", hostkey: PW1 }).ok, false);
  assert.equal(c.call({ action: "hostcheck", hostkey: sess }).ok, false);
  assert.equal(c.call({ action: "hostcheck", hostkey: tmp }).ok, true);
  const s = c.call({ action: "password_status" });
  assert.deepEqual([s.chosen, s.recovery], [false, false]);
});

test("a key stored by the older sha256 format still signs in", () => {
  const c = classroom();
  const fs = require("fs"), path = require("path"), crypto = require("crypto");
  c.backend.flush();
  const f = path.join(c.dir, "workbook.json");
  const salt = "oldsalt", hash = crypto.createHash("sha256").update(salt + ":legacy password 99", "utf8").digest("hex");
  const txt = fs.readFileSync(f, "utf8").split(JSON.stringify(c.key)).join(JSON.stringify("sha256:" + salt + ":" + hash));
  assert.notEqual(txt, fs.readFileSync(f, "utf8"));
  fs.writeFileSync(f, txt);
  const d = c.reopen();
  assert.equal(d.call({ action: "hostcheck", hostkey: "legacy password 99" }).ok, true);
  assert.equal(d.call({ action: "password_status" }).chosen, true);
});
