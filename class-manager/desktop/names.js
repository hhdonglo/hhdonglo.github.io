// Student names: joining first and last names, splitting a full name, and adding First name and Last name columns to exports.
// Pure functions only: nothing here touches the disk or Electron, so it can be tested in plain Node.
"use strict";

const clean = (s) => String(s == null ? "" : s).replace(/\s+/g, " ").trim();

// "Mensah, Ama" -> { first: "Ama", last: "Mensah" }; "Ama Serwaa Mensah" -> { first: "Ama Serwaa", last: "Mensah" }.
// A comma means "Last, First". Without one, the last word is the last name (a one-word name is a first name).
function splitName(full) {
  full = clean(full);
  if (!full) return { first: "", last: "" };
  const comma = full.indexOf(",");
  if (comma > 0) return { first: clean(full.slice(comma + 1)), last: clean(full.slice(0, comma)) };
  const i = full.lastIndexOf(" ");
  return i < 0 ? { first: full, last: "" } : { first: full.slice(0, i), last: full.slice(i + 1) };
}

// First and last name to the one name the class list stores: "Ama Mensah".
function joinName(first, last) { return clean(clean(first) + " " + clean(last)); }

// The name to store for one class list row [id, name, lastName?]. With a third cell the second is the first name.
// A single name written "Last, First" is stored as "First Last".
function rowName(row) {
  if (row[2] != null && clean(row[2]) !== "") return joinName(row[1], row[2]);
  const n = clean(row[1]);
  if (n.indexOf(",") > 0) { const s = splitName(n); return joinName(s.first, s.last); }
  return n;
}

// A heading that holds a whole name: "Name" or "Student name". Headings such as "First Name" (typed by students in quiz tabs) are left alone.
const FULL_NAME_HEADING = /^(student\s+)?name$/i;

// Rows of a table with every whole-name column replaced by two columns, First name and Last name.
// The first row is the heading. A table without such a column is returned unchanged.
function withNameColumns(rows) {
  if (!Array.isArray(rows) || !rows.length || !Array.isArray(rows[0])) return rows;
  const at = [];
  rows[0].forEach((h, i) => { if (FULL_NAME_HEADING.test(clean(h))) at.push(i); });
  if (!at.length) return rows;
  return rows.map((r, ri) => {
    if (!Array.isArray(r)) return r;
    const out = [];
    r.forEach((v, i) => {
      if (at.indexOf(i) < 0) { out.push(v); return; }
      if (ri === 0) { out.push("First name", "Last name"); return; }
      const s = splitName(v); out.push(s.first, s.last);
    });
    return out;
  });
}

module.exports = { splitName, joinName, rowName, withNameColumns };
