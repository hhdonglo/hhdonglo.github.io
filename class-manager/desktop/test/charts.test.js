/* Learning Progress charts: run with `npm test` in class-manager/desktop (Node 20 or later, no Electron needed).
   Unit tests feed the chart modules made-up data; one test renders the charts from the real server figures of the made-up class. */
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const C = require("../app/charts/core");
const { masteryDistribution, rows } = require("../app/charts/mastery-distribution");
const { heatmap, build } = require("../app/charts/heatmap");

const lv = (s, d, b, n) => ({ "Secure": s, "Developing": d, "Beginning": b, "Not enough evidence": n });
const outcomes = [
  { key: "L1.1", label: "Draw vectors", linked: true, students: 10, levels: lv(4, 3, 2, 1) },
  { key: "L1.2", label: "Add vectors", linked: true, students: 0, levels: lv(0, 0, 0, 0) },
];
const so = (key, current, level, answers) => ({ key, current, level, answers, gain: null });
const students = [
  { id: "1", name: "Ada", outcomes: [so("L1.1", 90, "Secure", 5)] },
  { id: "2", name: "Ben", outcomes: [so("L1.1", 30, "Beginning", 4)] },
  { id: "3", name: "Cy", outcomes: [so("L1.1", 100, "Not enough evidence", 1)] },
  { id: "4", name: "Di", outcomes: [] },
];

test("mastery distribution: counts and shares come from the levels, and a row with no students is left out", () => {
  const r = rows(outcomes); assert.equal(r.length, 1);
  assert.equal(r[0].total, 10); assert.deepEqual(r[0].parts.map((p) => p.n), [4, 3, 2, 1]); assert.equal(r[0].parts[0].share, 40);
  const h = masteryDistribution(outcomes);
  assert.match(h, /10 students/); assert.match(h, /4 Secure, 3 Developing, 2 Beginning, 1 Not enough evidence/); assert.match(h, /View as a table/);
  assert.doesNotMatch(h, /Add vectors/);
});

test("mastery distribution: nothing to show reads as not enough evidence, never an empty chart", () => {
  assert.match(masteryDistribution([]), /Not enough evidence yet/);
  assert.match(masteryDistribution(undefined), /Not enough evidence yet/);
});

test("heat map: weakest first, a thin record is a dot and not a low score, a student with no answers is left out", () => {
  const m = build(students, outcomes);
  assert.deepEqual(m.rows.map((r) => r.name), ["Ben", "Ada", "Cy"]);
  const h = heatmap(students, outcomes);
  assert.match(h, /data-id='2'/); assert.doesNotMatch(h, /data-id='4'/);
  assert.match(h, /not enough evidence, 1 answers/); assert.match(h, />90</); assert.match(h, />·</);
  assert.doesNotMatch(h, />100</, "one answer is never shown as 100%");
});

test("heat map: text is escaped and the column limit is stated", () => {
  const many = Array.from({ length: 30 }, (_, i) => ({ key: "L" + i, label: i === 0 ? "<b>x</b>" : "Obj " + i, students: 1, levels: lv(1, 0, 0, 0) }));
  const st = [{ id: "9", name: "A&B", outcomes: many.map((o) => so(o.key, 80, "Secure", 5)) }];
  const h = heatmap(st, many);
  assert.doesNotMatch(h, /<b>x/); assert.match(h, /A&amp;B/); assert.match(h, /Only the first 24 objectives/);
});

test("the charts agree with the server figures of the made-up class", () => {
  const { createBackend } = require("../backend");
  const { writeSample } = require("./sample-class");
  const { readSite } = require("./sample-pedagogy");
  const WEB = path.resolve(__dirname, "..", "..");
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "cm-charts-")), "workbook.json");
  createBackend({ webRoot: WEB, dataFile: file, readSite, log: () => {} }).flush();
  writeSample(file);
  const B = createBackend({ webRoot: WEB, dataFile: file, readSite, log: () => {} });
  const t = B.doPost({ callback: "cb", hostkey: B.hostKey(), action: "learning_progress" }).text;
  const lp = JSON.parse(/^cb\(([\s\S]*)\)\s*;?\s*$/.exec(t)[1]);
  assert.ok(lp.ok && lp.outcomes.length && lp.students.length);
  const r = rows(lp.outcomes);
  r.forEach((x) => { const o = lp.outcomes.find((y) => y.key === x.key); assert.equal(x.total, o.students); });
  const m = build(lp.students, lp.outcomes);
  assert.ok(m.rows.length > 0 && m.cols.length > 0);
  const h = heatmap(lp.students, lp.outcomes);
  assert.equal((h.match(/<tr tabindex/g) || []).length, m.rows.length);
});

test("shared helpers", () => { assert.equal(C.pct(1, 3), 33.3); assert.equal(C.pct(1, 0), null); assert.equal(C.esc("<&>"), "&lt;&amp;&gt;"); });
