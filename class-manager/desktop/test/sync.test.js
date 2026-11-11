/* Course synchronisation (sync/*.js): merge rules, two computers, materials, offline: run with `npm test`. */
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { merge3, presentWins } = require("../sync/merge");
const { createCourseSync } = require("../sync/course-sync");
const materials = require("../sync/materials");

const tmp = (p) => fs.mkdtempSync(path.join(os.tmpdir(), p));
const PASS = "correct horse battery";

// ---------- merge ----------
test("three-way merge carries additions, edits and removals, and counts real conflicts", () => {
  const r = merge3({ a: "1", b: "2", c: "3" }, { a: "1", b: "2", c: "3", d: "4" }, { a: "1", c: "9" }, null);
  assert.deepEqual(r.data, { a: "1", c: "9", d: "4" }); // b removed there, d added here, c edited there
  assert.equal(r.conflicts, 0);
  const x = merge3({ a: "1" }, { a: "2" }, { a: "3" }, (l) => l);
  assert.equal(x.conflicts, 1); assert.equal(x.data.a, "2");
  assert.equal(presentWins(0, 1), 1); assert.equal(presentWins(1, 0), 1); assert.equal(presentWins(0, 0), 0);
});

// ---------- two computers sharing one place ----------
function sharedPlace() {
  const files = new Map();
  return { files, make: () => ({
    rawList: async (rel) => { const pre = rel ? rel + "/" : "", seen = new Map();
      for (const [k, v] of files) if (k.startsWith(pre)) { const rest = k.slice(pre.length), i = rest.indexOf("/"); if (i < 0) seen.set(rest, { name: rest, bytes: v.length }); else seen.set(rest.slice(0, i), { name: rest.slice(0, i), dir: true }); }
      return [...seen.values()]; },
    rawGet: async (k) => { if (!files.has(k)) throw new Error("missing " + k); return files.get(k); },
    rawPut: async (k, b) => { files.set(k, Buffer.from(b)); } }) };
}
function computer(shared, name, extra) {
  const dir = tmp("cm-sync-" + name + "-"), tabs = new Map(), content = path.join(dir, "course"), notes = path.join(dir, "notes");
  const opt = Object.assign({ online: true, items: { notes: "local", materials: "local", classList: "sync", attendance: "sync" } }, extra || {});
  const linked = { linked: () => true, items: () => opt.items, setItems: (o) => Object.assign(opt.items, o), passphrase: (p) => p || PASS,
    raw: () => { if (!opt.online) throw new Error("offline"); return shared.make(); } };
  const cs = createCourseSync({ dir, contentDir: content, notesDir: notes, linked, deviceName: name, vault: { encode: (s) => Buffer.from(s), decode: (b) => b.toString() },
    backend: { rawRows: (n) => (tabs.has(n) ? tabs.get(n).map((r) => r.slice()) : null), setRows: (n, rows) => tabs.set(n, rows.map((r) => r.slice())) } });
  return { cs, tabs, opt, content, notes, dir };
}
const ids = (c) => (c.tabs.get("Roster") || []).slice(1).map((r) => r[0]);

test("class list and attendance flow both ways between two computers", async () => {
  const sh = sharedPlace(), a = computer(sh, "laptop"), b = computer(sh, "desktop");
  a.tabs.set("Roster", [["Student ID", ""], ["1001", "Ama"], ["1002", "Kofi"]]);
  a.tabs.set("Attendance", [["Student ID", "01/11/2026"], ["1001", 1], ["1002", 0]]);
  assert.equal((await a.cs.syncNow()).ok, true);
  assert.equal((await b.cs.syncNow()).ok, true);
  assert.deepEqual(ids(b), ["1001", "1002"]);
  assert.deepEqual(b.tabs.get("Attendance"), [["Student ID", "01/11/2026"], ["1001", 1], ["1002", 0]]);
  // b takes attendance for a new session and adds a student; a removes a student
  b.tabs.set("Roster", b.tabs.get("Roster").concat([["1003", "Esi"]]));
  b.tabs.set("Attendance", [["Student ID", "01/11/2026", "03/11/2026"], ["1001", 1, 1], ["1002", 0, 1], ["1003", "", 1]]);
  a.tabs.set("Roster", a.tabs.get("Roster").filter((r) => r[0] !== "1002"));
  await b.cs.syncNow(); await a.cs.syncNow(); await b.cs.syncNow();
  assert.deepEqual(ids(a), ["1001", "1003"]); assert.deepEqual(ids(b), ["1001", "1003"]);
  assert.deepEqual(a.tabs.get("Attendance")[0], ["Student ID", "01/11/2026", "03/11/2026"]);
  assert.equal(a.tabs.get("Attendance").find((r) => r[0] === "1003")[2], 1);
});

