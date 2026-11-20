"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { createVault } = require("../vault");
const { createIndex } = require("../academic-memory/index");
const { createAcademicWork } = require("../academic-work/service");
const { openWork, workspaceTypes } = require("../academic-work/store");
const { calendarFile, meetingUrl } = require("../academic-work/plans");
const { createMail, authorize } = require("../academic-work/mail");
const { inspectFile } = require("../academic-work/documents");
const { snapshot } = require("../academic-work/course-source");
const { createBackend } = require("../backend");
const memory = require("../academic-memory/log");
const { createReminderDelivery } = require("../academic-work/ipc");
const { EventEmitter } = require("node:events");

function fixture(t, course = []) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cm-work-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const vault = createVault({ keyFile: path.join(dir, "key"), protected: true, protect: b => b, unprotect: b => b });
  const file = path.join(dir, "work.cmv");
  let now = new Date("2026-11-19T12:00:00Z");
  const open = () => openWork(file, vault, () => course, () => now);
  return { dir, vault, file, open, setNow: value => { now = new Date(value); } };
}

test("workspace types, goals, plans and due reminders survive restart and archive", t => {
  const f = fixture(t), a = f.open();
  const made = workspaceTypes.map(type => a.saveWorkspace({ type, title: type + " notes" }));
  const id = made[0].id, other = made[1].id;
  const goal = a.savePlan(id, { kind: "goal", title: "Draft thesis chapter", progress: 40 });
  const event = a.savePlan(id, {
    kind: "meeting", title: "Research, meeting", when: "2026-11-19T15:00:00+02:00",
    end: "2026-11-19T13:30:00Z", remindAt: "2026-11-19T12:30:00Z", provider: "meet",
    link: "https://meet.google.com/abc-defg-hij", notes: "Compare methods; then plan."
  });
  assert.equal(event.when, "2026-11-19T13:00:00.000Z");
  assert.throws(() => a.controlPlan(other, goal.id, true), /workspace/);
  assert.throws(() => a.savePlan(id, { kind: "event", title: "Invalid", when: "2026-02-30T13:00:00Z" }), /valid date/);
  assert.throws(() => a.savePlan(id, { kind: "task", title: "Invalid", when: event.when, remindAt: event.end }), /at or before/);
  assert.match(calendarFile(event), /SUMMARY:Research\\, meeting\r\n/);
  assert.match(calendarFile(event), /TRIGGER;VALUE=DATE-TIME:20261119T123000Z/);
  assert.equal(a.due().length, 0);
  f.setNow("2026-11-19T12:31:00Z");
  assert.equal(f.open().due()[0].id, event.id);
  assert.equal(a.markReminded(id, event.id, "2026-11-19T12:31:00Z"), false);
  assert.equal(a.markReminded(id, event.id, event.remindAt), true);
  assert.equal(f.open().due().length, 0);
  assert.equal(a.controlPlan(id, goal.id, true).progress, 100);
  assert.equal(a.overview()[0].activity[0].kind, "Plan completed");
  a.archiveWorkspace(id, true);
  assert.throws(() => f.open().plans(id), /unavailable/);
  a.archiveWorkspace(id, false);
  assert.equal(f.open().plans(id).length, 2);
  assert.ok(f.vault.isSealed(fs.readFileSync(f.file)));
  assert.equal(fs.readFileSync(f.file).includes("Draft thesis chapter"), false);
});

test("an unreadable workspace store refuses a new write and preserves the file", t => {
  const f = fixture(t), store = f.open();
  const written = Buffer.from("Damaged profile");
  fs.writeFileSync(f.file, written);
  assert.throws(() => store.saveWorkspace({ type: "personal", title: "Recovery test" }), /unsealed/);
  assert.deepEqual(fs.readFileSync(f.file), written);
});

