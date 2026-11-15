/* Sends the chosen assessments to the LMS gradebook. `members` are the LMS learners already matched to CM IDs (members.js).
   With dryRun the LMS is not changed: the report says what would be sent. A student with no score is skipped, never sent as zero. */
"use strict";
const { listAssessments, scoresFor } = require("./assessments");
const { ensureLineItem, postScore } = require("./scores");

async function pushGrades(o) { // { master, columns, members, cfg, token, fetchFn, dryRun, now }
  const assess = listAssessments(o.master).filter((a) => o.columns.includes(a.column));
  const scores = scoresFor(o.master, assess.map((a) => a.column)), byId = new Map(o.members.map((m) => [m.id, m]));
  const report = { assessments: [], notInLms: [] };
  const notInLms = new Set();
  for (const a of assess) {
    const line = { name: a.name, sent: 0, failed: 0 };
    const todo = [];
    scores.forEach((mine, id) => { if (!mine[a.column]) return; if (!byId.has(id)) { notInLms.add(id); return; } todo.push({ userId: byId.get(id).userId, score: mine[a.column].score, outOf: mine[a.column].outOf }); });
    line.would = todo.length;
    if (!o.dryRun && todo.length) {
      const url = await ensureLineItem(o.cfg.lineItemsUrl, o.token, o.fetchFn, a);
      for (const s of todo) (await postScore(url, o.token, o.fetchFn, s, o.now)) ? line.sent++ : line.failed++;
    }
    report.assessments.push(line);
  }
  report.notInLms = [...notInLms];
  return report;
}

module.exports = { pushGrades };
