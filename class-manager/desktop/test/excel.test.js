/* Excel files: run with `npm test` in class-manager/desktop (Node 20 or later, no Electron needed).
   - A workbook written by excel.js opens again with the app's own reader (table.js), cell for cell.
   - The class list template imports as a class list: its first sheet holds the IDs and names.
   - Student IDs stay text, so leading zeros survive; plain numbers become numbers.
   - Sheet names follow Excel's rules.
   - The results workbook of one course holds only that course's records. */
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const JSZip = require("jszip");
const excel = require("../excel");
const { readXlsx } = require("../table");
const { createBackend } = require("../backend");
const { createCourse } = require("../course");
const C = require("../courses");

const WEB = path.resolve(__dirname, "..", "..");
const TPL = path.join(WEB, "templates");
const tmp = (p) => fs.mkdtempSync(path.join(os.tmpdir(), p));

async function saveAndRead(sheets) {
  const file = path.join(tmp("cm-xlsx-"), "book.xlsx");
  fs.writeFileSync(file, await excel.writeXlsx(sheets));
  return { file, rows: await readXlsx(file) };
}

test("a written workbook reads back cell for cell", async () => {
  const rows = [["Student ID", "Name", "Score"], ["00123456", "Ama <A&B> \"Q\"", "7"], ["10000002", "Kofi, Jr.", 12.5]];
  const { rows: back } = await saveAndRead([{ name: "Results", rows }]);
  assert.deepEqual(back, [["Student ID", "Name", "Score"], ["00123456", "Ama <A&B> \"Q\"", "7"], ["10000002", "Kofi, Jr.", "12.5"]]);
});

test("the class list template imports as a class list", async () => {
  const { rows } = await saveAndRead(excel.classListTemplate());
  assert.deepEqual(rows[0], ["Student ID", "First name", "Last name"]);
  assert.equal(rows.length, 4);
  rows.slice(1).forEach((r) => assert.match(r[0], /^\d{4,12}$/));
});

test("IDs stay text and plain numbers become numbers", async () => {
  const { file } = await saveAndRead([{ name: "S", rows: [["Student ID", "Total", "Note"], ["0012345", "8", "007"], ["12345", "10", "x"]] }]);
  const xml = await (await JSZip.loadAsync(fs.readFileSync(file))).file("xl/worksheets/sheet1.xml").async("string");
  assert.match(xml, /<c r="A2" t="inlineStr"><is><t xml:space="preserve">0012345</);
  assert.match(xml, /<c r="A3" t="inlineStr">/, "a column headed ID stays text even without a leading zero");
  assert.match(xml, /<c r="B2"><v>8<\/v>/);
  assert.match(xml, /<c r="C2" t="inlineStr">/, "a leading zero keeps a value as text");
  assert.equal(excel.isNumberCell("1234567890123456", "Total"), false, "16 digits would lose precision");
});

test("sheet names follow Excel's rules", () => {
  const names = excel.sheetNames(["Form Responses 1", "a/b:c?", "x".repeat(40), "x".repeat(40), ""]);
  assert.equal(names[0], "Form Responses 1");
  assert.equal(names[1], "a b c");
  assert.equal(names[2].length, 31);
  assert.notEqual(names[2], names[3]);
  assert.ok(names[3].length <= 31);
  assert.equal(names[4], "Sheet");
  assert.deepEqual([0, 25, 26, 701, 702].map(excel.colName), ["A", "Z", "AA", "ZZ", "AAA"]);
});

test("the results workbook of one course holds only that course's records", async () => {
  const reg = C.createRegistry(tmp("cm-xl-two-"));
  reg.add({ code: "PHYS 143" }); reg.add({ code: "MATH 101" });
  const open = (id) => { const d = reg.dirs(id); const course = createCourse({ dir: d.course, web: WEB, templates: TPL }); return createBackend({ webRoot: WEB, resolve: course.resolve, dataFile: d.workbook, log: () => {} }); };
  const A = open("phys-143"), B = open("math-101");
  A.rosterSync([["20001111", "Esi"], ["20002222", "Yaw"]], false);
  B.rosterSync([["30003333", "Abena"]], false);
  const sheets = excel.resultsSheets(A.tabs(), (n) => A.tab(n));
  assert.ok(sheets.some((s) => s.name === "Roster"));
  const file = path.join(tmp("cm-xl-res-"), "a.xlsx");
  fs.writeFileSync(file, await excel.writeXlsx(sheets));
  const all = JSON.stringify(await Promise.all(sheets.map(async (s, i) => {
    const zip = await JSZip.loadAsync(fs.readFileSync(file));
    return zip.file("xl/worksheets/sheet" + (i + 1) + ".xml").async("string");
  })));
  assert.match(all, /20001111/);
  assert.match(all, /20002222/);
  assert.doesNotMatch(all, /30003333|Abena/, "no record of the other course");
});
