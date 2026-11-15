/* LMS connector: run with `npm test` in class-manager/desktop (no Electron, no network).
   - Roster files from LMS exports are read by student ID; repeats and bad rows are counted, never added twice.
   - The plan never removes anyone and never overwrites a name.
   - The gradebook file holds only IDs and points, leaves empty cells for no score, and follows each LMS layout.
   - Signed tokens verify; the LMS services are exercised against a mock LMS, and nothing but ids and points is sent.
   - With the connection off, no service is called. */
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { readRoster } = require("../lms/roster-read");
const { planRoster } = require("../lms/roster-plan");
const { listAssessments } = require("../lms/assessments");
const { buildGradebook } = require("../lms/gradebook");
const keys = require("../lms/keys");
const jwt = require("../lms/jwt");
const config = require("../lms/config");
const { getToken, SCOPES } = require("../lms/token");
const { fetchMembers } = require("../lms/members");
const { pushGrades } = require("../lms/push-grades");
const { toolConfig } = require("../lms/tool-config");
const profiles = require("../lms/profiles");

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), "cm-lms-"));
const MASTER = [["Student ID", "Name", "Last updated", "Week 1", "Practice 1"],
  ["10000001", "Ama Mensah", "", "7 / 10", ""], ["10000002", "Kofi Boateng", "", "9 / 10", "4 / 5"], ["10000003", "Esi Owusu", "", "", ""]];

test("a Canvas roster is read by SIS ID; repeats and rows without an ID are counted", () => {
  const rows = [["Student", "ID", "SIS User ID"], ["Mensah, Ama", "1", "10000001"], ["Boateng, Kofi", "2", "10000002"], ["Again", "3", "10000001"], ["Nobody", "4", ""]];
  const r = readRoster(rows, { profile: "canvas" });
  assert.deepEqual(r.students.map((s) => s.id), ["10000001", "10000002"]);
  assert.equal(r.skipped, 1); assert.deepEqual(r.repeats, ["10000001"]);
});

test("a Brightspace roster joins first and last name; a missing ID column asks the lecturer to choose", () => {
  const r = readRoster([["OrgDefinedId", "First Name", "Last Name"], ["10000005", "Yaw", "Asare"]], { profile: "brightspace" });
  assert.equal(r.students[0].name, "Yaw Asare");
  assert.match(readRoster([["Foo", "Bar"], ["1", "2"]], { profile: "canvas" }).problem, /ID column/);
  assert.equal(readRoster([["Foo", "Bar"], ["10000009", "x"]], { profile: "canvas", idColumn: 0 }).students[0].id, "10000009");
});

test("the plan adds only what is missing, keeps names, and never removes", () => {
  const cm = [["Student ID", "Name"], ["10000001", "Ama Mensah"], ["10000009", "Only in CM"]];
  const p = planRoster([{ id: "10000001", name: "Ama M." }, { id: "10000002", name: "Kofi" }], cm);
  assert.deepEqual(p.toAdd.map((s) => s.id), ["10000002"]);
  assert.equal(p.nameDiffers.length, 1); assert.deepEqual(p.notInLms, ["10000009"]);
});

test("assessments are read from Master with how many students have a score", () => {
  const a = listAssessments(MASTER);
  assert.deepEqual(a.map((x) => [x.name, x.scored, x.outOf]), [["Week 1", 2, 10], ["Practice 1", 1, 5]]);
});

test("the gradebook file has IDs and points only, an empty cell for no score, and skips students with none", () => {
  const g = buildGradebook(MASTER, [3, 4], "blackboard");
  assert.equal(g.csv, "Username,Week 1,Practice 1\r\n10000001,7,\r\n10000002,9,4\r\n");
  assert.equal(g.noScores, 1); assert.ok(!/Ama|Kofi/.test(g.csv));
  const d = buildGradebook(MASTER, [3], "brightspace").csv.split("\r\n");
  assert.equal(d[0], "OrgDefinedId,Week 1 Points Grade,End-of-Line Indicator"); assert.equal(d[1], "10000001,7,#");
});

test("every profile has the fields the readers and writers use", () => {
  profiles.ids().forEach((id) => { const p = profiles.get(id); assert.ok(p.label && p.idColumns.length && p.gradebook.idHeader && p.gradebook.columnName("X")); });
});

test("a signed token verifies, and fails with another key or after it expires", () => {
  const k = keys.makeKey(), other = keys.makeKey();
  const t = jwt.sign({ iss: "x", exp: 2000 }, k);
  const pub = require("crypto").createPublicKey(k.privatePem);
  assert.equal(jwt.verify(t, pub, 1000).iss, "x");
  assert.equal(jwt.verify(t, pub, 3000), null);
  assert.equal(jwt.verify(t, require("crypto").createPublicKey(other.privatePem), 1000), null);
  assert.equal(keys.jwks(k).keys[0].kid, k.kid); assert.equal(keys.jwks(k).keys[0].d, undefined, "the private part never leaves");
});

test("the key is made once and kept in the course folder", () => {
  const d = tmp(), a = keys.loadKey(d), b = keys.loadKey(d);
  assert.equal(a.kid, b.kid);
});

test("settings are off by default and keep only https addresses", () => {
  const d = tmp();
  assert.equal(config.load(d).enabled, false);
  const c = config.save(d, { enabled: true, clientId: "abc", tokenUrl: "http://x.test/t", membersUrl: "https://x.test/m" });
  assert.equal(c.tokenUrl, ""); assert.equal(c.membersUrl, "https://x.test/m");
  assert.ok(config.missing(c, "members").some((m) => /token/i.test(m)));
  assert.ok(config.missing(config.clean({}), "members")[0].match(/Switch on/));
});

