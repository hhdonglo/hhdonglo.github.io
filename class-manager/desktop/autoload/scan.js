// Finds the files in a folder the lecturer points at, quickly and safely.
// - One pass over the folder names and sizes; a file is opened only if it is new or changed since the last scan (store.js).
// - Never follows shortcuts or links, skips hidden and temporary files, and stops at a depth and a count that keep a very large folder responsive.
// - `watch` tells the screen when something in the folder changed; it never imports by itself.
"use strict";
const fs = require("fs");
const path = require("path");
const { READABLE } = require("./read-file");

const LIMITS = { depth: 6, files: 1500, bytes: 60 * 1000 * 1000 };
const SKIP_DIRS = /^(node_modules|\.git|\$RECYCLE\.BIN|System Volume Information|__MACOSX)$/i;
const tick = () => new Promise((r) => setImmediate(r));

// -> { files: [{ path, rel, ext, size, mtimeMs }], skipped: { other, tooBig, hidden }, capped }
async function listFiles(root, exclude) {
  const out = { files: [], skipped: { other: 0, tooBig: 0, hidden: 0 }, capped: false };
  const skipUnder = (exclude || []).map((p) => path.resolve(p));
  async function walk(dir, depth) {
    let ents;
    try { ents = await fs.promises.readdir(dir, { withFileTypes: true }); } catch (e) { return; }
    for (const e of ents) {
      if (out.files.length >= LIMITS.files) { out.capped = true; return; }
      const full = path.join(dir, e.name);
      if (e.name.startsWith(".") || e.name.startsWith("~$")) { out.skipped.hidden++; continue; }
      if (e.isSymbolicLink()) continue;
      if (e.isDirectory()) { if (depth < LIMITS.depth && !SKIP_DIRS.test(e.name) && !skipUnder.some((p) => path.resolve(full).startsWith(p))) await walk(full, depth + 1); continue; }
      if (!e.isFile()) continue;
      const ext = path.extname(e.name).toLowerCase();
      if (!READABLE.has(ext)) { out.skipped.other++; continue; }
      let st; try { st = await fs.promises.stat(full); } catch (x) { continue; }
      if (st.size > LIMITS.bytes) { out.skipped.tooBig++; continue; }
      out.files.push({ path: full, rel: path.relative(root, full), ext, size: st.size, mtimeMs: st.mtimeMs });
    }
    await tick();
  }
  await walk(root, 0);
  return out;
}

// Watches the folder; calls onChange (once, after things settle) when a readable file is added, changed or removed. Returns stop().
function watch(root, onChange, exclude) {
  let timer = null, w = null;
  const skipUnder = (exclude || []).map((p) => path.resolve(p));
  try {
    w = fs.watch(root, { recursive: true }, (ev, name) => {
      if (!name || name.startsWith(".") || name.startsWith("~$") || !READABLE.has(path.extname(name).toLowerCase())) return;
      if (skipUnder.some((p) => path.resolve(root, name).startsWith(p))) return;
      clearTimeout(timer); timer = setTimeout(() => { try { onChange(); } catch (e) { /* the window closed */ } }, 1500);
    });
    w.on("error", () => {});
  } catch (e) { return { ok: false, stop() {} }; }
  return { ok: true, stop() { clearTimeout(timer); try { w.close(); } catch (e) { /* already closed */ } } };
}

module.exports = { listFiles, watch, LIMITS };
