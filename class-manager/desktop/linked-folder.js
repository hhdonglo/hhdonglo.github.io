/* Linked folder: an optional, encrypted copy of a course's records in a folder the lecturer chooses.
   The folder is usually one that Google Drive, OneDrive, Dropbox, MEGA or another desktop client keeps in step with
   the cloud (storage-providers.js), or a private git repository. Class Manager writes into the folder and reads
   from it; it never signs in to the provider and never sees the provider's files.
   - Off until the lecturer links a folder and chooses a passphrase of at least 10 characters.
   - Each copy is a .cmbackup file (vault.exportFile): AES-256-GCM with a key made from the passphrase. Student
     records never leave this computer in readable form. The provider sees only encrypted files.
   - Each copy is read back with the passphrase before it counts as made.
   - The passphrase is remembered (encrypted with the system keychain) only where the computer has a keychain, so
     that copies can be made on their own. Without one the lecturer types it for each copy.
   - Files go in <folder>/Class Manager/<course>/. The newest KEEP are kept; older copies are deleted from there.
   - Settings are kept in the course's folder (linked-folder.json), not in the linked folder.
   No Electron: the keychain and the content to copy are handed in. Tested in test/linked-folder.test.js. */
"use strict";
const fs = require("fs");
const path = require("path");
const { exportFile, importFile } = require("./vault");
const providers = require("./storage-providers");

const KEEP = 14;
const MIN_PASS = 10;
const NAME_RE = /^cm-[\w-]+-\d{8}-\d{6}\.cmbackup$/;

