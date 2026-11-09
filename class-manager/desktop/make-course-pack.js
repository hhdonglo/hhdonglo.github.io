// Builds a course pack (.zip) from a folder in course-packs/: course.json plus everything in files/.
// Usage: node make-course-pack.js <pack folder> <output .zip>
"use strict";
const fs = require("fs");
const path = require("path");
const JSZip = require("jszip");
const [src, out] = process.argv.slice(2);
if (!src || !out) { console.error("Usage: node make-course-pack.js <pack folder> <output .zip>"); process.exit(2); }
const zip = new JSZip();
const meta = JSON.parse(fs.readFileSync(path.join(src, "course.json"), "utf8"));
delete meta.web; // values for the web version only
zip.file("course.json", JSON.stringify(meta, null, 1));
let n = 0;
(function walk(dir, pre) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const f = path.join(dir, e.name);
    if (e.isDirectory()) walk(f, pre + e.name + "/");
    else { zip.file("files/" + pre + e.name, fs.readFileSync(f)); n++; }
  }
})(path.join(src, "files"), "");
zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }).then((b) => { fs.writeFileSync(out, b); console.log("Wrote " + out + " (" + n + " files, " + Math.round(b.length / 1048576) + " MB)"); });
