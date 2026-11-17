"use strict";
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { partition } = require("../lecture-files/types");
const { classify } = require("../lecture-files/classify");
const { peekAll } = require("../lecture-files/peek");
const { build } = require("../lecture-files/build");
const { draft, titleOf } = require("../lecture-files/describe");
const store = require("../lecture-files/store");
const actions = require("../lecture-files/actions");

const PACK = path.join(__dirname, "..", "..", "course-packs", "phys143", "files", "PHYS143");
// The folder of Lecture 1 as it was on the lecturer's screen: five teaching documents, working files, figures and notes.
const FIG = "agree budget dots gauss linearise micrometer quad randsys ruler spring targets vernier DE angle anti associative components conceptmap cross dir dot_both dot_example dot_projection dot_signs ex10 ex17 ex3 framework gammaphi headtotail hook_closed hook_open integrated mag magnitudes nonright para parallel".split(" ").map((n) => "fig_" + n + ".pdf");
const SCREEN = ["Lecture1-Units Physical Quantities and Vectors1.pdf", "lecture01_reading_ch01_vectors_pp39-61.pdf", "lecture01_supplement.pdf", "lecture01_tutorial.pdf", "lecture01_vectors.pdf", "lecture01_vectors_handout.pdf", "lecture01_vectors_reference.pdf"]
  .concat(FIG, ["lecture01_uncertainty.pdf", "Lecture 1 - Vectors.pdf", "guides_comparison_L1_L2.md", "lecture1_chain.md", "lecture1_streamlining_moves.md"]);

test("only PDF and Word files are documents; figures are told apart by name and folder", () => {
  const p = partition(["a/lecture1.pdf", "a/notes.docx", "a/notes.md", "a/data.csv", "a/fig_x.pdf", "figures/force.pdf", "a/slides.pptx"]);
  assert.deepStrictEqual(p.documents, ["a/lecture1.pdf", "a/notes.docx"]);
  assert.deepStrictEqual(p.figures, ["a/fig_x.pdf", "figures/force.pdf"]);
  assert.strictEqual(p.other.length, 3);
});

test("the kind comes from the file name, the folder and the first page, with a confidence and reasons", () => {
  const h = classify("lecture_1/lecture01_vectors_handout.pdf", null);
  assert.strictEqual(h.kind, "handout"); assert.ok(h.confidence >= 0.7); assert.match(h.reasons[0], /handout/);
  assert.strictEqual(classify("tutorials/week1.pdf", null).kind, "tutorial");
  const t = classify("lecture_1/sheet1.pdf", { pages: 4, text: "PHYS 143 - Mechanics\nWeek 1: Vectors - Tutorial Sheet\nUse the Master Procedure" });
  assert.strictEqual(t.kind, "tutorial"); assert.match(t.reasons.join(" "), /first page/);
  const both = classify("lecture01_vectors_reference.pdf", { pages: 76, text: "Vectors\nReference and practice deck" });
  assert.strictEqual(both.kind, "reference"); assert.ok(both.confidence > 0.7);
  assert.strictEqual(classify("lecture01_vectors.pdf", null).kind, "slides");
  assert.ok(classify("lecture01_vectors.pdf", null).confidence < 0.6, "a plain name is only a weak guess");
});

test("the real Lecture 1 documents are read from their text and classified", async () => {
  const dir = path.join(PACK, "lecture_1"), files = fs.readdirSync(dir).map((f) => ({ rel: "lecture_1/" + f, path: path.join(dir, f), size: fs.statSync(path.join(dir, f)).size }));
  const peeks = await peekAll(files, 3);
  const o = build({ files, peeks, lectures: [], counts: {}, saved: {} });
  const c = o.rows[0].chips;
  assert.match(c.slides.name, /^lecture01_vectors\.pdf$/); assert.match(c.handout.name, /handout/); assert.match(c.tutorial.name, /tutorial/);
  assert.match(c.supplement.name, /supplement/); assert.match(c.reference.name, /reference/);
  assert.strictEqual(o.rows[0].fileCount, 5);
  assert.strictEqual(o.rows[0].title, "Vectors");
  assert.match(o.rows[0].description.text, /magnitude and direction/); assert.strictEqual(o.rows[0].description.source, "drafted");
});

test("Lecture 1 as listed on screen: five or six documents, figures and notes ignored with counts, nothing silently lost", () => {
  const o = build({ files: SCREEN, peeks: {}, lectures: [], counts: {}, saved: {} }), r = o.rows[0];
  assert.ok(r.fileCount <= 5, "files counted: " + r.fileCount);
  assert.ok(r.documents.every((d) => !/^fig_/.test(d.name) && !/\.md$/.test(d.name)));
  const g = Object.fromEntries(o.ignored.groups.map((x) => [x.reason, x.count]));
  assert.strictEqual(g.figure, FIG.length); assert.strictEqual(g.other, 3);
  assert.strictEqual(r.fileCount + o.ignored.total, SCREEN.length, "every file is a document or ignored");
  assert.ok(r.ignored.some((x) => /uncertainty/.test(x.rel) && x.reason === "extra"), "a rival lecture-notes file is ignored but can be added back");
});

