/* One course's LMS connection settings, kept in lms.json in the course folder. Everything is off until the lecturer switches it on:
   with `enabled` false, CM never contacts an LMS. Web addresses must be https. */
"use strict";
const fs = require("fs");
const path = require("path");
const profiles = require("./profiles");

const DEFAULTS = { enabled: false, profile: "canvas", clientId: "", tokenUrl: "", membersUrl: "", lineItemsUrl: "" };
const https = (v) => (/^https:\/\/[^\s"<>]+$/.test(String(v || "").trim()) ? String(v).trim() : "");
const text = (v) => String(v == null ? "" : v).trim().slice(0, 200);

function clean(s) {
  s = s || {};
  return {
    enabled: s.enabled === true, profile: profiles.ids().includes(s.profile) ? s.profile : DEFAULTS.profile,
    clientId: text(s.clientId), tokenUrl: https(s.tokenUrl), membersUrl: https(s.membersUrl), lineItemsUrl: https(s.lineItemsUrl)
  };
}

const fileOf = (dir) => path.join(dir, "lms.json");
function load(dir) { try { return clean(JSON.parse(fs.readFileSync(fileOf(dir), "utf8"))); } catch (e) { return clean(DEFAULTS); } }
function save(dir, s) { const c = clean(s); fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(fileOf(dir), JSON.stringify(c, null, 1)); return c; }

// What the services need before they can run, in words for the lecturer.
function missing(c, need) {
  const m = [];
  if (!c.enabled) m.push("Switch on the connection first.");
  if (!c.clientId) m.push("The client ID the LMS gave CM.");
  if (!c.tokenUrl) m.push("The LMS token address (https).");
  if (need === "members" && !c.membersUrl) m.push("The roster (names and roles) address (https).");
  if (need === "grades" && !c.lineItemsUrl) m.push("The gradebook columns (line items) address (https).");
  return m;
}

module.exports = { DEFAULTS, clean, load, save, missing };