test("a student present on either computer stays present; conflicts are counted", async () => {
  const sh = sharedPlace(), a = computer(sh, "laptop"), b = computer(sh, "desktop");
  a.tabs.set("Attendance", [["Student ID", "D1"], ["1001", 0]]); a.tabs.set("Roster", [["Student ID", ""], ["1001", "Ama"]]);
  await a.cs.syncNow(); await b.cs.syncNow();
  a.tabs.set("Attendance", [["Student ID", "D1"], ["1001", 1]]);
  b.tabs.set("Attendance", [["Student ID", "D1"], ["1001", ""]]);
  await a.cs.syncNow(); const r = await b.cs.syncNow(); await a.cs.syncNow();
  assert.equal(b.tabs.get("Attendance")[1][1], 1);
  assert.equal(a.tabs.get("Attendance")[1][1], 1);
  assert.equal(r.ok, true);
});

test("two computers syncing at once cannot overwrite each other: each writes only its own file", async () => {
  const sh = sharedPlace(), a = computer(sh, "laptop"), b = computer(sh, "desktop");
  a.tabs.set("Roster", [["Student ID", ""], ["1001", "Ama"]]); b.tabs.set("Roster", [["Student ID", ""], ["2002", "Yaw"]]);
  await Promise.all([a.cs.syncNow(), b.cs.syncNow()]);
  await a.cs.syncNow(); await b.cs.syncNow();
  assert.deepEqual(ids(a), ["1001", "2002"]); assert.deepEqual(ids(b), ["1001", "2002"]);
  assert.equal([...sh.files.keys()].filter((k) => /^records-.*\.cmsync$/.test(k)).length, 2);
});

test("what is stored in the place is encrypted, and a wrong passphrase changes nothing", async () => {
  const sh = sharedPlace(), a = computer(sh, "laptop");
  a.tabs.set("Roster", [["Student ID", ""], ["1001", "Ama Mensah"]]);
  await a.cs.syncNow();
  for (const [k, v] of sh.files) assert.equal(v.includes("Mensah"), false, k);
  const b = computer(sh, "desktop"); b.tabs.set("Roster", [["Student ID", ""], ["5005", "Yaw"]]);
  const r = await b.cs.syncNow("a wrong passphrase!!");
  assert.deepEqual(ids(b), ["5005"], "a file that cannot be opened is skipped, local data stay");
  assert.equal(r.ok, true); assert.ok(r.records.problems.length >= 1);
});

test("offline: the local copy carries on, and the next round catches up", async () => {
  const sh = sharedPlace(), a = computer(sh, "laptop"), b = computer(sh, "desktop");
  a.tabs.set("Roster", [["Student ID", ""], ["1001", "Ama"]]); await a.cs.syncNow(); await b.cs.syncNow();
  b.opt.online = false;
  b.tabs.set("Roster", b.tabs.get("Roster").concat([["1002", "Kofi"]]));
  const off = await b.cs.syncNow();
  assert.equal(off.ok, false); assert.match(off.why, /carries on/);
  assert.deepEqual(ids(b), ["1001", "1002"]);
  b.opt.online = true; await b.cs.syncNow(); await a.cs.syncNow();
  assert.deepEqual(ids(a), ["1001", "1002"]);
});

test("an item set to local is neither read nor written; switching loses nothing", async () => {
  const sh = sharedPlace(), a = computer(sh, "laptop", { items: { materials: "local", classList: "sync", attendance: "local" } });
  a.tabs.set("Roster", [["Student ID", ""], ["1001", "Ama"]]); a.tabs.set("Attendance", [["Student ID", "D1"], ["1001", 1]]);
  await a.cs.syncNow();
  const b = computer(sh, "desktop", { items: { materials: "local", classList: "sync", attendance: "sync" } });
  b.tabs.set("Attendance", [["Student ID", "D1"], ["1001", 0]]);
  await b.cs.syncNow();
  assert.deepEqual(ids(b), ["1001"]);
  assert.equal(b.tabs.get("Attendance")[1][1], 0, "a's attendance was never sent");
  a.cs.setItems({ classList: "local" });
  assert.deepEqual(ids(a), ["1001"]);
  assert.ok([...sh.files.keys()].some((k) => k.startsWith("records-")), "the copy in the place stays");
});

