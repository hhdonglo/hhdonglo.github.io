/* Storage providers (storage/*.js), with in-memory stand-ins for each service: run with `npm test`. */
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const storage = require("../storage");
const s3 = require("../storage/s3");

const res = (status, body) => ({ status, json: async () => body, text: async () => (typeof body === "string" ? body : JSON.stringify(body)), arrayBuffer: async () => (body instanceof Buffer ? body : Buffer.from(String(body || ""))) });

test("every provider has the same shape and help text for the screen", () => {
  assert.deepEqual(storage.PROVIDERS.map((p) => p.id).sort(), ["dropbox", "github", "s3", "webdav"]);
  for (const p of storage.describe()) {
    assert.ok(p.name && p.help.length >= 2 && p.fields.length >= 2, p.id);
    for (const f of p.fields) assert.ok(f.key && f.label);
  }
  assert.ok(storage.byId("github").fields.find((f) => f.key === "token").secret, "tokens are shown as secrets");
});

test("only declared fields are kept, as trimmed text", () => {
  const c = storage.cleanCreds(storage.byId("webdav"), { url: " https://x/ ", username: "u", password: "p", evil: "x" });
  assert.deepEqual(c, { url: "https://x/", username: "u", password: "p" });
});

test("the S3 signature matches the published AWS Signature Version 4 example", () => {
  const auth = s3.sign({ method: "GET", path: "/test.txt", query: {}, amzDate: "20130524T000000Z", region: "us-east-1", payloadHash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    headers: { host: "examplebucket.s3.amazonaws.com", range: "bytes=0-9", "x-amz-content-sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855", "x-amz-date": "20130524T000000Z" },
    accessKey: "AKIAIOSFODNN7EXAMPLE", secretKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY" });
  assert.match(auth, /Signature=f0e8bdb87c964420e857bd35b5d6ed310bd44f0170aba48dd91039c6036bdb41$/);
});

test("S3: put, list, get and remove go to the bucket, signed", async () => {
  const objs = new Map(), seen = [];
  const fetch = async (url, o) => {
    const u = new URL(url); seen.push(o.headers.Authorization);
    const key = decodeURIComponent(u.pathname.replace(/^\/bucket\/?/, ""));
    if (o.method === "PUT") { objs.set(key, Buffer.from(o.body)); return res(200, ""); }
    if (o.method === "DELETE") { objs.delete(key); return res(204, ""); }
    if (o.method === "GET" && u.searchParams.get("list-type")) {
      const pre = u.searchParams.get("prefix") || "";
      return res(200, "<R>" + [...objs.keys()].filter((k) => k.startsWith(pre)).map((k) => "<Contents><Key>" + k + "</Key><Size>" + objs.get(k).length + "</Size></Contents>").join("") + "</R>");
    }
    return objs.has(key) ? res(200, objs.get(key)) : res(404, "");
  };
  const c = storage.byId("s3").create({ endpoint: "https://s3.example.com", region: "eu-1", bucket: "bucket", accessKey: "AK", secretKey: "SK" }, { fetch });
  await c.check();
  await c.put("Class Manager/X/a.cmbackup", Buffer.from("abc"));
  assert.deepEqual(await c.list("Class Manager/X"), [{ name: "a.cmbackup", bytes: 3 }]);
  assert.equal((await c.get("Class Manager/X/a.cmbackup")).toString(), "abc");
  await c.remove("Class Manager/X/a.cmbackup");
  assert.deepEqual(await c.list("Class Manager/X"), []);
  assert.ok(seen.every((a) => /^AWS4-HMAC-SHA256 Credential=AK\//.test(a)));
});

test("GitHub: refuses a public repository, then stores copies as files and replaces by sha", async () => {
  let isPrivate = false; const files = new Map();
  const fetch = async (url, o) => {
    const u = new URL(url);
    if (u.pathname === "/repos/me/copies") return res(200, { private: isPrivate, permissions: { push: true } });
    const p = decodeURIComponent(u.pathname.replace("/repos/me/copies/contents/", ""));
    if (o.method === "PUT") { const b = JSON.parse(o.body); files.set(p, { sha: "s" + files.size, data: Buffer.from(b.content, "base64") }); return res(201, {}); }
    if (o.method === "DELETE") { files.delete(p); return res(200, {}); }
    if (/raw/.test(o.headers.Accept) && files.has(p)) return res(200, files.get(p).data);
    if (files.has(p)) return res(200, { sha: files.get(p).sha });
    const kids = [...files.keys()].filter((k) => k.startsWith(p + "/"));
    return kids.length ? res(200, kids.map((k) => ({ type: "file", name: k.split("/").pop(), size: files.get(k).data.length }))) : res(404, {});
  };
  const mk = () => storage.byId("github").create({ repo: "me/copies", token: "t" }, { fetch });
  await assert.rejects(() => mk().check(), /public/);
  isPrivate = true; const c = mk();
  await c.check();
  await c.put("Class Manager/X/a.cmbackup", Buffer.from("abc"));
  await c.put("Class Manager/X/a.cmbackup", Buffer.from("abcd"));
  assert.deepEqual(await c.list("Class Manager/X"), [{ name: "a.cmbackup", bytes: 4 }]);
  assert.equal((await c.get("Class Manager/X/a.cmbackup")).toString(), "abcd");
  assert.throws(() => storage.byId("github").create({ repo: "nonsense", token: "t" }, { fetch }), /owner\/name/);
});

test("Dropbox: uploads into the app folder and renews an expired token with the refresh token", async () => {
  let valid = "good"; const files = new Map(); let refreshes = 0;
  const fetch = async (url, o) => {
    if (url.endsWith("/oauth2/token")) { refreshes++; valid = "fresh"; return res(200, { access_token: "fresh" }); }
    if (o.headers.Authorization !== "Bearer " + valid) return res(401, {});
    if (url.endsWith("files/upload")) { files.set(JSON.parse(o.headers["Dropbox-API-Arg"]).path, Buffer.from(o.body)); return res(200, {}); }
    if (url.endsWith("files/list_folder")) { const d = JSON.parse(o.body).path; const e = [...files.keys()].filter((k) => k.startsWith(d + "/")).map((k) => ({ ".tag": "file", name: k.split("/").pop(), size: files.get(k).length })); return e.length ? res(200, { entries: e }) : res(409, {}); }
    if (url.endsWith("files/download")) return res(200, files.get(JSON.parse(o.headers["Dropbox-API-Arg"]).path));
    return res(200, {});
  };
  const c = storage.byId("dropbox").create({ token: "stale", appKey: "k", appSecret: "s", refreshToken: "r" }, { fetch });
  await c.put("Class Manager/X/a.cmbackup", Buffer.from("abc"));
  assert.equal(refreshes, 1);
  assert.deepEqual(await c.list("Class Manager/X"), [{ name: "a.cmbackup", bytes: 3 }]);
  assert.equal((await c.get("Class Manager/X/a.cmbackup")).toString(), "abc");
  assert.deepEqual(await c.list("Class Manager/Other"), []);
  assert.throws(() => storage.byId("dropbox").create({}, { fetch }), /token/);
});

test("a network failure is reported in plain words", async () => {
  const c = storage.byId("webdav").create({ url: "https://down.example.org/dav/", username: "u", password: "p" }, { fetch: async () => { throw new Error("ECONNREFUSED"); } });
  await assert.rejects(() => c.check(), /Could not reach down\.example\.org: ECONNREFUSED/);
});
