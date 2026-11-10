/* Protection of student records at rest, and backups that can be restored.

   - The workbook of each course (data/workbook.json) is written encrypted: AES-256-GCM with a random 256-bit data key.
     The data key is kept in the app's data folder (data.key), itself encrypted with the system keychain (Electron
     safeStorage) where the computer offers one. Copying the data folder to another computer does not copy the keychain,
     so the copy cannot be read there. Where no keychain is available the key is stored with owner-only permissions and
     the app says that the records are not protected by the keychain.
   - A workbook written by an earlier version (plain JSON) is read as it is and written encrypted at the next save.
   - Automatic backups: a copy of the encrypted workbook in the course's backups/ folder when the app starts, every
     few hours while it runs and when it closes; the newest KEEP_AUTO are kept. Each new backup is read back and
     checked (decrypted and parsed) at once, so a backup that could not be restored is reported, not discovered later.
   - Backup to a file: the workbook and the course settings in one file, encrypted with a key made from a passphrase
     (scrypt), so it can be restored on another computer. Restore checks the passphrase (the GCM tag) and the content
     before anything is replaced, and keeps the current workbook as a backup first. */
"use strict";
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const MAGIC = Buffer.from("CMV1"); // workbook or automatic backup, encrypted with the data key
const FILE_MAGIC = Buffer.from("CMB1"); // backup file, encrypted with a passphrase
const KEEP_AUTO = 14;

function seal(key, plain) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", key, iv);
  const body = Buffer.concat([c.update(plain), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), body]);
}
function open(key, buf) {
  const iv = buf.subarray(0, 12), tag = buf.subarray(12, 28), body = buf.subarray(28);
  const d = crypto.createDecipheriv("aes-256-gcm", key, iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(body), d.final()]); // throws if the key is wrong or the data were changed
}

// opts.keyFile; opts.protect(buf) -> buf and opts.unprotect(buf) -> buf (the keychain); opts.protected: whether they are real.
function createVault(opts) {
  let key = null;
  function dataKey() {
    if (key) return key;
    if (fs.existsSync(opts.keyFile)) key = opts.unprotect(fs.readFileSync(opts.keyFile));
    else {
      key = crypto.randomBytes(32);
      fs.mkdirSync(path.dirname(opts.keyFile), { recursive: true });
      fs.writeFileSync(opts.keyFile, opts.protect(key), { mode: 0o600 });
    }
    if (key.length !== 32) throw new Error("The data key of this computer could not be read.");
    return key;
  }
  const isSealed = (buf) => buf.length > 32 && buf.subarray(0, 4).equals(MAGIC);
  return {
    protected: !!opts.protected,
    isSealed,
    encode: (text) => Buffer.concat([MAGIC, seal(dataKey(), Buffer.from(text, "utf8"))]),
    decode: (buf) => (isSealed(buf) ? open(dataKey(), buf.subarray(4)).toString("utf8") : buf.toString("utf8")) // plain JSON from an earlier version
  };
}

// ---------- backups ----------
function stamp(d) { const p = (n) => String(n).padStart(2, "0"); return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + "-" + p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds()) + String(d.getMilliseconds()).padStart(3, "0"); }
function checkBook(text) { // a workbook that can be restored: JSON with a list of tabs
  const b = JSON.parse(text);
  if (!b || !Array.isArray(b.sheets) || typeof b.props !== "object") throw new Error("not a Class Manager workbook");
  return { tabs: b.sheets.length, rows: b.sheets.reduce((n, s) => n + (Array.isArray(s.rows) ? s.rows.length : 0), 0), hasKey: b.sheets.some((s) => s.name === "Key") };
}

// dir: the course's backups/ folder; workbook: the course's workbook file; vault: as above.
function createBackups(opts) {
  const dir = opts.dir, vault = opts.vault;
  function list() {
    let names = [];
    try { names = fs.readdirSync(dir).filter((f) => /^workbook-\d{8}-\d{9}(-[a-z]+)?\.cmv$/.test(f)).sort().reverse(); } catch (e) { /* none yet */ }
    return names.map((f) => { const st = fs.statSync(path.join(dir, f)); return { name: f, bytes: st.size, at: st.mtimeMs, reason: (/-([a-z]+)\.cmv$/.exec(f) || [])[1] || "auto" }; });
  }
  // Copies the workbook as it is on disk (already encrypted), then reads the copy back to prove it can be restored.
  function make(reason) {
    if (!fs.existsSync(opts.workbook)) return { ok: false, why: "no workbook yet" };
    fs.mkdirSync(dir, { recursive: true });
    const raw = fs.readFileSync(opts.workbook);
    const sealed = vault.isSealed(raw) ? raw : vault.encode(raw.toString("utf8"));
    const tag = reason ? "-" + reason.replace(/[^a-z]/g, "") : "";
    let t = Date.now(), name;
    do { name = "workbook-" + stamp(new Date(t++)) + tag + ".cmv"; } while (fs.existsSync(path.join(dir, name)));
    fs.writeFileSync(path.join(dir, name), sealed, { mode: 0o600 });
    let check;
    try { check = checkBook(vault.decode(fs.readFileSync(path.join(dir, name)))); } catch (e) { return { ok: false, name, why: "the backup could not be read back: " + e.message }; }
    prune();
    return { ok: true, name, check };
  }
  function prune() { list().filter((b) => b.reason !== "restore").slice(KEEP_AUTO).forEach((b) => { try { fs.unlinkSync(path.join(dir, b.name)); } catch (e) { /* in use */ } }); }
  function read(name) {
    if (!/^workbook-[\w-]+\.cmv$/.test(name)) throw new Error("not a backup of this course");
    return vault.decode(fs.readFileSync(path.join(dir, name)));
  }
  function verify(name) { try { return Object.assign({ ok: true, name }, checkBook(read(name))); } catch (e) { return { ok: false, name, why: e.message }; } }
  // Replaces the workbook with a backup's content. The caller closes the course first and opens it again after.
  function restoreText(text) {
    const check = checkBook(text);
    const before = fs.existsSync(opts.workbook) ? make("restore") : null; // the records as they were, in case this was a mistake
    const tmp = opts.workbook + ".tmp";
    fs.mkdirSync(path.dirname(opts.workbook), { recursive: true });
    fs.writeFileSync(tmp, vault.encode(text)); fs.renameSync(tmp, opts.workbook);
    return { ok: true, check, kept: before && before.name };
  }
  return { list, make, verify, read, restoreText, restore: (name) => restoreText(read(name)) };
}

// ---------- backup to a file, for another computer ----------
function exportFile(content, passphrase) { // content: {workbook: text, settings: object, course, made}
  if (String(passphrase || "").length < 10) throw new Error("Choose a passphrase of at least 10 characters.");
  const salt = crypto.randomBytes(16);
  const key = crypto.scryptSync(String(passphrase), salt, 32, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  return Buffer.concat([FILE_MAGIC, salt, seal(key, Buffer.from(JSON.stringify(content), "utf8"))]);
}
function importFile(buf, passphrase) {
  if (!buf.subarray(0, 4).equals(FILE_MAGIC)) throw new Error("This is not a Class Manager backup file.");
  const salt = buf.subarray(4, 20);
  const key = crypto.scryptSync(String(passphrase || ""), salt, 32, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  let text;
  try { text = open(key, buf.subarray(20)).toString("utf8"); } catch (e) { throw new Error("The passphrase is not right, or the file was changed."); }
  const content = JSON.parse(text);
  checkBook(content.workbook);
  return content;
}

module.exports = { createVault, createBackups, exportFile, importFile, checkBook, KEEP_AUTO };
