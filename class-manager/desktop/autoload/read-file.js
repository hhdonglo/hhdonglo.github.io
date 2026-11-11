// Reads any file the lecturer points at into sheets of cells: [{ name, rows }], plus the plain text of a document.
// Excel and CSV come from xlsx-book.js; Word tables and paragraphs are read here; text, Markdown and PDF give text only.
// The original is opened for reading and never written. Nothing here knows what the cells mean (see detect.js).
"use strict";
const fs = require("fs");
const path = require("path");
const JSZip = require("jszip");
const { readBook } = require("../xlsx-book");
const { splitText, xmlText } = require("../table");

const READABLE = new Set([".xlsx", ".csv", ".tsv", ".txt", ".md", ".markdown", ".text", ".docx", ".pdf"]);
const MAX_DOC_BYTES = 30 * 1000 * 1000;

// Word: every table becomes a sheet, the rest becomes text.
async function readDocx(file) {
  const zip = await JSZip.loadAsync(fs.readFileSync(file));
  const entry = zip.file("word/document.xml");
  if (!entry) throw new Error("This Word file has no readable content.");
  const xml = await entry.async("string");
  const sheets = [], cellText = (c) => xmlText(c.replace(/<\/w:p>/g, "\n")).replace(/\s*\n\s*/g, " ").trim();
  let n = 0;
  const rest = xml.replace(/<w:tbl>[\s\S]*?<\/w:tbl>/g, (tbl) => {
    const rows = (tbl.match(/<w:tr[ >][\s\S]*?<\/w:tr>/g) || []).map((tr) => (tr.match(/<w:tc>[\s\S]*?<\/w:tc>/g) || []).map(cellText));
    if (rows.length) sheets.push({ name: "Table " + (++n), rows });
    return "";
  });
  const paras = (rest.match(/<w:p[ >][\s\S]*?<\/w:p>/g) || []).map((p) => xmlText((p.match(/<w:t(?: [^>]*)?>[^<]*<\/w:t>/g) || []).join(""))).filter((p) => p.trim());
  return { sheets, text: paras.join("\n") };
}

// Text that is a table (most lines have the same number of cells) is read as one; anything else is a document.
function readPlain(file) {
  const raw = fs.readFileSync(file, "utf8");
  const rows = splitText(raw), w = rows.length ? rows[0].length : 0;
  const tableLike = w >= 2 && rows.length >= 2 && rows.filter((r) => r.length >= 2 && r.length <= w).length >= rows.length * 0.8; // a row may be short: empty cells at its end are often left off
  return { sheets: tableLike ? [{ name: path.basename(file).replace(/\.[^.]+$/, ""), rows }] : [], text: tableLike ? "" : raw };
}

// -> { sheets, text, truncated }. Throws a plain message when the file cannot be read.
async function readAny(file, onProgress) {
  const ext = path.extname(file).toLowerCase();
  if (ext === ".xls") throw new Error("Old Excel files (.xls) cannot be read. Save the file as .xlsx or CSV.");
  if (!READABLE.has(ext)) throw new Error("This kind of file is not read (" + (ext || "no extension") + ").");
  if (ext === ".xlsx") { const sheets = await readBook(file, onProgress); return { sheets, text: "", truncated: sheets.some((s) => s.truncated) }; }
  if (fs.statSync(file).size > MAX_DOC_BYTES) throw new Error("The file is too large to read.");
  if (ext === ".docx") return Object.assign(await readDocx(file), { truncated: false });
  if (ext === ".pdf") { // text only; a table in a PDF is not reliable, so a PDF is used for quiz questions
    const { extract } = require("../authoring");
    return { sheets: [], text: (await extract(file)).map((p) => p.text).join("\n"), truncated: false };
  }
  return Object.assign(readPlain(file), { truncated: false }); // csv, tsv, txt, md
}

module.exports = { readAny, readDocx, readPlain, READABLE };
