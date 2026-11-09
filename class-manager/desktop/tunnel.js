// Internet access for students: a Cloudflare quick tunnel (cloudflared) that gives this computer's
// student pages a temporary https address, with no account and no router setup.
// cloudflared is downloaded once, on first use, from Cloudflare's GitHub releases, and checked against
// the SHA-256 values below before it is run. It is kept in the app's data folder.
"use strict";
const fs = require("fs");
const path = require("path");
const https = require("https");
const crypto = require("crypto");
const { spawn, execFileSync } = require("child_process");

const VERSION = "2026.10.7";
const FILES = { // platform-arch -> release file and its SHA-256
  "linux-x64": ["cloudflared-linux-amd64", "1f99fb518b83dec2ba8d870a7cc991d82a77e6196295a3d2754ba17ab9f91872"],
  "linux-arm64": ["cloudflared-linux-arm64", "3df43aedc9ff291d1735b5cb576cb97e0b157488796db2e32b28aecabb445775"],
  "win32-x64": ["cloudflared-windows-amd64.exe", "2493dbc168923bb3e59e5e7716f71deced92992eea9acd6e9d74f84ac7751343"],
  "win32-arm64": ["cloudflared-windows-amd64.exe", "2493dbc168923bb3e59e5e7716f71deced92992eea9acd6e9d74f84ac7751343"],
  "darwin-x64": ["cloudflared-darwin-amd64.tgz", "02f3edfd87684dd5b705607688e4eb4b323f6e777b81e7b3a85af556aa356848"],
  "darwin-arm64": ["cloudflared-darwin-arm64.tgz", "3586ccf397e98e5f437e60e7c307ca6ac463e110580503af8bb8e6f9ebf831bd"],
};
const URL_RE = /https:\/\/[a-z0-9-]+\.trycloudflare\.com/;

function get(url, hops) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { "User-Agent": "ClassManager" } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && (hops || 0) < 5) { res.resume(); return resolve(get(new URL(res.headers.location, url).href, (hops || 0) + 1)); }
      if (res.statusCode !== 200) { res.resume(); return reject(new Error("download failed (" + res.statusCode + ")")); }
      const parts = []; res.on("data", (c) => parts.push(c)); res.on("end", () => resolve(Buffer.concat(parts))); res.on("error", reject);
    }).on("error", reject);
  });
}

function createTunnel(opts) {
  const dir = opts.dir; // folder for the program and its empty home folder
  let child = null, state = { state: "off", url: "", error: "", since: 0 };
  const emit = () => { try { opts.onChange && opts.onChange(status()); } catch (e) { /* ignore */ } };
  const set = (o) => { state = Object.assign({}, state, o); emit(); };
  function status() { return Object.assign({ installed: installed() }, state); }
  function binPath() {
    if (process.env.CM_CLOUDFLARED) return process.env.CM_CLOUDFLARED; // tests only
    return path.join(dir, VERSION, process.platform === "win32" ? "cloudflared.exe" : "cloudflared");
  }
  function installed() { try { return fs.statSync(binPath()).isFile(); } catch (e) { return false; } }

  async function install() {
    if (installed()) return;
    const f = FILES[process.platform + "-" + process.arch];
    if (!f) throw new Error("Internet access is not available for this type of computer.");
    set({ state: "downloading", error: "" });
    const buf = await get("https://github.com/cloudflare/cloudflared/releases/download/" + VERSION + "/" + f[0]);
    if (crypto.createHash("sha256").update(buf).digest("hex") !== f[1]) throw new Error("The downloaded program did not match its checksum, so it was not used.");
    const target = binPath(); fs.mkdirSync(path.dirname(target), { recursive: true });
    if (f[0].endsWith(".tgz")) {
      const tgz = target + ".tgz"; fs.writeFileSync(tgz, buf);
      execFileSync("tar", ["-xzf", tgz, "-C", path.dirname(target)]); fs.unlinkSync(tgz);
    } else fs.writeFileSync(target, buf);
    fs.chmodSync(target, 0o755);
  }

  async function start(localPort) {
    if (child) return status();
    try { await install(); } catch (e) { set({ state: "error", error: e.message || String(e) }); return status(); }
    // An empty home folder, so that a cloudflared configuration elsewhere on this computer cannot change the tunnel.
    const home = path.join(dir, "home"); fs.mkdirSync(home, { recursive: true });
    const env = Object.assign({}, process.env, { HOME: home, USERPROFILE: home, XDG_CONFIG_HOME: home });
    set({ state: "starting", url: "", error: "" });
    let out = "";
    child = spawn(binPath(), ["tunnel", "--no-autoupdate", "--url", "http://127.0.0.1:" + localPort], { env, windowsHide: true });
    const timer = setTimeout(() => { if (state.state === "starting") { set({ state: "error", error: "No address arrived within 45 seconds. Check the internet connection and try again." }); stop(); } }, 45000);
    const read = (d) => {
      out = (out + d.toString()).slice(-20000);
      const m = out.match(URL_RE);
      if (m && state.state === "starting") { clearTimeout(timer); set({ state: "on", url: m[0] + "/", since: Date.now() }); }
    };
    child.stdout.on("data", read); child.stderr.on("data", read);
    child.on("error", (e) => { clearTimeout(timer); child = null; set({ state: "error", error: e.message, url: "" }); });
    child.on("exit", (code) => {
      clearTimeout(timer); child = null;
      if (state.state === "stopping" || state.state === "off") set({ state: "off", url: "" });
      else if (state.state !== "error") set({ state: "error", url: "", error: "The internet connection closed (code " + code + "). Start it again when ready." });
    });
    return status();
  }

  function stop() {
    if (!child) { if (state.state !== "error") set({ state: "off", url: "" }); return status(); }
    set({ state: "stopping" });
    try { child.kill(); } catch (e) { /* already gone */ }
    return status();
  }

  return { start, stop, status, installed };
}

// A simple per-visitor limit for requests that arrive through the tunnel.
function createLimiter(perMinute) {
  const hits = new Map();
  return function allow(key) {
    const now = Date.now(), w = Math.floor(now / 60000);
    const h = hits.get(key);
    if (!h || h.w !== w) { hits.set(key, { w, n: 1 }); if (hits.size > 5000) hits.clear(); return true; }
    h.n++; return h.n <= perMinute;
  };
}

module.exports = { createTunnel, createLimiter, VERSION };
