#!/usr/bin/env node
/* Builds apps_script/quiz_receiver.gs from the modules in apps_script/src/, in file-name order.
   The result is one file: it is what is pasted into Google Apps Script and what the desktop app runs.
     node apps_script/build.js           write quiz_receiver.gs
     node apps_script/build.js --check   exit 1 if quiz_receiver.gs is not up to date (used in CI) */
"use strict";
const fs = require("fs");
const path = require("path");

const SRC = path.join(__dirname, "src");
const OUT = path.join(__dirname, "quiz_receiver.gs");

function build() {
  const files = fs.readdirSync(SRC).filter((f) => /^\d\d-[\w-]+\.gs$/.test(f)).sort();
  const head = "// GENERATED FILE: do not edit. Built by apps_script/build.js from apps_script/src/ (" + files.join(", ") + ").\n" +
    "// To deploy in Google Apps Script, paste this whole file into the script editor.\n\n";
  return head + files.map((f) => "// ===== " + f + " =====\n" + fs.readFileSync(path.join(SRC, f), "utf8").replace(/\s*$/, "\n")).join("\n");
}

if (require.main === module) {
  const text = build();
  if (process.argv.includes("--check")) {
    const cur = fs.existsSync(OUT) ? fs.readFileSync(OUT, "utf8") : "";
    if (cur !== text) { console.error("apps_script/quiz_receiver.gs is out of date: run node apps_script/build.js"); process.exit(1); }
    console.log("apps_script/quiz_receiver.gs is up to date (" + text.split("\n").length + " lines)");
  } else { fs.writeFileSync(OUT, text); console.log("wrote apps_script/quiz_receiver.gs"); }
}
module.exports = { build };
