/* rules/groups.js and rules/assignments.js make groups and group assignments as the Apps Script does (groups_display and group_work included). */
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { classroom } = require("./classroom");
const G = require("../rules/groups");
const AS = require("../rules/assignments");
const A = require("../rules/auth");
const { fromBackend } = require("../rules/store");

const WEB = path.resolve(__dirname, "..", ".."), PACK = path.join(WEB, "course-packs", "phys143", "files");
const site = (p) => { const a = path.join(PACK, p); return JSON.parse(fs.readFileSync(fs.existsSync(a) ? a : path.join(WEB, p), "utf8")); };
const tab = (c, name) => { const b = JSON.parse(c.backend.exportText()).sheets.find((s) => s.name === name); return b ? b.rows : []; };
const T = (v) => ((typeof v === "string" && /^\d{4}-\d\d-\d\dT/.test(v)) || (v && typeof v === "object" && v.$d) ? "T" : v);
const strip = (rows) => rows.map((r) => { const x = r.map(T); while (x.length && (x[x.length - 1] === "" || x[x.length - 1] == null)) x.pop(); return x; }).filter((r) => r.length > 0);
const norm = (r, ids) => { let s = JSON.stringify(r, (k, v) => (k === "_session" || k === "version" || k === "generated" ? undefined : v)); (ids || []).forEach((i) => { s = s.split(i).join("AID"); }); return JSON.parse(s); };

function scenario(n, then) {
  const script = classroom({ students: n }), mod = classroom({ students: n });
  const sync = () => { const book = JSON.parse(script.backend.exportText()); mod.editWorkbook((b) => { b.sheets = book.sheets; b.props = book.props; }); return fromBackend(mod.backend); };
  const o = { site, random: () => crypto.randomUUID(), counters: A.memoryCounters(() => new Date()) };
  try { then({ script, mod, sync, o }); } finally { script.backend.close(); mod.backend.close(); }
}
const groupTab = (c) => strip(tab(c, "Groups"));

test("groups: one group is the same; many groups hold everyone once; refusals match", () => scenario(9, ({ script, mod, sync, o }) => {
  for (const p of [{ op: "make", set: "" }, { op: "make", set: "Lab 1", count: "1" }]) {
    const store = sync(), a = script.host("groups", p), b = G.act(store, p, o);
    assert.deepEqual(norm(b), norm(a), JSON.stringify(p)); assert.deepEqual(groupTab(mod), groupTab(script));
  }
  for (const mode of ["random", "mixed", "attendance"]) {
    const store = sync(), p = { op: "make", set: "Lab " + mode, size: "3", mode }, b = G.act(store, p, o), a = script.host("groups", p);
    [a, b].forEach((r) => { assert.equal(r.ok, true); assert.equal(r.groups.length, 3); assert.deepEqual(r.groups.flatMap((g) => g.members.map((m) => m.id)).sort(), script.students.map((s) => s.id)); assert.ok(r.groups.every((g) => g.members.length === 3)); assert.equal(r.notGrouped.length, 0); });
    assert.equal(b.mode, a.mode);
  }
  // A shared grouping from here on, so every later step compares exactly.
  script.host("groups", { op: "make", set: "Project", size: "3" });
  const steps = [{ op: "list" }, { op: "list", set: "Project" }, { op: "lock", set: "Project", group: "1" }, { op: "lock", set: "Project", group: "1", value: "no" }, { op: "move", set: "Project", id: "20000001", to: "2" },
    { op: "move", set: "Project", id: "99999999", to: "2" }, { op: "mark", set: "Project", group: "2", mark: "7", outof: "10" }, { op: "mark", set: "Project", group: "2", mark: "x" }, { op: "mark", set: "Project", group: "99", mark: "1" },
    { op: "move", set: "Nope", id: "1", to: "1" }, { op: "make", set: "Project", count: "2", avoid: "yes" }, { op: "delete", set: "Lab random" }];
  steps.forEach((p) => { const store = sync(), b = G.act(store, p, o), a = script.host("groups", p); if (p.op === "make") { assert.equal(b.ok, a.ok); return; } assert.deepEqual(norm(b), norm(a), JSON.stringify(p)); assert.deepEqual(groupTab(mod), groupTab(script), JSON.stringify(p)); assert.deepEqual(strip(tab(mod, "Master")), strip(tab(script, "Master")), "master " + JSON.stringify(p)); });
}));

