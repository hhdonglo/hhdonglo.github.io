/* Test helper: writes tabs as an Excel workbook the way Google Sheets exports one (dates as day numbers with a date style,
   numbers as numbers, text as text), so the web import is tested against the same kinds of cells. Made-up data only. */
"use strict";
const JSZip = require("jszip");

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const col = (i) => { let s = ""; for (i += 1; i > 0; i = Math.floor((i - 1) / 26)) s = String.fromCharCode(65 + ((i - 1) % 26)) + s; return s; };
const serial = (d) => (Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds()) - Date.UTC(1899, 11, 30)) / 864e5;

function cell(v, ref) {
  if (v === "" || v === null || v === undefined) return "";
  if (v instanceof Date) return '<c r="' + ref + '" s="1"><v>' + serial(v) + "</v></c>";
  if (typeof v === "number") return '<c r="' + ref + '"><v>' + v + "</v></c>";
  return '<c r="' + ref + '" t="inlineStr"><is><t>' + esc(v) + "</t></is></c>";
}

// sheets: [{ name, rows, hidden? }]
async function makeXlsx(sheets) {
  const zip = new JSZip();
  zip.file("[Content_Types].xml", '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/></Types>');
  zip.file("xl/styles.xml", '<styleSheet><numFmts count="1"><numFmt numFmtId="164" formatCode="m/d/yyyy h:mm:ss"/></numFmts><cellXfs count="2"><xf numFmtId="0"/><xf numFmtId="164"/></cellXfs></styleSheet>');
  zip.file("xl/workbook.xml", "<workbook><sheets>" + sheets.map((s, i) => '<sheet state="' + (s.hidden ? "hidden" : "visible") + '" name="' + esc(s.name) + '" sheetId="' + (i + 1) + '" r:id="rId' + (i + 1) + '"/>').join("") + "</sheets></workbook>");
  zip.file("xl/_rels/workbook.xml.rels", "<Relationships>" + sheets.map((s, i) => '<Relationship Id="rId' + (i + 1) + '" Type="worksheet" Target="worksheets/sheet' + (i + 1) + '.xml"/>').join("") + "</Relationships>");
  sheets.forEach((s, i) => zip.file("xl/worksheets/sheet" + (i + 1) + ".xml", "<worksheet><sheetData>" + s.rows.map((r, ri) => '<row r="' + (ri + 1) + '">' + r.map((v, ci) => cell(v, col(ci) + (ri + 1))).join("") + "</row>").join("") + "</sheetData></worksheet>"));
  return zip.generateAsync({ type: "nodebuffer" });
}

module.exports = { makeXlsx };
