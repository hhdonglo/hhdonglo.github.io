/* Many courses in one app: run with `npm test` in class-manager/desktop (Node 20 or later, no Electron needed).
   - The single-course layout of 0.7.0 moves into the first course with every record intact.
   - The registry adds, renames, archives and routes courses.
   - Two courses never see each other's records: class list, access codes, attendance, host key, results,
     course content, Google Sheet, and the browser storage of the pages. */
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const vm = require("vm");
const { createBackend } = require("../backend");
const { createCourse } = require("../course");
const C = require("../courses");

const WEB = path.resolve(__dirname, "..", "..");
const TPL = path.join(WEB, "templates");
const tmp = (p) => fs.mkdtempSync(path.join(os.tmpdir(), p));
const json = (out) => JSON.parse(out.text);

// A course as the app makes it: its own workbook and content folder, from the registry's folders.
function open(reg, id) {
  const d = reg.dirs(id);
  const course = createCourse({ dir: d.course, web: WEB, templates: TPL });
  const backend = createBackend({ webRoot: WEB, resolve: course.resolve, dataFile: d.workbook, log: () => {} });
  return { id, course, backend, key: backend.hostKey() };
}

test("the 0.7.0 single-course layout becomes the first course, with nothing lost", () => {
  const root = tmp("cm-mig-");
  // The old layout: settings.json with app and course settings together, data/, course/, authoring/.
  fs.writeFileSync(path.join(root, "settings.json"), JSON.stringify({ courseCode: "PHYS 143", courseTitle: "Physics for Life Sciences", semester: "Sem 1", scriptUrl: "", setupSeen: true, port: 9001, zoom: 1.25 }));
  const old = createBackend({ webRoot: WEB, dataFile: path.join(root, "data", "workbook.json"), log: () => {} });
  old.rosterSync([["10000001", "Ama"], ["10000002", "Kofi"]], false);
  const oldKey = old.hostKey();
  old.flush();
  fs.mkdirSync(path.join(root, "course", "data"), { recursive: true });
  fs.writeFileSync(path.join(root, "course", "data", "lectures.json"), JSON.stringify({ groups: [{ id: "lectures", title: "Lectures", lectures: [{ number: 1, title: "Units" }] }] }));
  fs.mkdirSync(path.join(root, "authoring"), { recursive: true });
  fs.writeFileSync(path.join(root, "authoring", "library.json"), "{}");
  fs.writeFileSync(path.join(root, "anthropic.bin"), "k");

  const r = C.migrateLegacy(root);
  assert.equal(r.migrated, "phys-143");
  const reg = C.createRegistry(root);
  assert.deepEqual(reg.list().map((c) => [c.id, c.code, c.title, c.term]), [["phys-143", "PHYS 143", "Physics for Life Sciences", "Sem 1"]]);
  assert.equal(reg.active(), "phys-143");
  assert.equal(reg.defaultId(), "phys-143");
  // App settings stay with the app; course settings go to the course.
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(root, "settings.json"), "utf8")), { port: 9001, zoom: 1.25 });
  const cs = JSON.parse(fs.readFileSync(path.join(root, "courses", "phys-143", "settings.json"), "utf8"));
  assert.equal(cs.courseCode, "PHYS 143"); assert.equal(cs.setupSeen, true); assert.equal(cs.port, undefined);
  // Folders moved, not copied; files the app keeps for itself stay where they were.
  for (const d of ["data", "course", "authoring"]) { assert.ok(!fs.existsSync(path.join(root, d)), d + " moved"); assert.ok(fs.existsSync(path.join(root, "courses", "phys-143", d)), d + " arrived"); }
  assert.ok(fs.existsSync(path.join(root, "anthropic.bin")));
  // The records and the host key are the same as before.
  const c = open(reg, "phys-143");
  assert.equal(c.key, oldKey);
  assert.deepEqual(c.backend.tab("Roster").slice(1).map((x) => x[0]), ["10000001", "10000002"]);
  assert.equal(c.course.lectures()[0].title, "Units");
  // A second start changes nothing.
  assert.equal(C.migrateLegacy(root).migrated, null);
});

test("a migration that stopped half way finishes at the next start", () => {
  const root = tmp("cm-mig2-");
  fs.writeFileSync(path.join(root, "settings.json"), JSON.stringify({ courseCode: "CHEM 1", port: 8143 }));
  fs.mkdirSync(path.join(root, "data")); fs.writeFileSync(path.join(root, "data", "workbook.json"), '{"sheets":[],"props":{}}');
  fs.mkdirSync(path.join(root, "authoring"));
  // Interrupted: the course folder and data were moved, the registry was never written.
  fs.mkdirSync(path.join(root, "courses", "chem-1"), { recursive: true });
  fs.renameSync(path.join(root, "data"), path.join(root, "courses", "chem-1", "data"));
  assert.equal(C.migrateLegacy(root).migrated, "chem-1");
  assert.ok(fs.existsSync(path.join(root, "courses", "chem-1", "data", "workbook.json")));
  assert.ok(fs.existsSync(path.join(root, "courses", "chem-1", "authoring")));
});

