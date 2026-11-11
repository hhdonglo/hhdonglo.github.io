// Plain values for the working file: IDs, marks and names written one way. Pure.
"use strict";
const { blank, text } = require("./detect");
const idOf = (v) => (blank(v) ? "" : (typeof v === "number" ? String(Math.round(v)) : text(v).replace(/\.0+$/, "")).replace(/\D/g, ""));
const validId = (id) => id.length >= 4 && id.length <= 12;
// 1 present, 0 absent, "" not a mark.
function markOf(v) {
  const s = text(v).toLowerCase();
  if (/^(1|1\.0|p|y|yes|present|true|✓|✔)$/.test(s)) return 1;
  if (/^(0|0\.0|a|n|no|absent|false)$/.test(s)) return 0;
  return "";
}
const numOrBlank = (v) => (blank(v) || text(v) === "" || !Number.isFinite(Number(v)) ? "" : Number(v));
// "Last, First" or "First Last" in one cell -> first and last.
function splitFull(s) {
  s = text(s).replace(/\s+/g, " ");
  if (!s) return ["", ""];
  const c = s.indexOf(",");
  if (c > 0) return [s.slice(c + 1).trim(), s.slice(0, c).trim()];
  const i = s.lastIndexOf(" ");
  return i < 0 ? [s, ""] : [s.slice(0, i), s.slice(i + 1)];
}
module.exports = { idOf, validId, markOf, numOrBlank, splitFull };