test("a locked group stays when the set is made again, and the projector view matches", () => scenario(8, ({ script, mod, sync, o }) => {
  script.host("groups", { op: "make", set: "Lab", size: "4" }); script.host("groups", { op: "lock", set: "Lab", group: "1" });
  const before = script.host("groups", { op: "list", set: "Lab" }).groups.find((g) => g.group === 1).members.map((m) => m.id).sort();
  const store = sync(), b = G.act(store, { op: "make", set: "Lab", size: "2" }, o);
  assert.equal(b.ok, true); assert.deepEqual(b.groups.find((g) => g.group === 1).members.map((m) => m.id).sort(), before);
  assert.ok(b.groups.find((g) => g.group === 1).locked); assert.ok(b.groups.length >= 2);
  const s2 = sync(); assert.deepEqual(norm(G.display(s2, { set: "Lab" }, o)), norm(script.host("groups_display", { set: "Lab" })));
  assert.equal(G.studentGroups(s2, "20000002").length, 1);
}));

test("assignments: save, list, close, mark, view, delete and refusals match", () => scenario(8, ({ script, mod, sync, o }) => {
  script.host("groups", { op: "make", set: "Lab", size: "4" });
  const ids = [], same = (p, tag) => { const store = sync(), a = script.host("assignments", p), b = AS.act(store, p, o); if (a.saved) ids.push(a.saved); assert.deepEqual(norm(b, ids.concat(b.saved ? [b.saved] : [])), norm(a, ids), tag || JSON.stringify(p)); return a; };
  same({ op: "list" }); same({ op: "save", set: "Nope", title: "x" }, "no set"); same({ op: "save", set: "Lab", title: "" }, "no title");
  same({ op: "save", set: "Lab", title: "Report", groups: "9" }, "bad group"); same({ op: "save", set: "Lab", title: "Report", due: "tomorrow" }, "bad due"); same({ op: "save", set: "Lab", title: "Report", outof: "0" }, "bad out of");
  const saved = same({ op: "save", set: "Lab", title: "Report", brief: "Write it", groups: "all", due: "2030-01-05", outof: "20", outcome: "L1.1" }, "save");
  assert.ok(saved.saved);
  const id = saved.saved;
  // The module's own save gives it another ID; take the script's ID to compare the later steps from the same records.
  for (const p of [{ op: "view", id }, { op: "close", id }, { op: "open", id }, { op: "mark", id, group: "1", mark: "15", feedback: "Good" }, { op: "mark", id, group: "1", mark: "z" }, { op: "mark", id, group: "9", mark: "1" }, { op: "view", id: "NOPE" }, { op: "list" }, { op: "delete", id }]) same(p);
  assert.deepEqual(strip(tab(mod, "Assignments")), strip(tab(script, "Assignments")));
}));

test("a student sees the group's assignment, submits, says their part and rates group-mates", () => scenario(8, ({ script, mod, sync, o }) => {
  script.host("groups", { op: "make", set: "Lab", size: "4" });
  const id = script.host("assignments", { op: "save", set: "Lab", title: "Report", brief: "b", due: "2030-01-05", outof: "10" }).saved;
  const groups = script.host("groups", { op: "list", set: "Lab" }).groups, g1 = groups[0].members.map((m) => m.id), me = g1[0], mate = g1[1], other = groups[1].members[0].id;
  const code = (s) => script.codes[s] || tab(script, "Access_Codes").find((r) => String(r[0]) === s)[1];
  const call = (who, p) => {
    const store = sync(), a = script.call(Object.assign({ action: "group_work", id: who, access: code(who) }, p));
    const b = AS.groupWork(store, Object.assign({ id: who, access: code(who) }, p), { post: true, session: "" }, o);
    assert.deepEqual(norm(b, [id]), norm(a, [id]), JSON.stringify(p)); assert.deepEqual(strip(tab(mod, "Group_Work")), strip(tab(script, "Group_Work")), "work " + JSON.stringify(p)); return a;
  };
  const first = call(me, {}); assert.equal(first.assignments.length, 1);
  call(me, { op: "submit", aid: id, text: "" }); call(me, { op: "submit", aid: id, link: "ftp://x" }); call(me, { op: "submit", aid: id, text: "Our answer", link: "https://example.org/a" });
  call(mate, { op: "part", aid: id, text: "I did the figures" }); call(mate, { op: "part", aid: id, text: "" });
  call(me, { op: "peer", aid: id, ratings: JSON.stringify({ [mate]: "full", [other]: "full", "000": "x" }) }); call(me, { op: "peer", aid: id, ratings: "{bad" }); call(me, { op: "peer", aid: id, ratings: "{}" });
  call(other, { op: "submit", aid: id, text: "wrong group's answer" }); call(me, { op: "submit", aid: "NOPE", text: "x" });
  const after = call(me, {}), mine = after.assignments[0]; assert.equal(mine.submitted, true); assert.equal(mine.rated, true);
  script.host("assignments", { op: "close", id }); call(me, { op: "submit", aid: id, text: "late" });
  call("20000001", { op: "list" }); const bad = AS.groupWork(sync(), { id: me, access: "WRONG" }, { post: true, session: "" }, o); assert.equal(bad.ok, false);
}));
