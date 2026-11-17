/* Class list from any standard file: CSV, Excel, Word, text, pasted text, PDF. Read locally; only pictures and scans go to Claude. */
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const JSZip = require("jszip");
const { readRosterFiles, fromLines } = require("../roster-shots/files");
const { review } = require("../roster-shots/review");
const b64 = (s) => Buffer.from(s, "utf8").toString("base64");
const ids = (r) => r.rows.map((x) => x.id + ":" + x.name);

test("CSV with a title row, extra columns and first and last name columns", async () => {
  const csv = "PHYS 143 Class list 2026\n\nS/N,Index Number,Surname,Other Names,Programme,Level\n1,22524013,Mensah,Ama Serwaa,BSc Physics,200\n2,22524014,Boateng,Kofi,BSc Physics,200\n";
  const r = await readRosterFiles([{ name: "list.csv", type: "text/csv", data: b64(csv) }]);
  assert.deepEqual(ids(r), ["22524013:Ama Serwaa Mensah", "22524014:Kofi Boateng"]);
  assert.equal(r.vision.length, 0);
});

test("semicolon CSV with one full-name column, Last, First", async () => {
  const r = await readRosterFiles([{ name: "a.csv", type: "text/csv", data: b64("Student ID;Student Name\n20000001;\"Mensah, Ama\"\n20000002;Kofi Boateng\n") }]);
  assert.deepEqual(ids(r), ["20000001:Ama Mensah", "20000002:Kofi Boateng"]);
});

test("pasted or plain text lines in several styles", async () => {
  const t = "1. 20000001  Ama Mensah\nBoateng, Kofi - 20000002\n20000003\tEsi Owusu\tPhysics\nTotal students: 3\n";
  assert.deepEqual(fromLines(t, "x").map((s) => s.id + ":" + s.name), ["20000001:Ama Mensah", "20000002:Boateng, Kofi", "20000003:Esi Owusu"]);
  const r = await readRosterFiles([{ name: "pasted text.txt", type: "text/plain", data: b64(t) }]);
  assert.equal(r.rows.length, 3);
});

test("Word table", async () => {
  const cell = (t) => "<w:tc><w:p><w:r><w:t>" + t + "</w:t></w:r></w:p></w:tc>";
  const row = (a) => "<w:tr>" + a.map(cell).join("") + "</w:tr>";
  const xml = '<w:document xmlns:w="w"><w:body><w:tbl>' + row(["ID", "Name"]) + row(["20000001", "Ama Mensah"]) + row(["20000002", "Kofi Boateng"]) + "</w:tbl></w:body></w:document>";
  const z = new JSZip(); z.file("word/document.xml", xml);
  const r = await readRosterFiles([{ name: "list.docx", data: (await z.generateAsync({ type: "nodebuffer" })).toString("base64") }]);
  assert.deepEqual(ids(r), ["20000001:Ama Mensah", "20000002:Kofi Boateng"]);
});

test("pictures are left for Claude, and an unknown type is refused plainly", async () => {
  const r = await readRosterFiles([{ name: "shot.png", type: "image/png", data: "AAAA" }]);
  assert.equal(r.vision.length, 1); assert.equal(r.rows.length, 0);
  await assert.rejects(readRosterFiles([{ name: "x.exe", data: "AAAA" }]), /not read/);
  await assert.rejects(readRosterFiles([{ name: "old.xls", data: "AAAA" }]), /\.xlsx or CSV/);
});

test("repeats merge and two names for one ID are a conflict through the same review", async () => {
  const r = await readRosterFiles([{ name: "a.csv", data: b64("ID,Name\n20000001,Ama Mensah\n20000001,Ama Mensah\n20000002,Kofi\n20000002,Kofi Boateng\n") }]);
  const v = review(r.rows, { names: {} });
  assert.equal(v.students.length, 1); assert.equal(v.merged.length, 1); assert.equal(v.conflicts.length, 1);
});
