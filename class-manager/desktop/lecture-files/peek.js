// A short look inside a lecture document: how many pages it has and the text of its first pages.
// One responsibility: read little, safely, and remember it (by path, size and date) so a screen refresh does not read the files again.
"use strict";
const fs = require("fs");
const { ext } = require("./types");

const PAGES = 2, CHARS = 4000, cache = new Map();

async function readPdf(file) {
  const { getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(new Uint8Array(fs.readFileSync(file)));
  let text = "";
  for (let i = 1; i <= Math.min(PAGES, pdf.numPages); i++) {
    const tc = await (await pdf.getPage(i)).getTextContent();
    let line = "", lastY = null;
    for (const it of tc.items) {
      if (typeof it.str !== "string") continue;
      const y = it.transform ? Math.round(it.transform[5]) : lastY;
      if (lastY !== null && y !== null && Math.abs(y - lastY) > 2 && line.trim()) { text += line.trim() + "\n"; line = ""; }
      line += it.str; if (it.hasEOL) { text += line.trim() + "\n"; line = ""; }
      lastY = y;
    }
    if (line.trim()) text += line.trim() + "\n";
  }
  return { pages: pdf.numPages, text: text.slice(0, CHARS) };
}
async function readWord(file) {
  const r = await require("mammoth").extractRawText({ buffer: fs.readFileSync(file) });
  const text = r.value.replace(/\n{3,}/g, "\n\n");
  return { pages: Math.max(1, Math.round(text.length / 3000)), text: text.slice(0, CHARS) };
}

// -> { ok, pages, text }; { ok: false } when the file cannot be read (damaged, locked, scanned pictures only).
async function peek(file) {
  let st; try { st = fs.statSync(file); } catch (e) { return { ok: false }; }
  const key = file + "|" + st.size + "|" + st.mtimeMs;
  if (cache.has(key)) return cache.get(key);
  let r;
  try { r = Object.assign({ ok: true }, ext(file) === ".pdf" ? await readPdf(file) : await readWord(file)); } catch (e) { r = { ok: false }; }
  cache.set(key, r);
  return r;
}

// Looks at many files, a few at a time, so a big folder keeps the screen responsive. -> { rel: peek }
async function peekAll(items, limit) {
  const out = {}; let i = 0;
  async function worker() { while (i < items.length) { const it = items[i++]; out[it.rel] = await peek(it.path); } }
  await Promise.all(Array.from({ length: Math.min(limit || 4, items.length) }, worker));
  return out;
}

module.exports = { peek, peekAll, _clear: () => cache.clear() };
