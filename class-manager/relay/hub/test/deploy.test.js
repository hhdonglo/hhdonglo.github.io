import test from "node:test";
import assert from "node:assert";

// A fake Cloudflare account that records every call.
function fakeCloudflare({ scripts = [], dbs = [] } = {}) {
  const calls = [];
  const fetchFn = async (url, init = {}) => {
    const method = init.method || "GET";
    const path = url.replace("https://api.cloudflare.com/client/v4", "");
    calls.push(method + " " + path);
    const ok = (result) => ({ ok: true, status: 200, json: async () => ({ success: true, result }) });
    if (url.endsWith("/health")) return { ok: true, status: 200, json: async () => ({ ok: true }) };
    if (path === "/accounts") return ok([{ id: "acc1", name: "Hope" }]);
    if (path.endsWith("/workers/scripts")) return ok(scripts.map((id) => ({ id })));
    if (path.includes("/d1/database?")) return ok(dbs.map((name) => ({ name, uuid: "uuid-" + name })));
    if (method === "POST" && path.endsWith("/d1/database")) return ok({ uuid: "new-uuid" });
    if (path.endsWith("/query")) return ok([]);
    if (path.endsWith("/workers/subdomain")) return ok({ subdomain: "hope" });
    throw new Error("unexpected " + method + " " + path);
  };
  return { fetchFn, calls };
}

async function load() { return import("../../deploy.mjs"); }
const base = { env: { CLOUDFLARE_API_TOKEN: "t" }, log: () => {}, sleep: async () => {} };

test("dry run changes nothing and lists existing resources as untouched", async () => {
  const { run } = await load();
  const cf = fakeCloudflare({ scripts: ["phyanalytics", "numeralanalytics"], dbs: ["other-db"] });
  const out = [];
  const r = await run({ ...base, argv: ["--dry-run"], fetch: cf.fetchFn, log: (m) => out.push(m), exec: async () => assert.fail("must not run") });
  assert.strictEqual(r.dryRun, true);
  assert.ok(cf.calls.every((c) => c.startsWith("GET")), "only reads: " + cf.calls);
  assert.match(out.join("\n"), /phyanalytics, numeralanalytics/);
});

test("first deploy creates the database and Worker with the cm names only", async () => {
  const { run, WORKER, DATABASE } = await load();
  const cf = fakeCloudflare({ scripts: ["phyanalytics"] });
  const execs = [];
  const r = await run({ ...base, argv: [], fetch: cf.fetchFn, exec: async (c, a, o) => execs.push({ a, o }) });
  assert.strictEqual(r.url, "https://cm-relay.hope.workers.dev");
  assert.strictEqual(WORKER, "cm-relay"); assert.strictEqual(DATABASE, "cm-relay-db");
  assert.ok(cf.calls.includes("POST /accounts/acc1/d1/database"));
  assert.strictEqual(execs.length, 2);
  assert.ok(execs[0].a.includes("deploy"));
  assert.ok(execs[1].a.includes("secret") && execs[1].o.input.length === 64);
  assert.ok(!cf.calls.some((c) => /phyanalytics|DELETE|PUT/.test(c)));
});

test("stops when a CM relay already exists, and updates only with --update", async () => {
  const { run } = await load();
  const cf = fakeCloudflare({ scripts: ["cm-relay"], dbs: ["cm-relay-db"] });
  await assert.rejects(run({ ...base, argv: [], fetch: cf.fetchFn, exec: async () => assert.fail("no") }), /already exists/);
  const execs = [];
  const r = await run({ ...base, argv: ["--update"], fetch: cf.fetchFn, exec: async (c, a) => execs.push(a) });
  assert.strictEqual(r.created, false);
  assert.strictEqual(execs.length, 1, "the secret is kept");
  assert.ok(!cf.calls.includes("POST /accounts/acc1/d1/database"));
});

test("refuses without a token and rejects unknown options", async () => {
  const { run } = await load();
  await assert.rejects(run({ ...base, env: {}, argv: [], fetch: async () => assert.fail("no") }), /No token/);
  await assert.rejects(run({ ...base, argv: ["--delete"], fetch: async () => assert.fail("no") }), /Unknown option/);
});

test("the generated config names only the CM Worker and database", async () => {
  const { wranglerToml } = await load();
  const t = wranglerToml({ main: "/x/worker.mjs", databaseId: "id1" });
  assert.match(t, /name = "cm-relay"/); assert.match(t, /database_name = "cm-relay-db"/); assert.match(t, /crons/);
  assert.ok(!/phyanalytics|numeralanalytics/.test(t));
});
