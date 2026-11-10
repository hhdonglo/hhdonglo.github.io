/* Records at rest, backups and restore (vault.js): run with `npm test` in class-manager/desktop.
   Item 10 of the review's minimum release suite: backup, restore and version upgrade are tested. */
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { createVault, createBackups, exportFile, importFile, KEEP_AUTO } = require("../vault");
const { createBackend } = require("../backend");
const C = require("../courses");

const WEB = path.resolve(__dirname, "..", "..");
const tmp = (p) => fs.mkdtempSync(path.join(os.tmpdir(), p));
// A stand-in for the keychain: it only marks the key, which is enough to show that the key file is not the raw key.
const fakeKeychain = (dir) => createVault({ keyFile: path.join(dir, "data.key"), protected: true,
  protect: (b) => Buffer.concat([Buffer.from("KC:"), b]), unprotect: (b) => b.subarray(3) });

function course(dir, vault) {
  const file = path.join(dir, "data", "workbook.json");
  const b = createBackend({ webRoot: WEB, dataFile: file, vault, log: () => {} });
  return { file, b };
}

test("the workbook is encrypted on disk and reads back the same", () => {
  const dir = tmp("cm-vault-"), vault = fakeKeychain(dir);
  const { file, b } = course(dir, vault);
  b.rosterSync([["20001111", "Abena Mensah"]], true); b.flush();
  const raw = fs.readFileSync(file);
  assert.equal(raw.subarray(0, 4).toString(), "CMV1");
  assert.ok(!raw.includes("20001111") && !raw.includes("Abena"), "no student data in clear on disk");
  assert.ok(!fs.readFileSync(path.join(dir, "data.key")).subarray(3).equals(Buffer.alloc(32)), "a real key");
  const again = createBackend({ webRoot: WEB, dataFile: file, vault: fakeKeychain(dir), log: () => {} });
  assert.deepEqual(again.tab("Roster").slice(1), [["20001111", "Abena Mensah"]]);
});

test("version upgrade: a plain workbook from 0.7.0 is migrated, read and then written encrypted, with nothing lost", () => {
  const root = tmp("cm-up-");
  fs.writeFileSync(path.join(root, "settings.json"), JSON.stringify({ courseCode: "PHYS 143", port: 8143 }));
  const old = createBackend({ webRoot: WEB, dataFile: path.join(root, "data", "workbook.json"), log: () => {} }); // 0.7.0: no vault
  old.rosterSync([["20002222", "Kojo"]], true); const key = old.hostKey(); old.flush();
  assert.equal(fs.readFileSync(path.join(root, "data", "workbook.json"), "utf8").charAt(0), "{");
  assert.equal(C.migrateLegacy(root).migrated, "phys-143");
  const reg = C.createRegistry(root), d = reg.dirs("phys-143");
  const b = createBackend({ webRoot: WEB, dataFile: d.workbook, vault: fakeKeychain(root), log: () => {} });
  assert.equal(b.hostKey(), key);
  assert.deepEqual(b.tab("Roster").slice(1), [["20002222", "Kojo"]]);
  b.flush();
  assert.equal(fs.readFileSync(d.workbook).subarray(0, 4).toString(), "CMV1", "encrypted from the first save");
});

test("a workbook that cannot be read is kept aside, never overwritten", () => {
  const dir = tmp("cm-bad-");
  const { file, b } = course(dir, fakeKeychain(dir));
  b.rosterSync([["20003333", "Esi"]], true); b.flush();
  const before = fs.readFileSync(file);
  const other = tmp("cm-other-"); // another computer: another key
  const b2 = createBackend({ webRoot: WEB, dataFile: file, vault: fakeKeychain(other), log: () => {} });
  const p = b2.loadProblem();
  assert.ok(p && fs.existsSync(p.file), "the unreadable file is kept");
  assert.ok(fs.readFileSync(p.file).equals(before), "byte for byte");
});

test("automatic backups are checked when made, pruned to the newest, and restore the records", () => {
  const dir = tmp("cm-bk-"), vault = fakeKeychain(dir);
  const { file, b } = course(dir, vault);
  const bk = createBackups({ dir: path.join(dir, "backups"), workbook: file, vault });
  b.rosterSync([["20004444", "Ama"]], true); b.flush();
  const first = bk.make("");
  assert.equal(first.ok, true); assert.ok(first.check.hasKey); assert.ok(first.check.rows > 0);
  assert.equal(bk.verify(first.name).ok, true);
  for (let i = 0; i < KEEP_AUTO + 5; i++) bk.make("");
  assert.equal(bk.list().length, KEEP_AUTO, "only the newest are kept");
  // Records change after the backup; restoring brings back the backed-up state and keeps the current one.
  const keep = bk.list()[0].name;
  b.rosterSync([["20005555", "Yaw"]], true); b.flush();
  const r = bk.restore(keep);
  assert.equal(r.ok, true); assert.ok(r.kept && /-restore\.cmv$/.test(r.kept));
  const after = createBackend({ webRoot: WEB, dataFile: file, vault, log: () => {} });
  assert.deepEqual(after.tab("Roster").slice(1).map((x) => x[0]), ["20004444"]);
  assert.ok(bk.list().some((x) => x.reason === "restore"));
  // A damaged backup is reported, not restored.
  const bad = path.join(dir, "backups", bk.list()[0].name);
  const buf = fs.readFileSync(bad); buf[buf.length - 1] ^= 1; fs.writeFileSync(bad, buf);
  assert.equal(bk.verify(path.basename(bad)).ok, false);
  assert.throws(() => bk.restore("../data/workbook.json"));
});

test("a backup file restores on another computer with the passphrase, and only with it", () => {
  const dir = tmp("cm-fx-"), vault = fakeKeychain(dir);
  const { file, b } = course(dir, vault);
  b.rosterSync([["20006666", "Kwame"]], true); b.flush();
  const content = { kind: "class-manager-backup", course: "phys-143", settings: { courseCode: "PHYS 143" }, workbook: vault.decode(fs.readFileSync(file)) };
  assert.throws(() => exportFile(content, "short"), /10 characters/);
  const buf = exportFile(content, "correct horse battery");
  assert.ok(!buf.includes("20006666"));
  assert.throws(() => importFile(buf, "wrong passphrase!!"), /passphrase is not right/);
  const tampered = Buffer.from(buf); tampered[60] ^= 1;
  assert.throws(() => importFile(tampered, "correct horse battery"));
  assert.throws(() => importFile(Buffer.from("not a backup at all, just text"), "x"), /not a Class Manager backup/);
  // Another computer: another key, an empty course, then the restore.
  const dir2 = tmp("cm-fx2-"), vault2 = fakeKeychain(dir2);
  const target = course(dir2, vault2);
  target.b.flush();
  const got = importFile(buf, "correct horse battery");
  assert.equal(got.settings.courseCode, "PHYS 143");
  createBackups({ dir: path.join(dir2, "backups"), workbook: target.file, vault: vault2 }).restoreText(got.workbook);
  const restored = createBackend({ webRoot: WEB, dataFile: target.file, vault: vault2, log: () => {} });
  assert.deepEqual(restored.tab("Roster").slice(1), [["20006666", "Kwame"]]);
});
