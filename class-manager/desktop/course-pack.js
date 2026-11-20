/* Read, replace, and export the material files in a CM course pack. */
"use strict";
const fs = require("fs");
const path = require("path");
const JSZip = require("jszip");
const { inside } = require("./course-content");

// A folder chosen instead of a zip: the pack folder itself or a folder with the pack one or two levels down. Read like a zip, without hidden files.
async function zipOfFolder(root) {
  const zip = new JSZip(); let n = 0;
  (function walk(dir, rel, depth) {
    let ents; try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return; }
    for (const e of ents) {
      if (e.name.startsWith(".") || e.name.startsWith("~$") || e.isSymbolicLink() || n > 20000) continue;
      const full = path.join(dir, e.name), r = rel ? rel + "/" + e.name : e.name;
      if (e.isDirectory()) { if (depth < 12 && e.name !== "node_modules") walk(full, r, depth + 1); }
      else if (e.isFile()) { zip.file(r, fs.readFileSync(full)); n++; }
    }
  })(root, "", 0);
  return zip;
}

function createCoursePack(dir) {
  async function importPack(file) {
    const zip = fs.statSync(file).isDirectory() ? await zipOfFolder(file) : await JSZip.loadAsync(fs.readFileSync(file));
    // course.json at the top of the zip, or inside one wrapper folder (a zip made by compressing the pack folder itself).
    const cjName = zip.file("course.json") ? "course.json" : Object.keys(zip.files).filter((n) => /^[^/]+(\/[^/]+)?\/course\.json$/.test(n) && !/^__MACOSX\//.test(n)).sort((a, b) => a.length - b.length)[0];
    if (!cjName) throw new Error("This is not a Class Manager course pack (course.json is missing).");
    const base = cjName.slice(0, cjName.length - "course.json".length); // "" or "Folder/"
    const meta = JSON.parse(await zip.file(cjName).async("string"));
    if (meta.format !== "class-manager-course") throw new Error("This is not a Class Manager course pack.");
    const names = Object.keys(zip.files).filter((n) => n.startsWith(base + "files/") && !zip.files[n].dir && !/(^|\/)(\.DS_Store|~\$[^/]*)$/.test(n));
    // A pack with no files (only course.json) gives the course details but must not replace the course content with nothing.
    if (!names.length) return { settings: meta.settings || {}, name: meta.name || "", files: 0, replaced: false };
    const tmp = dir + ".import"; fs.rmSync(tmp, { recursive: true, force: true }); fs.mkdirSync(tmp, { recursive: true });
    for (const n of names) {
      const rel = n.slice(base.length + 6);
      if (!rel || /(^|\/)\.\.(\/|$)/.test(rel) || path.isAbsolute(rel)) continue;
      const out = path.join(tmp, rel);
      if (!inside(tmp, out)) continue;
      fs.mkdirSync(path.dirname(out), { recursive: true });
      fs.writeFileSync(out, await zip.files[n].async("nodebuffer"));
    }
    const old = dir + ".previous";
    fs.rmSync(old, { recursive: true, force: true });
    if (fs.existsSync(dir)) fs.renameSync(dir, old); // kept until the next import, in case it is needed again
    fs.renameSync(tmp, dir);
    return { settings: meta.settings || {}, name: meta.name || "", files: names.length, replaced: true };
  }
  async function exportPack(file, settings) {
    const zip = new JSZip();
    const s = Object.assign({}, settings); delete s.scriptUrl; delete s.port; delete s.setupSeen;
    zip.file("course.json", JSON.stringify({ format: "class-manager-course", version: 1, name: [s.courseCode, s.courseTitle].filter(Boolean).join(" "), settings: s }, null, 1));
    const walk = (dir, pre) => { let list = []; try { list = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return; }
      list.forEach((e) => { const f = path.join(dir, e.name); if (e.isDirectory()) walk(f, pre + e.name + "/"); else zip.file("files/" + pre + e.name, fs.readFileSync(f)); }); };
    walk(dir, "");
    fs.writeFileSync(file, await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }));
    return file;
  }

  return { importPack, exportPack };
}

module.exports = { createCoursePack };
