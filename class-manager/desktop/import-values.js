// Values for the web import: how IDs, codes and times are written so that the same record always gives the same key.
// Pure functions only (no disk, no Electron), tested in test/import.test.js.
"use strict";

const isDate = (v) => Object.prototype.toString.call(v) === "[object Date]";
const blank = (v) => v === undefined || v === null || v === "" || (typeof v === "number" && Number.isNaN(v));
const pad = (n) => ("0" + n).slice(-2);

// A student ID as digits only, like the script's normId_: 22524013, "22524013.0" and " 22524013 " all give "22524013".
function idOf(v) {
  if (blank(v)) return "";
  if (typeof v === "number") return Number.isFinite(v) ? String(Math.round(v)).replace(/\D/g, "") : "";
  return String(v).trim().replace(/\.0+$/, "").replace(/\D/g, "");
}

// A join code or other short text, upper case, without the ".0" a spreadsheet adds to a number.
function codeOf(v) {
  if (blank(v)) return "";
  return (typeof v === "number" ? String(v) : String(v).trim().replace(/^(\d+)\.0+$/, "$1")).toUpperCase();
}

// A number as text without a trailing .0 (Round 0.0 and 0 are the same round).
function numOf(v) {
  if (blank(v)) return "";
  const n = Number(v);
  return Number.isFinite(n) ? String(n) : String(v).trim();
}

// Wall-clock time to the second, "2026-11-04 08:25:36". A Date, an ISO-like string or text from a spreadsheet; "" if it is none of these.
function timeOf(v) {
  if (blank(v)) return "";
  let d = v;
  if (!isDate(d)) {
    const s = String(v).trim();
    const m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})/.exec(s);
    if (m) return m[1] + "-" + m[2] + "-" + m[3] + " " + m[4] + ":" + m[5] + ":" + m[6];
    d = new Date(s);
  }
  if (Number.isNaN(d.getTime())) return String(v).trim();
  return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()) + " " + pad(d.getHours()) + ":" + pad(d.getMinutes()) + ":" + pad(d.getSeconds());
}

// A session label as the attendance tabs write it: text, or a date shown as dd/MM/yyyy.
function sessionOf(v) {
  if (blank(v)) return "";
  if (isDate(v)) return pad(v.getDate()) + "/" + pad(v.getMonth() + 1) + "/" + v.getFullYear();
  return String(v).trim();
}

// A heading without case, spaces or punctuation, to compare "First Name", "First name" and "first_name".
const headOf = (v) => String(v == null ? "" : v).toLowerCase().replace(/[^a-z0-9]/g, "");

// The text of a mark cell, 1 or 0, from 1, "1", "1.0", true; "" for anything else.
function markOf(v) {
  if (v === true) return 1;
  const n = Number(v);
  return !blank(v) && Number.isFinite(n) ? (n > 0 ? 1 : 0) : "";
}

module.exports = { isDate, blank, idOf, codeOf, numOf, timeOf, sessionOf, headOf, markOf };
