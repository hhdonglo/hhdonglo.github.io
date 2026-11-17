// Builds the lecture cards from a folder listing. This is the one place that decides what a lecture file is, so every loader
// (course pack import, course folder load, linked folder) shows the same thing.
// One responsibility: listing + what was read inside the files + the lecturer's choices in, rows out. Pure (no file access).
//   1. Every file is a lecture document, or is ignored with a reason (figure, not PDF or Word, backup or draft, duplicate, no lecture number).
//   2. Each lecture gets at most one document per role (slides or notes, handout, tutorial, supplement, reference): the lecturer's choice first,
//      then the course's own list, then the best guess with its confidence. Other documents with the same role are ignored ("extra") and can be added back.
//   3. Rows keep the statuses of lecture-progress/overview.js, which now counts only the documents that were taken in.
"use strict";
const { overview, COPIES } = require("../lecture-progress/overview");
const { lectureOf } = require("../autoload/lecture-names");
const { isDocumentType, figureByName, nameOf } = require("./types");
const { classify, KINDS, LABELS } = require("./classify");
const { draft, titleOf } = require("./describe");

const DRAFTS = /(^|[\s_\-.(\[])(drafts?|old|backups?|bak|copy|tmp|temp|wip|scratch|working|untitled|superseded|obsolete|v\d+)([\s_\-.)\]]|$)|\(\d+\)|~$|copy of/i;
const REASONS = {
  figure: "Figures", other: "Not PDF or Word (notes, tables, text)", backup: "Backups, drafts and copies",
  duplicate: "Duplicates", extra: "Extra documents (another file already has that role)", unplaced: "No lecture number found",
};
const baseName = (rel) => nameOf(rel).replace(/\.[^.]+$/, "");
const looksLikeFigure = (p) => !!p && p.ok && p.pages === 1 && String(p.text || "").replace(/\s/g, "").length < 80;
const key = (rel) => nameOf(rel).toLowerCase();

// -> { docs: [{ rel, size, lecture, peek }], ignored: [{ rel, reason, lecture }] }
function sieve(files, peeks) {
  const docs = [], ignored = [], seen = new Map(), same = new Map();
  const list = (files || []).map((f) => (typeof f === "string" ? { rel: f } : f)).sort((a, b) => a.rel.split(/[\\/]/).length - b.rel.split(/[\\/]/).length || a.rel.localeCompare(b.rel));
  list.forEach((f) => {
    const rel = f.rel, lecture = lectureOf(rel), no = (reason) => ignored.push({ rel, reason, lecture });
    if (!isDocumentType(rel)) return no("other");
    if (COPIES.test(rel) || DRAFTS.test(baseName(rel))) return no("backup");
    if (figureByName(rel)) return no("figure");
    const p = peeks && peeks[rel];
    if (looksLikeFigure(p) && classify(rel, p).confidence < 0.6 && !/lecture|tutorial|handout|sheet/i.test(rel)) return no("figure");
    if (seen.has(key(rel))) return no("duplicate");
    seen.set(key(rel), rel);
    if (f.size != null && p && p.ok) { // the same bytes under another plain name: one copy only
      const sig = f.size + "|" + p.pages + "|" + String(p.text).slice(0, 300), named = classify(rel, null).reasons.some((r) => !/no other kind/.test(r));
      if (same.has(sig) && !named) return no("duplicate");
      if (!same.has(sig) && !named) same.set(sig, rel);
    }
    if (lecture == null) return no("unplaced");
    docs.push({ rel, size: f.size, lecture, peek: p || null });
  });
  return { docs, ignored };
}

// The scanned document the course or the lecturer means by a path (the same file name counts).
function resolveRel(value, docs) {
  if (!value) return null;
  const hit = docs.find((d) => d.rel === value) || docs.find((d) => key(d.rel) === key(value));
  return hit ? hit.rel : String(value);
}