test("a new installation has nothing to migrate and starts with one empty course", () => {
  const root = tmp("cm-new-");
  assert.equal(C.migrateLegacy(root).migrated, null);
  const reg = C.createRegistry(root);
  const id = reg.ensureOne();
  assert.equal(reg.list().length, 1);
  assert.equal(reg.active(), id);
});

test("courses are added, renamed and archived; their addresses stay the same", () => {
  const reg = C.createRegistry(tmp("cm-reg-"));
  const a = reg.add({ code: "PHYS 143", title: "Physics" });
  const b = reg.add({ code: "PHYS 143", title: "Physics, second group" });
  const m = reg.add({ code: "MATH 101" });
  assert.equal(a.id, "phys-143"); assert.equal(b.id, "phys-143-2"); assert.equal(m.id, "math-101");
  reg.update(m.id, { code: "MATH 102", title: "Calculus" });
  assert.equal(reg.get(m.id).code, "MATH 102");
  assert.equal(reg.get(m.id).id, "math-101", "the id, and so every link to the course, does not change on rename");

  assert.deepEqual(reg.route("/c/math-101/quiz.html"), { id: "math-101", rest: "/quiz.html", prefixed: true, prefix: "/c/math-101/" });
  assert.equal(reg.route("/quiz.html").id, "phys-143", "addresses without a course go to the default course");
  assert.deepEqual(reg.route("/c/math-101"), { redirect: "/c/math-101/" });
  assert.ok(reg.route("/c/nope/index.html").notFound);
  assert.ok(reg.route("/c/../settings.json").notFound);
  assert.ok(reg.route("/c/MATH-101/").notFound);
  assert.equal(reg.idFromUrl("http://127.0.0.1:8143/c/phys-143-2/app/home.html"), "phys-143-2");

  assert.ok(reg.setActive(m.id)); assert.equal(reg.active(), m.id);
  assert.ok(reg.setArchived(m.id, true).ok);
  assert.ok(reg.route("/c/math-101/index.html").notFound, "an archived course is not served");
  assert.notEqual(reg.active(), m.id, "archiving the shown course shows another");
  assert.equal(reg.setActive(m.id), false);
  assert.ok(reg.setArchived(m.id, false).ok);
  reg.setArchived(b.id, true);
  assert.equal(reg.setArchived(a.id, true).ok, true);
  assert.equal(reg.setArchived(m.id, true).ok, false, "the last open course cannot be archived");
});

test("each course can point to its own folder, and two courses cannot share one", () => {
  const root = tmp("cm-link-");
  const reg = C.createRegistry(root);
  const a = reg.add({ code: "A 1" }), b = reg.add({ code: "B 1" });
  const folder = tmp("cm-repo-");
  reg.setSource(a.id, { kind: "folder", path: folder });
  assert.equal(reg.dirs(a.id).course, path.resolve(folder));
  assert.ok(reg.dirs(a.id).linked);
  assert.equal(reg.dirs(b.id).course, path.join(root, "courses", b.id, "course"));
  // Student records stay in the app's folder even when the content is linked.
  assert.equal(reg.dirs(a.id).workbook, path.join(root, "courses", a.id, "data", "workbook.json"));
  assert.throws(() => reg.setSource(b.id, { kind: "folder", path: path.join(root, "courses", a.id) }));
  reg.setSource(a.id, { kind: "app" });
  assert.equal(reg.dirs(a.id).linked, false);
});