const safeLabel = (s) => String(s || "course").replace(/[^\w-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "course";
function stamp(d) { const p = (n) => String(n).padStart(2, "0"); return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + "-" + p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds()); }

// opts.dir: the course's folder; opts.label(): short course name; opts.content(): the data to copy (see vault.exportFile);
// opts.protect(buf)/unprotect(buf): the keychain; opts.protected: whether it is real; opts.now(): for tests.
function createLinkedFolder(opts) {
  const cfgFile = path.join(opts.dir, "linked-folder.json");
  const passFile = path.join(opts.dir, "linked-folder.key");
  const now = opts.now || (() => new Date());
  const read = () => { try { return JSON.parse(fs.readFileSync(cfgFile, "utf8")); } catch (e) { return {}; } };
  const write = (o) => { fs.mkdirSync(opts.dir, { recursive: true }); const t = cfgFile + ".tmp"; fs.writeFileSync(t, JSON.stringify(o, null, 1), { mode: 0o600 }); fs.renameSync(t, cfgFile); };
  const target = (cfg) => path.join(cfg.folder, "Class Manager", safeLabel(opts.label()));
  const storedPass = () => { try { return opts.unprotect(fs.readFileSync(passFile)).toString("utf8"); } catch (e) { return ""; } };

  function list() {
    const cfg = read(); if (!cfg.folder) return [];
    let names = [];
    try { names = fs.readdirSync(target(cfg)).filter((f) => NAME_RE.test(f)).sort().reverse(); } catch (e) { /* none yet, or the folder is not there */ }
    return names.map((f) => { const st = fs.statSync(path.join(target(cfg), f)); return { name: f, bytes: st.size, at: st.mtimeMs }; });
  }
  function state() {
    const cfg = read();
    if (!cfg.folder) return { linked: false, keychain: !!opts.protected };
    const provider = providers.detect(cfg.folder);
    let reachable = true; try { reachable = fs.statSync(cfg.folder).isDirectory(); } catch (e) { reachable = false; }
    return { linked: true, folder: cfg.folder, provider, advice: providers.advice(provider), reachable, auto: !!cfg.auto && fs.existsSync(passFile),
      keychain: !!opts.protected, remembered: fs.existsSync(passFile), last: cfg.last || null, copies: list(), keep: KEEP };
  }
  function prune(cfg) { list().slice(KEEP).forEach((c) => { try { fs.unlinkSync(path.join(target(cfg), c.name)); } catch (e) { /* in use */ } }); }

  // Makes one copy and reads it back. pass is needed unless it is remembered.
  function copyNow(pass) {
    const cfg = read();
    if (!cfg.folder) return { ok: false, why: "No folder is linked." };
    const p = String(pass || "") || storedPass();
    if (p.length < MIN_PASS) return { ok: false, why: "Enter the passphrase for the linked folder (at least " + MIN_PASS + " characters)." };
    let out;
    try {
      if (!fs.statSync(cfg.folder).isDirectory()) throw new Error("not a folder");
      const buf = exportFile(opts.content(), p);
      const dir = target(cfg); fs.mkdirSync(dir, { recursive: true });
      let t = now().getTime(), name;
      do { name = "cm-" + safeLabel(opts.label()) + "-" + stamp(new Date(t)) + ".cmbackup"; t += 1000; } while (fs.existsSync(path.join(dir, name)));
      const tmp = path.join(dir, name + ".part");
      fs.writeFileSync(tmp, buf, { mode: 0o600 });
      fs.renameSync(tmp, path.join(dir, name)); // the sync client never sees a half-written file under its final name
      importFile(fs.readFileSync(path.join(dir, name)), p); // read back with the passphrase before saying it is done
      out = { ok: true, name, at: now().toISOString(), bytes: buf.length };
    } catch (e) {
      out = { ok: false, why: "The copy was not made: " + (e.code === "ENOENT" ? "the linked folder is not there (is the drive connected?)" : e.message), at: now().toISOString() };
    }
    write(Object.assign({}, cfg, { last: out }));
    if (out.ok) prune(cfg);
    return out;
  }

  // Links a folder. The passphrase is checked, the folder is tested by writing and removing a file.
  function link(folder, pass, auto) {
    folder = String(folder || "");
    if (!folder || !path.isAbsolute(folder)) return { ok: false, why: "Choose a folder." };
    if (String(pass || "").length < MIN_PASS) return { ok: false, why: "Choose a passphrase of at least " + MIN_PASS + " characters. Keep it safe: without it a copy cannot be opened." };
    try {
      const probe = path.join(folder, ".class-manager-test-" + process.pid);
      fs.writeFileSync(probe, "ok"); fs.unlinkSync(probe);
    } catch (e) { return { ok: false, why: "Class Manager cannot write to that folder." }; }
    fs.mkdirSync(opts.dir, { recursive: true });
    try { fs.unlinkSync(passFile); } catch (e) { /* none */ }
    if (opts.protected && auto) fs.writeFileSync(passFile, opts.protect(Buffer.from(String(pass), "utf8")), { mode: 0o600 });
    write({ folder, auto: !!(opts.protected && auto), linked: now().toISOString() });
    const first = copyNow(pass);
    return Object.assign({ ok: first.ok, first }, state());
  }
  function unlink() { // the copies already in the folder are left alone
    try { fs.unlinkSync(passFile); } catch (e) { /* none */ }
    try { fs.unlinkSync(cfgFile); } catch (e) { /* none */ }
    return state();
  }
  // Called after the app's own backups: a copy only if linked, automatic and remembered.
  function auto() {
    const cfg = read();
    return cfg.folder && cfg.auto && fs.existsSync(passFile) ? copyNow("") : null;
  }
  // The content of one copy, for restore. name must be a copy of this course in the linked folder.
  function open(name, pass) {
    const cfg = read();
    if (!cfg.folder || !NAME_RE.test(String(name))) throw new Error("not a copy in the linked folder");
    const p = String(pass || "") || storedPass();
    return importFile(fs.readFileSync(path.join(target(cfg), name)), p);
  }
  return { state, link, unlink, copyNow, auto, list, open };
}

module.exports = { createLinkedFolder, KEEP, MIN_PASS };
