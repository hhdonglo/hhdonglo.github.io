/* Teaching resources and question authoring for the Class Manager app.
   - Resource library: the lecturer's own files (PDF, Word, PowerPoint, Markdown, text) are copied into the
     app's data folder, their text is extracted and cut into passages, and the passages are indexed for search.
   - Summaries: with an Anthropic API key, written by Claude from the document; without one, an extractive
     summary (the document's most representative sentences, in their original order).
   - Question generation: Claude writes quiz sets from passages retrieved from the library. Every generated
     question is a draft until the lecturer approves it.
   - Import: questions written by the lecturer in Word, PDF, Markdown or text, in the documented template.
   - Approved questions go to a bank overlay in the data folder. The server merges it with the course banks,
     so practice pages, the live quiz, the mock examination and the reports all use the approved questions.
   Nothing about students is ever sent to the model: only the lecturer's documents and instructions. */
"use strict";
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const TYPES = ["concept", "calc", "graph", "misconception"];
const LEVELS = ["easy", "moderate", "difficult"];
const DEFAULT_MODEL = "claude-opus-5-5";
const FALLBACK_MODELS = /^claude-(opus-5-5|opus-5|fable-5-1|sonnet-5-5)$/; // models that take the server-side fallback option
const MAX_FILE = 60 * 1024 * 1024;

// ---------- text helpers ----------
const STOP = new Set(("a an and are as at be been but by can could did do does each for from had has have he her his how i if in into is it its " +
  "may more most no not of on one or other our out over same she should so some such than that the their them then there these they this " +
  "those through to two under up use used using was we were what when where which while who why will with would you your also between both " +
  "only very given shown show figure slide page example").split(" "));
