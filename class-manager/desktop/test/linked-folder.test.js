/* Linked folder (linked-folder.js) and provider detection (storage-providers.js): run with `npm test`. */
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { createLinkedFolder, KEEP } = require("../linked-folder");
const { detect, advice } = require("../storage-providers");

const tmp = (p) => fs.mkdtempSync(path.join(os.tmpdir(), p));
const book = JSON.stringify({ sheets: [{ name: "Key", rows: [["a"]] }], props: {} });
const content = () => ({ kind: "class-manager-backup", course: "phys-143", made: "2026-11-11", settings: {}, workbook: book });
const keychain = { protect: (b) => Buffer.concat([Buffer.from("KC:"), b]), unprotect: (b) => b.subarray(3), protected: true };
function make(extra) {
  let t = Date.parse("2026-11-11T10:00:00");
  const dir = tmp("cm-lf-course-"), folder = tmp("cm-lf-cloud-");
  const lf = createLinkedFolder(Object.assign({ dir, label: () => "PHYS 143", content, now: () => new Date((t += 60000)) }, keychain, extra || {}));
  return { lf, dir, folder };
}

test("providers are recognised from the path", () => {
  assert.equal(detect("/Users/a/Library/CloudStorage/GoogleDrive-a@x.org/My Drive/Teaching").id, "gdrive");
  assert.equal(detect("C:\\Users\\a\\OneDrive - University\\Class").id, "onedrive");
  assert.equal(detect("/Users/a/Dropbox/Class").id, "dropbox");
  assert.equal(detect("C:\\Users\\a\\MEGA\\Class").id, "mega");
  assert.equal(detect("/Users/a/Library/Mobile Documents/com~apple~CloudDocs/Class").id, "icloud");
  assert.equal(detect(path.join(tmp("cm-plain-"), "x")).id, "plain");
  assert.match(advice({ id: "dropbox", name: "Dropbox" }), /Dropbox will upload/);
});

test("a git working copy is recognised and the advice says to keep it private", () => {
  const repo = tmp("cm-git-"); fs.mkdirSync(path.join(repo, ".git")); fs.mkdirSync(path.join(repo, "sub"));
  const p = detect(path.join(repo, "sub"));
  assert.equal(p.id, "git");
  assert.match(advice(p), /private/);
});

test("linking needs a passphrase of 10 characters and a folder that can be written", () => {
  const { lf, folder } = make();
  assert.equal(lf.link(folder, "short", true).ok, false);
  assert.equal(lf.link("relative/path", "long enough pass", true).ok, false);
  assert.equal(lf.link(path.join(folder, "missing"), "long enough pass", true).ok, false);
  assert.equal(lf.state().linked, false);
});

test("linking makes a first copy that is encrypted and opens only with the passphrase", () => {
  const { lf, folder } = make();
  const r = lf.link(folder, "correct horse battery", true);
  assert.equal(r.ok, true);
  const s = lf.state();
  assert.equal(s.linked, true); assert.equal(s.auto, true); assert.equal(s.copies.length, 1);
  const dir = path.join(folder, "Class Manager", "PHYS-143");
  const raw = fs.readFileSync(path.join(dir, s.copies[0].name));
  assert.equal(raw.toString("utf8").includes("Key"), false, "the copy is not readable text");
  assert.equal(lf.open(s.copies[0].name, "correct horse battery").course, "phys-143");
  assert.throws(() => lf.open(s.copies[0].name, "wrong passphrase!!"), /passphrase/);
  assert.equal(fs.readdirSync(dir).some((f) => f.endsWith(".part")), false, "no half-written file is left");
});

test("without a keychain the passphrase is never stored and copies need it each time", () => {
  const { lf, dir, folder } = make({ protected: false });
  assert.equal(lf.link(folder, "correct horse battery", true).ok, true);
  assert.equal(lf.state().auto, false);
  assert.equal(fs.existsSync(path.join(dir, "linked-folder.key")), false);
  assert.equal(lf.auto(), null);
  assert.equal(lf.copyNow("").ok, false);
  assert.equal(lf.copyNow("correct horse battery").ok, true);
});

test("the remembered passphrase is encrypted by the keychain and lets copies run by themselves", () => {
  const { lf, dir, folder } = make();
  lf.link(folder, "correct horse battery", true);
  const stored = fs.readFileSync(path.join(dir, "linked-folder.key"));
  assert.equal(stored.includes(Buffer.from("correct horse battery")), true, "stand-in keychain only prefixes; real one encrypts");
  assert.equal(stored.subarray(0, 3).toString(), "KC:");
  const r = lf.auto();
  assert.equal(r.ok, true);
  assert.equal(lf.state().copies.length, 2);
});

test("automatic copies do nothing when the lecturer chose manual", () => {
  const { lf, folder } = make();
  lf.link(folder, "correct horse battery", false);
  assert.equal(lf.auto(), null);
  assert.equal(lf.state().copies.length, 1);
});

test("only the newest copies are kept", () => {
  const { lf, folder } = make();
  lf.link(folder, "correct horse battery", true);
  for (let i = 0; i < KEEP + 3; i++) assert.equal(lf.auto().ok, true);
  assert.equal(lf.state().copies.length, KEEP);
});

test("a missing folder is reported and does not lose the settings", () => {
  const { lf, folder } = make();
  lf.link(folder, "correct horse battery", true);
  fs.rmSync(folder, { recursive: true, force: true });
  const r = lf.auto();
  assert.equal(r.ok, false); assert.match(r.why, /not there|drive/);
  const s = lf.state();
  assert.equal(s.linked, true); assert.equal(s.reachable, false); assert.equal(s.last.ok, false);
});

test("a copy name outside the linked folder is refused", () => {
  const { lf, folder } = make();
  lf.link(folder, "correct horse battery", true);
  assert.throws(() => lf.open("../../etc/passwd", "correct horse battery"), /not a copy/);
});

test("unlinking forgets the folder and the passphrase but leaves the copies", () => {
  const { lf, dir, folder } = make();
  lf.link(folder, "correct horse battery", true);
  lf.unlink();
  assert.equal(lf.state().linked, false);
  assert.equal(fs.existsSync(path.join(dir, "linked-folder.key")), false);
  assert.equal(fs.readdirSync(path.join(folder, "Class Manager", "PHYS-143")).length, 1);
});
