"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { DatabaseSync } = require("node:sqlite");
const { classroom } = require("./classroom");
const { defaultModules, modules } = require("../module-registry");
const access = require("../module-access");
const settings = require("../course-module-settings");

const calendarEvent = { op: "save", title: "Lab tutorial", start: "2030-02-04T10:00", kind: "tutorial" };
const attempt = { kind: "attempt", id: "20000001", quiz: "Lecture 1", score: "4", total: "5", asked: "L1Q1", wrong: "" };

function fixture(t, engine = "js") {
  const cm = classroom({ students: 4, engine });
  t.after(() => { cm.backend.close(); fs.rmSync(cm.dir, { recursive: true, force: true }); });
  return cm;
}

const scenarios = [
  {
    id: "calendar", tables: ["Calendar"],
    seed: c => c.host("calendar_edit", calendarEvent),
    read: c => c.call({ action: "calendar" }),
    write: c => c.host("calendar_edit", { ...calendarEvent, title: "Blocked tutorial" }),
    check: result => assert.ok(result.events.some(item => item.title === "Lab tutorial" && item.kind === "tutorial"))
  },
  {
    id: "messaging", tables: ["Messages", "Chat_Groups", "Chat_Read"],
    seed: c => c.host("chat", { op: "send", conv: "CLASS", text: "Welcome to the lab" }),
    read: c => c.host("chat", { conv: "CLASS" }),
    write: c => c.host("chat", { op: "send", conv: "CLASS", text: "Blocked message" }),
    check: result => assert.ok(result.messages.some(item => item.text === "Welcome to the lab"))
  },
  {
    id: "announcements", tables: ["Announcements", "Chat_Read"],
    seed: c => c.host("announcements", { op: "save", title: "Lab notice", text: "Read the worksheet", pinned: "yes", audience: "all" }),
    read: c => c.call({ action: "announcements" }),
    write: c => c.host("announcements", { op: "save", title: "Blocked notice" }),
    check: result => assert.ok(result.announcements.some(item => item.title === "Lab notice" && item.pinned))
  },
  {
    id: "practice", tables: ["Attempts", "Reports"],
    seed: c => { assert.equal(c.call(attempt), "ok"); return c.call({ kind: "report", question: "Example", comment: "Check wording" }); },
    read: c => c.call({ action: "my_results", id: c.students[0].id, code: c.codes[c.students[0].id] }),
    write: c => c.call(attempt),
    check: result => assert.equal(result.practice[0].attempts, 1)
  },
  {
    id: "groups", remove: ["groups", "assignments"], tables: ["Groups"],
    seed: c => c.host("groups", { op: "make", set: "Lab", size: "2" }),
    read: c => c.host("groups", { op: "list", set: "Lab" }),
    write: c => c.host("groups", { op: "delete", set: "Lab" }),
    check: result => assert.equal(result.groups.flatMap(group => group.members).length, 4)
  },
  {
    id: "assignments", tables: ["Assignments", "Group_Work", "Assignment_Marks"],
    seed: c => {
      assert.ok(c.host("groups", { op: "make", set: "Lab", size: "2" }).ok);
      const saved = c.host("assignments", { op: "save", set: "Lab", title: "Lab report", groups: "all", due: "2030-02-05", outof: "10" });
      assert.ok(saved.saved);
      const student = c.students[0];
      const submission = c.call({ action: "group_work", id: student.id, access: c.codes[student.id], op: "submit", aid: saved.saved, text: "Example answer" });
      assert.ok(submission.ok);
      return c.host("assignments", { op: "mark", id: saved.saved, group: "1", mark: "9" });
    },
    read: c => c.host("assignments", { op: "list" }),
    write: c => c.host("assignments", { op: "save", set: "Lab", title: "Blocked assignment" }),
    check: result => assert.ok(result.assignments.some(item => item.title === "Lab report"))
  }
];