test("two courses never see each other's records", () => {
  const reg = C.createRegistry(tmp("cm-two-"));
  reg.add({ code: "PHYS 143" }); reg.add({ code: "MATH 101" });
  const A = open(reg, "phys-143"), B = open(reg, "math-101");
  const shared = "20001234"; // a student who takes both courses

  A.backend.rosterSync([[shared, "Esi"], ["20005678", "Yaw"]], false);
  B.backend.rosterSync([[shared, "Esi"]], false);
  assert.deepEqual(A.backend.tab("Roster").slice(1).map((r) => r[0]).sort(), [shared, "20005678"]);
  assert.deepEqual(B.backend.tab("Roster").slice(1).map((r) => r[0]), [shared], "B's class list holds only B's students");

  // Host keys are separate: A's key does nothing in B.
  assert.notEqual(A.key, B.key);
  assert.equal(json(B.backend.doPost({ action: "hostcheck", hostkey: A.key })).ok, false);
  assert.equal(json(B.backend.doPost({ action: "hostcheck", hostkey: B.key })).ok, true);

  // Access codes are separate: the same student has a different code in each course, and A's code opens nothing in B.
  const codeA = json(A.backend.doPost({ action: "access_codes", op: "generate", hostkey: A.key })).rows.find((r) => r.id === shared).code;
  const codeB = json(B.backend.doPost({ action: "access_codes", op: "generate", hostkey: B.key })).rows.find((r) => r.id === shared).code;
  assert.ok(codeA && codeB); assert.notEqual(codeA, codeB);
  assert.equal(json(A.backend.doPost({ action: "my_results", id: shared, code: codeA })).ok, true);
  assert.notEqual(json(B.backend.doPost({ action: "my_results", id: shared, code: codeA })).ok, true, "A's code is refused by B");

  // Attendance opened in A is not open in B.
  const opened = json(A.backend.doPost({ action: "attend_open", hostkey: A.key, label: "Week 1" }));
  assert.equal(opened.ok, true, JSON.stringify(opened));
  assert.equal(json(A.backend.doPost({ action: "attend_status", hostkey: A.key })).session.status, "Open");
  const sb = json(B.backend.doPost({ action: "attend_status", hostkey: B.key }));
  assert.ok(!sb.session || sb.session.status !== "Open", "B has no open attendance");

  // The student lookup and the class statistics of B know nothing of A's other student.
  assert.equal(A.backend.studentStats({ id: "20005678" }).ok, true);
  assert.equal(B.backend.studentStats({ id: "20005678" }).ok, false, "B's lookup does not find A's student");
  assert.deepEqual(Array.from(B.backend.stats({}).students, (x) => x.id), [shared]);
  assert.deepEqual(Array.from(A.backend.stats({}).students, (x) => x.id).sort(), [shared, "20005678"]);

  // The workbooks are different files, and B's file holds no trace of A's student.
  assert.notEqual(reg.dirs("phys-143").workbook, reg.dirs("math-101").workbook);
  A.backend.flush(); B.backend.flush();
  assert.ok(!fs.readFileSync(reg.dirs("math-101").workbook, "utf8").includes("20005678"));
  assert.ok(!fs.readFileSync(reg.dirs("math-101").workbook, "utf8").includes(codeA));

  // Course content is separate: a lecture added to A is not a lecture of B.
  A.course.saveLecture({ number: 3, title: "Energy" });
  assert.equal(A.course.lectures().length, 1);
  assert.equal(B.course.lectures().length, 0);
  assert.equal(B.course.portal().lectures["3"], undefined);
});

test("one Google sign-in, one Google Sheet per course", () => {
  // The token file of 0.7.0 held one sheet: it becomes the sheet of the migrated course.
  let all = C.migrateTokens({ refresh: "r1", email: "me@example.org", sheetId: "S-OLD", sheetUrl: "u-old" }, "phys-143");
  assert.deepEqual(C.courseTokens(all, "phys-143"), { refresh: "r1", email: "me@example.org", sheetId: "S-OLD", sheetUrl: "u-old" });
  assert.equal(C.courseTokens(all, "math-101").sheetId, "", "a new course gets its own sheet");
  all = C.storeCourseTokens(all, "math-101", { refresh: "r1", email: "me@example.org", sheetId: "S-MATH", sheetUrl: "u-math" });
  assert.equal(C.courseTokens(all, "math-101").sheetId, "S-MATH");
  assert.equal(C.courseTokens(all, "phys-143").sheetId, "S-OLD", "saving one course's sheet leaves the other's");
  all = C.storeCourseTokens(all, "phys-143", {}); // sign-out from any course signs the app out
  assert.equal(C.courseTokens(all, "math-101").refresh, undefined);
  assert.equal(C.courseTokens(all, "math-101").sheetId, "S-MATH", "the sheets are remembered for the next sign-in");
});

test("pages of two courses keep separate browser storage", () => {
  const src = fs.readFileSync(path.join(WEB, "config.js"), "utf8");
  function page(prefix, store) { // runs config.js in a fake window and returns that window
    function Storage() {}
    Storage.prototype.getItem = function (k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; };
    Storage.prototype.setItem = function (k, v) { store[k] = String(v); };
    Storage.prototype.removeItem = function (k) { delete store[k]; };
    const ls = new Storage();
    const doc = { documentElement: { style: { setProperty() {} } }, querySelectorAll: () => [], addEventListener() {}, readyState: "complete", title: "Page" };
    const w = { Storage, localStorage: ls, sessionStorage: new Storage(), document: doc, location: { href: "http://x/" }, addEventListener() {} };
    w.window = w;
    vm.runInNewContext(C.configScript(src, { courseId: "x", courseCode: "X" }, prefix), w);
    return w;
  }
  const store = {}; // one phone: one storage for the whole address
  const def = page("", store), other = page("cm@math-101:", store);
  def.localStorage.setItem("cm_portal_id", "20001234");
  assert.equal(other.localStorage.getItem("cm_portal_id"), null, "another course does not read the default course's remembered ID");
  other.localStorage.setItem("cm_portal_code", "ABCD-EFGH");
  assert.equal(def.localStorage.getItem("cm_portal_code"), null);
  assert.equal(other.localStorage.getItem("cm_portal_code"), "ABCD-EFGH");
  assert.deepEqual(Object.keys(store).sort(), ["cm@math-101:cm_portal_code", "cm_portal_id"]);
  assert.equal(other.CM.courseId, "x");
});
