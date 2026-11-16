/* relay/staging-check.mjs, the script Hope runs against a real Worker, is itself tested here against the Worker code behind a local HTTP server. */
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("http");
const path = require("path");
const { spawnSync } = require("child_process");

const kv = () => { const m = new Map(); return { put: async (k, v) => { m.set(k, v); }, get: async (k) => (m.has(k) ? m.get(k) : null), delete: async (k) => { m.delete(k); },
  list: async ({ prefix, limit }) => { const keys = [...m.keys()].filter((k) => k.startsWith(prefix)).sort().slice(0, limit).map((name) => ({ name })); return { keys, list_complete: true }; }, size: () => m.size }; };

test("the staging check passes against the Worker and leaves the mailbox empty", async () => {
  const worker = (await import("../../relay/worker.mjs")).default;
  const env = { BOX: kv(), DROP_TOKEN: "drop-code-1234", PULL_TOKEN: "pull-code-0123456789" };
  const server = http.createServer((req, res) => { const chunks = []; req.on("data", (c) => chunks.push(c)); req.on("end", async () => {
    const r = await worker.fetch(new Request("http://x" + req.url, { method: req.method, headers: req.headers, body: ["GET", "HEAD"].includes(req.method) ? undefined : Buffer.concat(chunks) }), env);
    res.writeHead(r.status, { "content-type": "application/json" }); res.end(await r.text()); }); });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const url = "http://127.0.0.1:" + server.address().port;
  const out = await new Promise((resolve) => { const p = require("child_process").spawn(process.execPath, [path.join(__dirname, "..", "..", "relay", "staging-check.mjs"), url, env.DROP_TOKEN, env.PULL_TOKEN]); let s = ""; p.stdout.on("data", (d) => (s += d)); p.stderr.on("data", (d) => (s += d)); p.on("close", (code) => resolve({ code, s })); });
  server.close();
  assert.equal(out.code, 0, out.s);
  assert.match(out.s, /All checks passed/);
  assert.equal(env.BOX.size(), 0);
});

test("with no address it explains the usage", () => {
  const r = spawnSync(process.execPath, [path.join(__dirname, "..", "..", "relay", "staging-check.mjs")], { encoding: "utf8" });
  assert.equal(r.status, 2); assert.match(r.stderr, /Usage/);
});
