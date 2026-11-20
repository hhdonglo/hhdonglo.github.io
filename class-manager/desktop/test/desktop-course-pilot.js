const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { Readable, Writable } = require("node:stream");
const Module = require("node:module");

const desktop = path.resolve(__dirname, "..");
const root = process.argv[2];
const handlers = new Map();
const appEvents = new Map();
let send, ready;
const loaded = new Promise(resolve => { ready = resolve; });
const app = {
  isPackaged: false, getPath: () => root, getVersion: () => "0.35.0", requestSingleInstanceLock: () => true,
  whenReady: () => Promise.resolve(), on: (event, fn) => appEvents.set(event, fn), quit: () => {},
};
const electron = {
  app, ipcMain: {handle: (name, fn) => handlers.set(name, fn), on() {}},
  Menu: {setApplicationMenu() {}, buildFromTemplate() {}},
  BrowserWindow: class Window {
    static getAllWindows() { return []; }
    static fromWebContents() { return null; }

    constructor() { this.webContents = { on() {}, setWindowOpenHandler() {} }; }
    removeMenu() {}
    loadURL(url) { ready(url); }
  },
  safeStorage: { isEncryptionAvailable: () => false },
  dialog: {
    showErrorBox: (title, msg) => { throw new Error(title + ": " + msg); },
    showOpenDialog: () => ({ filePaths: [path.resolve(desktop, "../course-packs/phys143/files")] })
  }
};
const real = Module._load;
Module._load = function (name, parent, ...rest) {
  if (name === "electron") return electron;
  if (name === "http" && parent.filename === path.join(desktop, "main.js")) return {
    createServer(fn) { send = fn; return {once() {}, listen(_port, _host, callback) { callback(); }, address() { return {port: 8143}; }}; }
  };
  return real.call(this, name, parent, ...rest);
};
require(path.join(desktop, "main.js"));
Module._load = real;

