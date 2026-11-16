/* Where CM finds the relay: one address, built into the installer (relay/address.json, written by the release build from the CM_RELAY_URL setting)
   or set in the environment for a test (CM_RELAY_URL). An empty address means no relay: CM then works locally, as before. */
"use strict";
const fs = require("fs");
const path = require("path");

function relayAddress(env, file) {
  const fromEnv = String((env || process.env).CM_RELAY_URL || "").trim();
  let url = fromEnv;
  if (!url) { try { url = String(JSON.parse(fs.readFileSync(file || path.join(__dirname, "address.json"), "utf8")).url || "").trim(); } catch (e) { url = ""; } }
  return /^https:\/\/[\w.-]+(:\d+)?(\/[\w./-]*)?$/.test(url) ? url.replace(/\/$/, "") : "";
}

module.exports = { relayAddress };
