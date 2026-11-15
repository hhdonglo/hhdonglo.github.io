/* The assistant export: what is kept, what is never included, stable pseudonyms, Markdown, the MCP server and the screen's handlers.
   Run with `npm test` in class-manager/desktop. Uses the made-up class in sample-class.js. */
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { PassThrough } = require("stream");
const { createBackend } = require("../backend");
const { writeSample } = require("./sample-class");
const { buildSnapshot, preview } = require("../llm/snapshot");
const { toMarkdown } = require("../llm/markdown");
const { createPseudonyms } = require("../llm/pseudonym");
const mcp = require("../llm/mcp-server");

const WEB = path.resolve(__dirname, "..", "..");
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cm-llm-"));
const file = path.join(dir, "workbook.json");
createBackend({ webRoot: WEB, dataFile: file, log: () => {} }).close();
const sample = writeSample(file);
const backend = createBackend({ webRoot: WEB, dataFile: file, log: () => {} });
const base = { course: { code: "PHYS 143", title: "Mechanics", term: "2026" }, salt: "a".repeat(48), readTab: (n) => backend.tab(n), now: 0 };
const snap = buildSnapshot(base);
const all = JSON.stringify(snap) + toMarkdown(snap);

test("pseudonyms are stable, unique and reversible", () => {
  const a = createPseudonyms("s1"), b = createPseudonyms("s1"), c = createPseudonyms("s2");
  const ids = sample.ids;
  const names = ids.map((i) => a.of(i));
  assert.equal(new Set(names).size, ids.length);
  assert.deepEqual(names, ids.map((i) => b.of(i)));
  assert.notEqual(a.of(ids[0]), c.of(ids[0]));
  assert.equal(a.back(names[3].toLowerCase()), ids[3]);
});

test("by default no real ID and no name leaves", () => {
  sample.ids.forEach((id) => assert.ok(!all.includes(id), "real ID " + id));
  ["Ama", "Mensah", "Kwame", "Mawuli"].forEach((n) => assert.ok(!all.includes(n), "name " + n));
  assert.equal(snap.privacy.studentIds, "pseudonyms");
  assert.equal(snap.students, sample.ids.length);
});

test("only allowed tabs are read; secrets are never included", () => {
  const read = [];
  buildSnapshot(Object.assign({}, base, { readTab: (n) => { read.push(n); return backend.tab(n); } }));
  for (const bad of ["Key", "Attendance_Log", "Attendance_Control", "Presence", "Log"]) assert.ok(!read.includes(bad), bad + " was read");
  assert.ok(!Object.keys(snap.tables).includes("Key"));
  assert.ok(!/Device|Secret|Host key/i.test(JSON.stringify(Object.values(snap.tables).map((t) => t.columns))));
});

test("the same student has the same pseudonym in every table", () => {
  const p = createPseudonyms(base.salt).of(sample.ids[5]);
  const found = Object.values(snap.tables).filter((t) => t.rows.some((r) => r.includes(p)));
  assert.ok(found.length >= 3);
});

test("the lecturer can choose names and real IDs", () => {
  const s = buildSnapshot(Object.assign({}, base, { includeNames: true, realIds: true }));
  assert.ok(JSON.stringify(s).includes(sample.ids[0]));
  assert.ok(JSON.stringify(s).includes("Ama"));
  assert.equal(s.privacy.names, "included");
});

test("the preview lists tables, columns and a sample row", () => {
  const p = preview(snap);
  const att = p.tables.find((t) => t.name === "Attendance");
  assert.ok(att.rows === sample.ids.length && att.sample.length === 2 && att.columns.length > 2);
});

test("Markdown has a table per tab and states the privacy", () => {
  const md = toMarkdown(snap, { maxRows: 5 });
  assert.match(md, /^# PHYS 143 Mechanics \(2026\)/);
  assert.match(md, /## Attendance \(30 rows\)/);
  assert.match(md, /pseudonyms/);
  assert.match(md, /more rows are in snapshot\.json/);
});

function ask(messages) { // runs the MCP server over a stream, as an assistant would
  const snapDir = fs.mkdtempSync(path.join(os.tmpdir(), "cm-mcp-"));
  fs.writeFileSync(path.join(snapDir, "snapshot.json"), JSON.stringify(snap));
  const input = new PassThrough(), output = new PassThrough(); let got = "";
  output.on("data", (d) => { got += d; });
  mcp.serve(snapDir, input, output);
  messages.forEach((m, i) => input.write(JSON.stringify(Object.assign({ jsonrpc: "2.0" }, m, m.method === "notifications/initialized" ? {} : { id: i + 1 })) + "\n"));
  return new Promise((r) => setTimeout(() => r(got.trim().split("\n").filter(Boolean).map((l) => JSON.parse(l))), 50));
}

test("MCP server: initialize, list tools (all read-only), and answer", async () => {
  const p = createPseudonyms(base.salt).of(sample.ids[0]);
  const res = await ask([
    { method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "t", version: "1" } } },
    { method: "notifications/initialized" },
    { method: "tools/list" },
    { method: "tools/call", params: { name: "attendance_summary", arguments: { below_percent: 100 } } },
    { method: "tools/call", params: { name: "student_record", arguments: { student: p } } },
    { method: "tools/call", params: { name: "get_table", arguments: { name: "nope" } } }
  ]);
  assert.equal(res.length, 5); // the notification gets no reply
  assert.equal(res[0].result.serverInfo.name, "class-manager-snapshot");
  const tools = res[1].result.tools;
  assert.ok(tools.length >= 4 && tools.every((t) => t.annotations.readOnlyHint));
  const att = JSON.parse(res[2].result.content[0].text);
  assert.equal(att.sessions.length, 8);
  assert.ok(att.below_threshold.students.length > 0);
  assert.ok(Object.keys(JSON.parse(res[3].result.content[0].text)).includes("Attendance"));
  assert.equal(res[4].result.isError, true);
});

test("screen handlers: preview, save writes the files, lookup finds the student", async () => {
  const handlers = new Map(), out = fs.mkdtempSync(path.join(os.tmpdir(), "cm-out-"));
  const c = { id: "phys143", settings: { courseCode: "PHYS 143" }, backend };
  require("../llm/ipc").register({ on: (ch, fn) => handlers.set(ch, fn), dialog: { showOpenDialog: async () => ({ canceled: false, filePaths: [out] }) }, winOf: () => null, shell: null, dirOf: () => dir });
  const p = handlers.get("cm:llmPreview")(c, null, {});
  assert.ok(p.ok && p.tables.length >= 4);
  const r = await handlers.get("cm:llmSave")(c, null, {});
  assert.ok(r.ok);
  ["snapshot.md", "snapshot.json", "cm-mcp-server.js", "mcp-config.json"].forEach((f) => assert.ok(fs.existsSync(path.join(r.folder, f)), f));
  const cfg = JSON.parse(fs.readFileSync(path.join(r.folder, "mcp-config.json"), "utf8"));
  assert.equal(cfg.mcpServers["class-manager"].command, "node");
  const written = fs.readFileSync(path.join(r.folder, "snapshot.json"), "utf8");
  sample.ids.forEach((id) => assert.ok(!written.includes(id)));
  const pseudo = written.match(/S-[0-9A-F]{6}/)[0];
  const who = handlers.get("cm:llmLookup")(c, null, pseudo);
  assert.ok(who.ok && sample.ids.includes(who.id));
  assert.equal(handlers.get("cm:llmLookup")(c, null, "S-000000").ok, false);
});
