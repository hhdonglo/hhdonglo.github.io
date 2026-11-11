// The app's own memory of the files it has looked at: one small file per source, kept in the course's working folder
// (inside the app's data, never in the project's repository). A file whose size and date are unchanged is not read again.
"use strict";
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const keyOf = (f) => f.size + "|" + Math.round(f.mtimeMs);
const idOf = (p) => crypto.createHash("sha1").update(p).digest("hex").slice(0, 16);

function createStore(dir) {
  const sdir = path.join(dir, "sources");
  const file = (p) => path.join(sdir, idOf(p) + ".json");
  function write(f, o) { fs.mkdirSync(sdir, { recursive: true }); const t = f + ".tmp"; fs.writeFileSync(t, JSON.stringify(o)); fs.renameSync(t, f); }
  return {
    get(entry) { try { const o = JSON.parse(fs.readFileSync(file(entry.path), "utf8")); return o.key === keyOf(entry) ? o.analysis : null; } catch (e) { return null; } },
    put(entry, analysis) { write(file(entry.path), { key: keyOf(entry), analysis }); },
    // Forget sources that are no longer in the folder, so the working file does not keep data from files that were removed.
    prune(paths) { const keep = new Set(paths.map((p) => idOf(p) + ".json")); try { fs.readdirSync(sdir).forEach((n) => { if (n.endsWith(".json") && !keep.has(n)) fs.unlinkSync(path.join(sdir, n)); }); } catch (e) { /* nothing stored yet */ } },
    id: idOf
  };
}

module.exports = { createStore, keyOf, idOf };
