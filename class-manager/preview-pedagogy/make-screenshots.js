// Preview screenshots of the teaching features with the made-up class (nothing real). Needs Playwright with Chromium.
// Run from class-manager/: node preview-pedagogy/make-screenshots.js preview-pedagogy
"use strict";
const R = require("path").resolve(__dirname, "..");
const fs = require("fs"), os = require("os"), path = require("path"), http = require("http");
const { createBackend } = require(R + "/desktop/backend");
const { writeSample } = require(R + "/desktop/test/sample-class");
const { readSite } = require(R + "/desktop/test/sample-pedagogy");
const { chromium } = require("playwright");
const OUT = process.argv[2];
fs.mkdirSync(OUT, { recursive: true });

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cm-prev-"));
const file = path.join(dir, "workbook.json");
createBackend({ webRoot: R, dataFile: file, readSite, log: () => {} }).flush();
const sample = writeSample(file);
const B = createBackend({ webRoot: R, dataFile: file, readSite, log: () => {} });
const KEY = B.hostKey();
const get = (p) => { const t = B.doGet(Object.assign({ callback: "cb" }, p)).text; const m = /^cb\(([\s\S]*)\)\s*;?\s*$/.exec(t); return JSON.parse(m ? m[1] : t); };
const host = (p) => get(Object.assign({ hostkey: KEY }, p));
const post = (p) => B.doPost(p).text;
const ids = sample.ids, names = sample.names;
const codes = host({ action: "access_codes", op: "generate" }); const codeOf = {}; (codes.rows || []).forEach((c) => { codeOf[c.id] = c.code; });

