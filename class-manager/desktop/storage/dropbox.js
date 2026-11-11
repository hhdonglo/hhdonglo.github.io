/* Dropbox, with the lecturer's own Dropbox app. The lecturer creates an app (scoped to "App folder") in the
   Dropbox App Console and pastes either a generated access token, or the app key, app secret and a refresh token.
   Files go into the app's own folder, so the app cannot see anything else in the Dropbox. */
"use strict";
const { send, baseOf } = require("./http");

const help = [
  "Go to dropbox.com/developers/apps and choose Create app: Scoped access, App folder, any name.",
  "On the Permissions tab tick files.content.write and files.content.read, then Submit.",
  "On the Settings tab, under OAuth 2, press Generate access token and copy it. (Dropbox tokens made this way expire after some hours; for copies that run by themselves use the app key, app secret and a refresh token instead, which Dropbox's documentation explains.)"
];
const fields = [
  { key: "token", label: "Access token (or leave empty and use the three boxes below)", secret: true },
  { key: "appKey", label: "App key (optional)" },
  { key: "appSecret", label: "App secret (optional)", secret: true },
  { key: "refreshToken", label: "Refresh token (optional)", secret: true }
];

function create(creds, ctx) {
  let access = String(creds.token || "");
  const refreshable = creds.appKey && creds.appSecret && creds.refreshToken;
  if (!access && !refreshable) throw new Error("Enter an access token, or the app key, app secret and refresh token.");
  async function token(force) {
    if (access && !force) return access;
    if (!refreshable) throw new Error("The Dropbox token has expired. Generate a new one, or use a refresh token.");
    const r = await send(ctx.fetch, "POST", "https://api.dropboxapi.com/oauth2/token", { headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "grant_type=refresh_token&refresh_token=" + encodeURIComponent(creds.refreshToken) + "&client_id=" + encodeURIComponent(creds.appKey) + "&client_secret=" + encodeURIComponent(creds.appSecret) });
    if (r.status !== 200) throw new Error("Dropbox refused the refresh token (" + r.status + ").");
    access = (await r.json()).access_token; return access;
  }
  async function call(m, url, o) { // one retry with a fresh token if Dropbox says the token is out of date
    for (let i = 0; i < 2; i++) {
      const r = await send(ctx.fetch, m, url, Object.assign({}, o, { headers: Object.assign({ Authorization: "Bearer " + await token(i > 0) }, (o && o.headers) || {}) }));
      if (r.status !== 401 || !refreshable) return r;
    }
  }
  const rpc = (ep, body) => call("POST", "https://api.dropboxapi.com/2/" + ep, { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const path = (p) => "/" + p;
  return {
    async check() { const r = await rpc("users/get_current_account", null); if (r.status === 401) throw new Error("Dropbox refused the token."); if (r.status !== 200) throw new Error("Dropbox answered " + r.status + "."); return { private: true }; },
    async put(p, buf) {
      const r = await call("POST", "https://content.dropboxapi.com/2/files/upload", { headers: { "Content-Type": "application/octet-stream", "Dropbox-API-Arg": JSON.stringify({ path: path(p), mode: "overwrite", mute: true }) }, body: buf });
      if (r.status !== 200) throw new Error("Dropbox: upload failed (" + r.status + ").");
    },
    async list(dir) {
      const r = await rpc("files/list_folder", { path: path(dir) });
      if (r.status === 409) return [];
      if (r.status !== 200) throw new Error("Dropbox: could not list the folder (" + r.status + ").");
      return (await r.json()).entries.map((e) => (e[".tag"] === "folder" ? { name: e.name, dir: true } : { name: e.name, bytes: e.size }));
    },
    async get(p) {
      const r = await call("POST", "https://content.dropboxapi.com/2/files/download", { headers: { "Dropbox-API-Arg": JSON.stringify({ path: path(p) }) } });
      if (r.status !== 200) throw new Error("Dropbox: download failed (" + r.status + ")."); return Buffer.from(await r.arrayBuffer());
    },
    async remove(p) { await rpc("files/delete_v2", { path: path(p) }); }
  };
}
module.exports = { id: "dropbox", name: "Dropbox (your own app)", fields, help, create, baseOf };
