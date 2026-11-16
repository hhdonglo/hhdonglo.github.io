/* The server script's version lock. One responsibility: tie the script's version string to its content.
   `node apps_script/version-lock.js` writes version-lock.json (run it after you bump SCRIPT_VERSION in src/60-portal.gs and rebuild).
   desktop/test/versions.test.js fails when the script changed but the version string did not, because a lecturer's deployed copy
   would then look up to date to the Control Centre while running old code. Pure helpers are exported for that test. */
"use strict";
const fs = require("fs"), path = require("path"), crypto = require("crypto");
const FILE = path.join(__dirname, "quiz_receiver.gs"), LOCK = path.join(__dirname, "version-lock.json");

function describe(text) {
  const m = text.match(/^var SCRIPT_VERSION = '([^']+)';/m);
  const body = text.replace(/\r\n/g, "\n").replace(/^var SCRIPT_VERSION = '[^']+';/m, "var SCRIPT_VERSION = '';"); // Windows checkouts may turn line ends into CRLF: the hash must not depend on them
  return { version: m ? m[1] : "", hash: crypto.createHash("sha256").update(body, "utf8").digest("hex") };
}
const current = () => describe(fs.readFileSync(FILE, "utf8"));
const locked = () => JSON.parse(fs.readFileSync(LOCK, "utf8"));

if (require.main === module) { fs.writeFileSync(LOCK, JSON.stringify(current(), null, 2) + "\n"); console.log("locked", current().version); }
module.exports = { describe, current, locked };