async function request(url, fields, ready = Promise.resolve()) {
  const req = Readable.from((async function* () {
    await ready;
    if (fields) yield Buffer.from(new URLSearchParams(fields).toString());
  })());
  req.method = fields ? "POST" : "GET";
  req.url = url;
  req.socket = {remoteAddress: "127.0.0.1"};
  req.headers = {host:"localhost:8143"};
  return new Promise(resolve => {
    let code;
    const chunks = [];
    const response = new Writable({write(chunk, _encoding, callback) { chunks.push(chunk); callback(); }});
    response.writeHead = status => { code = status; };
    response.on("finish", () => resolve({code, text: Buffer.concat(chunks).toString()}));
    send(req, response);
  });
}
function ipc(channel, id, ...args) {
  return handlers.get("cm:" + channel)({sender: {getURL: () => "http://localhost:8143/c/" + id + "/app/home.html"}}, ...args);
}
(async () => {
  const initial = new URL(await loaded).pathname.split("/")[2];
  const secret = "local demo password";
  assert.equal((await ipc("academic", initial, "overview")).locked, true);
  assert.ok((await ipc("centralCreate", initial, secret)).ok);
  const add = (preset, term) => ipc("addCourse", initial, { code: "PHYS 143", term, preset });
  assert.equal((await add("unknown", "Term 0")).ok, false);
  const a = (await add("attendance", "Term 1")).id;
  const b = (await add("attendanceQuizzes", "Term 2")).id;
  const extra = [];
  for (let i = 3; i <= 8; i++) extra.push((await add("all", "Term " + i)).id);
  assert.equal(new Set([initial, a, b, ...extra]).size, 9);
  assert.equal((await ipc("courses", a)).list.length, 9);
  assert.deepEqual((await ipc("courseModules", a)).enabled, ["attendance"]);
  assert.deepEqual((await ipc("courseModules", b)).enabled, ["attendance", "liveQuizzes"]);
  assert.equal((await ipc("info", a)).settings.semester, "Term 1");
  assert.equal((await ipc("info", b)).settings.semester, "Term 2");

  const full = extra[0], fullModules = (await ipc("courseModules", full)).enabled;
  const off = async (...ids) => assert.ok((await ipc("saveCourseModules", full, fullModules.filter(id => !ids.includes(id)))).ok);
  const page = (name) => request("/c/" + full + "/" + name);
  const content = path.join(root, "courses", full, "course");
  fs.mkdirSync(path.join(content, "data"), { recursive: true });
  fs.writeFileSync(path.join(content, "data", "lectures.json"), JSON.stringify({ groups: [{ id: "test", lectures: [{ number: 1, practice_page: "custom-exercise.html" }] }] }));
  fs.writeFileSync(path.join(content, "custom-exercise.html"), "<h1>Custom exercise</h1>");
  const pages = [
    [["calendar"], ["calendar.html", "calendar.ics"]],
    [["messaging", "announcements"], ["messages.html"]],
    [["practice"], ["mock-exam.html", "lecture-1-practice.html", "custom-exercise.html", "app/mailbox.html"]],
    [["assignments"], ["assignments.html", "group-work.html"]],
    [["groups", "assignments"], ["groups.html"]]
  ];
  for (const [modules, urls] of pages) {
    for (const url of urls) assert.equal((await page(url)).code, 200, url + " enabled");
    await off(...modules);
    for (const url of urls) assert.equal((await page(url)).code, 404, url + " disabled");
    await off();
    for (const url of urls) assert.equal((await page(url)).code, 200, url + " re-enabled");
  }
  await off("calendar");
  assert.equal((await page("CALENDAR.HTML")).code, 404);
  await off("messaging");
  assert.equal((await page("messages.html")).code, 200);
  await off("announcements");
  assert.equal((await page("messages.html")).code, 200);
  await off();

  const studentId = "20000001";
  const roster = (course, name) => ipc("rosterShotsSave", course, { rows: [{ id: studentId, name }] });
  assert.ok((await roster(a, "Alice Example")).ok);
  assert.ok((await roster(b, "Bernard Example")).ok);
  assert.ok((await roster(extra.at(-1), "Carla Example")).ok);
  assert.match((await ipc("switchCourse", a, extra.at(-1))).url, new RegExp("/c/" + extra.at(-1) + "/"));
  assert.deepEqual(await ipc("findStudents", a, "bernard"), []);
  assert.deepEqual(await ipc("findStudents", a, studentId), [{ id: studentId, name: "Alice Example" }]);
  assert.deepEqual(await ipc("findStudents", b, "BERN"), [{ id: studentId, name: "Bernard Example" }]);
  assert.deepEqual(await ipc("findStudents", extra.at(-1), studentId), [{ id: studentId, name: "Carla Example" }]);

  assert.equal((await ipc("bankFolderPick", a)).disabled, "liveQuizzes");
  assert.ok((await ipc("bankFolderPick", b)).loadable > 0);
  assert.ok((await ipc("bankFolderLoad", b)).ok);
  const call = async (id, fields) => JSON.parse((await request("/c/" + id + "/exec", fields)).text);
  const host = (id, action, extra = {}) => call(id, { action, hostkey: secret, cmCourseId: id, ...extra });
  assert.equal((await request("/c/" + a + "/quiz.html")).code, 404);
  assert.equal((await request("/c/" + b + "/quiz.html")).code, 200);
  assert.equal((await host(a, "questions")).disabled, "liveQuizzes");
  assert.match((await host(b, "attend_open", { cmCourseId: a, nogeo: "1" })).why, /different course/);
  assert.equal((await call(b, { action: "portal_status" })).attendance, "closed");
  const attendance = await host(a, "attend_open", { nogeo: "1" });
  assert.ok(attendance.ok);
  assert.ok((await call(a, { cmCourseId: a, action: "attend", id: studentId, dev: "pilot-phone-123456789", t: attendance.session.link })).ok);
  assert.equal((await host(a, "attend_status")).session.present, 1);
  assert.equal((await call(b, { action: "portal_status" })).attendance, "closed");
  assert.ok((await ipc("tab", b, "Attendance_Log") || []).length <= 1);
  const code = "26271";
  assert.ok((await host(b, "control", { act: "init", code })).ok);
  assert.ok((await host(b, "control", { act: "start", code })).ok);
  assert.match((await call(b, { cmCourseId: a, kind: "answer", id: studentId, name: "Alice Example", code, q: "1", answer: "A" })).why, /different course/);
  assert.ok((await ipc("tab", b, "Answers") || []).length <= 1);
  const answer = await request("/c/" + b + "/exec", { cmCourseId: b, kind: "answer", id: studentId, name: "Bernard Example", code, q: "1", answer: "A" });
  assert.equal(answer.text, "ok");
  assert.equal((await ipc("tab", b, "Answers")).length, 2);
  assert.equal((await call(a, { action: "portal_status" })).quiz, "none");
  const discussion = await ipc("memoryChange", a, { operation: "discussion", title: "Private pilot note", searchable: true });
  assert.equal(discussion.discussions.length, 1);
  const indexed = (await ipc("memorySearch", a, "private pilot")).results[0];
  assert.equal(indexed.id, discussion.discussions[0].id);
  assert.deepEqual((await ipc("memorySearch", b, "private pilot")).results, []);
  assert.equal((await ipc("memorySource", a, indexed)).item.discussion.title, "Private pilot note");
  assert.equal((await ipc("memorySource", b, indexed)).ok, false);
  fs.writeFileSync(path.join(root, "academic-index.cmv"), "broken local index");
  assert.ok((await ipc("memoryRefresh", a)).ok);
  assert.equal((await ipc("memorySearch", a, "private pilot")).results[0].id, indexed.id);
  assert.equal((await ipc("memory", a)).records[0].kind, "attendanceCheckIn");

  const work = (course, action, params) => ipc("academic", course, action, params);
  const overview = await work(b, "overview");
  assert.ok(overview.ok, overview.why);
  assert.equal(overview.value.cards.length, 9);
  const untrusted = await handlers.get("cm:academic")({ sender: { getURL: () => "https://external.test/c/" + b + "/app/home.html" } }, "overview");
  assert.equal(untrusted.ok, false);
  const created = await work(b, "workspace", { type: "committee", title: "Pilot committee" });
  assert.ok(created.ok, created.why);
  const workspaceId = created.value.id;
  assert.ok((await work(b, "plan", { workspaceId, kind: "goal", title: "Plan review", progress: 30 })).ok);
  const results = (await work(b, "search", { query: "private pilot" })).value.results;
  assert.equal(results.length, 1);
  assert.equal(results[0].workspaceId, a);
  assert.equal((await work(b, "source", results[0])).value.discussion.title, "Private pilot note");
  assert.deepEqual((await work(b, "search", { query: "Alice Example" })).value.results, []);
  assert.equal((await work(b, "search", { query: "Bernard" })).value.results[0].workspaceId, b);
  assert.equal((await work(b, "browse", { workspaceId })).value.plans[0].progress, 30);

  let finishBody;
  const bodyReady = new Promise(resolve => { finishBody = resolve; });
  const stale = request("/c/" + a + "/exec", { cmCourseId: a, action: "attend_close", hostkey: secret }, bodyReady);
  assert.ok((await ipc("archiveCourse", initial, a, true)).ok);
  finishBody();
  assert.match(JSON.parse((await stale).text).why, /course changed/);
  assert.equal((await ipc("findStudents", a, studentId)).ok, false);
  assert.equal((await ipc("memorySearch", a, "private pilot")).ok, false);
  assert.equal((await work(b, "source", results[0])).ok, false);
  assert.deepEqual((await work(b, "search", { query: "private pilot" })).value.results, []);
  assert.equal((await request("/c/" + a + "/exec")).code, 404);
  assert.equal((await ipc("findStudents", b, studentId))[0].name, "Bernard Example");
  appEvents.get("before-quit")?.();
})().catch(error => { console.error(error); process.exitCode = 1; });
