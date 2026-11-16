#!/usr/bin/env node
// Guided, one-command setup of the CM relay on Cloudflare.
//   node deploy.mjs --dry-run   shows the plan and changes nothing
//   node deploy.mjs             creates the database and the Worker
//   node deploy.mjs --update    publishes new code to an existing CM relay
// It only ever uses the names WORKER and DATABASE below. It reads your other Workers, databases and domains
// to check for a clash, and never changes them. The API token is read from CLOUDFLARE_API_TOKEN (or typed
// when asked), used for this run, and never written to disk.
import { randomBytes } from "node:crypto";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { SCHEMA } from "./hub/src/db.js";

export const WORKER = "cm-relay";
export const DATABASE = "cm-relay-db";
const API = "https://api.cloudflare.com/client/v4";
const HERE = dirname(fileURLToPath(import.meta.url));

export function wranglerToml({ main, databaseId }) {
  return [
    `name = "${WORKER}"`,
    `main = ${JSON.stringify(main)}`,
    `compatibility_date = "2025-01-01"`,
    `workers_dev = true`,
    ``,
    `[triggers]`,
    `crons = ["17 3 * * *"]`,
    ``,
    `[[d1_databases]]`,
    `binding = "DB"`,
    `database_name = "${DATABASE}"`,
    `database_id = "${databaseId}"`,
    ``
  ].join("\n");
}

function parseArgs(argv) {
  const a = { dryRun: false, update: false, account: "" };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--dry-run") a.dryRun = true;
    else if (argv[i] === "--update") a.update = true;
    else if (argv[i] === "--account") a.account = argv[++i] || "";
    else throw new Error("Unknown option " + argv[i] + ". Use --dry-run, --update or --account <id>.");
  }
  return a;
}

async function api(fetchFn, token, method, path, body) {
  const r = await fetchFn(API + path, {
    method,
    headers: { authorization: "Bearer " + token, "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined
  });
  const j = await r.json().catch(() => ({}));
  if (!j.success) {
    const msg = (j.errors || []).map((e) => e.message).join("; ") || "HTTP " + r.status;
    throw new Error("Cloudflare said: " + msg + " (" + method + " " + path.replace(/\/accounts\/[^/]+/, "/accounts/…") + ")");
  }
  return j.result;
}

function runCommand(cmd, args, { input, env, cwd }) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { env: { ...process.env, ...env }, cwd, stdio: ["pipe", "inherit", "inherit"] });
    p.on("error", reject);
    p.on("close", (c) => (c === 0 ? resolve() : reject(new Error(cmd + " " + args.join(" ") + " stopped with code " + c))));
    p.stdin.end(input || "");
  });
}

export async function run({ argv = [], env = process.env, fetch: fetchFn = fetch, exec = runCommand, ask, log = console.log, sleep = (ms) => new Promise((r) => setTimeout(r, ms)) } = {}) {
  const args = parseArgs(argv);
  let token = env.CLOUDFLARE_API_TOKEN || "";
  if (!token && ask) token = (await ask("Cloudflare API token (Workers and D1 edit): ")).trim();
  if (!token) throw new Error("No token. Create one in Cloudflare (My Profile, API Tokens, permissions: Workers Scripts Edit, D1 Edit, Account Settings Read) and run again with CLOUDFLARE_API_TOKEN set.");

  const accounts = await api(fetchFn, token, "GET", "/accounts");
  let account = accounts.find((a) => a.id === (args.account || env.CLOUDFLARE_ACCOUNT_ID)) || (accounts.length === 1 ? accounts[0] : null);
  if (!account) throw new Error("This token reaches " + accounts.length + " accounts. Run again with --account <id>: " + accounts.map((a) => a.name + " " + a.id).join(", "));
  const base = "/accounts/" + account.id;

  const scripts = await api(fetchFn, token, "GET", base + "/workers/scripts");
  const databases = await api(fetchFn, token, "GET", base + "/d1/database?per_page=100");
  const others = scripts.map((s) => s.id).filter((n) => n !== WORKER);
  const otherDbs = databases.map((d) => d.name).filter((n) => n !== DATABASE);
  const workerExists = scripts.some((s) => s.id === WORKER);
  const db = databases.find((d) => d.name === DATABASE);

  log("Account: " + account.name);
  log("Left untouched (read only): Workers " + (others.join(", ") || "none") + "; databases " + (otherDbs.join(", ") || "none") + "; all domains.");

  if ((workerExists || db) && !args.update) {
    throw new Error("A CM relay already exists here (" + [workerExists && "Worker " + WORKER, db && "database " + DATABASE].filter(Boolean).join(", ") + "). Nothing was changed. To publish new code to it, run with --update.");
  }
  if (args.update && !workerExists && !db) throw new Error("--update needs an existing CM relay, and none was found. Run without --update to create it.");

  const plan = [
    db ? "Reuse database " + DATABASE : "Create database " + DATABASE,
    "Make sure its tables exist",
    (workerExists ? "Replace the code of Worker " : "Create Worker ") + WORKER + " (free workers.dev address, daily cleanup at 03:17 UTC)",
    workerExists ? "Keep the existing secret" : "Set a new random secret for the proof of work",
    "Check /health"
  ];
  log("Plan:\n" + plan.map((p, i) => "  " + (i + 1) + ". " + p).join("\n"));
  if (args.dryRun) { log("Dry run: nothing was changed."); return { dryRun: true, plan }; }

  const databaseId = db ? db.uuid : (await api(fetchFn, token, "POST", base + "/d1/database", { name: DATABASE })).uuid;
  for (const sql of SCHEMA) await api(fetchFn, token, "POST", base + "/d1/database/" + databaseId + "/query", { sql });

  const dir = mkdtempSync(join(tmpdir(), "cm-relay-"));
  try {
    const config = join(dir, "wrangler.toml");
    writeFileSync(config, wranglerToml({ main: join(HERE, "hub", "worker.mjs"), databaseId }));
    const wenv = { CLOUDFLARE_API_TOKEN: token, CLOUDFLARE_ACCOUNT_ID: account.id };
    await exec("npx", ["--yes", "wrangler@3", "deploy", "--config", config], { env: wenv, cwd: HERE });
    if (!workerExists) {
      await exec("npx", ["--yes", "wrangler@3", "secret", "put", "RELAY_SECRET", "--name", WORKER, "--config", config], { env: wenv, cwd: HERE, input: randomBytes(32).toString("hex") });
    }
  } finally { rmSync(dir, { recursive: true, force: true }); }

  const sub = (await api(fetchFn, token, "GET", base + "/workers/subdomain")).subdomain;
  const url = "https://" + WORKER + "." + sub + ".workers.dev";
  let healthy = false;
  for (let i = 0; i < 5 && !healthy; i++) {
    try { const r = await fetchFn(url + "/health"); healthy = r.ok; } catch { /* retry */ }
    if (!healthy) await sleep(2000);
  }
  if (!healthy) throw new Error("Deployed, but " + url + "/health did not answer yet. Wait a minute and open it in a browser.");

  log("\nThe CM relay is running at " + url + "\nNext: in the website repository, Settings, Secrets and variables, Actions, Variables, add CM_RELAY_URL = " + url + " (CM installers built after that carry the address).");
  return { url, databaseId, created: !workerExists };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const { createInterface } = await import("node:readline/promises");
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  run({ argv: process.argv.slice(2), ask: (q) => rl.question(q) })
    .catch((e) => { console.error("\n" + e.message); process.exitCode = 1; })
    .finally(() => rl.close());
}