test("a computer that has not synchronised for 60 days is ignored", async () => {
  const sh = sharedPlace(); let t = Date.now();
  const a = computer(sh, "old"); a.tabs.set("Roster", [["Student ID", ""], ["1001", "Ama"]]);
  const dirA = a.dir; void dirA;
  await a.cs.syncNow();
  const b = computer(sh, "new", {});
  const real = Date.now; Date.now = () => t + 61 * 864e5;
  try { await b.cs.syncNow(); } finally { Date.now = real; }
  assert.deepEqual(ids(b), []);
});

// ---------- materials and notes ----------
test("materials and notes are read from the place; a file changed here is never overwritten", async () => {
  const sh = sharedPlace(), a = computer(sh, "laptop", { items: { notes: "sync", materials: "sync", classList: "local", attendance: "local" } });
  sh.files.set("materials/data/lectures.json", Buffer.from('{"v":1}'));
  sh.files.set("materials/lecture-1.html", Buffer.from("<p>one</p>"));
  sh.files.set("notes/week1.txt", Buffer.from("remember the demo"));
  sh.files.set("notes/../escape.txt", Buffer.from("x")); // not a real folder: must never land outside
  const r = await a.cs.syncNow();
  assert.equal(r.ok, true, r.why);
  assert.equal(fs.readFileSync(path.join(a.content, "data", "lectures.json"), "utf8"), '{"v":1}');
  assert.equal(fs.readFileSync(path.join(a.notes, "week1.txt"), "utf8"), "remember the demo");
  assert.equal(fs.existsSync(path.join(a.dir, "escape.txt")), false);
  fs.writeFileSync(path.join(a.notes, "week1.txt"), "my own edit");
  sh.files.set("notes/week1.txt", Buffer.from("changed in the cloud"));
  await a.cs.syncNow();
  assert.equal(fs.readFileSync(path.join(a.notes, "week1.txt"), "utf8"), "my own edit");
  assert.equal(fs.readFileSync(path.join(a.notes, "week1.txt.from-cloud"), "utf8"), "changed in the cloud");
});

test("files made here go up, and a second computer receives them", async () => {
  const sh = sharedPlace(), mat = { items: { notes: "sync", materials: "sync", classList: "local", attendance: "local" } };
  const a = computer(sh, "laptop", mat), b = computer(sh, "desktop", mat);
  fs.mkdirSync(a.notes, { recursive: true }); fs.writeFileSync(path.join(a.notes, "plan.txt"), "term plan");
  await a.cs.syncNow(); await b.cs.syncNow();
  assert.equal(fs.readFileSync(path.join(b.notes, "plan.txt"), "utf8"), "term plan");
});

test("changes are sent a few seconds after they are made, not on every change", async () => {
  const sh = sharedPlace(); const fired = []; let n = 0;
  const timers = { setTimeout: (f) => { fired.push(f); return { unref() {} }; }, setInterval: () => ({ unref() {} }), clearTimeout() {}, clearInterval() {} };
  const dir = tmp("cm-sync-t-");
  const linked = { linked: () => true, items: () => ({ materials: "local", classList: "sync", attendance: "local" }), passphrase: () => PASS, raw: () => { n++; return sh.make(); } };
  const cs = createCourseSync({ dir, contentDir: dir, notesDir: dir, linked, timers, vault: { encode: (s) => Buffer.from(s), decode: (b) => b.toString() }, backend: { rawRows: () => [["Student ID", ""]], setRows() {} } });
  cs.changed(); cs.changed(); cs.changed();
  assert.equal(fired.length, 1, "one send is scheduled");
  fired[0](); await new Promise((r) => setTimeout(r, 50));
  assert.equal(n, 1);
});

test("each kind of information has its own source: notes in the cloud, materials and attendance on this computer", async () => {
  const sh = sharedPlace(), a = computer(sh, "laptop", { items: { notes: "sync", materials: "local", classList: "local", attendance: "local" } });
  sh.files.set("notes/week1.txt", Buffer.from("notes"));
  sh.files.set("materials/lecture-1.html", Buffer.from("<p>x</p>"));
  a.tabs.set("Attendance", [["Student ID", "D1"], ["1001", 1]]);
  await a.cs.syncNow();
  assert.equal(fs.existsSync(path.join(a.notes, "week1.txt")), true);
  assert.equal(fs.existsSync(path.join(a.content, "lecture-1.html")), false, "materials stay as they are here");
  assert.equal([...sh.files.keys()].some((k) => k.startsWith("records-")), false, "attendance is not sent");
  assert.equal((await a.cs.state()).items.attendance, "local");
});
