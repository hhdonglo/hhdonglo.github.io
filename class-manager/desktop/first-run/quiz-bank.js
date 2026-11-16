// Quiz banks in the format of the quizzes already online (quizzes/lectureN.json on the website). Pure.
// One file is { lecture, title, questions: [ { id, type, q, options[4], answer (0 to 3), exp, ref, ... } ] }.
// Files are read, checked and merged; a question is never rewritten, so what is loaded is what is online.
"use strict";

const TYPES = ["concept", "calc", "graph", "misconception"];
const FILE = /^lecture(\d+)(_concept)?\.json$/i; // lecture3.json, and the concept diagnostics lecture1_concept.json

const text = (v) => typeof v === "string" && v.trim() !== "";

function checkQuestion(q, i) {
  const at = "Question " + (i + 1) + (q && q.id ? " (" + q.id + ")" : "");
  const bad = [];
  if (!q || typeof q !== "object") return [at + " is not a question."];
  if (!text(q.id)) bad.push(at + " has no id.");
  if (!TYPES.includes(q.type)) bad.push(at + ": type must be one of " + TYPES.join(", ") + ".");
  if (!text(q.q)) bad.push(at + " has no question text.");
  if (!Array.isArray(q.options) || q.options.length !== 4 || !q.options.every(text)) bad.push(at + " needs exactly four non-empty options.");
  if (!Number.isInteger(q.answer) || q.answer < 0 || q.answer > 3) bad.push(at + ": answer must be 0, 1, 2 or 3 (the position of the correct option).");
  if (!text(q.exp)) bad.push(at + " has no explanation.");
  return bad;
}

// One file. Returns { ok, lecture, concept, title, questions, problems } and, when ok, the exact parsed document.
function parseBank(fileName, raw) {
  const m = String(fileName || "").match(FILE);
  let doc;
  try { doc = JSON.parse(String(raw).replace(/^﻿/, "")); } catch (e) { return { ok: false, file: fileName, problems: ["Not valid JSON: " + e.message] }; }
  if (!doc || typeof doc !== "object" || Array.isArray(doc) || !Array.isArray(doc.questions)) return { ok: false, file: fileName, problems: ["Not a quiz bank: a file holds { lecture, title, questions: [...] }."] };
  const lecture = Number.isInteger(doc.lecture) ? doc.lecture : m ? Number(m[1]) : NaN;
  const problems = [];
  if (!(lecture >= 0 && lecture <= 99)) problems.push("No lecture number (the file name or the \"lecture\" field must give one).");
  if (m && Number.isInteger(doc.lecture) && Number(m[1]) !== doc.lecture) problems.push("The file name says lecture " + m[1] + " but the file says lecture " + doc.lecture + ".");
  if (!doc.questions.length) problems.push("The file has no questions.");
  const seen = new Set();
  doc.questions.forEach((q, i) => {
    problems.push(...checkQuestion(q, i));
    if (q && text(q.id)) { if (seen.has(q.id)) problems.push("The id " + q.id + " is used twice."); seen.add(q.id); }
  });
  return { ok: !problems.length, file: fileName, lecture, concept: !!(m && m[2]) || doc.mode === "concept", title: String(doc.title || ""), questions: doc.questions.length, problems, doc };
}

// Add only: questions of an existing bank stay exactly as they are; only ids it lacks are appended, in file order.
// An id that is already there with different content is reported and left alone.
function mergeBank(existing, incoming) {
  if (!existing) return { doc: incoming, added: incoming.questions.length, same: 0, differing: [] };
  const have = new Map(existing.questions.map((q) => [q.id, q]));
  const doc = Object.assign({}, existing, { questions: existing.questions.slice() });
  let added = 0, same = 0; const differing = [];
  incoming.questions.forEach((q) => {
    const old = have.get(q.id);
    if (!old) { doc.questions.push(q); added++; } else if (JSON.stringify(old) === JSON.stringify(q)) same++; else differing.push(q.id);
  });
  return { doc, added, same, differing };
}

module.exports = { TYPES, FILE, parseBank, mergeBank, checkQuestion };
