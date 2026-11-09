/* Optional Google sign-in for the Class Manager app.
   After sign-in, the app creates one Google Sheet in the lecturer's own Drive and keeps a copy
   of every tab of the local workbook there (attendance, scores, master, roster, logs).
   The local workbook stays the working copy, so class runs the same with or without a connection.

   Scope: drive.file only. The app can see and change only the files it creates, nothing else
   in the lecturer's Drive. Sign-in uses the system browser with a loopback address and PKCE,
   the method Google recommends for desktop apps. */
"use strict";
const http = require("http");
const crypto = require("crypto");

const SCOPES = "openid email https://www.googleapis.com/auth/drive.file";
const b64url = (b) => b.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

function createGoogle(opts) {
  // opts: { clientId, clientSecret, load(), save(obj), openBrowser(url), log, tabs(), tab(name), title() }
  let state = opts.load() || {}; // { refresh, email, sheetId, sheetUrl }
  let access = null, accessExp = 0, timer = null, syncing = false, lastSync = 0, lastError = "";

  const configured = () => !!opts.clientId;

  function signIn() {
    if (!configured()) return Promise.reject(new Error("Google sign-in is not set up in this build of the app."));
    const verifier = b64url(crypto.randomBytes(32));
    const challenge = b64url(crypto.createHash("sha256").update(verifier).digest());
    const nonce = b64url(crypto.randomBytes(16));
    return new Promise((resolve, reject) => {
      const srv = http.createServer(async (req, res) => {
        const u = new URL(req.url, "http://127.0.0.1");
        if (u.pathname !== "/callback") { res.writeHead(404); return res.end(); }
        const done = (msg) => { res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" }); res.end("<p style='font:1.2rem system-ui;padding:2rem'>" + msg + "</p>"); srv.close(); };
        if (u.searchParams.get("state") !== nonce || !u.searchParams.get("code")) { done("Sign-in was cancelled. You can close this tab."); return reject(new Error("Sign-in was cancelled.")); }
        try {
          const tok = await token({ code: u.searchParams.get("code"), code_verifier: verifier, grant_type: "authorization_code", redirect_uri: redirect });
          state.refresh = tok.refresh_token || state.refresh;
          access = tok.access_token; accessExp = Date.now() + (tok.expires_in - 60) * 1000;
          state.email = emailFrom(tok.id_token);
          opts.save(state);
          done("Signed in. You can close this tab and return to Class Manager.");
          await ensureSheet();
          resolve(status());
        } catch (e) { done("Sign-in failed: " + String(e.message).replace(/</g, "")); reject(e); }
      });
      let redirect = "";
      srv.listen(0, "127.0.0.1", () => {
        redirect = "http://127.0.0.1:" + srv.address().port + "/callback";
        const q = new URLSearchParams({ client_id: opts.clientId, redirect_uri: redirect, response_type: "code", scope: SCOPES, code_challenge: challenge, code_challenge_method: "S256", state: nonce, access_type: "offline", prompt: "consent" });
        opts.openBrowser("https://accounts.google.com/o/oauth2/v2/auth?" + q);
      });
      setTimeout(() => { try { srv.close(); } catch (e) {} reject(new Error("Sign-in timed out.")); }, 5 * 60 * 1000);
    });
  }

  function emailFrom(idt) {
    try { return JSON.parse(Buffer.from(String(idt).split(".")[1], "base64").toString("utf8")).email || ""; } catch (e) { return ""; }
  }

  async function token(params) {
    const body = new URLSearchParams(Object.assign({ client_id: opts.clientId }, opts.clientSecret ? { client_secret: opts.clientSecret } : {}, params));
    const r = await fetch("https://oauth2.googleapis.com/token", { method: "POST", body });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error_description || j.error || "token request failed");
    return j;
  }

  async function bearer() {
    if (access && Date.now() < accessExp) return access;
    if (!state.refresh) throw new Error("Not signed in.");
    const tok = await token({ refresh_token: state.refresh, grant_type: "refresh_token" });
    access = tok.access_token; accessExp = Date.now() + (tok.expires_in - 60) * 1000;
    return access;
  }

  async function api(method, url, body) {
    const r = await fetch(url, { method, headers: { Authorization: "Bearer " + (await bearer()), "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
    const j = r.status === 204 ? {} : await r.json().catch(() => ({}));
    if (!r.ok) { const e = new Error((j.error && j.error.message) || "Google request failed (" + r.status + ")"); e.status = r.status; throw e; }
    return j;
  }

  async function ensureSheet() {
    if (state.sheetId) {
      try { await api("GET", "https://sheets.googleapis.com/v4/spreadsheets/" + state.sheetId + "?fields=spreadsheetId"); return; }
      catch (e) { if (e.status !== 404 && e.status !== 403) throw e; state.sheetId = ""; } // deleted or no longer reachable: make a new one
    }
    const j = await api("POST", "https://sheets.googleapis.com/v4/spreadsheets", { properties: { title: opts.title() } });
    state.sheetId = j.spreadsheetId; state.sheetUrl = j.spreadsheetUrl; opts.save(state);
    opts.log("Google Sheet created");
  }

  // Copy every local tab to the Google Sheet (whole-tab replace; the local workbook is the source).
  async function syncNow() {
    if (!state.refresh || syncing) return status();
    syncing = true;
    try {
      await ensureSheet();
      const base = "https://sheets.googleapis.com/v4/spreadsheets/" + state.sheetId;
      const meta = await api("GET", base + "?fields=sheets.properties");
      const have = meta.sheets.map((s) => s.properties.title);
      const tabs = opts.tabs().map((t) => t.name);
      const add = tabs.filter((n) => have.indexOf(n) < 0).map((title) => ({ addSheet: { properties: { title } } }));
      if (add.length) await api("POST", base + ":batchUpdate", { requests: add });
      await api("POST", base + "/values:batchClear", { ranges: tabs.map((n) => "'" + n.replace(/'/g, "''") + "'") });
      const data = tabs.map((n) => ({ range: "'" + n.replace(/'/g, "''") + "'!A1", values: opts.tab(n) || [[""]] })).filter((d) => d.values.length);
      await api("POST", base + "/values:batchUpdate", { valueInputOption: "RAW", data });
      // The blank first tab Google adds to a new file is removed once there is something else.
      const blank = meta.sheets.find((s) => s.properties.title === "Sheet1" && tabs.indexOf("Sheet1") < 0);
      if (blank) await api("POST", base + ":batchUpdate", { requests: [{ deleteSheet: { sheetId: blank.properties.sheetId } }] }).catch(() => {});
      lastSync = Date.now(); lastError = "";
    } catch (e) { lastError = e.message; opts.log("sync failed: " + e.message); }
    finally { syncing = false; }
    return status();
  }

  // Called after every change to the local workbook: copy at most once every 30 seconds.
  function changed() {
    if (!state.refresh || timer) return;
    timer = setTimeout(() => { timer = null; syncNow(); }, 30000);
  }

  function signOut() {
    const t = state.refresh;
    state = {}; access = null; opts.save(state);
    if (t) fetch("https://oauth2.googleapis.com/revoke?token=" + encodeURIComponent(t), { method: "POST" }).catch(() => {});
    return status();
  }

  function status() {
    return { configured: configured(), signedIn: !!state.refresh, email: state.email || "", sheetUrl: state.sheetUrl || "", lastSync, lastError, syncing };
  }

  return { signIn, signOut, syncNow, changed, status };
}

module.exports = { createGoogle };
