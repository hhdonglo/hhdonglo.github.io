// The secret salt behind the pseudonyms: made once per course and kept in the course's data folder, never exported.
"use strict";
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

function saltOf(dir) {
  const file = path.join(dir, "llm-salt.json");
  try { const s = JSON.parse(fs.readFileSync(file, "utf8")).salt; if (typeof s === "string" && s.length >= 32) return s; } catch (e) { /* made below */ }
  const salt = crypto.randomBytes(24).toString("hex");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(file, JSON.stringify({ salt }), { mode: 0o600 });
  return salt;
}

module.exports = { saltOf };