function words(s) { return String(s || "").toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").match(/[a-z0-9]+/g) || []; }
function stem(w) { return w.length > 4 && /[^s]s$/.test(w) ? w.slice(0, -1) : w; }
function terms(s) { return words(s).filter((w) => w.length > 1 && !STOP.has(w)).map(stem); }
function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
// Question text is shown as HTML on the student pages. Everything is escaped except a few inline tags,
// and x^2, x^{-3}, v_0 and v_{max} become superscripts and subscripts.
function toHtml(s) {
  let t = esc(String(s == null ? "" : s).trim()).replace(/&lt;(\/?)(sub|sup|em|strong|b|i|br)\s*\/?&gt;/gi, (m, sl, tg) => "<" + sl + tg.toLowerCase() + ">");
  t = t.replace(/\^\{([^{}]{1,20})\}/g, "<sup>$1</sup>").replace(/_\{([^{}]{1,20})\}/g, "<sub>$1</sub>")
    .replace(/(\w|\))\^(-?\d+(?:\.\d+)?)/g, "$1<sup>$2</sup>").replace(/\b([A-Za-z])_([A-Za-z0-9])\b/g, "$1<sub>$2</sub>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>").replace(/\r?\n/g, "<br>");
  return t;
}
function plain(html) { return String(html || "").replace(/<[^>]+>/g, " ").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim(); }
function normStem(s) { return words(plain(s)).join(" "); }
function sentences(text) {
  return String(text).replace(/\s+/g, " ").split(/(?<=[.!?])\s+(?=[A-Z0-9(“"])/).map((s) => s.trim()).filter((s) => s.length > 30 && s.length < 600);
}
function readJson(f, d) { try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch (e) { return d; } }
function writeJson(f, o) { fs.mkdirSync(path.dirname(f), { recursive: true }); const t = f + ".tmp"; fs.writeFileSync(t, JSON.stringify(o, null, 1)); fs.renameSync(t, f); }
const uid = () => crypto.randomBytes(6).toString("hex");

// ---------- text extraction ----------
// Returns [{loc, text}]: one entry per page (PDF), slide (PowerPoint) or the whole document.
async function extract(file) {
  const ext = path.extname(file).toLowerCase();
  const buf = fs.readFileSync(file);
  if (ext === ".pdf") {
    const { getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(new Uint8Array(buf));
    const out = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const tc = await page.getTextContent();
      let line = "", lines = [], lastY = null;
      for (const it of tc.items) { // rebuild the lines of the page from the text positions
        if (typeof it.str !== "string") continue;
        const y = it.transform ? Math.round(it.transform[5]) : lastY;
        if (lastY !== null && y !== null && Math.abs(y - lastY) > 2 && line.trim()) { lines.push(line.trim()); line = ""; }
        line += it.str; if (it.hasEOL) { lines.push(line.trim()); line = ""; }
        lastY = y;
      }
      if (line.trim()) lines.push(line.trim());
      out.push({ loc: "page " + i, text: lines.filter(Boolean).join("\n") });
    }
    return out;
  }
  if (ext === ".docx") {
    const mammoth = require("mammoth");
    const r = await mammoth.extractRawText({ buffer: buf });
    return [{ loc: "", text: r.value.replace(/\n{3,}/g, "\n\n") }];
  }
  if (ext === ".pptx") {
    const JSZip = require("jszip");
    const zip = await JSZip.loadAsync(buf);
    const names = Object.keys(zip.files).filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n)).sort((a, b) => Number(a.match(/\d+/)[0]) - Number(b.match(/\d+/)[0]));
    const out = [];
    for (const n of names) {
      const xml = await zip.file(n).async("string");
      const paras = xml.split(/<\/a:p>/).map((p) => (p.match(/<a:t>([^<]*)<\/a:t>/g) || []).map((t) => t.replace(/<\/?a:t>/g, "")).join("")).filter((p) => p.trim());
      const text = paras.join("\n").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
      out.push({ loc: "slide " + n.match(/\d+/)[0], text });
    }
    return out;
  }
  if ([".md", ".markdown", ".txt", ".text"].includes(ext)) return [{ loc: "", text: buf.toString("utf8").replace(/^﻿/, "") }];
  throw new Error("This kind of file is not supported. Use PDF, Word (.docx), PowerPoint (.pptx), Markdown or text.");
}

// Passages of about 900 characters, kept within one page or slide where possible.
function chunk(parts) {
  const out = [];
  for (const p of parts) {
    const paras = p.text.split(/\n\s*\n|\n(?=[-•*]\s)/).map((x) => x.replace(/[ \t]+/g, " ").trim()).filter(Boolean);
    let cur = "";
    const push = () => { if (cur.trim()) out.push({ loc: p.loc, text: cur.trim() }); cur = ""; };
    for (const para of paras) {
      if (para.length > 1400) { push(); for (let i = 0; i < para.length; i += 1000) out.push({ loc: p.loc, text: para.slice(i, i + 1100) }); continue; }
      if (cur.length + para.length > 900) push();
      cur += (cur ? "\n" : "") + para;
    }
    push();
  }
  return out.map((c, i) => Object.assign({ i }, c));
}

// ---------- question template ----------
// Parses questions written in the template documented in desktop/README.md and app/question-template.md.
function parseQuestions(text, defaults) {
  defaults = Object.assign({ lecture: "", difficulty: "", type: "" }, defaults || {});
  // Word and PDF files sometimes run a question's lines together; split them again before options and fields.
  const lines = String(text || "").replace(/\r/g, "").replace(/ /g, " ").split("\n").flatMap((l) => {
    let t = l.replace(/\s+(?=(?:Answer|Correct answer|Explanation|Type|Difficulty|Lecture|Reference)\s*:)/g, "\n");
    if (/(^|\s)\(?A[).]\s/.test(t) && /\s\*?\(?B[).]\s/.test(t)) t = t.replace(/\s+(?=\*?\(?[A-E][).]\s)/g, "\n");
    return t.split("\n");
  });
  const items = [];
  let cur = null, part = null, hdr = Object.assign({}, defaults);
  const START = /^\s*(?:#+\s*)?(?:Q(?:uestion)?\s*\.?\s*(\d+)\s*[.):]?|Question\s*:|(\d+)\s*[.)])\s*(.*)$/i;
  const OPT = /^\s*(\*?)\s*\(?([A-Ea-e])[).:]\s*(\*?)\s*(.*?)\s*(\*?)\s*$/;
  const FIELD = /^\s*(?:[-*]\s*)?(Answer|Correct answer|Key|Explanation|Exp|Solution|Type|Difficulty|Level|Lecture|Week|Reference|Ref|Source)\s*[:=-]\s*(.*)$/i;
  const finish = () => { if (cur) items.push(cur); cur = null; part = null; };
  lines.forEach((raw, n) => {
    const line = raw.replace(/\s+$/, "");
    if (/^\s*(---+|\*\*\*+|___+)\s*$/.test(line)) { finish(); return; }
    const f = line.match(FIELD);
    const s = !f && line.match(START);
    if (s && (s[3] || "").trim() !== "" || (s && /^\s*Q/i.test(line))) {
      finish();
      cur = { line: n + 1, lecture: hdr.lecture, difficulty: hdr.difficulty, type: hdr.type, q: (s[3] || "").trim(), options: [], answer: "", exp: "", ref: "", source: "", marked: -1 };
      part = "q"; return;
    }
    if (f) {
      const key = f[1].toLowerCase(), val = f[2].trim();
      const map = { "answer": "answer", "correct answer": "answer", "key": "answer", "explanation": "exp", "exp": "exp", "solution": "exp", "type": "type", "difficulty": "difficulty", "level": "difficulty", "lecture": "lecture", "week": "lecture", "reference": "ref", "ref": "ref", "source": "source" };
      const k = map[key];
      if (!cur) { if (["lecture", "difficulty", "type"].includes(k)) hdr[k] = val; return; } // header lines before the first question
      cur[k] = val; part = k === "exp" ? "exp" : null; return;
    }
    if (!cur) return;
    const o = part !== "exp" && line.match(OPT);
    if (o && (cur.options.length || part === "q" || part === "opt")) {
      const letter = o[2].toUpperCase(), idx = letter.charCodeAt(0) - 65;
      if (idx === cur.options.length) {
        cur.options.push(o[4].replace(/\*+$/, "").trim());
        if (o[1] || o[3] || o[5]) cur.marked = idx;
        part = "opt"; return;
      }
    }
    if (!line.trim()) { if (part === "q" || part === "exp") cur[part === "q" ? "q" : "exp"] += "\n"; return; }
    if (part === "q") cur.q += (cur.q ? "\n" : "") + line.trim();
    else if (part === "opt") cur.options[cur.options.length - 1] += " " + line.trim();
    else if (part === "exp") cur.exp += (cur.exp && !/\n$/.test(cur.exp) ? " " : "") + line.trim();
  });
  finish();
  return items.map((it) => {
    let a = String(it.answer || "").trim(), ans = -1;
    const m = a.match(/^\(?([A-Ea-e])\b/);
    if (m) ans = m[1].toUpperCase().charCodeAt(0) - 65;
    else if (/^\d$/.test(a)) ans = Number(a) - 1;
    else if (a) { const k = it.options.findIndex((o) => normStem(o) === normStem(a)); if (k >= 0) ans = k; }
    if (ans < 0 && it.marked >= 0) ans = it.marked;
    const lec = String(it.lecture || "").match(/\d+/);
    const ty = String(it.type || "").toLowerCase();
    const lv = String(it.difficulty || "").toLowerCase();
    return {
      line: it.line,
      lecture: lec ? Number(lec[0]) : null,
      type: TYPES.find((t) => ty.startsWith(t) || (t === "calc" && /calcul|numer/.test(ty)) || (t === "graph" && /diagram/.test(ty))) || "concept",
      difficulty: LEVELS.find((l) => lv.startsWith(l.slice(0, 3))) || (/hard/.test(lv) ? "difficult" : /medium/.test(lv) ? "moderate" : ""),
      q: toHtml(it.q.replace(/\n+$/, "")), options: it.options.map(toHtml), answer: ans, answerText: a,
      exp: toHtml(it.exp.replace(/\n+$/, "")), ref: plain(toHtml(it.ref)), source: plain(toHtml(it.source))
    };
  });
}

function createAuthoring(opts) {
  const DIR = opts.dir;                      // userData/authoring
  const WEB = opts.webRoot;
  const LIB = path.join(DIR, "library");
  const BANKS = path.join(DIR, "banks");
  const F = { index: path.join(LIB, "index.json"), drafts: path.join(DIR, "drafts.json"), settings: path.join(DIR, "settings.json") };
  const log = opts.log || (() => {});
  fs.mkdirSync(LIB, { recursive: true }); fs.mkdirSync(BANKS, { recursive: true });

  let docs = readJson(F.index, []);
  let drafts = readJson(F.drafts, []);
  const saveDocs = () => writeJson(F.index, docs);
  const saveDrafts = () => writeJson(F.drafts, drafts);
  const chunksOf = (id) => readJson(path.join(LIB, id + ".chunks.json"), []);

  // ---------- settings and the API key ----------
  function settings() { return Object.assign({ model: DEFAULT_MODEL }, readJson(F.settings, {})); }
  function status() {
    const s = settings();
    return { model: s.model, defaultModel: DEFAULT_MODEL, hasKey: !!opts.loadKey(), keyStored: opts.keyIsEncrypted ? opts.keyIsEncrypted() : true };
  }
  function setSettings(o) {
    const s = settings();
    if (o && typeof o.model === "string") s.model = /^claude-[a-z0-9.-]{3,60}$/.test(o.model.trim()) ? o.model.trim() : DEFAULT_MODEL;
    writeJson(F.settings, { model: s.model });
    if (o && typeof o.apiKey === "string") opts.saveKey(o.apiKey.trim());
    return status();
  }
  function client() {
    const key = opts.loadKey();
    if (!key) return null;
    const Anthropic = require("@anthropic-ai/sdk").default;
    const o = { apiKey: key, maxRetries: 3, timeout: 15 * 60 * 1000 };
    if (process.env.CM_ANTHROPIC_URL) o.baseURL = process.env.CM_ANTHROPIC_URL; // tests only
    return new Anthropic(o);
  }
  // One request to Claude that returns JSON matching `schema`. Streams, so that long documents do not time out.
  async function askJson(system, user, schema, maxTokens) {
    const c = client();
    if (!c) throw new Error("No Anthropic API key is set. Add one under Settings on this screen.");
    const model = settings().model;
    const req = {
      model, max_tokens: maxTokens || 32000, system,
      messages: [{ role: "user", content: user }],
      thinking: { type: "adaptive" }, output_config: { effort: "high", format: { type: "json_schema", schema } }
    };
    let msg;
    try {
      if (FALLBACK_MODELS.test(model)) msg = await c.beta.messages.stream(Object.assign(req, { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" })).finalMessage();
      else msg = await c.messages.stream(req).finalMessage();
    } catch (e) {
      const A = require("@anthropic-ai/sdk");
      if (e instanceof A.AuthenticationError) throw new Error("The API key was not accepted. Check it under Settings.");
      if (e instanceof A.PermissionDeniedError) throw new Error("This API key may not use the model " + model + ".");
      if (e instanceof A.NotFoundError) throw new Error("The model " + model + " was not found. Check the model name under Settings.");
      if (e instanceof A.RateLimitError) throw new Error("The Anthropic service is busy or the account's limit is reached. Try again in a minute.");
      if (e instanceof A.APIConnectionError) throw new Error("Could not reach the Anthropic service. Check the internet connection.");
      if (e instanceof A.APIError) throw new Error("The Anthropic service returned an error (" + (e.status || "unknown") + "): " + e.message);
      throw e;
    }
    if (msg.stop_reason === "refusal") throw new Error("The model declined this request.");
    if (msg.stop_reason === "max_tokens") throw new Error("The answer was too long and was cut off. Ask for fewer questions at a time.");
    const text = msg.content.filter((b) => b.type === "text").map((b) => b.text).join("");
    try { return JSON.parse(text); } catch (e) { throw new Error("The model's answer could not be read. Try again."); }
  }

  // ---------- library ----------
  function publicDoc(d) { return Object.assign({}, d, { file: undefined }); }
  function listDocs() { return docs.map(publicDoc); }
  async function addFile(src, lecture) {
    const st = fs.statSync(src);
    if (st.size > MAX_FILE) throw new Error(path.basename(src) + " is larger than 60 MB.");
    const parts = await extract(src);
    const chunks = chunk(parts);
    const chars = chunks.reduce((n, c) => n + c.text.length, 0);
    if (chars < 40) throw new Error(path.basename(src) + ": no text could be read. A scanned PDF has no text layer; export the original slides or notes instead.");
    const id = uid(), ext = path.extname(src).toLowerCase();
    fs.copyFileSync(src, path.join(LIB, id + ext));
    writeJson(path.join(LIB, id + ".chunks.json"), chunks);
    const d = { id, name: path.basename(src), kind: ext.slice(1), file: id + ext, lecture: Number(lecture) || null, added: new Date().toISOString(), chars, passages: chunks.length, parts: parts.length, summary: null };
    docs.push(d); saveDocs(); index = null;
    return publicDoc(d);
  }
  async function addFiles(paths, lecture) {
    const added = [], errors = [];
    for (const p of paths || []) { try { added.push(await addFile(p, lecture)); } catch (e) { errors.push(path.basename(p) + ": " + e.message); } }
    return { added, errors };
  }
  function removeDoc(id) {
    const d = docs.find((x) => x.id === id); if (!d) return false;
    for (const f of [d.file, id + ".chunks.json"]) { try { fs.unlinkSync(path.join(LIB, f)); } catch (e) { /* already gone */ } }
    docs = docs.filter((x) => x.id !== id); saveDocs(); index = null; return true;
  }
  function setDoc(id, fields) {
    const d = docs.find((x) => x.id === id); if (!d) return null;
    if ("lecture" in fields) d.lecture = Number(fields.lecture) || null;
    saveDocs(); return publicDoc(d);
  }
  function docPassages(id) { return chunksOf(id); }

  // ---------- search (BM25 over the passages) ----------
  let index = null;
  function buildIndex() {
    const P = [], df = new Map();
    for (const d of docs) for (const c of chunksOf(d.id)) {
      const tf = new Map(); const t = terms(c.text);
      t.forEach((w) => tf.set(w, (tf.get(w) || 0) + 1));
      tf.forEach((v, w) => df.set(w, (df.get(w) || 0) + 1));
      P.push({ doc: d.id, name: d.name, lecture: d.lecture, i: c.i, loc: c.loc, text: c.text, tf, len: t.length });
    }
    const avg = P.reduce((n, p) => n + p.len, 0) / Math.max(1, P.length);
    index = { P, df, avg, N: P.length };
    return index;
  }
  function search(query, o) {
    o = o || {};
    const ix = index || buildIndex();
    const q = [...new Set(terms(query))];
    const allow = o.docs && o.docs.length ? new Set(o.docs) : null;
    const k1 = 1.4, b = 0.75;
    const scored = [];
    for (const p of ix.P) {
      if (allow && !allow.has(p.doc)) continue;
      let s = 0;
      for (const w of q) {
        const f = p.tf.get(w); if (!f) continue;
        const idf = Math.log(1 + (ix.N - ix.df.get(w) + 0.5) / (ix.df.get(w) + 0.5));
        s += idf * (f * (k1 + 1)) / (f + k1 * (1 - b + b * p.len / ix.avg));
      }
      if (s > 0) scored.push({ score: s, p });
    }
    scored.sort((a, b2) => b2.score - a.score);
    return scored.slice(0, o.k || 10).map(({ score, p }) => ({ doc: p.doc, name: p.name, lecture: p.lecture, i: p.i, loc: p.loc, text: p.text, score: Math.round(score * 100) / 100 }));
  }

  // ---------- summaries ----------
  function extractive(id) {
    const ix = index || buildIndex();
    const passages = chunksOf(id);
    const all = passages.map((c) => c.text).join("\n\n");
    const sents = sentences(all);
    const tf = new Map(); terms(all).forEach((w) => tf.set(w, (tf.get(w) || 0) + 1));
    const weight = (w) => (tf.get(w) || 0) * Math.log(1 + ix.N / (1 + (ix.df.get(w) || 0)));
    const scored = sents.map((s, i) => { const t = terms(s); const v = t.reduce((n, w) => n + weight(w), 0) / Math.sqrt(Math.max(4, t.length)); return { i, s, v }; });
    const n = Math.max(5, Math.min(14, Math.round(sents.length * 0.08)));
    const pick = scored.slice().sort((a, b) => b.v - a.v).slice(0, n).sort((a, b) => a.i - b.i).map((x) => x.s);
    const key = [...tf.keys()].filter((w) => w.length > 3 && !/^\d+$/.test(w)).sort((a, b) => weight(b) - weight(a)).slice(0, 14);
    let text = "Extractive summary: the sentences below are taken word for word from the document and were chosen by how representative they are. Add an Anthropic API key under Settings for a written summary.\n\n";
    text += pick.length ? pick.map((s) => "- " + s).join("\n") : "- The document has too few complete sentences for an extractive summary (slides often hold short phrases). The key terms below show its content.";
    text += "\n\nKey terms: " + key.join(", ");
    return text;
  }
  async function summarise(id, mode) {
    const d = docs.find((x) => x.id === id); if (!d) throw new Error("Document not found.");
    let text, how;
    if (mode !== "extractive" && opts.loadKey()) {
      const passages = chunksOf(id);
      const body = (parts) => parts.map((c) => (c.loc ? "[" + c.loc + "] " : "") + c.text).join("\n\n");
      const schema = { type: "object", additionalProperties: false, required: ["summary"], properties: { summary: { type: "string" } } };
      const sys = "You summarise university teaching material for the lecturer who wrote it. Write in formal, measured academic English. " +
        "Use only what the document contains; do not add facts, results or examples that are not in it. Where the document gives a page or slide marker in square brackets, cite it in brackets after the point it supports. " +
        "Structure: a short overview paragraph; then the main concepts and definitions; the key equations with the meaning of each symbol; the worked examples or applications; and the points students commonly find difficult if the document names them. Use plain text with simple hyphen bullets and section headings on their own lines. Do not use the ampersand character.";
      let all = body(passages);
      if (all.length > 600000) { // very long: summarise in parts, then combine
        const groups = []; let g = [], n = 0;
        for (const c of passages) { if (n + c.text.length > 400000 && g.length) { groups.push(g); g = []; n = 0; } g.push(c); n += c.text.length; }
        if (g.length) groups.push(g);
        const parts = [];
        for (const grp of groups) parts.push((await askJson(sys, "Summarise this part of the document \"" + d.name + "\".\n\n<document>\n" + body(grp) + "\n</document>", schema, 16000)).summary);
        all = parts.map((p, i) => "[part " + (i + 1) + "]\n" + p).join("\n\n");
      }
      text = (await askJson(sys, "Summarise the document \"" + d.name + "\".\n\n<document>\n" + all + "\n</document>", schema, 16000)).summary;
      how = "claude";
    } else { text = extractive(id); how = "extractive"; }
    d.summary = { text, how, model: how === "claude" ? settings().model : "", at: new Date().toISOString() };
    saveDocs();
    return publicDoc(d);
  }

  // ---------- banks: the course banks plus the approved questions ----------
  const baseBank = (n) => readJson(path.join(WEB, "quizzes", "lecture" + n + ".json"), null);
  const overlayFile = (n) => path.join(BANKS, "lecture" + n + ".json");
  const overlay = (n) => readJson(overlayFile(n), null);
  function overlayNumbers() { return fs.readdirSync(BANKS).map((f) => (f.match(/^lecture(\d+)\.json$/) || [])[1]).filter(Boolean).map(Number); }
  function baseWeeks() { return (readJson(path.join(WEB, "apps_script", "live_quizzes.json"), {}).weeks) || {}; }
  function mergedBank(n) {
    const b = baseBank(n), o = overlay(n);
    if (!o || !(o.questions || []).length) return b;
    const out = b ? JSON.parse(JSON.stringify(b)) : { lecture: n, title: o.title || "Lecture " + n, questions: [] };
    out.questions = out.questions.concat(o.questions.map((q) => { const c = Object.assign({}, q); delete c.origin; delete c.approved; delete c.difficulty; return c; }));
    return out;
  }
  // Called by the server for every page and by the quiz server: returns the merged file, or null to use the file on disk.
  function siteFile(rel) {
    rel = "/" + String(rel || "").replace(/^\/+/, "");
    const m = rel.match(/^\/quizzes\/lecture(\d+)\.json$/);
    if (m) { const o = overlay(Number(m[1])); return o && o.questions.length ? JSON.stringify(mergedBank(Number(m[1]))) : null; }
    if (rel === "/apps_script/live_quizzes.json") {
      const nums = overlayNumbers().filter((n) => (overlay(n) || { questions: [] }).questions.length);
      if (!nums.length) return null;
      const lq = readJson(path.join(WEB, "apps_script", "live_quizzes.json"), { weeks: {} });
      lq.weeks = lq.weeks || {};
      nums.forEach((n) => { if (!lq.weeks[String(n)]) lq.weeks[String(n)] = (overlay(n) || {}).title || "Lecture " + n; });
      return JSON.stringify(lq, null, 1);
    }
    return null;
  }
  function banks() {
    const w = baseWeeks(), nums = new Set(overlayNumbers());
    fs.readdirSync(path.join(WEB, "quizzes")).forEach((f) => { const m = f.match(/^lecture(\d+)\.json$/); if (m) nums.add(Number(m[1])); });
    return [...nums].sort((a, b) => a - b).map((n) => {
      const b = baseBank(n), o = overlay(n);
      return { lecture: n, title: (b && b.title) || (o && o.title) || w[String(n)] || "", base: b ? b.questions.length : 0, added: o ? o.questions.length : 0, live: !!(w[String(n)] || (o && o.questions.length)),
        approved: o ? o.questions.map((q) => ({ id: q.id, q: q.q, options: q.options, answer: q.answer, exp: q.exp, ref: q.ref, type: q.type, difficulty: q.difficulty || "", origin: q.origin || "", approved: q.approved || "" })) : [] };
    });
  }
  function setBankTitle(n, title) {
    n = Number(n); const o = overlay(n) || { lecture: n, title: "", questions: [], next: 1 };
    o.title = String(title || "").trim().slice(0, 120); writeJson(overlayFile(n), o); return banks();
  }
  function stemsFor(n) {
    const b = mergedBank(n) || baseBank(n);
    return b ? b.questions.map((q) => normStem(q.q)) : [];
  }

  // ---------- drafts ----------
  function validate(q, others) {
    const errors = [], warnings = [];
    if (!plain(q.q)) errors.push("The question has no text.");
    if (!Array.isArray(q.options) || q.options.length !== 4) errors.push("A question needs exactly four options (A to D); this one has " + ((q.options || []).length) + ".");
    else if (q.options.some((o) => !plain(o))) errors.push("An option is empty.");
    else if (new Set(q.options.map(normStem)).size < 4) errors.push("Two options are the same.");
    if (!(Number.isInteger(q.answer) && q.answer >= 0 && q.answer < (q.options || []).length)) errors.push(q.answerText ? "The answer \"" + q.answerText + "\" does not match an option." : "No correct answer is given (add \"Answer: B\", or mark the option with an asterisk).");
    if (!(Number(q.lecture) >= 0 && Number(q.lecture) <= 99) || q.lecture === null || q.lecture === "") errors.push("No lecture is given.");
    if (!plain(q.exp)) warnings.push("No explanation. Students see the explanation after a wrong answer.");
    if (!q.difficulty) warnings.push("No difficulty level.");
    const st = normStem(q.q);
    if (st && q.lecture != null && stemsFor(Number(q.lecture)).includes(st)) warnings.push("The same question is already in the Lecture " + q.lecture + " bank.");
    if (st && (others || []).some((o) => o !== q && o.status !== "rejected" && normStem(o.q) === st)) warnings.push("The same question is already among the drafts.");
    return { errors, warnings };
  }
  function withChecks(d) { return Object.assign({}, d, validate(d, drafts)); }
  function listDrafts() { return drafts.filter((d) => d.status === "draft").map(withChecks); }
  function clean(q) {
    return {
      lecture: q.lecture === "" || q.lecture == null ? null : Number(q.lecture),
      type: TYPES.includes(q.type) ? q.type : "concept",
      difficulty: LEVELS.includes(q.difficulty) ? q.difficulty : "",
      q: String(q.q || ""), options: (q.options || []).map(String).slice(0, 5), answer: Number.isInteger(Number(q.answer)) && q.answer !== "" && q.answer !== null ? Number(q.answer) : -1,
      exp: String(q.exp || ""), ref: String(q.ref || "").slice(0, 300), source: String(q.source || "").slice(0, 200)
    };
  }
  function addDrafts(items, origin, extra) {
    const now = new Date().toISOString();
    const added = (items || []).map((q) => Object.assign(clean(q), { did: uid(), origin: origin || "manual", status: "draft", created: now }, extra || {}, q.set ? { set: String(q.set).slice(0, 120) } : {}, q.batch ? { batch: q.batch } : {}, q.from ? { from: q.from } : {}));
    drafts = drafts.concat(added); saveDrafts();
    return added.map(withChecks);
  }
  // Manual entry and edits arrive as plain text from the form; the form marks them with `plainText`.
  function fromForm(q) {
    const o = Object.assign({}, q);
    if (q.plainText) { o.q = toHtml(q.q); o.options = (q.options || []).map(toHtml); o.exp = toHtml(q.exp); }
    return o;
  }
  function updateDraft(did, fields) {
    const d = drafts.find((x) => x.did === did); if (!d) return null;
    Object.assign(d, clean(Object.assign({}, d, fromForm(fields))), { edited: new Date().toISOString() });
    saveDrafts(); return withChecks(d);
  }
  function rejectDrafts(dids) { const s = new Set(dids); drafts = drafts.filter((d) => !s.has(d.did)); saveDrafts(); return listDrafts(); }
  function approve(dids, by) {
    const s = new Set(dids), done = [], skipped = [];
    for (const d of drafts) {
      if (!s.has(d.did) || d.status !== "draft") continue;
      const v = validate(d, drafts);
      if (v.errors.length) { skipped.push({ did: d.did, why: v.errors.join(" ") }); continue; }
      const n = Number(d.lecture);
      const o = overlay(n) || { lecture: n, title: (baseBank(n) || {}).title || baseWeeks()[String(n)] || "Lecture " + n, questions: [], next: 1 };
      const id = "L" + n + "-U" + String(o.next || 1).padStart(2, "0");
      o.next = (o.next || 1) + 1;
      const q = { id, type: d.type, q: d.q, options: d.options.slice(0, 4), answer: d.answer, exp: d.exp, ref: d.ref || "" };
      if (d.source) q.source = d.source;
      q.difficulty = d.difficulty || ""; q.origin = d.origin; q.approved = new Date().toISOString();
      o.questions.push(q); writeJson(overlayFile(n), o);
      d.status = "approved"; d.approvedId = id; done.push(id);
    }
    drafts = drafts.filter((d) => d.status !== "approved"); saveDrafts();
    log("approved " + done.length + " question(s)" + (by ? " via " + by : ""));
    return { approved: done, skipped };
  }
  function withdraw(id) {
    const m = String(id).match(/^L(\d+)-U\d+$/); if (!m) return false;
    const n = Number(m[1]), o = overlay(n); if (!o) return false;
    const q = o.questions.find((x) => x.id === id); if (!q) return false;
    o.questions = o.questions.filter((x) => x.id !== id); writeJson(overlayFile(n), o); // ids are never reused
    drafts.push(Object.assign(clean(Object.assign({ lecture: n }, q)), { did: uid(), origin: q.origin || "manual", status: "draft", created: new Date().toISOString(), note: "Withdrawn from the bank as " + id })); saveDrafts();
    return true;
  }

  // ---------- import ----------
  async function importFile(file, defaults) {
    const parts = await extract(file);
    return importText(parts.map((p) => p.text).join("\n"), defaults, path.basename(file));
  }
  function importText(text, defaults, name) {
    const items = parseQuestions(text, defaults).map((q) => Object.assign(q, { from: name || "pasted text" }));
    return { name: name || "pasted text", items: items.map((q) => Object.assign(q, validate(q, drafts))) };
  }

  // ---------- generation ----------
  // Retrieval: the passages that best match the lecturer's focus, from the chosen documents; the whole of the
  // documents when they are short enough and no focus is given.
  function context(docIds, focus, budget) {
    const chosen = docs.filter((d) => !docIds || !docIds.length || docIds.includes(d.id));
    if (!chosen.length) throw new Error("Choose at least one document from the library.");
    const total = chosen.reduce((n, d) => n + d.chars, 0);
    let passages;
    if (!focus && total <= budget) passages = chosen.flatMap((d) => chunksOf(d.id).map((c) => ({ name: d.name, loc: c.loc, text: c.text })));
    else {
      const q = focus || chosen.map((d) => d.name.replace(/\.\w+$/, "")).join(" ");
      passages = search(q, { docs: chosen.map((d) => d.id), k: 400 }).map((r) => ({ name: r.name, loc: r.loc, text: r.text }));
      let n = 0; passages = passages.filter((p) => (n += p.text.length) <= budget);
      if (!passages.length) throw new Error("No passages in the chosen documents match \"" + focus + "\". Try other words.");
    }
    return { passages, names: chosen.map((d) => d.name) };
  }
  async function generate(o) {
    const lecture = Number(o.lecture);
    if (!(lecture >= 0 && lecture <= 99) || o.lecture === "" || o.lecture == null) throw new Error("Choose the lecture the questions are for.");
    const sets = Math.max(1, Math.min(6, Number(o.sets) || 1)), per = Math.max(1, Math.min(20, Number(o.perSet) || 5));
    if (sets * per > 60) throw new Error("Ask for at most 60 questions at a time.");
    const types = (o.types || []).filter((t) => TYPES.includes(t));
    const ctx = context(o.docs, String(o.focus || "").trim(), 300000);
    const existing = (mergedBank(lecture) || { questions: [] }).questions.map((q) => "- " + plain(q.q).slice(0, 200));
    const qSchema = { type: "object", additionalProperties: false, required: ["type", "difficulty", "q", "options", "answer", "exp", "ref"],
      properties: { type: { type: "string", enum: TYPES }, difficulty: { type: "string", enum: LEVELS }, q: { type: "string" }, options: { type: "array", items: { type: "string" } }, answer: { type: "integer" }, exp: { type: "string" }, ref: { type: "string" } } };
    const schema = { type: "object", additionalProperties: false, required: ["quizzes"], properties: { quizzes: { type: "array", items: { type: "object", additionalProperties: false, required: ["title", "questions"], properties: { title: { type: "string" }, questions: { type: "array", items: qSchema } } } } } };
    const sys = "You write multiple-choice questions for a university course, for the lecturer to review before students see them. " +
      "Base every question, answer and explanation strictly on the course material supplied; do not use facts, constants or examples that are not in it, and if the material does not support a question, do not write it. " +
      "Each question has exactly four options and exactly one correct answer; the other three are plausible distractors that reflect specific, common errors. Do not use 'all of the above', 'none of the above', or options that refer to other options by letter. " +
      "For calculations, use the values and constants the material uses, give numerical options with units and the same number of significant figures, and make each distractor the result of a named mistake. " +
      "The explanation (two to four sentences) gives the reasoning or the working and says why the most tempting distractor is wrong. The reference names the source document and the page or slide marker in square brackets where one is given. " +
      "Write in formal academic English. Text may use only these HTML tags: <sub>, <sup>, <em>, <strong>. Do not use the ampersand character. " +
      "The field 'answer' is the zero-based index of the correct option. Do not repeat or closely paraphrase the existing questions listed, and do not repeat a question across the quizzes.";
    const types_ = types.length ? "Use only these question types: " + types.join(", ") + "." : "Use a mix of question types: concept, calc (calculation), misconception, and graph (reading a graph or diagram described in words) where the material supports it.";
    const mix = o.difficulty && LEVELS.includes(o.difficulty) ? "All questions at the " + o.difficulty + " level." : "A mix of difficulty: roughly a third each easy, moderate and difficult.";
    const user = "Write " + sets + " quiz" + (sets > 1 ? "zes" : "") + " of " + per + " questions each for Lecture " + lecture + ". " + types_ + " " + mix +
      (o.focus ? " Focus on: " + String(o.focus).slice(0, 500) + "." : "") + (o.notes ? " Further instructions from the lecturer: " + String(o.notes).slice(0, 1500) : "") +
      "\n\n<existing_questions>\n" + (existing.join("\n") || "(none)") + "\n</existing_questions>\n\n<course_material>\n" +
      ctx.passages.map((p) => "<passage source=\"" + esc(p.name) + "\"" + (p.loc ? " location=\"" + p.loc + "\"" : "") + ">\n" + p.text + "\n</passage>").join("\n") + "\n</course_material>";
    const out = await askJson(sys, user, schema, Math.min(64000, 4000 + sets * per * 900));
    const stamp = new Date().toISOString().slice(0, 16).replace("T", " ");
    const items = [];
    (out.quizzes || []).forEach((qz, k) => (qz.questions || []).forEach((q) => {
      // Shuffle the options so the position of the correct answer is balanced.
      let opts4 = (q.options || []).slice(0, 4), ans = q.answer;
      if (opts4.length === 4 && ans >= 0 && ans < 4) {
        const order = [0, 1, 2, 3].sort(() => crypto.randomInt(3) - 1);
        ans = order.indexOf(ans); opts4 = order.map((i) => q.options[i]);
      }
      items.push({ lecture, type: q.type, difficulty: q.difficulty, q: toHtml(q.q), options: opts4.map(toHtml), answer: ans, exp: toHtml(q.exp), ref: plain(toHtml(q.ref)), set: qz.title || "Quiz " + (k + 1) });
    }));
    const added = addDrafts(items, "generated", { batch: stamp, sourceDocs: ctx.names, model: settings().model });
    return { drafts: added, passages: ctx.passages.length };
  }

  return { status, setSettings, listDocs, addFiles, removeDoc, setDoc, docPassages, search, summarise, banks, setBankTitle, siteFile,
    listDrafts, addDrafts: (items, origin) => addDrafts((items || []).map(fromForm), origin), updateDraft, rejectDrafts, approve, withdraw, importFile, importText, generate };
}

module.exports = { createAuthoring, parseQuestions, extract, chunk, toHtml };