const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml", ".webmanifest": "application/json" };
const srv = http.createServer((req, res) => {
  const u = new URL(req.url, "http://x"); let p = decodeURIComponent(u.pathname);
  if (p === "/exec") {
    const params = Object.fromEntries(u.searchParams);
    if (req.method === "POST") { let b = ""; req.on("data", (c) => (b += c)); req.on("end", () => { Object.assign(params, Object.fromEntries(new URLSearchParams(b))); const o = B.doPost(params, b); res.writeHead(200, { "Content-Type": o.mime }); res.end(o.text); }); return; }
    const o = B.doGet(params); res.writeHead(200, { "Content-Type": o.mime }); return res.end(o.text);
  }
  if (p === "/config.js") {
    const src = fs.readFileSync(R + "/config.js", "utf8");
    const cm = { courseCode: "PHYS 101", courseTitle: "General Physics I", institution: "Sample University", lecturer: "Dr Lecturer", semester: "Semester 1", contact: "", scriptUrl: "http://" + req.headers.host + "/exec", desktop: true };
    res.writeHead(200, { "Content-Type": "text/javascript" }); return res.end("window.CM = " + JSON.stringify(cm) + ";\n" + src.slice(src.indexOf("/* Helpers")));
  }
  const s = readSite(p); if (s !== null && /\.json$/.test(p)) { res.writeHead(200, { "Content-Type": "application/json" }); return res.end(s); }
  if (p === "/") p = "/index.html";
  const f = p.startsWith("/app/") ? path.join(R, "desktop", "app", p.slice(5)) : path.join(R, p);
  fs.readFile(f, (e, d) => { if (e) { res.writeHead(404); return res.end(); } res.writeHead(200, { "Content-Type": MIME[path.extname(f)] || "application/octet-stream" }); res.end(d); });
});

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  await new Promise((r) => srv.listen(0, "127.0.0.1", r));
  const base = "http://127.0.0.1:" + srv.address().port + "/";
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 }, deviceScaleFactor: 2 });
  await ctx.addInitScript((k) => { try { sessionStorage.setItem("cm_hk", k); } catch (e) {} }, KEY);
  const shot = async (page, name, full) => { await page.screenshot({ path: path.join(OUT, name), fullPage: !!full }); console.log("saved", name); };

  // 1. Ask, discuss, revise.
  const code = "26275";
  const hp = await ctx.newPage(); await hp.goto(base + "quiz-host.html"); await hp.fill("#h-code", code); await hp.press("#h-code", "Enter"); await wait(3000);
  const wrongOf = (k) => (k === "A" ? "B" : "A");
  const voters = ids.slice(0, 20);
  // A student phone joins and answers wrong.
  const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const sp = await phone.newPage();
  const me = ids[20], myName = names[20].split(" ")[0];
  await sp.goto(base + "quiz.html?code=" + code);
  await sp.fill("#in-name", myName); await sp.fill("#in-id", me); await sp.fill("#in-code", code);
  host({ action: "control", code, act: "start" }); const st0 = host({ action: "host", code }).status; console.log("after start", st0.state);
  await sp.click("#f-start button[type=submit], #f-start .go"); await wait(3000);
  const keys = st0.qids.map((q) => "BDACE"[Number(q.split("-Q")[1]) - 1]);
  voters.forEach((id, i) => post({ kind: "answer", code, id, name: names[i].split(" ")[0], q: "1", answer: i < 12 ? keys[0] : wrongOf(keys[0]) }));
  await wait(5000);
  await sp.locator("#opts > *").nth("ABCDE".indexOf(wrongOf(keys[0]))).click(); await wait(300);
  if (await sp.locator("#next").isEnabled().catch(() => false)) await sp.click("#next"); await wait(2500);
  console.log("phone answered", JSON.stringify(host({ action: "host", code }).dist));
  host({ action: "control", code, act: "revote" });
  voters.forEach((id, i) => { let a = null; if (i >= 12 && i < 18) a = keys[0]; else if (i === 0) a = wrongOf(keys[0]); else if (i < 12) a = keys[0]; if (a && i < 15) post({ kind: "answer", code, id, name: names[i].split(" ")[0], q: "1", answer: a }); });
  await wait(6000);
  await shot(sp, "01-student-phone-second-vote.png");




  await wait(3000);
  await shot(hp, "02-host-second-vote.png", true);
  const dp = await ctx.newPage();
  await shot(dp, "03-projector-discuss-and-vote-again.png");
  // Finish the vote and the quiz, then review.
  voters.forEach((id, i) => { if (i >= 15 && i < 18) post({ kind: "answer", code, id, name: names[i].split(" ")[0], q: "1", answer: keys[0] }); });
  for (let q = 2; q <= 5; q++) { host({ action: "control", code, act: "next" }); voters.forEach((id, i) => post({ kind: "answer", code, id, name: names[i].split(" ")[0], q: String(q), answer: keys[q - 1] })); }
  host({ action: "control", code, act: "next" });
  host({ action: "control", code, act: "review" });
  await dp.reload(); await wait(3500);
  await shot(dp, "04-projector-review-before-and-after.png");
  await hp.close(); await dp.close();
  host({ action: "control", code, act: "release" });

  // 2. Objectives.
  [1, 2, 3, 4].forEach((n) => host({ action: "outcomes", op: "accept", lecture: String(n) }));
  const op = await ctx.newPage(); await op.goto(base + "outcomes.html"); await wait(2500);
  await op.selectOption("#o-lec", "5"); await wait(500);
  await shot(op, "05-learning-objectives.png", true);
  host({ action: "outcomes", op: "accept", lecture: "5" });
  await op.close();

  // 3. Groups and assignments.
  const g = host({ action: "groups", op: "make", set: "Lab 1", mode: "mixed", size: "4" });
  const A1 = host({ action: "assignments", op: "save", set: "Lab 1", title: "Projectile design", brief: "Design a launch that lands a ball on a target 5 m away. Show the method, the numbers and one check.", groups: "1,2,3", due: "2099-12-01T17:00", outcome: "L4.2", outof: "20" }).saved;
  host({ action: "assignments", op: "save", set: "Lab 1", title: "Free-body poster", brief: "One poster with three free-body diagrams from everyday life.", groups: "4,5,6", due: "2099-12-08T17:00", outcome: "L5.1" });
  const mem = (n) => g.groups.find((x) => x.group === n).members.map((m) => m.id);
  const S = (id, p) => get(Object.assign({ action: "group_work", id, access: codeOf[id] }, p));
  const g1 = mem(1), g2 = mem(2);
  S(g1[0], { op: "submit", aid: A1, text: "Launch at 7.0 m/s and 45 degrees. Range R = v^2 sin(2θ)/g = 49/9.8 = 5.0 m. Check: time of flight 1.01 s, horizontal speed 4.95 m/s, distance 5.0 m.", link: "https://example.org/projectile-sheet" });
  S(g1[0], { op: "part", aid: A1, text: "I derived the range formula and chose the angle." });
  S(g1[1], { op: "part", aid: A1, text: "I checked the numbers with the time of flight." });
  S(g1[2], { op: "part", aid: A1, text: "I wrote up the method." });
  const rate = (from, grp, low) => { const r = {}; grp.filter((x) => x !== from).forEach((x) => { r[x] = x === low ? "little" : "full"; }); S(from, { op: "peer", aid: A1, ratings: JSON.stringify(r) }); };
  rate(g1[0], g1, g1[g1.length - 1]); rate(g1[1], g1, g1[g1.length - 1]);
  S(g2[0], { op: "submit", aid: A1, text: "We used 45 degrees and solved for the speed: about 7 m/s." });
  S(g2[0], { op: "part", aid: A1, text: "I did the algebra." });
  host({ action: "assignments", op: "mark", id: A1, group: "1", mark: "17", feedback: "Clear method and a good check. State the assumption that air resistance is neglected." });

  const ap = await ctx.newPage(); await ap.goto(base + "assignments.html"); await wait(2500);
  await shot(ap, "06-assignments-list.png", true);
  const view = ap.locator("[data-open]").first();
  if (await view.count()) { await view.click(); await wait(2000); await shot(ap, "07-assignment-submissions-and-peer-ratings.png", true); }
  await ap.close();
  const gp = await ctx.newPage(); await gp.goto(base + "groups.html"); await wait(2500);
  await shot(gp, "08-groups-with-tasks.png", true);
  await gp.close();

  // 4. Student views on a phone.
  const sid = g1[1];
  const wp = await phone.newPage();
  await wp.goto(base + "group-work.html"); await wp.fill("#w-id", sid); await wp.fill("#w-code", codeOf[sid]); await wp.click("#w-form .go"); await wait(2500);
  await shot(wp, "09-student-group-work.png", true);
  const pp = await phone.newPage();
  const pid = ids[1]; await pp.goto(base + "index.html"); await wait(1500); await pp.evaluate(() => { const r = document.getElementById("p-res"); if (r) r.hidden = false; const d = document.getElementById("p-details"); if (d) d.open = true; }); await pp.fill("#p-id", pid); await pp.fill("#p-code", codeOf[pid]); await pp.click("#p-show"); await wait(3000);
  await wait(1500);
  await pp.setViewportSize({ width: 390, height: 1400 });
  const found = await pp.evaluate(() => { const h = [...document.querySelectorAll("h2")].find((x) => /Progress by learning objective/.test(x.textContent)); if (!h) return false; h.style.display = "block"; let el = h; while (el && el !== document.body) { let sib = el.previousElementSibling; while (sib) { if (sib.tagName !== "SCRIPT" && sib.tagName !== "STYLE") sib.style.display = "none"; sib = sib.previousElementSibling; } el = el.parentElement; } const d = document.getElementById("p-details"); if (d) { const sm = d.querySelector("summary"); } window.scrollTo(0, 0); return true; });
  console.log("progress h2", found); await wait(500);
  await shot(pp, "10-student-my-progress.png");

  // 5. The desktop app: Learning Progress and the student lookup.
  const app = await ctx.newPage();
  await app.exposeFunction("__cm", (name, arg) => {
    try {
      if (name === "progress") return B.progress({});
      if (name === "stats") return B.stats(arg || {});
      if (name === "studentStats") return B.studentStats(arg || {});
      if (name === "info") return { settings: { courseCode: "PHYS 101", courseTitle: "General Physics I", lecturer: "Dr Lecturer" }, base, version: "0.7.0", addresses: [base], tunnel: { state: "off" }, hostKey: KEY, tabs: [], google: { connected: false }, dataFolder: "/sample", setup: { steps: { course: true, classList: true, materials: true }, complete: true, seen: true, roster: ids.length } };
      if (name === "live") return { attendance: null, quizzes: [], roster: ids.length };
      return null;
    } catch (e) { return { ok: false, why: e.message }; }
  });
  await app.addInitScript(() => {
    window.cmApp = new Proxy({}, { get: (t, k) => (k === "onTunnel" ? () => {} : k === "filePath" ? () => "" : (arg) => window.__cm(String(k), arg)) });
  });
  await app.goto(base + "app/home.html"); await wait(2500);
  await app.click('[data-view="progress"]'); await wait(2500);
  await shot(app, "11-learning-progress.png");
  const scrollTo = async (pg, sel, re) => pg.evaluate(([sel, re]) => { const h = [...document.querySelectorAll(sel)].find((x) => new RegExp(re).test(x.textContent) && x.offsetParent); if (h) h.scrollIntoView({ block: "start", behavior: "instant" }); return !!h; }, [sel, re]);
  let n = 0;
  for (const re of ["^Learning objectives", "^Students", "^Group"]) { const ok = await scrollTo(app, "#v-progress h2, #v-progress h3", re); console.log("scroll", re, ok); if (ok) { await wait(300); await shot(app, "11" + "abc"[n++] + "-learning-progress-" + re.replace(/\W/g, "").toLowerCase() + ".png"); } }
  await app.keyboard.press("Control+k"); await wait(500);
  await shot(app, "12-find-a-student.png");
  await app.fill("#look-in", ids[3]); await app.press("#look-in", "Enter"); await wait(2500);
  await shot(app, "13-student-profile-needs-check-in.png");
  if (await scrollTo(app, "h3.sec", "^Suggestions")) { await wait(300); await shot(app, "13a-profile-suggestions.png"); }
  await app.keyboard.press("Escape"); await wait(300);
  await app.keyboard.press("Control+k"); await wait(300);
  await app.fill("#look-in", ids[1]); await app.press("#look-in", "Enter"); await wait(2500);
  await shot(app, "14-student-profile-improving.png");
  if (await scrollTo(app, "h3.sec", "^Suggestions")) { await wait(300); await shot(app, "14a-profile-suggestions.png"); }
  if (await scrollTo(app, "h3.sec", "^Progress by objective")) { await wait(300); await shot(app, "14b-profile-progress-by-objective.png"); }

  await browser.close(); srv.close();
})().catch((e) => { console.error(e); process.exit(1); });
