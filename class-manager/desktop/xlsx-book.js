// Reads every sheet of an Excel workbook (.xlsx), or a CSV file as one sheet, keeping what each cell is:
// text stays text, numbers stay numbers, and a cell formatted as a date or time becomes a Date.
// table.js reads only the first sheet as text (for class lists); this reads a whole exported workbook.
// Nothing here touches Electron, so it can be tested in plain Node.
"use strict";
const fs = require("fs");
const path = require("path");
const JSZip = require("jszip");
const { splitText, xmlText, colIndex } = require("./table");

const MAX_ROWS = 50000;           // per sheet
const MAX_BYTES = 60 * 1000 * 1000;

// Excel's built-in date and time formats, and any custom format that shows a year, month, day, hour or second.
const BUILT_IN_DATE = new Set([14, 15, 16, 17, 18, 19, 20, 21, 22, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 45, 46, 47, 50, 51, 52, 53, 54, 55, 56, 57, 58]);
function isDateFormat(code) {
  const bare = String(code || "").replace(/"[^"]*"/g, "").replace(/\[[^\]]*\]/g, "").replace(/\\./g, "");
  return /[ymdhs]/i.test(bare) && !/^(general|@)$/i.test(bare.trim());
}

// A day count since 1899-12-30 as a local date and time (the wall-clock time the sheet shows), rounded to the second.
function serialToDate(n) {
  const ms = Math.round(Number(n) * 86400) * 1000;
  const u = new Date(Date.UTC(1899, 11, 30) + ms);
  return new Date(u.getUTCFullYear(), u.getUTCMonth(), u.getUTCDate(), u.getUTCHours(), u.getUTCMinutes(), u.getUTCSeconds());
}

function dateStyles(stylesXml) { // the set of cell style numbers (the s="" of a cell) that format a date
  const custom = {};
  (stylesXml.match(/<numFmt [^>]*>/g) || []).forEach((t) => {
    const id = (t.match(/numFmtId="(\d+)"/) || [])[1], code = (t.match(/formatCode="([^"]*)"/) || [])[1];
    if (id) custom[id] = xmlText(code || "");
  });
  const block = (stylesXml.match(/<cellXfs[^>]*>([\s\S]*?)<\/cellXfs>/) || [])[1] || "";
  const set = new Set();
  (block.match(/<xf [^>]*?(\/>|>[\s\S]*?<\/xf>)/g) || []).forEach((xf, i) => {
    const id = Number((xf.match(/numFmtId="(\d+)"/) || [])[1] || 0);
    if (BUILT_IN_DATE.has(id) || (custom[id] !== undefined && isDateFormat(custom[id]))) set.add(i);
  });
  return set;
}

const tick = () => new Promise((r) => setImmediate(r)); // lets CM draw and answer clicks between chunks of a large sheet
const CHUNK = 3000;

// One cell: its value, with dates as Date.
function cellValue(attrs, body, shared, dates) {
  const t = (attrs.match(/t="(\w+)"/) || [])[1];
  const style = Number((attrs.match(/\ss="(\d+)"/) || attrs.match(/^s="(\d+)"/) || [])[1]);
  if (!body) return "";
  if (t === "inlineStr") return xmlText((body.match(/<t[^>]*>[\s\S]*?<\/t>/g) || []).join(""));
  const raw = (body.match(/<v>([\s\S]*?)<\/v>/) || [])[1] || "";
  if (t === "s") return shared[Number(raw)] || "";
  if (t === "str" || t === "e") return xmlText(raw);
  if (t === "b") return raw === "1";
  if (raw !== "" && Number.isFinite(Number(raw))) return dates.has(style) ? serialToDate(raw) : Number(raw);
  return xmlText(raw);
}

// The rows of one sheet. Reads in chunks and gives way between them; onRows(n) reports progress. Sets .truncated when the row limit is reached.
async function readSheet(zip, file, shared, dates, onRows) {
  const entry = zip.file(file), rows = [];
  if (!entry) return rows;
  const xml = await entry.async("string"), re = /<row[^>]*>([\s\S]*?)<\/row>/g, cre = /<c ([^>]*?)(\/>|>([\s\S]*?)<\/c>)/g;
  let m;
  while ((m = re.exec(xml))) {
    if (rows.length >= MAX_ROWS) { rows.truncated = true; break; }
    const row = [];
    cre.lastIndex = 0;
    let c;
    while ((c = cre.exec(m[1]))) {
      const ref = (c[1].match(/r="([A-Z]+\d+)"/) || [])[1];
      const v = cellValue(c[1], c[3], shared, dates), i = ref ? colIndex(ref) : row.length;
      while (row.length < i) row.push("");
      row[i] = typeof v === "string" ? v.trim() : v;
    }
    rows.push(row);
    if (rows.length % CHUNK === 0) { if (onRows) onRows(rows.length); await tick(); }
  }
  while (rows.length && rows[rows.length - 1].every((x) => x === "")) rows.pop();
  return rows;
}

// [{ name, rows }] for every visible sheet, in the workbook's order.
async function readXlsxBook(file, onProgress) {
  const zip = await JSZip.loadAsync(fs.readFileSync(file));
  const shared = [];
  const ss = zip.file("xl/sharedStrings.xml");
  if (ss) (await ss.async("string")).replace(/<si>([\s\S]*?)<\/si>/g, (m, inner) => { shared.push(xmlText((inner.match(/<t[^>]*>[\s\S]*?<\/t>/g) || []).join(""))); return ""; });
  const st = zip.file("xl/styles.xml");
  const dates = st ? dateStyles(await st.async("string")) : new Set();
  const wb = await zip.file("xl/workbook.xml").async("string");
  const rels = await zip.file("xl/_rels/workbook.xml.rels").async("string");
  const out = [];
  for (const tag of wb.match(/<sheet [^>]*>/g) || []) {
    if (/state="(hidden|veryHidden)"/.test(tag)) continue;
    const name = xmlText((tag.match(/name="([^"]*)"/) || [])[1] || ""), rid = (tag.match(/r:id="([^"]+)"/) || [])[1];
    const rel = (rels.match(new RegExp("<Relationship [^>]*Id=\"" + rid + "\"[^>]*>")) || [])[0] || "";
    const target = (rel.match(/Target="([^"]+)"/) || [])[1];
    if (!name || !target) continue;
    if (onProgress) onProgress({ sheet: name, rows: 0 });
    const rows = await readSheet(zip, "xl/" + target.replace(/^\/?xl\//, ""), shared, dates, (n) => onProgress && onProgress({ sheet: name, rows: n }));
    out.push({ name, rows, truncated: !!rows.truncated });
  }
  return out;
}

// A CSV or text file is one sheet named after the file. Cells stay text.
function readCsvBook(file) {
  return [{ name: path.basename(file).replace(/\.[^.]+$/, ""), rows: splitText(fs.readFileSync(file, "utf8")) }];
}

async function readBook(file, onProgress) {
  const ext = path.extname(file).toLowerCase();
  if (ext === ".xls") throw new Error("Old Excel files (.xls) cannot be read. Save the file as .xlsx or CSV and choose it again.");
  if (fs.statSync(file).size > MAX_BYTES) throw new Error("The file is too large to import.");
  return ext === ".xlsx" ? readXlsxBook(file, onProgress) : readCsvBook(file);
}

module.exports = { MAX_ROWS, readBook, readXlsxBook, readCsvBook, serialToDate, isDateFormat };
