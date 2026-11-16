/* Smoke test of the PACKAGED app: the installer's own runtime must be able to open a course database (node:sqlite) and keep a student across a restart.
   Usage: node tools/smoke-packaged.js <dist folder>          (CI runs this after electron-builder on Linux, macOS and Windows)
          node tools/smoke-packaged.js --layout <resources folder> <runtime binary>   (the same check on a given layout; the unit test uses it with plain Node)
   It finds the built app in dist/, starts the app's own binary as a plain Node (ELECTRON_RUN_AS_NODE, no window, no display needed),
   and, inside that runtime, loads backend.js from app.asar, creates a course in a temporary folder, saves a student, closes, reopens and reads it back.
   Exit 0 and "SMOKE OK" on success; anything else prints the reason and exits 1. */
"use strict";
const fs = require("fs"), os = require("os"), path = require("path"), { spawnSync } = require("child_process");

function find(dist) { // { resources, bin } of the unpacked build for this operating system
  const dirs = fs.readdirSync(dist, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => path.join(dist, d.name));
  for (const d of dirs) {
    if (/mac/.test(path.basename(d))) { // dist/mac*/Class Manager.app
      const app = fs.readdirSync(d).find((n) => n.endsWith(".app")); if (!app) continue;
      const macos = path.join(d, app, "Contents", "MacOS"), bin = fs.readdirSync(macos)[0];
      return { resources: path.join(d, app, "Contents", "Resources"), bin: path.join(macos, bin) };
    }
    const res = path.join(d, "resources");
    if (!fs.existsSync(path.join(res, "app.asar"))) continue;
    const exe = fs.readdirSync(d).filter((n) => { const p = path.join(d, n), st = fs.statSync(p); return st.isFile() && (process.platform === "win32" ? /^(?!.*(uninstall)).*\.exe$/i.test(n) : (st.mode & 0o111) && !/\.so|chrome|crashpad|sandbox|\.(pak|bin|dat|json|html|txt)$/i.test(n)); });
    if (exe.length) return { resources: res, bin: path.join(d, exe[0]) };
  }
  throw new Error("No unpacked build found in " + dist);
}

const CHILD = `
const path = require("path"), fs = require("fs"), os = require("os");
const res = process.env.CM_RES;
const { createBackend } = require(path.join(res, "app.asar", "backend.js"));
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cm-smoke-"));
const make = () => createBackend({ webRoot: path.join(res, "web"), dataFile: path.join(dir, "workbook.json"), log: () => {} });
let b = make();
b.sheet("Roster", true).clear();
b.sheet("Roster").getRange(1, 1, 2, 2).setValues([["Student ID", "Name"], ["20004444", "Ama"]]);
b.flush(); b.close();
b = make();
const list = b.students.list();
b.close();
if (list.length !== 1 || list[0].id !== "20004444") { console.error("the student was not kept: " + JSON.stringify(list)); process.exit(1); }
if (!fs.existsSync(path.join(dir, "course.db"))) { console.error("no course.db was written in " + dir); process.exit(1); }
console.log("SMOKE OK node " + process.versions.node + (process.versions.electron ? " electron " + process.versions.electron : "") + " sqlite " + require("node:sqlite").DatabaseSync.name);
`;

function run(resources, bin) {
  const r = spawnSync(bin, ["-e", CHILD], { env: Object.assign({}, process.env, { ELECTRON_RUN_AS_NODE: "1", CM_RES: resources }), encoding: "utf8", timeout: 120000 });
  return { ok: r.status === 0 && /SMOKE OK/.test(r.stdout || ""), out: ((r.stdout || "") + (r.stderr || "")).trim(), status: r.status };
}

if (require.main === module) {
  const a = process.argv.slice(2);
  try {
    const t = a[0] === "--layout" ? { resources: a[1], bin: a[2] } : find(a[0] || "dist");
    const r = run(t.resources, t.bin);
    console.log(r.out);
    if (!r.ok) { console.error("SMOKE FAILED (exit " + r.status + ") with " + t.bin); process.exit(1); }
  } catch (e) { console.error("SMOKE FAILED: " + e.message); process.exit(1); }
}
module.exports = { find, run };
