// Writes Excel workbooks (.xlsx): the class list template and the results of one course.
// Reading a workbook is in table.js. Nothing here touches the disk or Electron, so it can be tested in plain Node.
"use strict";
const JSZip = require("jszip");

// ---------- cells ----------

// Text that Excel accepts inside XML: escaped, and without the control characters XML forbids.
function xmlEscape(v) {
  return String(v == null ? "" : v)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// Column letters for a 0-based index: 0 -> A, 25 -> Z, 26 -> AA.
function colName(i) {
  let s = "";
  for (i += 1; i > 0; i = Math.floor((i - 1) / 26)) s = String.fromCharCode(65 + ((i - 1) % 26)) + s;
  return s;
}

// A column whose heading names an ID or a code stays text, so leading zeros and long numbers survive.
const TEXT_HEADING = /\bid\b|code|phone/i;
// A plain number: no leading zero (except 0.x), at most 15 digits, so Excel keeps it exactly.
const PLAIN_NUMBER = /^-?(0|[1-9]\d{0,14})(\.\d{1,10})?$/;

function isNumberCell(v, heading) {
  if (TEXT_HEADING.test(String(heading || ""))) return false;
  if (typeof v === "number") return Number.isFinite(v);
  return typeof v === "string" && PLAIN_NUMBER.test(v);
}

function cellXml(v, ref, heading, bold) {
  const style = bold ? ' s="1"' : "";
  if (v == null || v === "") return bold ? "<c r=\"" + ref + "\"" + style + "/>" : "";
  if (!bold && isNumberCell(v, heading)) return "<c r=\"" + ref + "\"" + style + "><v>" + Number(v) + "</v></c>";
  return "<c r=\"" + ref + "\"" + style + " t=\"inlineStr\"><is><t xml:space=\"preserve\">" + xmlEscape(v) + "</t></is></c>";
}

// ---------- sheets ----------

// Excel sheet names: at most 31 characters, none of : \ / ? * [ ], and unique in the workbook.
function sheetNames(names) {
  const used = new Set();
  return names.map((n) => {
    const base = (String(n || "Sheet").replace(/[:\\/?*\[\]]/g, " ").trim() || "Sheet").slice(0, 31);
    let name = base, k = 2;
    while (used.has(name.toLowerCase())) { const tail = " " + k++; name = base.slice(0, 31 - tail.length) + tail; }
    used.add(name.toLowerCase());
    return name;
  });
}

// Column widths from the longest value in each column, within sensible limits.
function widths(rows) {
  const w = [];
  rows.slice(0, 500).forEach((r) => r.forEach((v, i) => { w[i] = Math.max(w[i] || 8, Math.min(60, String(v == null ? "" : v).length + 2)); }));
  return w;
}

// One worksheet. The first row is the heading: bold, frozen and with a filter.
function sheetXml(rows) {
  rows = (rows || []).map((r) => (Array.isArray(r) ? r : [r]));
  const head = rows[0] || [];
  const ncol = Math.max(1, ...rows.map((r) => r.length));
  const cols = widths(rows).map((w, i) => "<col min=\"" + (i + 1) + "\" max=\"" + (i + 1) + "\" width=\"" + w + "\" customWidth=\"1\"/>").join("");
  const body = rows.map((r, ri) => "<row r=\"" + (ri + 1) + "\">" +
    r.map((v, ci) => cellXml(v, colName(ci) + (ri + 1), head[ci], ri === 0)).join("") + "</row>").join("");
  const last = colName(ncol - 1) + Math.max(1, rows.length);
  return "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>" +
    "<worksheet xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\">" +
    "<sheetViews><sheetView workbookViewId=\"0\"><pane ySplit=\"1\" topLeftCell=\"A2\" activePane=\"bottomLeft\" state=\"frozen\"/></sheetView></sheetViews>" +
    (cols ? "<cols>" + cols + "</cols>" : "") +
    "<sheetData>" + body + "</sheetData>" +
    (rows.length > 1 ? "<autoFilter ref=\"A1:" + last + "\"/>" : "") +
    "</worksheet>";
}

// ---------- workbook ----------

const STYLES = "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>" +
  "<styleSheet xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\">" +
  "<fonts count=\"2\"><font><sz val=\"11\"/><name val=\"Calibri\"/></font><font><b/><sz val=\"11\"/><name val=\"Calibri\"/></font></fonts>" +
  "<fills count=\"2\"><fill><patternFill patternType=\"none\"/></fill><fill><patternFill patternType=\"gray125\"/></fill></fills>" +
  "<borders count=\"1\"><border><left/><right/><top/><bottom/><diagonal/></border></borders>" +
  "<cellStyleXfs count=\"1\"><xf numFmtId=\"0\" fontId=\"0\" fillId=\"0\" borderId=\"0\"/></cellStyleXfs>" +
  "<cellXfs count=\"2\"><xf numFmtId=\"0\" fontId=\"0\" fillId=\"0\" borderId=\"0\" xfId=\"0\"/><xf numFmtId=\"0\" fontId=\"1\" fillId=\"0\" borderId=\"0\" xfId=\"0\" applyFont=\"1\"/></cellXfs>" +
  "<cellStyles count=\"1\"><cellStyle name=\"Normal\" xfId=\"0\" builtinId=\"0\"/></cellStyles>" +
  "</styleSheet>";

// sheets: [{ name, rows: [[cell, ...], ...] }]. Returns the .xlsx file as a Buffer.
async function writeXlsx(sheets) {
  if (!sheets || !sheets.length) sheets = [{ name: "Sheet1", rows: [] }];
  const names = sheetNames(sheets.map((s) => s.name));
  const zip = new JSZip();
  zip.file("[Content_Types].xml", "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>" +
    "<Types xmlns=\"http://schemas.openxmlformats.org/package/2006/content-types\">" +
    "<Default Extension=\"rels\" ContentType=\"application/vnd.openxmlformats-package.relationships+xml\"/>" +
    "<Default Extension=\"xml\" ContentType=\"application/xml\"/>" +
    "<Override PartName=\"/xl/workbook.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml\"/>" +
    "<Override PartName=\"/xl/styles.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml\"/>" +
    names.map((n, i) => "<Override PartName=\"/xl/worksheets/sheet" + (i + 1) + ".xml\" ContentType=\"application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml\"/>").join("") +
    "</Types>");
  zip.file("_rels/.rels", "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>" +
    "<Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\">" +
    "<Relationship Id=\"rId1\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument\" Target=\"xl/workbook.xml\"/></Relationships>");
  zip.file("xl/workbook.xml", "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>" +
    "<workbook xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\" xmlns:r=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships\"><sheets>" +
    names.map((n, i) => "<sheet name=\"" + xmlEscape(n) + "\" sheetId=\"" + (i + 1) + "\" r:id=\"rId" + (i + 1) + "\"/>").join("") +
    "</sheets></workbook>");
  zip.file("xl/_rels/workbook.xml.rels", "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>" +
    "<Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\">" +
    names.map((n, i) => "<Relationship Id=\"rId" + (i + 1) + "\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet\" Target=\"worksheets/sheet" + (i + 1) + ".xml\"/>").join("") +
    "<Relationship Id=\"rId" + (names.length + 1) + "\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles\" Target=\"styles.xml\"/>" +
    "</Relationships>");
  zip.file("xl/styles.xml", STYLES);
  sheets.forEach((s, i) => zip.file("xl/worksheets/sheet" + (i + 1) + ".xml", sheetXml(s.rows)));
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}

// ---------- the two workbooks CM offers ----------

// The class list template. The list is the first sheet, because import reads the first sheet.
function classListTemplate() {
  return [
    { name: "Class list", rows: [["Student ID", "First name", "Last name"], ["10000001", "Ama", "Mensah"], ["10000002", "Kofi", "Boateng"], ["10000003", "Efua", "Owusu"]] },
    { name: "How to fill in", rows: [
      ["How to fill in the class list"],
      ["1. On the Class list sheet, replace the three sample rows with your students: one student per row."],
      ["2. Column A holds the student ID (4 to 12 digits). Column B holds the first name and column C the last name; both may be left empty."],
      ["3. Keep the heading row. Sakai and most records systems export first and last names as separate columns, as here. A single Name column also works. Further columns, such as email or programme, may stay; they are not imported."],
      ["4. Save the file as Excel (.xlsx), then in Class Manager choose Setup, Class list, Choose a file."],
      ["5. Check the preview: say which columns hold the ID, the first name and the last name, then save."],
      ["Each course has its own class list. Import the file while the right course is selected."]
    ] }
  ];
}

// Every tab of one course's workbook, as sheets. tabs: [{ name }]; read(name) returns the tab's rows.
function resultsSheets(tabs, read) {
  return (tabs || []).map((t) => ({ name: t.name, rows: read(t.name) || [] }));
}

module.exports = { writeXlsx, classListTemplate, resultsSheets, sheetNames, colName, isNumberCell, xmlEscape };
