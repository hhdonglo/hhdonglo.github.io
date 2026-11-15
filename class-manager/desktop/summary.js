/* The weekly Teaching Insights summary. Two parts:
   - aggregates(d): numbers only, taken from the class statistics. No names, IDs or answers of single students leave this function.
   - ruleText(a): a plain written summary made on this computer from those numbers. Always available, never sends anything anywhere.
   - aiText(a, opts): optional, off by default. Only when the lecturer turns on "AI summary" and has stored an Anthropic key, the aggregates (not student data) are sent
     and the reply replaces the written summary. If anything fails, the written summary is used. Pure of Electron: the key is passed in. */
"use strict";

function aggregates(d) {
  d = d || {}; const s = d.summary || {}, a = d.attendance || {}, L = d.learning || {};
  const last = (d.quizzes || []).slice(-1)[0];
  return {
    students: d.rosterSize || 0,
    attendanceRate: a.rate === undefined ? null : a.rate, attendanceEarlier: a.earlierRate === undefined ? null : a.earlierRate, attendanceRecent: a.recentRate === undefined ? null : a.recentRate, sessions: a.sessions || 0,
    absentInARow: s.missedInARow || 0, absentThreshold: (d.thresholds || {}).misses || 3,
    latestQuiz: last ? { name: last.quiz, mean: last.stats && last.stats.mean, students: last.students } : null,
    verdict: L.verdict || null, confidence: L.confidence || null,
    topics: (L.topics || []).map((t) => ({ topic: t.label, pct: t.pct, small: !!t.small })),
    targets: (d.targets || []).slice(0, 5).map((t) => ({ kind: t.kind, title: t.title, n: t.n, action: t.action })),
    groups: d.groupNames ? Object.keys(d.groupNames).length : 0
  };
}

function ruleText(a) {
  const out = [];
  if (!a.students) return "No class list yet, so there is nothing to summarise.";
  if (a.sessions) {
    let t = "Attendance is " + a.attendanceRate + "% over " + a.sessions + " sessions";
    if (a.attendanceEarlier !== null && a.attendanceRecent !== null) { const dlt = Math.round(10 * (a.attendanceRecent - a.attendanceEarlier)) / 10; t += dlt ? ", " + (dlt > 0 ? "up " : "down ") + Math.abs(dlt) + " points in the last three sessions" : ", unchanged in the last three sessions"; }
    out.push(t + ".");
  } else out.push("No attendance session has been submitted yet.");
  if (a.absentInARow) out.push(a.absentInARow + (a.absentInARow === 1 ? " student has" : " students have") + " missed the last " + a.absentThreshold + " or more sessions.");
  if (a.latestQuiz) out.push("The latest quiz (" + a.latestQuiz.name + ") averaged " + a.latestQuiz.mean + "% across " + a.latestQuiz.students + " students.");
  const weak = a.topics.filter((t) => !t.small && t.pct !== null && t.pct < 60);
  if (weak.length) out.push("Topics to revisit: " + weak.map((t) => t.topic + " (" + t.pct + "%)").join(", ") + ".");
  if (a.verdict) out.push("Is the class learning? " + a.verdict + (a.confidence ? " (confidence: " + a.confidence + ")" : "") + ".");
  if (a.targets.length) out.push("Suggested first: " + a.targets[0].title + ". " + a.targets[0].action);
  return out.join(" ");
}

async function aiText(a, o) {
  if (!o || !o.enabled || !o.loadKey) return null;
  const key = o.loadKey(); if (!key) return null;
  try {
    const Anthropic = require("@anthropic-ai/sdk").default;
    const c = new Anthropic({ apiKey: key, maxRetries: 1, timeout: 60000 });
    const msg = await c.messages.create({ model: o.model, max_tokens: 700,
      system: "You write a short weekly summary for a university lecturer from class-level numbers. Formal, measured, plain prose, two short paragraphs at most. Say what changed, what to look at first, and what the numbers cannot show. Never claim a cause. Do not mention individual students. Write CM, never 'app'. Do not use the ampersand.",
      messages: [{ role: "user", content: JSON.stringify(a) }] });
    const t = msg.content.filter((b) => b.type === "text").map((b) => b.text).join("").trim();
    return t || null;
  } catch (e) { return null; }
}

async function weekly(d, o) { const a = aggregates(d), rule = ruleText(a), ai = await aiText(a, o); return { text: ai || rule, source: ai ? "ai" : "local", rule, aggregates: a }; }

module.exports = { aggregates, ruleText, aiText, weekly };
