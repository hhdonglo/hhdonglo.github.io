// Reads a class list as rows of cells: CSV, tab-separated or plain text, or the first sheet of an Excel workbook (.xlsx).
"use strict";
const fs = require("fs");
const path = require("path");
const JSZip = require("jszip");

// CSV or tab-separated text, with quoted cells.
function splitText(text) {
  text = String(text || "").replace(/^﻿/, "");
  const first = text.split(/\r?\n/).find((l) => l.trim()) || "";
  const sep = (first.match(/\t/g) || []).length > 0 ? "\t" : (first.match(/;/g) || []).length > (first.match(/,/g) || []).length ? ";" : ",";
  const rows = []; let row = [], cell = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') q = false; else cell += c; continue; }
    if (c === '"' && cell === "") q = true;
    else if (c === sep) { row.push(cell.trim()); cell = ""; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && text[i + 1] === "\n") i++; row.push(cell.trim()); rows.push(row); row = []; cell = ""; }
    else cell += c;
  }
  if (cell !== "" || row.length) { row.push(cell.trim()); rows.push(row); }
  return rows.filter((r) => r.some((x) => x !== "")).slice(0, 20000);
}

function xmlText(s) { return String(s).replace(/<[^>]+>/g, "").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&"); }
function colIndex(ref) { const m = String(ref).match(/^([A-Z]+)/); let n = 0; if (m) for (const ch of m[1]) n = n * 26 + ch.charCodeAt(0) - 64; return n - 1; }

async function readXlsx(file) {
  const zip = await JSZip.loadAsync(fs.readFileSync(file));
  const shared = [];
  const ss = zip.file("xl/sharedStrings.xml");
  if (ss) (await ss.async("string")).replace(/<si>([\s\S]*?)<\/si>/g, (m, inner) => { shared.push(xmlText((inner.match(/<t[^>]*>[\s\S]*?<\/t>/g) || []).join(""))); return ""; });
  // The first sheet in the workbook's order.
  let sheet = "xl/worksheets/sheet1.xml";
  try {
    const wb = await zip.file("xl/workbook.xml").async("string");
    const rels = await zip.file("xl/_rels/workbook.xml.rels").async("string");
    const rid = (wb.match(/<sheet [^>]*r:id="([^"]+)"/) || [])[1];
    const target = rid && (rels.match(new RegExp('<Relationship [^>]*Id="' + rid + '"[^>]*Target="([^"]+)"')) || rels.match(new RegExp('<Relationship [^>]*Target="([^"]+)"[^>]*Id="' + rid + '"')) || [])[1];
    if (target) sheet = "xl/" + target.replace(/^\/?xl\//, "");
  } catch (e) { /* use sheet1 */ }
  const sx = zip.file(sheet);
  if (!sx) throw new Error("The workbook has no readable sheet.");
  const rows = [];
  (await sx.async("string")).replace(/<row[^>]*>([\s\S]*?)<\/row>/g, (m, inner) => {
    const row = [];
    inner.replace(/<c ([^>]*?)(\/>|>([\s\S]*?)<\/c>)/g, (m2, attrs, end, body) => {
      const ref = (attrs.match(/r="([A-Z]+\d+)"/) || [])[1], t = (attrs.match(/t="(\w+)"/) || [])[1];
      let v = "";
      if (body) {
        if (t === "inlineStr") v = xmlText((body.match(/<t[^>]*>[\s\S]*?<\/t>/g) || []).join(""));
        else { const raw = (body.match(/<v>([\s\S]*?)<\/v>/) || [])[1] || ""; v = t === "s" ? shared[Number(raw)] || "" : xmlText(raw); }
      }
      const i = ref ? colIndex(ref) : row.length;
      while (row.length < i) row.push("");
      row[i] = String(v).trim();
      return "";
    });
    if (row.some((x) => x !== "")) rows.push(row);
    return "";
  });
  return rows.slice(0, 20000);
}

async function readTable(file) {
  const ext = path.extname(file).toLowerCase();
  if (ext === ".xls") throw new Error("Old Excel files (.xls) cannot be read. Save the file as .xlsx or CSV and choose it again.");
  if (fs.statSync(file).size > 20000000) throw new Error("The file is too large for a class list.");
  if (ext === ".xlsx") return readXlsx(file);
  return splitText(fs.readFileSync(file, "utf8"));
}

module.exports = { readTable, splitText, readXlsx };