test("cross-workspace search and link resolution recheck source approval without leaking course records", t => {
  const course = { id: "physics", code: "PHY", title: "Physics", created: "course-identity" };
  const f = fixture(t, [course]), store = f.open();
  const idx = createIndex(path.join(f.dir, "index"), f.vault);
  const courseDoc = memory.saveDiscussion({ discussions: [], documents: [] }, { title: "Approved lecture discussion", searchable: true, notes: "quantum" });
  const stored = { version: 1, discussions: [courseDoc], documents: [], links: [], tags: [] };
  const shared = createAcademicWork({ work: store, index: idx, courseRoot: () => f.dir, courseHealth: () => [],
    courseSource: () => ({ secret: () => JSON.stringify(stored), enabledModules: () => ["liveQuizzes"],
      rawRows: tab => tab === "Quiz_Control" ? [["Code"], ["SECRETJOIN", "Open", "", "", "", "", "", "", "", "", "2026-11-18"]] : [] }) });
  const a = store.saveWorkspace({ type: "research", title: "Research" });
  const b = store.saveWorkspace({ type: "personal", title: "Reading" });
  const pdf = path.join(f.dir, "reading.txt");
  fs.writeFileSync(pdf, "Local reading notes");
  const linked = shared.linkFile(b.id, pdf).memory.documents[0];
  shared.changeMemory(b.id, { operation: "discussion", title: "quantum shared", searchable: true, attachments: [linked.id] });
  shared.changeMemory(b.id, { operation: "discussion", title: "quantum private", searchable: false });
  const q = shared.search("quantum", "", course.id, () => []);
  assert.deepEqual(q.results.map(r => r.title).sort(), ["Approved lecture discussion", "quantum shared"]);
  assert.deepEqual(shared.search("quantum", b.id, course.id, () => [{ id: "1", name: "Private Student" }]).results.map(r => r.kind), ["discussion"]);
  assert.equal(shared.search("SECRETJOIN", "", course.id, () => []).results.length, 0);
  const quiz = shared.search("live quiz", "", course.id, () => []).results[0];
  assert.equal(shared.approvedSource(quiz).title, "Live quiz");
  assert.equal(shared.approvedSource(quiz).source.key, undefined);
  const target = q.results.find(r => r.workspaceId === b.id);
  const link = { operation: "link", from: { kind: "workspace", id: a.id }, to: target, relation: "supports" };
  assert.equal(shared.changeMemory(a.id, link).links[0].toTarget.title, "quantum shared");
  assert.equal(shared.allLinks().links[0].ownerId, a.id);
  assert.throws(() => shared.changeMemory(a.id, { ...link, to: { ...target, created: "wrong workspace" } }), /available target/);
  assert.deepEqual(inspectFile(shared.document(b.id, linked.id, true)), { kind: "text", title: "reading.txt", text: "Local reading notes", truncated: false });
  const own = shared.browse(b.id).memory.discussions[0];
  shared.changeMemory(b.id, { ...own, operation: "discussion", searchable: false });
  assert.throws(() => shared.approvedSource(target), /no longer available/);
  assert.throws(() => shared.document(b.id, linked.id, true), /no longer available/);
  assert.equal(shared.browse(a.id).links[0].toTarget, null);
  assert.doesNotMatch(JSON.stringify(shared.overview().activity), /quantum private/);
  fs.writeFileSync(path.join(f.dir, "index"), "broken index");
  assert.equal(shared.search("quantum", "", course.id, () => []).results.length, 1);
});

test("a closed course snapshot respects persisted modules and loads its sealed memory without services", t => {
  const f = fixture(t), workbook = path.join(f.dir, "workbook.json");
  const backend = createBackend({ dataFile: workbook, webRoot: path.join(__dirname, "../.."), vault: f.vault, log: () => {} });
  backend.setRows("Attendance_Control", [["Code"], ["ABCDE", "Nov 1", "Closed", "2026-11-01"]]);
  backend.setSecret("academic-memory", "source memory");
  backend.saveModules(["content", "analytics"]);
  backend.close();
  const file = path.join(f.dir, "course.db"), before = fs.statSync(file).mtimeMs;
  const backendView = snapshot(file, f.vault);
  assert.deepEqual(backendView.enabledModules(), ["content", "analytics"]);
  assert.equal(backendView.secret(), "source memory");
  assert.equal(backendView.rawRows("Roster").length, 0);
  assert.equal(fs.statSync(file).mtimeMs, before);
});

test("meeting launch restricts schemes and provider hosts and the reader refuses disguised files", t => {
  const f = fixture(t);
  assert.match(meetingUrl("teams"), /^https:\/\/teams\.microsoft\.com/);
  assert.equal(meetingUrl("zoom", "https://university.zoom.us/j/123"), "https://university.zoom.us/j/123");
  for (const bad of ["https://zoom.us.evil.test/j/1", "https://zoom.us@evil.test/", "http://zoom.us/", "file:///tmp/x", "https://zoom.us:4433/"]) {
    assert.throws(() => meetingUrl("zoom", bad), /HTTPS meeting link/);
  }
  const pdf = path.join(f.dir, "fake.pdf");
  fs.writeFileSync(pdf, "<script>Remote HTML</script>");
  assert.throws(() => inspectFile(pdf), /valid PDF/);
});

