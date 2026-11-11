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

test("linking needs a passphrase of 10 characters and a folder that can be written", async () => {
  const { lf, folder } = make();
  assert.equal((await lf.link({ folder }, "short", true)).ok, false);
  assert.equal((await lf.link({ folder: "relative/path" }, "long enough pass", true)).ok, false);
  assert.equal((await lf.link({ folder: path.join(folder, "missing") }, "long enough pass", true)).ok, false);
  assert.equal((await lf.state()).linked, false);
});

test("linking makes a first copy that is encrypted and opens only with the passphrase", async () => {
  const { lf, folder } = make();
  const r = await lf.link({ folder: folder }, "correct horse battery", true);
  assert.equal(r.ok, true);
  const s = await lf.state();
  assert.equal(s.linked, true); assert.equal(s.auto, true); assert.equal(s.copies.length, 1);
  const dir = path.join(folder, "Class Manager", "PHYS-143");
  const raw = fs.readFileSync(path.join(dir, s.copies[0].name));
  assert.equal(raw.toString("utf8").includes("Key"), false, "the copy is not readable text");
  assert.equal((await lf.open(s.copies[0].name, "correct horse battery")).course, "phys-143");
  await assert.rejects(() => lf.open(s.copies[0].name, "wrong passphrase!!"), /passphrase/);
  assert.equal(fs.readdirSync(dir).some((f) => f.endsWith(".part")), false, "no half-written file is left");
});

test("without a keychain the passphrase is never stored and copies need it each time", async () => {
  const { lf, dir, folder } = make({ protected: false });
  assert.equal((await lf.link({ folder: folder }, "correct horse battery", true)).ok, true);
  assert.equal((await lf.state()).auto, false);
  assert.equal(fs.existsSync(path.join(dir, "linked-folder.key")), false);
  assert.equal(await lf.auto(), null);
  assert.equal((await lf.copyNow("")).ok, false);
  assert.equal((await lf.copyNow("correct horse battery")).ok, true);
});

test("the remembered passphrase is encrypted by the keychain and lets copies run by themselves", async () => {
  const { lf, dir, folder } = make();
  await lf.link({ folder: folder }, "correct horse battery", true);
  const stored = fs.readFileSync(path.join(dir, "linked-folder.key"));
  assert.equal(stored.includes(Buffer.from("correct horse battery")), true, "stand-in keychain only prefixes; real one encrypts");
  assert.equal(stored.subarray(0, 3).toString(), "KC:");
  const r = await lf.auto();
  assert.equal(r.ok, true);
  assert.equal((await lf.state()).copies.length, 2);
});

test("automatic copies do nothing when the lecturer chose manual", async () => {
  const { lf, folder } = make();
  await lf.link({ folder: folder }, "correct horse battery", false);
  assert.equal(await lf.auto(), null);
  assert.equal((await lf.state()).copies.length, 1);
});

test("only the newest copies are kept", async () => {
  const { lf, folder } = make();
  await lf.link({ folder: folder }, "correct horse battery", true);
  for (let i = 0; i < KEEP + 3; i++) assert.equal((await lf.auto()).ok, true);
  assert.equal((await lf.state()).copies.length, KEEP);
});

test("a missing folder is reported and does not lose the settings", async () => {
  const { lf, folder } = make();
  await lf.link({ folder: folder }, "correct horse battery", true);
  fs.rmSync(folder, { recursive: true, force: true });
  const r = await lf.auto();
  assert.equal(r.ok, false); assert.match(r.why, /not there|drive/);
  const s = await lf.state();
  assert.equal(s.linked, true); assert.equal(s.reachable, false); assert.equal(s.last.ok, false);
});

test("a copy name outside the linked folder is refused", async () => {
  const { lf, folder } = make();
  await lf.link({ folder: folder }, "correct horse battery", true);
  await assert.rejects(() => lf.open("../../etc/passwd", "correct horse battery"), /not a copy/);
});

