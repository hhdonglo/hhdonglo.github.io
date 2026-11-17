// A one or two sentence description of a lecture, quoted from its own notes: never written from outside knowledge.
// One responsibility: the text of the first pages in, a title and a sentence out (or nothing when the notes do not give one). Pure.
"use strict";
const { titleLines, HEADER } = require("./classify");

const clean = (s) => String(s || "").replace(/\s+/g, " ").trim();

// "Week 1: Vectors - Tutorial Sheet" gives "Vectors"; a plain title line ("Vectors") is taken as it is.
function titleOf(text) {
  const lines = titleLines(text);
  for (const l of lines) {
    const m = /^(?:week|lecture)\s*\d+\s*[:.\-–]\s*(.+?)(?:\s+[–\-]\s+.+)?$/i.exec(l);
    if (m && m[1].length <= 70) return clean(m[1]);
  }
  const plain = lines.find((l) => l.length >= 3 && l.length <= 60 && !/[?.]$/.test(l) && !/^(week|lecture)\s*\d+/i.test(l));
  return plain ? clean(plain) : "";
}

// The first question or full sentence of the opening page that is not a header line. -> { title, sentence } with either possibly "".
function describe(text) {
  const title = titleOf(text);
  const lines = String(text || "").split(/\r?\n/).map(clean).filter((l) => l && !HEADER.test(l) && l !== title);
  const body = lines.join(" ").replace(/\s+/g, " ");
  const sentences = body.match(/[^.?!]{25,}[.?!]/g) || [];
  const ok = sentences.map(clean).filter((s) => s.length <= 220 && !/^(week|lecture)\s*\d+/i.test(s) && !/\d\s*$/.test(s.slice(0, -1)));
  const q = ok.find((s) => s.endsWith("?")), s = q || ok[0] || "";
  return { title, sentence: s };
}

// -> "Vectors. How do we describe...?" or "" . The title is dropped when the sentence already begins with it.
function draft(text) {
  const d = describe(text);
  if (!d.sentence) return d.title ? "" : "";
  return d.title && !d.sentence.toLowerCase().startsWith(d.title.toLowerCase()) ? d.title + ". " + d.sentence : d.sentence;
}

module.exports = { describe, draft, titleOf };
