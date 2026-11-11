/* WebDAV: Nextcloud, ownCloud, Box (WebDAV), pCloud, Synology, Koofr, many university and NAS services.
   The lecturer enters the address, user name and an app password. Paths are relative to the address given. */
"use strict";
const { send, dirOf, enc } = require("./http");

const help = [
  "Nextcloud or ownCloud: open Settings, Security, create an app password, and copy it. The address is shown under Files, Settings, WebDAV (it ends in /remote.php/dav/files/<your user name>/).",
  "Other services: use the WebDAV address, user name and password (or app password) that the service gives you.",
  "Use an app password, not your main password: you can cancel it at any time."
];
const fields = [
  { key: "url", label: "WebDAV address", placeholder: "https://cloud.example.org/remote.php/dav/files/you/" },
  { key: "username", label: "User name" },
  { key: "password", label: "App password", secret: true }
];

function create(creds, ctx) {
  const base = String(creds.url || "").replace(/\/+$/, "");
  if (!/^https:\/\//.test(base)) throw new Error("The WebDAV address must start with https://");
  const auth = "Basic " + Buffer.from(String(creds.username || "") + ":" + String(creds.password || "")).toString("base64");
  const u = (p) => base + "/" + String(p).split("/").map(enc).join("/");
  const call = (m, p, o) => send(ctx.fetch, m, u(p), Object.assign({ headers: Object.assign({ Authorization: auth }, (o && o.headers) || {}) }, o && o.body ? { body: o.body } : {}));
  async function mkdirs(dir) { // MKCOL each folder in turn; 405 means it exists already
    let cur = "";
    for (const seg of dir.split("/").filter(Boolean)) {
      cur += (cur ? "/" : "") + seg;
      const r = await call("MKCOL", cur);
      if (![201, 405, 301, 200].includes(r.status)) throw new Error("WebDAV: could not create the folder (" + r.status + ")");
    }
  }
  return {
    async check() {
      const r = await call("PROPFIND", "", { headers: { Depth: "0" } });
      if (r.status === 401 || r.status === 403) throw new Error("WebDAV: the user name or password was refused.");
      if (r.status !== 207 && r.status !== 200) throw new Error("WebDAV: the address did not answer as a WebDAV folder (" + r.status + ").");
      return { private: true };
    },
    async put(p, buf) {
      await mkdirs(dirOf(p));
      const r = await call("PUT", p, { body: buf, headers: { "Content-Type": "application/octet-stream" } });
      if (![200, 201, 204].includes(r.status)) throw new Error("WebDAV: upload failed (" + r.status + ").");
    },
    async list(dir) {
      const r = await call("PROPFIND", dir, { headers: { Depth: "1" } });
      if (r.status === 404) return [];
      if (r.status !== 207) throw new Error("WebDAV: could not list the folder (" + r.status + ").");
      const xml = await r.text(), out = [];
      for (const m of xml.matchAll(/<(?:\w+:)?response>([\s\S]*?)<\/(?:\w+:)?response>/g)) {
        const href = (/<(?:\w+:)?href>([^<]*)</.exec(m[1]) || [])[1]; if (!href) continue;
        const name = decodeURIComponent(href.replace(/\/+$/, "").split("/").pop());
        const size = Number((/<(?:\w+:)?getcontentlength>(\d+)</.exec(m[1]) || [])[1] || 0);
        if (name && !/<(?:\w+:)?collection\s*\/>/.test(m[1])) out.push({ name, bytes: size });
      }
      return out;
    },
    async get(p) { const r = await call("GET", p); if (r.status !== 200) throw new Error("WebDAV: download failed (" + r.status + ")."); return Buffer.from(await r.arrayBuffer()); },
    async remove(p) { await call("DELETE", p); }
  };
}
module.exports = { id: "webdav", name: "WebDAV (Nextcloud, ownCloud, pCloud and others)", fields, help, create };
