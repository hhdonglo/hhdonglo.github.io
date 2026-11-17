"use strict";
// Screenshots of the Class Analytics board on a made-up class (test/sample-class.js, no real student data).
// Usage: node tools/board-screenshots.js <output folder> [dark|light]. Needs Playwright. Writes board-wide, board-narrow and board-empty PNGs.
const path = require("path"), fs = require("fs");
const { chromium } = require("playwright");
const { classroom } = require("../test/classroom");
const { sampleClass } = require("../test/sample-class");

function stats() {
  const c = classroom({ engine: "js" }), s = sampleClass({ now: Date.now() });
  // two sessions where nobody checked in (a test and an abandoned one): CM sets them aside
  s.tabs.Attendance[0].push("3 Nov 2026 (test)", "6 Nov 2026"); for (let i = 1; i < s.tabs.Attendance.length; i++) s.tabs.Attendance[i].push(0, 0);
  c.editWorkbook((book) => { const enc = (v) => (v instanceof Date ? { $d: v.toISOString() } : v);
    for (const [name, rows] of Object.entries(s.tabs)) { const data = { name, id: 9000 + book.sheets.length, rows: rows.map((r) => r.map(enc)) }; const i = book.sheets.findIndex((x) => x.name === name); if (i >= 0) book.sheets[i] = Object.assign(book.sheets[i], { rows: data.rows }); else book.sheets.push(data); } });
  const d = c.host("class_stats", {}); c.backend.close(); return d;
}
const LP = { state: "behind", target: 12, held: 4, left: 8, expected: 6, behind: 2, ahead: 0, weekNow: 5, weeksTotal: 12, headline: "Behind target: 2 lectures behind", detail: "Held 4 of 12.", notify: false, key: "k",
  days: [{ date: "2026-10-19", how: "attendance" }, { date: "2026-10-23", how: "attendance" }, { date: "2026-10-26", how: "attendance" }, { date: "2026-11-02", how: "marked held" }],
  schedule: { due: { label: "Lecture 6", title: "Work and energy" }, next: { label: "Lecture 5", title: "Momentum" }, missed: [{ label: "Lecture 5", title: "Momentum", summary: "" }] } };
function empty(d) { return Object.assign({}, d, { attendance: Object.assign({}, d.attendance, { sessions: 0, rate: null, bySession: [], notHeld: [], recentRate: null, earlierRate: null }), quizzes: [], learning: Object.assign({}, d.learning, { topics: [], signals: [], verdict: "Not enough data" }), targets: [], students: d.students.map((x) => Object.assign({}, x, { attendance: null, quizAverage: null, practiceRecent: 0, group: "Not enough data", missedInARow: 0, change: null })), groups: { "On track": 0, "Working hard but struggling": 0, "Disengaged": 0, "Needs a check-in": 0, "Not enough data": d.rosterSize }, summary: Object.assign({}, d.summary, { lastQuiz: null, recentRate: null, earlierRate: null, missedInARow: 0 }) }); }
const STUB = (d, lp) => `(function(){var d=${JSON.stringify(d)},lp=${JSON.stringify(lp)};var course={id:"phys143",code:"PHYS 143",title:"Mechanics and Thermal Physics",term:"2026/27",current:true,source:{kind:"folder",path:"/x"},repo:{}};
 var map={courses:function(){return{ok:true,list:[course],current:"phys143"}},info:function(){return{ok:true,me:{},source:course.source,repo:{},base:"http://x",addresses:[],settings:{port:8080},tabs:[],tunnel:null,setup:{steps:{course:true,classList:true,materials:true}}}},stats:function(){return d},lectureProgress:function(){return lp?{ok:true,progress:lp}:{ok:false}},analyticsExtra:function(){return{cohorts:{},interventions:[],termClosed:false,aiSummary:false,hasKey:false,privacyNotice:"x"}},weeklySummary:function(){return{ok:true,text:"Attendance and quiz results are steady. Two sessions with no check-ins were set aside.",source:"rules"}}};
 window.cmApp=new Proxy({},{get:function(_,k){return function(){return Promise.resolve(map[k]?map[k]():Object.assign([],{ok:true,list:[],rows:[],items:[],banks:[],docs:[],connected:false}))}},has:function(){return true}});})();`;

(async () => {
  const out = process.argv[2], scheme = process.argv[3] || "dark"; fs.mkdirSync(out, { recursive: true });
  const d = stats(), browser = await chromium.launch();
  // made-up topic figures so the topic panels have something to draw (the sample class has no question-level answers)
  const tp = (n, pct, band) => ({ key: "L" + n, label: "Lecture " + n, title: ["Units", "Kinematics", "Forces", "Energy"][n - 1], pct, band, answers: 120, students: 38, small: false, studentBands: { well: 12, developing: 14, attention: 12 } });
  d.topics = { cutoffs: { well: 70, developing: 50, minTopicAnswers: 10, minStudentAnswers: 3 }, answers: 480, unmapped: 0, semester: [tp(1, 82, "well"), tp(2, 64, "developing"), tp(3, 41, "attention"), tp(4, 73, "well")],
    overTime: [1, 2, 3, 4].map((n) => ({ key: "L" + n, label: "Lecture " + n, title: "", values: [60 + n * 3, 55 + n * 5, 50 + n], answers: [30, 30, 30] })), students: {}, byQuiz: {} };
  const tabs = process.env.CM_TABS ? process.env.CM_TABS.split(",") : ["overview", "attendance", "quizzes", "risk", "questions", "relations", "actions"];
  const shots = [];
  for (const t of tabs) { shots.push(["tab-" + t + "-wide", 1512, 2600, d, LP, t]); shots.push(["tab-" + t + "-narrow", 760, 5200, d, LP, t]); }
  shots.push(["board-empty", 1512, 2000, empty(d), null, "overview"]);
  for (const [name, w, h, data, lp, tab] of shots) {
    const ctx = await browser.newContext({ viewport: { width: w, height: 900 }, colorScheme: scheme, deviceScaleFactor: 1 });
    await ctx.addInitScript(STUB(data, lp));
    const pg = await ctx.newPage(); pg.on("pageerror", (e) => console.log("PAGE ERROR", e.stack.split("\n").slice(0, 3).join(" | ")));
    await pg.goto("file://" + path.join(__dirname, "..", "app", "home.html")); await pg.waitForTimeout(900);
    await pg.click("[data-bd-pane='" + tab + "']").catch(() => {});
    await pg.setViewportSize({ width: w, height: h }); await pg.waitForTimeout(200);
    const box = await pg.evaluate(() => { const e = document.querySelector(".bd-pane:not([hidden])"); const r = e ? e.getBoundingClientRect() : { bottom: 900 }; return Math.ceil(r.bottom + window.scrollY + 40); });
    await pg.setViewportSize({ width: w, height: Math.min(h, Math.max(900, box)) });
    await pg.screenshot({ path: path.join(out, name + "-" + scheme + ".png") });
    await ctx.close();
  }
  await browser.close();
})();