test("unlinking forgets the folder and the passphrase but leaves the copies", async () => {
  const { lf, dir, folder } = make();
  await lf.link({ folder: folder }, "correct horse battery", true);
  await lf.unlink();
  assert.equal((await lf.state()).linked, false);
  assert.equal(fs.existsSync(path.join(dir, "linked-folder.key")), false);
  assert.equal(fs.readdirSync(path.join(folder, "Class Manager", "PHYS-143")).length, 1);
});

// ---------- services, with an in-memory stand-in for a WebDAV server ----------
function fakeDav() {
  const files = new Map();
  const fetch = async (url, o) => {
    const p = decodeURIComponent(new URL(url).pathname).replace(/^\/dav\//, "").replace(/\/$/, "");
    const m = o.method, res = (status, body) => ({ status, text: async () => body || "", arrayBuffer: async () => (body instanceof Buffer ? body : Buffer.from(body || "")) });
    if (o.headers.Authorization !== "Basic " + Buffer.from("hope:app-pass").toString("base64")) return res(401);
    if (m === "MKCOL") return res(files.has(p + "/") ? 405 : (files.set(p + "/", true), 201));
    if (m === "PUT") { files.set(p, Buffer.from(o.body)); return res(201); }
    if (m === "GET") return files.has(p) ? res(200, files.get(p)) : res(404);
    if (m === "DELETE") { files.delete(p); return res(204); }
    if (m === "PROPFIND") {
      if (p === "") return res(207, "<d:multistatus/>");
      const kids = [...files.keys()].filter((k) => k.startsWith(p + "/") && !k.endsWith("/") && !k.slice(p.length + 1).includes("/"));
      if (!files.has(p + "/")) return res(404);
      return res(207, "<d:multistatus>" + kids.map((k) => "<d:response><d:href>/dav/" + k + "</d:href><d:propstat><d:prop><d:getcontentlength>" + files.get(k).length + "</d:getcontentlength></d:prop></d:propstat></d:response>").join("") + "</d:multistatus>");
    }
    return res(400);
  };
  return { fetch, files };
}
const dav = { url: "https://cloud.example.org/dav/", username: "hope", password: "app-pass" };

test("a WebDAV service is linked with the lecturer's own credentials, copies are encrypted and restore", async () => {
  const d = fakeDav();
  const { lf, dir } = make({ fetch: d.fetch });
  const r = await lf.link({ kind: "webdav", creds: dav }, "correct horse battery", true);
  assert.equal(r.ok, true, r.why);
  const names = [...d.files.keys()].filter((k) => k.endsWith(".cmbackup"));
  assert.equal(names.length, 1);
  assert.match(names[0], /^Class Manager\/PHYS-143\/cm-PHYS-143-/);
  assert.equal(d.files.get(names[0]).includes("Key"), false, "the service holds only encrypted bytes");
  assert.equal((await lf.open(path.basename(names[0]), "")).course, "phys-143");
  const cred = fs.readFileSync(path.join(dir, "linked-folder.cred"));
  assert.equal(cred.subarray(0, 3).toString(), "KC:");
  assert.equal(JSON.parse(fs.readFileSync(path.join(dir, "linked-folder.json"), "utf8")).creds, undefined, "settings hold no credentials");
  assert.equal((await lf.state()).copies.length, 1);
  assert.equal((await lf.auto()).ok, true);
  assert.equal((await lf.state()).copies.length, 2);
});

test("a service needs a keychain, a working login and the declared fields only", async () => {
  const d = fakeDav();
  const a = make({ fetch: d.fetch, protected: false });
  assert.match((await a.lf.link({ kind: "webdav", creds: dav }, "correct horse battery", true)).why, /keychain/);
  const b = make({ fetch: d.fetch });
  const bad = await b.lf.link({ kind: "webdav", creds: Object.assign({}, dav, { password: "" }) }, "correct horse battery", true);
  assert.equal(bad.ok, false);
  assert.equal((await b.lf.state()).linked, false);
  assert.equal((await b.lf.link({ kind: "nonsense", creds: {} }, "correct horse battery", true)).ok, false);
  assert.equal((await b.lf.link({ kind: "webdav", creds: { url: "http://insecure.example.org/" } }, "correct horse battery", true)).ok, false);
});