test("read-only mail adapters keep credentials sealed and project Gmail and Outlook bodies as text", async t => {
  const f = fixture(t), file = path.join(f.dir, "mail.cmv"), calls = [];
  const fetcher = async (url, options) => {
    calls.push({ url, options });
    const ok = value => new Response(JSON.stringify(value), { status: 200 });
    if (url.includes("/token")) return ok({ access_token: "secret-access", refresh_token: "secret-refresh", expires_in: 3600 });
    if (url.includes("labelIds")) return ok({ messages: [{ id: "abc" }] });
    if (url.includes("gmail.googleapis")) return ok({ id: "abc", payload: { mimeType: "text/html", headers: [{ name: "Subject", value: "Reading" }],
      body: { data: Buffer.from("<p>Hello</p><script>never show</script>").toString("base64url") } } });
    if (url.includes("mailFolders")) return ok({ value: [{ id: "out", subject: "Agenda", bodyPreview: "Agenda preview" }] });
    return ok({ id: "out", subject: "Agenda", body: { contentType: "text", content: "Full agenda" } });
  };
  const connect = async () => ({ code: "authorization-code", grant_type: "authorization_code" });
  const mail = createMail(file, () => f.vault, () => {}, fetcher, connect);
  await mail.connect("gmail", { clientId: "google-client", clientSecret: "desktop-client" });
  await mail.connect("outlook", { clientId: "microsoft-client" });
  assert.ok(mail.status().every(item => item.connected));
  assert.equal((await mail.list("gmail"))[0].subject, "Reading");
  assert.equal((await mail.message("gmail", "abc")).text, "Hello");
  assert.equal((await mail.list("outlook"))[0].preview, "Agenda preview");
  assert.equal((await mail.message("outlook", "out")).text, "Full agenda");
  assert.equal(calls.at(-1).options.headers.Prefer, 'outlook.body-content-type="text"');
  assert.ok(calls.filter(call => !call.url.includes("/token")).every(call => call.options.method === undefined));
  assert.ok(f.vault.isSealed(fs.readFileSync(file)));
  assert.equal(fs.readFileSync(file).includes("secret-access"), false);
  mail.disconnect("gmail");
  await assert.rejects(mail.list("gmail"), /Connect Gmail/);
});

test("OAuth callback checks state and performs an S256 desktop handoff", async () => {
  const result = await authorize({ host: "127.0.0.1", auth: "https://example.test/auth", scope: "readonly" }, { id: "client" }, async address => {
    const params = new URL(address).searchParams, redirect = params.get("redirect_uri");
    assert.equal(params.get("code_challenge_method"), "S256");
    assert.equal((await fetch(redirect + "?code=bad&state=bad")).status, 400);
    const approved = await fetch(redirect + "?" + new URLSearchParams({ code: "ok", state: params.get("state") }));
    assert.equal(approved.status, 200);
    assert.match(await approved.text(), /return to Class Manager/);
  });
  assert.equal(result.code, "ok");
  assert.ok(result.code_verifier.length >= 43);
});

test("reminder delivery is idempotent and retries a notification failure", () => {
  const pending = { id: "plan", workspaceId: "ws", remindAt: "time" };
  let attempts = 0, recorded = 0, didOpen = false, ready = false;
  class Notice extends EventEmitter {
    static isSupported() { return true; }
    show() { attempts++; this.emit(attempts === 1 ? "failed" : "show"); if (attempts === 2) this.emit("click"); }
  }
  const work = { due: () => recorded ? [] : [pending], markReminded: (...args) => {
    assert.deepEqual(args, ["ws", "plan", "time"]); recorded++;
  } };
  const deliver = createReminderDelivery(() => work, Notice, () => ready, () => { didOpen = true; }, assert.fail);
  deliver(); assert.equal(attempts, 0);
  ready = true;
  deliver(); deliver(); deliver();
  assert.equal(attempts, 2);
  assert.equal(recorded, 1);
  assert.equal(didOpen, true);
});