test("drafts, backups, copies and duplicates are ignored; the same bytes under a plain name are one document", () => {
  const files = [{ rel: "l1/lecture01_vectors.pdf", size: 10 }, { rel: "l1/lecture01_vectors (1).pdf", size: 10 }, { rel: "l1/lecture01_vectors_old.pdf", size: 10 }, { rel: "backups/l1/lecture01_vectors.pdf", size: 10 }, { rel: "x/lecture01_vectors.pdf", size: 10 }];
  const o = build({ files, peeks: {}, lectures: [], counts: {}, saved: {} });
  assert.strictEqual(o.rows[0].fileCount, 1);
  const g = Object.fromEntries(o.ignored.groups.map((x) => [x.reason, x.count]));
  assert.strictEqual(g.backup, 3); assert.strictEqual(g.duplicate, 1);
});

test("the lecturer's choice wins and a taken-off role stays empty", () => {
  const files = ["l2/lecture02_handout.pdf", "l2/lecture02_handout_extra.pdf", "l2/lecture02_tutorial.pdf"];
  let o = build({ files, peeks: {}, lectures: [], counts: {}, saved: { 2: { files: { handout: "l2/lecture02_handout_extra.pdf", tutorial: null } } } });
  const r2 = o.rows[1];
  assert.strictEqual(r2.chips.handout.name, "lecture02_handout_extra.pdf"); assert.strictEqual(r2.chips.handout.source, "you");
  assert.strictEqual(r2.chips.tutorial, null);
  assert.ok(r2.ignored.some((x) => /handout\.pdf$/.test(x.rel)));
});

test("a description is quoted from the notes, the course's own text wins, and none is made up", () => {
  assert.strictEqual(titleOf("PHYS 143 - Mechanics\nWeek 1: Vectors - Tutorial Sheet\nHope, Office 24, Department of Physics"), "Vectors");
  assert.strictEqual(draft("PHYS 143\nVectors\nHow do we describe and combine quantities that have magnitude and direction?\nHope, Department of Physics"), "Vectors. How do we describe and combine quantities that have magnitude and direction?");
  assert.strictEqual(draft("12\n3 4"), "");
  const o = build({ files: ["l1/lecture01_vectors.pdf"], peeks: { "l1/lecture01_vectors.pdf": { ok: true, pages: 40, text: "Vectors\nWhat is a vector and why does it matter in mechanics?" } }, lectures: [{ number: 1, title: "T", summary: "Course text." }], counts: {}, saved: {} });
  assert.strictEqual(o.rows[0].description.text, "Course text."); assert.strictEqual(o.rows[0].description.source, "course");
});

test("choose, replace, detach, remove and undo; nothing is deleted for good", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lf-")), src = path.join(os.tmpdir(), "new-handout.pdf");
  fs.mkdirSync(path.join(dir, "l1")); fs.writeFileSync(path.join(dir, "l1", "a.pdf"), "a"); fs.writeFileSync(src, "n");
  const a = actions.create({ dir, course: null, linked: false });
  assert.strictEqual(a.choose(1, "handout", "l1/a.pdf").ok, true); assert.strictEqual(store.getFile(dir, 1, "handout"), "l1/a.pdf");
  assert.strictEqual(a.choose(1, "handout", "../outside.pdf").ok, false);
  assert.strictEqual(a.replace(1, "handout", path.join(dir, "x.txt")).ok, false);
  const r = a.replace(1, "handout", src); assert.ok(fs.existsSync(path.join(dir, r.rel))); assert.ok(fs.existsSync(path.join(dir, "l1", "a.pdf")), "the old file stays");
  a.undo(); assert.strictEqual(store.getFile(dir, 1, "handout"), "l1/a.pdf"); assert.ok(!fs.existsSync(path.join(dir, r.rel)));
  const d = a.remove(1, "handout", "l1/a.pdf"); assert.strictEqual(d.moved, true); assert.ok(!fs.existsSync(path.join(dir, "l1", "a.pdf")));
  assert.strictEqual(store.getFile(dir, 1, "handout"), null);
  a.undo(); assert.ok(fs.existsSync(path.join(dir, "l1", "a.pdf"))); assert.strictEqual(store.getFile(dir, 1, "handout"), "l1/a.pdf");
  const linked = actions.create({ dir, course: null, linked: true }).remove(1, "handout", "l1/a.pdf");
  assert.strictEqual(linked.moved, false); assert.ok(fs.existsSync(path.join(dir, "l1", "a.pdf")), "a linked folder is never changed");
  assert.strictEqual(a.describe(1, "  My text ").text, "My text");
});
