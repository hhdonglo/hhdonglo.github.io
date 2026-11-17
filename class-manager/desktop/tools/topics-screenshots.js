"use strict";
// Screenshots of the topic views (Quizzes and Questions panel, the Class Analytics topic panels, My topics in the portal) on a made-up class (test/sample-class.js, no real student data).
// Usage: node tools/topics-screenshots.js <output folder> [dark|light]. Needs Playwright. Writes board-wide, board-narrow and board-empty PNGs.
const path = require("path"), fs = require("fs");
const { chromium } = require("playwright");
const { classroom } = require("../test/classroom");
const { sampleClass } = require("../test/sample-class");

function stats() {
  const c = classroom({ engine: "js" }), s = sampleClass({ now: Date.now() });
  c.editWorkbook((book) => { const enc = (v) => (v instanceof Date ? { $d: v.toISOString() } : v);
    for (const [name, rows] of Object.entries(s.tabs)) { const data = { name, id: 9000 + book.sheets.length, rows: rows.map((r) => r.map(enc)) }; const i = book.sheets.findIndex((x) => x.name === name); if (i >= 0) book.sheets[i] = Object.assign(book.sheets[i], { rows: data.rows }); else book.sheets.push(data); } });
  const d = c.host("class_stats", {}); c.backend.close(); return d;
}
const LP = { state: "behind", target: 12, held: 4, left: 8, expected: 6, behind: 2, ahead: 0, weekNow: 5, weeksTotal: 12, headline: "Behind target: 2 lectures behind", detail: "Held 4 of 12.", notify: false, key: "k",
  days: [{ date: "2026-10-19", how: "attendance" }, { date: "2026-10-23", how: "attendance" }, { date: "2026-10-26", how: "attendance" }, { date: "2026-11-02", how: "marked held" }],
  schedule: { due: { label: "Lecture 6", title: "Work and energy" }, next: { label: "Lecture 5", title: "Momentum" }, missed: [{ label: "Lecture 5", title: "Momentum", summary: "" }] } };
function empty(d) { return Object.assign({}, d, { attendance: Object.assign({}, d.attendance, { sessions: 0, rate: null, bySession: [], recentRate: null, earlierRate: null }), quizzes: [], learning: Object.assign({}, d.learning, { topics: [], signals: [], verdict: "Not enough data" }), targets: [], students: d.students.map((x) => Object.assign({}, x, { attendance: null, quizAverage: null, practiceRecent: 0, group: "Not enough data", missedInARow: 0, change: null })), groups: { "On track": 0, "Working hard but struggling": 0, "Disengaged": 0, "Needs a check-in": 0, "Not enough data": d.rosterSize }, summary: Object.assign({}, d.summary, { lastQuiz: null, recentRate: null, earlierRate: null, missedInARow: 0 }) }); }
const STUB = (d, lp) => `(function(){var d=${JSON.stringify(d)},lp=${JSON.stringify(lp)};var course={id:"phys143",code:"PHYS 143",title:"Mechanics and Thermal Physics",term:"2026/27",current:true,source:{kind:"folder",path:"/x"},repo:{}};
 var map={courses:function(){return{ok:true,list:[course],current:"phys143"}},info:function(){return{ok:true,me:{},source:course.source,repo:{},base:"http://x",addresses:[],settings:{port:8080},tabs:[],tunnel:null,setup:{steps:{course:true,classList:true,materials:true}}}},stats:function(){return d},lectureProgress:function(){return lp?{ok:true,progress:lp}:{ok:false}},analyticsExtra:function(){return{cohorts:{}}}};
 window.cmApp=new Proxy({},{get:function(_,k){return function(){return Promise.resolve(map[k]?map[k]():Object.assign([],{ok:true,list:[],rows:[],items:[],banks:[],docs:[],connected:false}))}},has:function(){return true}});})();`;

(async () => {
  const out = process.argv[2], scheme = process.argv[3] || "dark"; fs.mkdirSync(out, { recursive: true });
  const d = stats(), browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1512, height: 1500 }, colorScheme: scheme, deviceScaleFactor: 1 });
  await ctx.addInitScript(STUB(d, LP));
  const pg = await ctx.newPage(); pg.on("pageerror", (e) => { if (!/lecture-list/.test(e.stack)) console.log("PAGE ERROR", e.stack.split("\n").slice(0, 3).join(" | ")); });
  await pg.goto("file://" + path.join(__dirname, "..", "app", "home.html")); await pg.waitForTimeout(900);
  await pg.getByText("Quizzes and Questions", { exact: true }).first().click(); await pg.waitForTimeout(700);
  await pg.screenshot({ path: path.join(out, "quizzes-topics-" + scheme + ".png") });
  await pg.getByText("Class Analytics", { exact: true }).first().click(); await pg.waitForTimeout(700);
  const el = await pg.$("#bd-tmast"); if (el) { await pg.setViewportSize({ width: 1512, height: 2300 }); await pg.evaluate(() => document.getElementById("bd-tmast").scrollIntoView()); await pg.screenshot({ path: path.join(out, "analytics-topics-" + scheme + ".png") }); }
  await ctx.close();
  // The portal: a student's own topics, from the same made-up class (one student's rows only).
  const { studentTopics } = require("../rules/topics");
  const topics = d.students && d.students[0] ? JSON.parse(process.env.CM_PORTAL_TOPICS || "null") : null;
  const pctx = await browser.newContext({ viewport: { width: 520, height: 1500 }, deviceScaleFactor: 1 }); const pp = await pctx.newPage();
  await pp.goto("file://" + path.join(__dirname, "..", "..", "index.html")); await pp.waitForTimeout(500);
  const demo = [
    { key: "L2", lecture: 2, label: "Lecture 2", title: "Motion", asked: 9, right: 3, pct: 33.3, band: "attention", advice: "Start here: re-read Velocity and acceleration and work through the questions to revisit, then redo the practice quiz." },
    { key: "L1", lecture: 1, label: "Lecture 1", title: "Vectors", asked: 8, right: 5, pct: 62.5, band: "developing", advice: "Revise Vector addition, then redo the practice quiz." },
    { key: "L4", lecture: 4, label: "Lecture 4", title: "Work and kinetic energy", asked: 2, right: 2, pct: 100, band: "early", advice: "Only 2 of 3 answers needed so far. Try the Lecture 4 practice quiz." },
    { key: "L3", lecture: 3, label: "Lecture 3", title: "Newton's laws", asked: 10, right: 9, pct: 90, band: "well", advice: "A short practice before the exam keeps it fresh." }];
  await pp.evaluate((t) => { const o = document.getElementById("p-out"); o.innerHTML = window.cmMyTopics.html(t, null, (n) => "lecture-" + n + "-practice.html"); for (let e = o; e; e = e.parentElement) e.hidden = false; const d = document.getElementById("p-details"); if (d) d.open = true; o.scrollIntoView(); }, demo);
  await pp.screenshot({ path: path.join(out, "portal-my-topics.png") });
  await browser.close();
})();