// ---- a mock LMS ----
function mockLms() {
  const log = [], items = [];
  const res = (body, ok = true, headers = {}) => ({ ok, status: ok ? 200 : 400, json: async () => body, headers: { get: (h) => headers[h.toLowerCase()] || "" } });
  const fetchFn = async (url, init) => {
    init = init || {}; log.push({ url, method: init.method || "GET", body: init.body });
    if (url.endsWith("/token")) return res({ access_token: "T" });
    if (url.includes("/members") && !url.includes("page=2")) return res({ members: [
      { user_id: "u1", roles: ["http://purl.imsglobal.org/vocab/lis/v2/membership#Learner"], lis_person_sourcedid: "10000001", given_name: "Ama", family_name: "Mensah" },
      { user_id: "u9", roles: ["http://purl.imsglobal.org/vocab/lis/v2/membership#Instructor"], lis_person_sourcedid: "10000099" }] }, true, { link: '<https://lms.test/members?page=2>; rel="next"' });
    if (url.includes("page=2")) return res({ members: [{ user_id: "u2", roles: ["Learner"], lis_person_sourcedid: "10000002" }, { user_id: "u3", roles: ["Learner"] }] });
    if (url.includes("/line_items") && !url.includes("/scores") && (init.method || "GET") === "GET") return res(items);
    if (url.includes("/line_items") && init.method === "POST" && !url.includes("/scores")) { const b = JSON.parse(init.body); const it = { id: "https://lms.test/line_items/" + (items.length + 1), resourceId: b.resourceId }; items.push(it); return res(it); }
    if (url.includes("/scores")) return res({});
    return res({}, false);
  };
  return { fetchFn, log };
}
const CFG = { enabled: true, clientId: "cid", tokenUrl: "https://lms.test/token", membersUrl: "https://lms.test/members", lineItemsUrl: "https://lms.test/line_items" };

test("the token request carries a signed assertion for this client and scopes", async () => {
  const m = mockLms(), k = keys.makeKey();
  assert.equal(await getToken(CFG, k, [SCOPES.members], m.fetchFn, 1e6), "T");
  const form = new URLSearchParams(m.log[0].body), claims = jwt.verify(form.get("client_assertion"), require("crypto").createPublicKey(k.privatePem), 1000);
  assert.equal(claims.iss, "cid"); assert.equal(claims.aud, CFG.tokenUrl); assert.equal(form.get("scope"), SCOPES.members);
});

test("the roster from the LMS follows pages, keeps learners only and counts those it cannot match", async () => {
  const m = mockLms(), r = await fetchMembers(CFG.membersUrl, "T", m.fetchFn);
  assert.deepEqual(r.students.map((s) => s.id), ["10000001", "10000002"]); assert.equal(r.unmatched, 1);
});

test("grades go to the LMS as ids and points; no names; no scores means no send; a dry run changes nothing", async () => {
  const m = mockLms(), members = (await fetchMembers(CFG.membersUrl, "T", m.fetchFn)).students;
  const dry = await pushGrades({ master: MASTER, columns: [3], members, cfg: CFG, token: "T", fetchFn: m.fetchFn, dryRun: true });
  assert.equal(dry.assessments[0].would, 2); assert.ok(!m.log.some((l) => l.method === "POST"));
  const run = await pushGrades({ master: MASTER, columns: [3, 4], members, cfg: CFG, token: "T", fetchFn: m.fetchFn });
  assert.deepEqual(run.assessments.map((a) => [a.name, a.sent, a.failed]), [["Week 1", 2, 0], ["Practice 1", 1, 0]]);
  const sent = m.log.filter((l) => /\/scores/.test(l.url)).map((l) => JSON.parse(l.body));
  sent.forEach((s) => assert.deepEqual(Object.keys(s).sort(), ["activityProgress", "gradingProgress", "scoreGiven", "scoreMaximum", "timestamp", "userId"]));
  assert.equal(sent.length, 3);
  const again = await pushGrades({ master: MASTER, columns: [3], members, cfg: CFG, token: "T", fetchFn: m.fetchFn });
  assert.equal(again.assessments[0].sent, 2); assert.equal(m.log.filter((l) => l.method === "POST" && /line_items$/.test(l.url)).length, 2, "the column is found again, not made twice");
});

test("a student with scores who is not in the LMS roster is reported, not sent", async () => {
  const m = mockLms(), r = await pushGrades({ master: MASTER, columns: [3], members: [{ id: "10000001", userId: "u1" }], cfg: CFG, token: "T", fetchFn: m.fetchFn });
  assert.deepEqual(r.notInLms, ["10000002"]);
});

test("the registration file carries the public key and the services, never the private key", () => {
  const k = keys.makeKey(), t = toolConfig(k);
  assert.equal(t.public_jwk.kid, k.kid); assert.equal(t.public_jwk.d, undefined); assert.ok(!JSON.stringify(t).includes("PRIVATE"));
  assert.equal(t.scopes.length, 3);
});

test("with the connection off, the service handlers refuse and nothing is fetched", async () => {
  const handlers = {}, calls = [], d = tmp();
  require("../lms/ipc").register({ on: (ch, fn) => { handlers[ch] = fn; }, dialog: {}, winOf: () => null, shell: {}, dirOf: () => d, fetchFn: async (u) => { calls.push(u); return { ok: true, json: async () => ({}) }; } });
  const c = { id: "x", backend: { rawRows: () => MASTER } };
  assert.match((await handlers["cm:lmsRosterService"](c, {})).why, /Switch on/);
  assert.match((await handlers["cm:lmsGradesService"](c, {}, { columns: [3] })).why, /Switch on/);
  assert.equal(calls.length, 0);
});
