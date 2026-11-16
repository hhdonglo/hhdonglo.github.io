// Checks a REAL deployed CM mailbox Worker end to end, from this computer. Nothing is faked: it makes real requests to the address you give it.
// Usage: node relay/staging-check.mjs <https address of the Worker> <DROP_TOKEN> <PULL_TOKEN>
// It uses its own throwaway course name and a throwaway key pair, puts one sealed test item in, collects it, opens it, confirms it, and checks the mailbox is empty again.
// It never touches a real course. Run it against a separate "staging" Worker so you can also delete that Worker afterwards.
import { createRequire } from "module";
import { fileURLToPath } from "url";
import path from "path";
const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const { generateKeys, open } = require(path.join(here, "..", "desktop", "relay", "crypto.js"));
const { seal } = require(path.join(here, "..", "assets", "relay-seal.js"));

const [base0, drop, pull] = process.argv.slice(2);
if (!base0 || !drop || !pull) { console.error("Usage: node relay/staging-check.mjs <https address of the Worker> <DROP_TOKEN> <PULL_TOKEN>"); process.exit(2); }
const base = base0.replace(/\/$/, "");
let failed = 0;
const check = (name, ok, extra) => { console.log((ok ? "PASS " : "FAIL ") + name + (ok || !extra ? "" : " (" + extra + ")")); if (!ok) failed++; };
const call = async (p, init) => { try { const r = await fetch(base + p, init); let j = null; try { j = await r.clone().json(); } catch (e) { /* not JSON */ } return { status: r.status, json: j }; } catch (e) { return { status: 0, error: e.message }; } };
const post = (p, body, token) => call(p, { method: "POST", headers: Object.assign({ "Content-Type": "application/json" }, token ? { Authorization: "Bearer " + token } : {}), body: JSON.stringify(body) });

const course = "staging-check-" + Math.random().toString(36).slice(2, 8);
const keys = generateKeys();
const secret = "staging check " + Date.now();

const h = await call("/health");
check("the Worker answers /health", h.status === 200 && h.json && h.json.ok === true, h.error || "status " + h.status);
if (h.status !== 200) { console.log("\nThe address does not answer. Check the Worker address and that the Worker is deployed."); process.exit(1); }

const sealed = await seal(keys.publicKey, secret);
check("a wrong student code is refused", (await post("/put", { course, drop: "wrong-code-0000", sealed })).status === 403);
check("a sealed item with the student code is accepted", (await post("/put", { course, drop, sealed })).status === 200);
check("the student code cannot read the mailbox", (await post("/pull", { course }, drop)).status === 403);
check("a wrong lecturer code is refused", (await post("/pull", { course }, "nope-nope-nope-nope")).status === 403);
const got = await post("/pull", { course }, pull);
const items = (got.json && got.json.items) || [];
check("CM's lecturer code collects the item", got.status === 200 && items.length === 1, "status " + got.status + ", items " + items.length);
let opened = ""; try { opened = items.length ? open(keys.privateKey, items[0].sealed || items[0]) : ""; } catch (e) { opened = "(could not open: " + e.message + ")"; }
check("only the private key opens it, and the text is intact", opened === secret, opened);
const ack = items.length ? await post("/ack", { ids: [items[0].id] }, pull) : { status: 0 };
check("confirming removes it", ack.status === 200 && ack.json && ack.json.removed === 1, "status " + ack.status);
const again = await post("/pull", { course }, pull);
check("the mailbox is empty again", again.status === 200 && ((again.json && again.json.items) || []).length === 0);

console.log(failed ? "\n" + failed + " check(s) FAILED. Send this output to Claude." : "\nAll checks passed: this Worker works end to end.");
process.exit(failed ? 1 : 0);
