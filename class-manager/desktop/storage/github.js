/* GitHub (or GitHub Enterprise): copies go into a PRIVATE repository, through the contents API.
   The lecturer makes the repository and a fine-grained personal access token limited to that one repository
   (permission: Contents, read and write). The provider refuses a public repository. */
"use strict";
const { send, enc, dirOf, baseOf } = require("./http");

const help = [
  "Make a new PRIVATE repository on GitHub (for example class-manager-copies).",
  "On GitHub: Settings, Developer settings, Personal access tokens, Fine-grained tokens, Generate new token. Choose only that repository, and give it the permission Contents: Read and write.",
  "Copy the token into the box below. The copies are encrypted with your passphrase before they are sent, but keep the repository private."
];
const fields = [
  { key: "repo", label: "Repository (owner/name)", placeholder: "your-name/class-manager-copies" },
  { key: "branch", label: "Branch", placeholder: "main" },
  { key: "token", label: "Access token", secret: true }
];

function create(creds, ctx) {
  const repo = String(creds.repo || "").trim();
  if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) throw new Error("The repository must look like owner/name.");
  const branch = String(creds.branch || "").trim() || "main";
  const api = String(creds.api || "https://api.github.com").replace(/\/+$/, "");
  const H = { Authorization: "Bearer " + String(creds.token || ""), Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", "User-Agent": "class-manager" };
  const url = (p) => api + "/repos/" + repo + "/contents/" + String(p).split("/").map(enc).join("/") + "?ref=" + enc(branch);
  const call = (m, u, body, extra) => send(ctx.fetch, m, u, { headers: Object.assign({}, H, extra || {}, body ? { "Content-Type": "application/json" } : {}), body: body ? JSON.stringify(body) : undefined });
  async function shaOf(p) { const r = await call("GET", url(p)); return r.status === 200 ? (await r.json()).sha : null; }
  return {
    async check() {
      const r = await call("GET", api + "/repos/" + repo);
      if (r.status === 401) throw new Error("GitHub refused the token.");
      if (r.status === 404) throw new Error("GitHub cannot find that repository with this token.");
      if (r.status !== 200) throw new Error("GitHub answered " + r.status + ".");
      const j = await r.json();
      if (!j.private) throw new Error("That repository is public. Use a private repository for copies of class records.");
      if (j.permissions && j.permissions.push === false) throw new Error("The token cannot write to that repository.");
      return { private: true };
    },
    async put(p, buf) {
      const sha = await shaOf(p);
      const r = await call("PUT", api + "/repos/" + repo + "/contents/" + p.split("/").map(enc).join("/"), { message: "Class Manager copy " + baseOf(p), content: buf.toString("base64"), branch, sha: sha || undefined });
      if (r.status !== 200 && r.status !== 201) throw new Error("GitHub: upload failed (" + r.status + ").");
    },
    async list(dir) {
      const r = await call("GET", url(dir));
      if (r.status === 404) return [];
      if (r.status !== 200) throw new Error("GitHub: could not list the folder (" + r.status + ").");
      const j = await r.json();
      return (Array.isArray(j) ? j : []).filter((f) => f.type === "file").map((f) => ({ name: f.name, bytes: f.size }));
    },
    async get(p) { const r = await call("GET", url(p), null, { Accept: "application/vnd.github.raw+json" }); if (r.status !== 200) throw new Error("GitHub: download failed (" + r.status + ")."); return Buffer.from(await r.arrayBuffer()); },
    async remove(p) { const sha = await shaOf(p); if (sha) await call("DELETE", api + "/repos/" + repo + "/contents/" + p.split("/").map(enc).join("/"), { message: "Remove old Class Manager copy", sha, branch }); }
  };
}
module.exports = { id: "github", name: "GitHub (private repository)", fields, help, create, dirOf };
