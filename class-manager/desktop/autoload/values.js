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
// A score written as a fraction: "1/5", "1 / 5", "8 of 10". Returns { score, total } or null.
function fractionOf(v) {
  const m = /^\s*(\d+(?:\.\d+)?)\s*(?:\/|of|out of)\s*(\d+(?:\.\d+)?)\s*$/i.exec(text(v));
  return m && Number(m[2]) > 0 ? { score: Number(m[1]), total: Number(m[2]) } : null;
}
// A score cell as { score, total }: a fraction gives both, a plain number gives the score and no total, anything else is null.
function scoreCell(v) {
  const f = fractionOf(v); if (f) return f;
  const n = numOrBlank(v); return n === "" ? null : { score: n, total: "" };
}
module.exports = { idOf, validId, markOf, numOrBlank, splitFull, fractionOf, scoreCell };
