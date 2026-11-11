/* Linked storage: an optional, encrypted copy of a course's records somewhere the lecturer chooses.
   Where: a folder that a sync app (Google Drive, OneDrive, Dropbox, MEGA, iCloud and others) keeps in the cloud
   (storage-providers.js), a private git repository folder, or a service the app talks to itself with the
   lecturer's own credentials: WebDAV, GitHub, Dropbox, S3-compatible (storage/). The lecturer registers with those
   services; the app holds no developer keys.
   - Off until the lecturer links a place and chooses a passphrase of at least 10 characters.
   - Each copy is a .cmbackup file (vault.exportFile): AES-256-GCM with a key made from the passphrase. The
     provider sees only encrypted files.
   - Each copy is read back with the passphrase before it counts as made.
   - Credentials and the passphrase are remembered (encrypted with the system keychain) only where the computer has
     one. A service link needs a keychain; a folder link works without (copies then need the passphrase each time).
   - Files go in Class Manager/<course>/. The newest KEEP are kept; older copies are deleted from there.
   - Settings are kept in the course's data folder (linked-folder.json), never in the linked place.
   Everything here is async, because a service takes a network round trip. No Electron: the keychain, the content to
   copy and fetch are handed in. Tested in test/linked-folder.test.js. */
"use strict";
const fs = require("fs");
const path = require("path");
const { exportFile, importFile } = require("./vault");
const folders = require("./storage-providers");
const storage = require("./storage");

const KEEP = 14;
const MIN_PASS = 10;
const NAME_RE = /^cm-[\w-]+-\d{8}-\d{6}\.cmbackup$/;

const safeLabel = (s) => String(s || "course").replace(/[^\w-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "course";
function stamp(d) { const p = (n) => String(n).padStart(2, "0"); return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + "-" + p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds()); }
function atOf(name) { const m = /(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})\.cmbackup$/.exec(name); return m ? new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]).getTime() : 0; }

// A place to keep copies: put(name, buf), list() -> [{name, bytes}], get(name), remove(name), writable().
function folderPlace(folder, label) {
  const dir = path.join(folder, "Class Manager", label);
  return {
    async check() { const probe = path.join(folder, ".class-manager-test-" + process.pid); fs.writeFileSync(probe, "ok"); fs.unlinkSync(probe); },
    async put(name, buf) { fs.mkdirSync(dir, { recursive: true }); const t = path.join(dir, name + ".part"); fs.writeFileSync(t, buf, { mode: 0o600 }); fs.renameSync(t, path.join(dir, name)); }, // a sync app never sees a half-written file under its final name
    async list() { try { return fs.readdirSync(dir).filter((f) => NAME_RE.test(f)).map((f) => ({ name: f, bytes: fs.statSync(path.join(dir, f)).size })); } catch (e) { return []; } },
    async get(name) { return fs.readFileSync(path.join(dir, name)); },
    async remove(name) { try { fs.unlinkSync(path.join(dir, name)); } catch (e) { /* in use */ } },
    // Any file under Class Manager/<course>/ (course synchronisation): paths use "/" and stay inside that folder.
    async rawList(rel) { try { return fs.readdirSync(path.join(dir, ...String(rel).split("/").filter(Boolean)), { withFileTypes: true }).map((d) => (d.isDirectory() ? { name: d.name, dir: true } : { name: d.name, bytes: fs.statSync(path.join(dir, ...String(rel).split("/").filter(Boolean), d.name)).size })); } catch (e) { return []; } },
    async rawGet(rel) { return fs.readFileSync(path.join(dir, ...safeRel(rel))); },
    async rawPut(rel, buf) { const f = path.join(dir, ...safeRel(rel)); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f + ".part", buf, { mode: 0o600 }); fs.renameSync(f + ".part", f); }
  };
}
function safeRel(rel) { const p = String(rel).split("/").filter(Boolean); if (!p.length || p.some((x) => x === ".." || x === "." || /[\\\0]/.test(x))) throw new Error("unsafe path"); return p; }
function servicePlace(client, label) {
  const dir = "Class Manager/" + label;
  return {
    rawList: async (rel) => { try { return await client.list(dir + (rel ? "/" + rel : "")); } catch (e) { return []; } },
    rawGet: (rel) => client.get(dir + "/" + safeRel(rel).join("/")),
    rawPut: (rel, buf) => client.put(dir + "/" + safeRel(rel).join("/"), buf),
    check: () => client.check(),
    put: (name, buf) => client.put(dir + "/" + name, buf),
    list: async () => (await client.list(dir)).filter((f) => NAME_RE.test(f.name)),
    get: (name) => client.get(dir + "/" + name),
    remove: (name) => client.remove(dir + "/" + name).catch(() => {})
  };
}

