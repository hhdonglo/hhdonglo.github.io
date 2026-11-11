/* S3-compatible storage: Amazon S3, Backblaze B2, Cloudflare R2, Wasabi, MinIO and others. Requests are signed
   with AWS Signature Version 4 (path-style addresses). The lecturer makes a bucket and an access key limited to it. */
"use strict";
const crypto = require("crypto");
const { send, baseOf } = require("./http");

const help = [
  "Make a bucket with your provider (Amazon S3, Backblaze B2, Cloudflare R2, Wasabi and others) and keep it private.",
  "Make an access key that can read and write only that bucket, and copy its key ID and secret.",
  "The endpoint is the provider's S3 address, for example https://s3.eu-central-1.amazonaws.com or https://<account>.r2.cloudflarestorage.com. The region is shown beside it (use auto for Cloudflare R2)."
];
const fields = [
  { key: "endpoint", label: "Endpoint", placeholder: "https://s3.eu-central-1.amazonaws.com" },
  { key: "region", label: "Region", placeholder: "eu-central-1" },
  { key: "bucket", label: "Bucket" },
  { key: "accessKey", label: "Access key ID" },
  { key: "secretKey", label: "Secret access key", secret: true }
];

const sha = (d) => crypto.createHash("sha256").update(d).digest("hex");
const hmac = (k, d) => crypto.createHmac("sha256", k).update(d).digest();
const uri = (s) => encodeURIComponent(s).replace(/[!'()*]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase());

// AWS Signature Version 4. headers: lower-case names including host and x-amz-*; returns the Authorization value.
function sign(o) {
  const names = Object.keys(o.headers).map((h) => h.toLowerCase()).sort();
  const canonHeaders = names.map((h) => h + ":" + String(o.headers[h]).trim() + "\n").join("");
  const signed = names.join(";");
  const query = Object.keys(o.query || {}).sort().map((k) => uri(k) + "=" + uri(o.query[k])).join("&");
  const canonical = [o.method, o.path, query, canonHeaders, signed, o.payloadHash].join("\n");
  const day = o.amzDate.slice(0, 8), scope = day + "/" + o.region + "/s3/aws4_request";
  const toSign = ["AWS4-HMAC-SHA256", o.amzDate, scope, sha(canonical)].join("\n");
  const key = hmac(hmac(hmac(hmac("AWS4" + o.secretKey, day), o.region), "s3"), "aws4_request");
  const sig = crypto.createHmac("sha256", key).update(toSign).digest("hex");
  return "AWS4-HMAC-SHA256 Credential=" + o.accessKey + "/" + scope + ", SignedHeaders=" + signed + ", Signature=" + sig;
}

function create(creds, ctx) {
  const ep = String(creds.endpoint || "").replace(/\/+$/, "");
  if (!/^https:\/\//.test(ep)) throw new Error("The endpoint must start with https://");
  const bucket = String(creds.bucket || ""), region = String(creds.region || "us-east-1");
  if (!bucket || !creds.accessKey || !creds.secretKey) throw new Error("Enter the bucket, the access key ID and the secret access key.");
  const host = new URL(ep).host;
  async function call(method, key, query, body) {
    const path = "/" + uri(bucket) + (key ? "/" + key.split("/").map(uri).join("/") : "");
    const payloadHash = sha(body || "");
    const amzDate = (ctx.now ? ctx.now() : new Date()).toISOString().replace(/[-:]|\.\d{3}/g, "");
    const headers = { host, "x-amz-content-sha256": payloadHash, "x-amz-date": amzDate };
    const auth = sign({ method, path, query, headers, payloadHash, amzDate, region, accessKey: creds.accessKey, secretKey: creds.secretKey });
    const qs = Object.keys(query || {}).sort().map((k) => uri(k) + "=" + uri(query[k])).join("&");
    return send(ctx.fetch, method, ep + path + (qs ? "?" + qs : ""), { headers: { "x-amz-content-sha256": payloadHash, "x-amz-date": amzDate, Authorization: auth }, body });
  }
  const xml = (s, tag) => [...s.matchAll(new RegExp("<" + tag + ">([^<]*)</" + tag + ">", "g"))].map((m) => m[1]);
  return {
    async check() {
      const r = await call("GET", "", { "list-type": "2", "max-keys": "1" });
      if (r.status === 403) throw new Error("The storage service refused the access key.");
      if (r.status === 404) throw new Error("The bucket was not found.");
      if (r.status !== 200) throw new Error("The storage service answered " + r.status + ".");
      return { private: true };
    },
    async put(p, buf) { const r = await call("PUT", p, null, buf); if (r.status !== 200) throw new Error("Upload failed (" + r.status + ")."); },
    async list(dir) {
      const r = await call("GET", "", { "list-type": "2", prefix: dir + "/" });
      if (r.status !== 200) throw new Error("Could not list the bucket (" + r.status + ").");
      const t = await r.text(), keys = xml(t, "Key"), sizes = xml(t, "Size");
      return keys.map((k, i) => ({ name: baseOf(k), bytes: Number(sizes[i] || 0) }));
    },
    async get(p) { const r = await call("GET", p); if (r.status !== 200) throw new Error("Download failed (" + r.status + ")."); return Buffer.from(await r.arrayBuffer()); },
    async remove(p) { await call("DELETE", p); }
  };
}
module.exports = { id: "s3", name: "S3-compatible storage (Amazon S3, Backblaze B2, Cloudflare R2, Wasabi)", fields, help, create, sign };