// docs of one lecture -> { chips, taken, extras }
function assign(n, docs, listed, saved) {
  const cls = {}; docs.forEach((d) => { cls[d.rel] = classify(d.rel, d.peek); });
  const chips = {}, taken = new Set(), by = {}; docs.forEach((d) => { by[d.rel] = d; });
  KINDS.forEach((k) => {
    const mine = saved && Object.prototype.hasOwnProperty.call(saved, k) ? saved[k] : undefined;
    if (mine === null) { chips[k] = null; chips["_blocked_" + k] = true; return; }
    const pick = mine ? { rel: resolveRel(mine, docs), source: "you" } : listed && listed[k] ? { rel: resolveRel(listed[k], docs), source: "course" } : null;
    if (pick && !taken.has(pick.rel)) {
      taken.add(pick.rel);
      chips[k] = { rel: pick.rel, name: nameOf(pick.rel), confidence: 1, level: "high", reasons: [pick.source === "you" ? "you chose this file" : "the course lists this file"], source: pick.source, kind: k };
    }
  });
  KINDS.forEach((k) => {
    if (chips[k] !== undefined || chips["_blocked_" + k]) return;
    const stems = (d) => (k === "slides" ? docs.filter((x) => x !== d && baseName(x.rel).toLowerCase().startsWith(baseName(d.rel).toLowerCase() + "_")).length : 0);
    const c = docs.filter((d) => !taken.has(d.rel) && cls[d.rel].kind === k).sort((a, b) => stems(b) - stems(a) || cls[b.rel].scores[k] - cls[a.rel].scores[k] || (b.peek ? b.peek.pages : 0) - (a.peek ? a.peek.pages : 0) || a.rel.length - b.rel.length);
    if (!c.length) { chips[k] = null; return; }
    const w = c[0], r = cls[w.rel], rivals = c.length - 1, conf = Math.max(0.2, r.confidence - Math.min(0.3, 0.1 * rivals));
    const stem = stems(w), cf = Math.min(0.95, conf + (stem ? 0.3 : 0));
    taken.add(w.rel);
    chips[k] = { rel: w.rel, name: nameOf(w.rel), confidence: Math.round(cf * 100) / 100, level: cf >= 0.75 ? "high" : cf >= 0.5 ? "medium" : "low", source: "auto", kind: k,
      reasons: r.reasons.concat(stem ? ["the handout, reference and other files are named after it"] : [], rivals ? [rivals + " other file" + (rivals > 1 ? "s" : "") + " could also be this, so check it"] : []) };
  });
  KINDS.forEach((k) => { delete chips["_blocked_" + k]; if (chips[k] === undefined) chips[k] = null; });
  const extras = docs.filter((d) => !taken.has(d.rel)).map((d) => ({ rel: d.rel, reason: "extra", guess: cls[d.rel].kind, confidence: cls[d.rel].confidence, lecture: n }));
  return { chips, taken, extras, cls };
}

function describeRow(n, row, chips, listedSummary, savedText, peekOf) {
  if (listedSummary) return { text: listedSummary, source: "course" };
  if (savedText) return { text: savedText, source: "edited" };
  for (const k of ["slides", "handout", "supplement", "tutorial", "reference"]) {
    const c = chips[k]; if (!c) continue;
    const t = draft(peekOf(c.rel) && peekOf(c.rel).text);
    if (t) return { text: t, source: "drafted", from: c.name };
  }
  return null;
}

// files: [{ rel, size? }] or paths; peeks: { rel: { ok, pages, text } }; lectures: the course's list; counts: questions per lecture; saved: store.read().lectures
function build({ files, peeks, lectures, counts, saved }) {
  const { docs, ignored } = sieve(files, peeks), perLecture = {};
  docs.forEach((d) => { (perLecture[d.lecture] = perLecture[d.lecture] || []).push(d); });
  const listed = {}; (lectures || []).forEach((l) => { listed[l.number] = l; });
  const decided = {}, kept = [];
  const nums = new Set(Object.keys(perLecture).map(Number).concat(Object.keys(saved || {}).map(Number)));
  nums.forEach((n) => {
    const s = saved && saved[n] && saved[n].files || {}, a = assign(n, perLecture[n] || [], listed[n], s);
    decided[n] = a; Object.keys(a.chips).forEach((k) => { if (a.chips[k]) kept.push(a.chips[k].rel); });
    a.extras.forEach((x) => ignored.push(x));
  });
  const base = overview(kept, lectures, counts), peekOf = (rel) => { const d = docs.find((x) => x.rel === rel); return d && d.peek; };
  const rows = base.rows.map((r) => {
    const a = decided[r.number] || { chips: {} }, sv = saved && saved[r.number], chips = {};
    KINDS.forEach((k) => { chips[k] = a.chips[k] || null; });
    const documents = KINDS.filter((k) => chips[k]).map((k) => chips[k]);
    const title = r.title || titleOf(peekOf(chips.slides && chips.slides.rel) && peekOf(chips.slides.rel).text) || "";
    return Object.assign({}, r, { chips, documents, title, files: documents.map((d) => d.rel), fileCount: documents.length,
      ignored: ignored.filter((x) => x.lecture === r.number), description: describeRow(r.number, r, chips, r.description, sv && sv.description, peekOf) || null });
  });
  const counted = {}; ignored.forEach((x) => { counted[x.reason] = (counted[x.reason] || 0) + 1; });
  const groups = Object.keys(REASONS).filter((k) => counted[k]).map((k) => ({ reason: k, label: REASONS[k], count: counted[k] }));
  const rowsFixed = rows.map((r) => Object.assign(r, { description: r.description && r.description.text ? r.description : null }));
  return { rows: rowsFixed, last: base.last, gaps: base.gaps, ignored: { total: ignored.length, groups, files: ignored.filter((x) => x.lecture == null || !rows.some((r) => r.number === x.lecture)) }, labels: LABELS };
}

module.exports = { build, sieve, assign, REASONS, DRAFTS };