for (const scenario of scenarios) {
  test(scenario.id + " works after migration and preserves data across disable, restart and re-enable", async t => {
    const cm = fixture(t);
    const seeded = scenario.seed(cm);
    assert.ok(seeded === "ok" || seeded.ok);
    const before = scenario.tables.map(table => cm.backend.rawRows(table));
    const legacy = new DatabaseSync(path.join(cm.dir, "course.db"));
    try { legacy.exec("DROP TABLE course_modules"); } finally { legacy.close(); }
    cm.reopen();
    assert.deepEqual(cm.backend.enabledModules(), defaultModules());
    scenario.check(scenario.read(cm));
    const disabled = defaultModules().filter(id => !(scenario.remove || [scenario.id]).includes(id));
    assert.ok((await settings.save(cm, disabled)).ok);
    cm.reopen();
    for (const page of modules[scenario.id].pages) assert.ok(access.browserAccess(disabled).disabledPages.includes(page));
    const read = scenario.read(cm);
    if (scenario.id === "practice") {
      assert.ok(read.ok);
      assert.deepEqual(read.practice, []);
      assert.deepEqual(read.mastery, []);
    } else assert.equal(read.disabled, scenario.id);
    assert.equal(scenario.write(cm).disabled, scenario.id);
    if (scenario.id === "assignments") {
      assert.equal(cm.call({ action: "group_work", id: cm.students[0].id, access: cm.codes[cm.students[0].id] }).disabled, "assignments");
      assert.ok(cm.host("groups_display", { set: "Lab" }).groups.every(group => !group.tasks.length));
    }
    if (scenario.id === "calendar") assert.equal(cm.get({ action: "calendar_ics" }).disabled, "calendar");
    assert.deepEqual(scenario.tables.map(table => cm.backend.rawRows(table)), before);
    assert.ok((await settings.save(cm, defaultModules())).ok);
    cm.reopen();
    scenario.check(scenario.read(cm));
    assert.deepEqual(scenario.tables.map(table => cm.backend.rawRows(table)), before);
  });
}

test("Calendar can be hidden while announcements retain their original audience and event link", async t => {
  const cm = fixture(t);
  const calendar = cm.host("calendar_edit", calendarEvent);
  const event = calendar.events.find(item => item.title === calendarEvent.title).id;
  const audience = "L:Lab|1";
  const notice = cm.host("announcements", { op: "save", title: "Restricted notice", audience, event }).announcements[0];
  assert.equal(notice.event.id, event);
  assert.ok((await settings.save(cm, defaultModules().filter(id => id !== "calendar" && id !== "messaging"))).ok);
  assert.equal(cm.host("chat", {}).disabled, "messaging");
  assert.ok(!access.browserAccess(cm.backend.enabledModules()).disabledPages.includes("messages.html"));
  const edited = cm.host("announcements", { op: "save", ann: notice.id, title: "Edited", audience }).announcements[0];
  assert.equal(edited.event, undefined);
  assert.equal(edited.audience, audience);
  assert.equal(cm.call({ action: "announcements" }).announcements.length, 0);
  assert.ok((await settings.save(cm, defaultModules())).ok);
  assert.equal(cm.host("announcements", {}).announcements[0].event.id, event);
});

test("typed calendar edits stay in Calendar using either desktop rules engine", async t => {
  const cm = fixture(t, "script");
  assert.ok((await settings.save(cm, defaultModules().filter(id => id !== "practice"))).ok);
  assert.ok(cm.host("calendar_edit", calendarEvent).ok);
  cm.host("calendar_edit", { ...calendarEvent, kind: "attempt", id: "20000001" });
  assert.ok((cm.backend.rawRows("Attempts") || []).length <= 1);
});

test("Messaging and Announcements independently control their shared page", () => {
  for (const id of ["messaging", "announcements"]) assert.equal(access.pageModule("messages.html", [id]), id);
  assert.ok(access.browserAccess([]).disabledPages.includes("messages.html"));
});

test("shared browser navigation hides disabled course links while leaving other courses available", () => {
  const { runInNewContext } = require("node:vm");
  const { configScript } = require("../courses");
  const document = {
    readyState: "loading",
    addEventListener() {},
    querySelectorAll() { return []; }
  };
  const window = {}, location = { href: "http://localhost/c/course-a/course.html" };
  const links = ["calendar.html#upcoming", "messages.html", "course.html#weekly", "lecture-1-practice.html",
    "assignments.html", "course.html", "/c/course-b/calendar.html", "https://elsewhere.example/calendar.html"];
  const disabled = defaultModules().filter(id => !["calendar", "messaging", "announcements", "practice", "assignments"].includes(id));
  const source = fs.readFileSync(path.join(__dirname, "../../config.js"), "utf8");
  const nodes = links.map(href => ({ getAttribute: () => href, style: {} }));
  runInNewContext(configScript(source, { modules: disabled, ...access.browserAccess(disabled) }, ""),
    { window, document, location, URL });
  window.CM.hideDisabledNavigation({ querySelectorAll: () => nodes });
  assert.deepEqual(nodes.map(node => node.style.display === "none"), [true, true, true, true, true, false, false, false]);
});