// opts.dir: the course's folder; opts.label(): short course name; opts.content(): the data to copy (see vault.exportFile);
// opts.protect(buf)/unprotect(buf): the keychain; opts.protected: whether it is real; opts.fetch; opts.now(): for tests.
function createLinkedFolder(opts) {
  const cfgFile = path.join(opts.dir, "linked-folder.json");
  const passFile = path.join(opts.dir, "linked-folder.key");
  const credFile = path.join(opts.dir, "linked-folder.cred");
  const now = opts.now || (() => new Date());
  const fetchFn = opts.fetch || ((...a) => globalThis.fetch(...a));
  const read = () => { try { return JSON.parse(fs.readFileSync(cfgFile, "utf8")); } catch (e) { return {}; } };
  const write = (o) => { fs.mkdirSync(opts.dir, { recursive: true }); const t = cfgFile + ".tmp"; fs.writeFileSync(t, JSON.stringify(o, null, 1), { mode: 0o600 }); fs.renameSync(t, cfgFile); };
  const storedPass = () => { try { return opts.unprotect(fs.readFileSync(passFile)).toString("utf8"); } catch (e) { return ""; } };
  const label = () => safeLabel(opts.label());
  const isService = (cfg) => !!cfg.kind && cfg.kind !== "folder";
  function place(cfg, creds) {
    if (!isService(cfg)) return folderPlace(cfg.folder, label());
    const p = storage.byId(cfg.kind); if (!p) throw new Error("Unknown storage service.");
    let c = creds; if (!c) { try { c = JSON.parse(opts.unprotect(fs.readFileSync(credFile)).toString("utf8")); } catch (e) { throw new Error("The saved credentials could not be read. Link the service again."); } }
    return servicePlace(p.create(c, { fetch: fetchFn, now }), label());
  }

  async function list(cfg) {
    cfg = cfg || read(); if (!cfg.kind && !cfg.folder) return [];
    if (!cfg.kind) cfg.kind = "folder"; // a link made before services were added
    try { return (await place(cfg).list()).map((f) => Object.assign({ at: atOf(f.name) }, f)).sort((a, b) => (a.name < b.name ? 1 : -1)); } catch (e) { return []; }
  }
  async function state() {
    const cfg = read();
    if (!cfg.folder && !isService(cfg)) return { linked: false, keychain: !!opts.protected, services: storage.describe() };
    const service = isService(cfg) ? storage.byId(cfg.kind) : null;
    const provider = service ? { id: service.id, name: service.name } : folders.detect(cfg.folder);
    let reachable = true; if (!service) { try { reachable = fs.statSync(cfg.folder).isDirectory(); } catch (e) { reachable = false; } }
    return { linked: true, kind: service ? service.id : "folder", folder: service ? "" : cfg.folder, provider, advice: service ? service.name + ": copies are sent to your account with the credentials you gave." : folders.advice(provider),
      reachable, auto: !!cfg.auto && fs.existsSync(passFile), keychain: !!opts.protected, remembered: fs.existsSync(passFile), last: cfg.last || null, copies: await list(cfg), keep: KEEP, services: storage.describe() };
  }
  async function prune(cfg, p) { for (const c of (await list(cfg)).slice(KEEP)) await p.remove(c.name); }

  // Makes one copy and reads it back. pass is needed unless it is remembered.
  async function copyNow(pass) {
    const cfg = read();
    if (!cfg.folder && !isService(cfg)) return { ok: false, why: "Nothing is linked." };
    const p = String(pass || "") || storedPass();
    if (p.length < MIN_PASS) return { ok: false, why: "Enter the passphrase for the linked storage (at least " + MIN_PASS + " characters)." };
    let out;
    try {
      const pl = place(cfg);
      await pl.check();
      const buf = exportFile(opts.content(), p);
      const have = new Set((await pl.list()).map((f) => f.name));
      let t = now().getTime(), name;
      do { name = "cm-" + label() + "-" + stamp(new Date(t)) + ".cmbackup"; t += 1000; } while (have.has(name));
      await pl.put(name, buf);
      importFile(await pl.get(name), p); // read back with the passphrase before saying it is done
      out = { ok: true, name, at: now().toISOString(), bytes: buf.length };
      await prune(cfg, pl);
    } catch (e) {
      out = { ok: false, why: "The copy was not made: " + (e.code === "ENOENT" ? "the linked folder is not there (is the drive connected?)" : e.message), at: now().toISOString() };
    }
    write(Object.assign({}, cfg, { last: out }));
    return out;
  }

  // Links a place. spec: { kind: "folder", folder } or { kind: <service id>, creds }. The place is tested before anything is saved.
  async function link(spec, pass, auto) {
    const kind = (spec && spec.kind) || "folder";
    if (String(pass || "").length < MIN_PASS) return { ok: false, why: "Choose a passphrase of at least " + MIN_PASS + " characters. Keep it safe: without it a copy cannot be opened." };
    const cfg = { kind, auto: !!(opts.protected && auto), linked: now().toISOString() };
    let creds = null;
    if (kind === "folder") {
      const folder = String(spec.folder || "");
      if (!folder || !path.isAbsolute(folder)) return { ok: false, why: "Choose a folder." };
      cfg.folder = folder;
    } else {
      const sv = storage.byId(kind); if (!sv) return { ok: false, why: "Unknown storage service." };
      if (!opts.protected) return { ok: false, why: "This computer has no keychain to keep the credentials safely. Use a synced folder instead." };
      creds = storage.cleanCreds(sv, spec.creds);
    }
    try { await place(cfg, creds).check(); } catch (e) { return { ok: false, why: kind === "folder" ? "Class Manager cannot write to that folder." : e.message }; }
    fs.mkdirSync(opts.dir, { recursive: true });
    for (const f of [passFile, credFile]) { try { fs.unlinkSync(f); } catch (e) { /* none */ } }
    if (opts.protected && auto) fs.writeFileSync(passFile, opts.protect(Buffer.from(String(pass), "utf8")), { mode: 0o600 });
    if (creds) fs.writeFileSync(credFile, opts.protect(Buffer.from(JSON.stringify(creds), "utf8")), { mode: 0o600 });
    write(cfg);
    const first = await copyNow(pass);
    return Object.assign({ ok: first.ok, first }, await state());
  }
  async function unlink() { // the copies already in the place are left alone
    for (const f of [passFile, credFile, cfgFile]) { try { fs.unlinkSync(f); } catch (e) { /* none */ } }
    return state();
  }
  // Called after the app's own backups: a copy only if linked, automatic and remembered.
  async function auto() { const cfg = read(); return (cfg.folder || isService(cfg)) && cfg.auto && fs.existsSync(passFile) ? copyNow("") : null; }
  // The content of one copy, for restore. name must be a copy of this course in the linked place.
  async function open(name, pass) {
    const cfg = read();
    if ((!cfg.folder && !isService(cfg)) || !NAME_RE.test(String(name))) throw new Error("not a copy in the linked storage");
    return importFile(await place(cfg).get(name), String(pass || "") || storedPass());
  }
  // For course synchronisation (sync/course-sync.js): the linked place's file calls, which items are kept in step, the passphrase.
  const raw = () => { const cfg = read(); if (!cfg.folder && !isService(cfg)) throw new Error("Nothing is linked."); return place(cfg); };
  const items = () => Object.assign({ notes: "local", materials: "local", classList: "local", attendance: "local" }, read().items || {});
  function setItems(o) { const cfg = read(); if (!cfg.folder && !isService(cfg)) throw new Error("Nothing is linked."); const cur = items(); for (const k of Object.keys(cur)) if (o && (o[k] === "local" || o[k] === "sync")) cur[k] = o[k]; write(Object.assign({}, cfg, { items: cur })); return cur; }
  const passphrase = (pass) => String(pass || "") || storedPass();
  return { state, link, unlink, copyNow, auto, list: () => list(), open, raw, items, setItems, passphrase, linked: () => { const c = read(); return !!(c.folder || isService(c)); } };
}

module.exports = { createLinkedFolder, KEEP, MIN_PASS };
