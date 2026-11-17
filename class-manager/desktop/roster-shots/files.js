// Reads a class list from ANY standard file: CSV, TSV, Excel, Word, text, pasted text, a PDF with real text. All of it locally:
// no API key, nothing uploaded. Only scanned PDFs and pictures are left for vision.js (and the screen says so).
// Reuses CM's existing readers: autoload/read-file.js (readAny: Excel, CSV, Word, text, PDF text) and autoload/detect.js
// (finds the ID and name columns by heading or by content, skips header rows and extra columns). No reader is written twice.
// Returns raw rows { id, name, shot }; review.js decides what is safe to save (IDs are never guessed here).
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const { readAny } = require("../autoload/read-file");
const { detectSheet, blank, text } = require("../autoload/detect");
const { splitFull } = require("../autoload/values");

const IMAGE = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".gif": "image/gif" };
const LOCAL = new Set([".csv", ".tsv", ".txt", ".text", ".md", ".markdown", ".xlsx", ".docx", ".pdf"]);
const MAX_FILES = 12;

// The ID exactly as written: a whole number cell is written out; anything else is left for review.js to judge.
const rawId = (v) => (typeof v === "number" ? (Number.isInteger(v) ? String(v) : String(v)) : text(v));

// Rows of cells -> students, using detect.js to find the columns. [] when the sheet has no ID column.
function fromSheet(rows, shot) {
  const d = detectSheet(rows);
  if (!d.cols.id || d.kind === "questions") return [];
  const clean = rows.filter((r) => Array.isArray(r) && r.some((c) => !blank(c) && text(c) !== ""));
  const at = (r, f) => (d.cols[f] ? r[d.cols[f].col] : undefined);
  return clean.slice(d.header + 1).map((r) => {
    let name;
    if (d.cols.first || d.cols.last) name = [text(at(r, "first")), text(at(r, "last"))].filter(Boolean).join(" ");
    else { const [f, l] = splitFull(at(r, "full")); name = [f, l].filter(Boolean).join(" "); }
    return { id: rawId(at(r, "id")), name, shot };
  }).filter((s) => s.id !== "");
}

// Text that is not a table (a list typed or pasted, or the text of a PDF): one student per line, an ID of 4 to 12 digits and a name.
// "20000001 Ama Mensah", "Mensah, Ama - 20000001", "1. 20000001  Ama Mensah  Physics" all give the ID and the words beside it.
function fromLines(raw, shot) {
  const out = [];
  String(raw || "").split(/\r?\n/).forEach((line) => {
    const m = /(?<![\d.])(\d{4,12})(?![\d.])/.exec(line);
    if (!m) return;
    const rest = (line.slice(0, m.index) + "\t" + line.slice(m.index + m[1].length)).replace(/^\s*\d{1,3}[.)]\s+/, "");
    const cells = rest.split(/\t|\s{2,}|[|;]/).map((c) => c.replace(/^[\s\-–—:,]+|[\s\-–—:,]+$/g, "").trim()).filter((c) => /[A-Za-z]/.test(c) && !/\d/.test(c));
    const name = cells[0] || "";
    out.push({ id: m[1], name, shot });
  });
  return out;
}

// One file { name, type, data (base64) } -> { rows, vision: [files for Claude], note }.
async function readOne(file) {
  const name = file.name || "pasted text", ext = (path.extname(name) || (file.type === "text/plain" || !file.type ? ".txt" : "")).toLowerCase();
  if (IMAGE[ext] || /^image\//.test(file.type || "")) return { rows: [], vision: [file] };
  if (ext === ".xls") throw new Error(name + ": old Excel files (.xls) cannot be read. Save the file as .xlsx or CSV.");
  if (!LOCAL.has(ext)) throw new Error(name + ": this kind of file is not read (" + (ext || "no extension") + "). Use CSV, Excel, Word, text, PDF or a screenshot.");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cm-roster-")), tmp = path.join(dir, "file" + ext); // readAny reads from disk; the copy is removed at once
  try {
    fs.writeFileSync(tmp, Buffer.from(String(file.data || ""), "base64"));
    const got = await readAny(tmp);
    if ([".csv", ".tsv", ".txt", ".text", ".md", ".markdown"].includes(ext)) { // typed or exported lists: title rows, blank lines and ragged rows are normal, so read the cells whatever the shape
      const grid = require("../table").splitText(fs.readFileSync(tmp, "utf8")), rows = fromSheet(grid, name);
      return { rows: rows.length ? rows : fromLines(fs.readFileSync(tmp, "utf8"), name), vision: [] };
    }
    let rows = [];
    got.sheets.forEach((sh) => { rows = rows.concat(fromSheet(sh.rows, name)); });
    if (!rows.length && got.text) rows = fromLines(got.text, name);
    if (!rows.length && ext === ".pdf") return { rows: [], vision: [{ name, type: "application/pdf", data: file.data }] }; // no text in it: a scan
    return { rows, vision: [] };
  } finally { try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) { /* the temp folder is cleaned by the system anyway */ } }
}

// files: [{ name, type, data }]. Returns { rows, vision, local } where `vision` are the files only Claude can read.
async function readRosterFiles(files) {
  const list = (files || []).slice(0, MAX_FILES);
  if (!list.length) throw new Error("Add at least one file or paste the list.");
  const rows = [], vision = [], local = [];
  for (const f of list) { const r = await readOne(f); rows.push(...r.rows); vision.push(...r.vision); if (r.rows.length) local.push(f.name || "pasted text"); }
  return { rows, vision, local };
}

// A file as one table of rows for readers that want a table (the LMS roster comparison): any standard file, through the same readers.
async function tableOf(file) {
  const ext = path.extname(file).toLowerCase();
  if ([".csv", ".tsv", ".txt", ".xlsx"].includes(ext)) return require("../table").readTable(file);
  const got = await readAny(file);
  if (got.sheets.length) return got.sheets[0].rows;
  return [["Student ID", "Name"]].concat(fromLines(got.text, "").map((s) => [s.id, s.name]));
}

module.exports = { tableOf, readRosterFiles, fromSheet, fromLines, MAX_FILES };
