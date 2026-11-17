// Decides what a lecture document is: slides or lecture notes, handout, tutorial, supplement or reference.
// One responsibility: evidence in, a kind with a confidence and plain reasons out. Pure (the text is read by peek.js).
// Evidence, strongest first: words in the file name, a title line inside the file, words in the folder names, the length of the document.
// Each piece of evidence gives a weight for one kind; weights for the same kind combine as 1 - (1 - a)(1 - b); a rival kind lowers the confidence.
"use strict";
const { nameOf } = require("./types");

const KINDS = ["slides", "handout", "tutorial", "supplement", "reference"];
const LABELS = { slides: "Slides", handout: "Handout", tutorial: "Tutorial", supplement: "Supplement", reference: "Reference" };

// [kind, pattern, what it is called in the reasons]
const WORDS = [
  ["handout", /hand[\s_\-]?outs?/i, "handout"],
  ["tutorial", /tutorials?|\btut\d*\b|exercises?|problem[\s_\-]?(sets?|sheets?)|work[\s_\-]?sheets?|practice[\s_\-]?(problems|sheet)/i, "tutorial"],
  ["supplement", /supplement(s|ary|al)?|further[\s_\-]?notes|extra[\s_\-]?notes|additional[\s_\-]?notes/i, "supplement"],
  ["reference", /references?|further[\s_\-]?reading|reading[\s_\-]?list|bibliography|formula[\s_\-]?sheets?|cheat[\s_\-]?sheets?|(^|[\s_\-])reading([\s_\-]|$)/i, "reference"],
  ["slides", /slides?|lecture[\s_\-]?notes?|\bdeck\b|presentation/i, "slides or lecture notes"],
];
const HEADER = /department|university|college|faculty|office|@|©|\b(19|20)\d\d\b|^(PHYS|MATH|CHEM|BIOL|CSC|ENG|STAT)[A-Z]*\s?\d{2,4}\b/i;

const mix = (a, b) => 1 - (1 - a) * (1 - b);
const first = (re, s) => { const m = re.exec(s); return m ? m[0].trim() : null; };

// Lines of the first page that say what the document is: the header lines (course, author, office) are left out.
function titleLines(text) {
  return String(text || "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean).slice(0, 16).filter((l) => !HEADER.test(l) || /week\s*\d|lecture\s*\d/i.test(l)).slice(0, 8);
}

// peek: { pages, text } from peek.js, or null when the file could not be read. -> { kind, confidence, level, reasons, scores }
function classify(rel, peek) {
  const file = nameOf(rel).replace(/\.[^.]+$/, ""), dirs = String(rel).split(/[\\/]/).slice(0, -1).join(" / ");
  const ev = {}, why = {};
  const add = (kind, w, reason) => { ev[kind] = mix(ev[kind] || 0, w); (why[kind] = why[kind] || []).push(reason); };
  WORDS.forEach(([kind, re, name]) => {
    const f = first(re, file), d = first(re, dirs);
    if (f) add(kind, kind === "slides" ? 0.6 : 0.75, "the file name says \"" + f + "\"");
    if (d) add(kind, 0.4, "the folder name says \"" + d + "\"");
  });
  if (peek && peek.text) {
    const lines = titleLines(peek.text);
    WORDS.forEach(([kind, re]) => {
      const hit = lines.find((l) => re.test(l));
      if (hit) add(kind, kind === "slides" ? 0.45 : 0.65, "the first page says \"" + (hit.length > 60 ? hit.slice(0, 57) + "..." : hit) + "\"");
    });
    if (peek.pages >= 25 && Object.keys(ev).every((k) => k === "slides")) add("slides", 0.25, "it has " + peek.pages + " pages, as a lecture does");
  }
  if (!Object.keys(ev).length) add("slides", 0.4, "no other kind of document is named; it is taken as the lecture notes");
  const ranked = Object.keys(ev).sort((a, b) => ev[b] - ev[a]);
  const best = ranked[0], rival = ranked[1] ? ev[ranked[1]] : 0;
  const confidence = Math.max(0.2, Math.min(0.99, ev[best] - 0.35 * rival));
  const level = confidence >= 0.75 ? "high" : confidence >= 0.5 ? "medium" : "low";
  return { kind: best, confidence: Math.round(confidence * 100) / 100, level, reasons: why[best], scores: ev };
}

module.exports = { classify, titleLines, KINDS, LABELS, HEADER };
