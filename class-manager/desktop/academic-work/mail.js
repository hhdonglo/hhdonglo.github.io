"use strict";

const { createHash, randomBytes } = require("node:crypto");
const { createServer } = require("node:http");
const { createSealedStore } = require("./sealed-store");

const google = {
  name: "Gmail", auth: "https://accounts.google.com/o/oauth2/v2/auth", token: "https://oauth2.googleapis.com/token",
  host: "127.0.0.1", scope: "https://www.googleapis.com/auth/gmail.readonly", extra: { access_type: "offline", prompt: "consent" }
};
const microsoft = {
  name: "Outlook", auth: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
  token: "https://login.microsoftonline.com/common/oauth2/v2.0/token", host: "localhost",
  scope: "https://graph.microsoft.com/Mail.Read offline_access", extra: { prompt: "select_account" }
};
const providers = { gmail: google, outlook: microsoft };
const gmail = "https://gmail.googleapis.com/gmail/v1/users/me/messages";
const outlook = "https://graph.microsoft.com/v1.0/me";

async function authorize(config, client, openBrowser) {
  const state = randomBytes(32).toString("base64url"), verifier = randomBytes(64).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  let redirect;
  const code = await new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      let url;
      try { url = new URL(req.url, "http://127.0.0.1"); } catch { res.writeHead(400).end(); return; }
      if (req.method !== "GET" || url.pathname !== "/oauth/callback" || url.searchParams.get("state") !== state) {
        res.writeHead(400).end("This is not the pending Class Manager authorization."); return;
      }
      const value = url.searchParams.get("code");
      res.writeHead(value ? 200 : 400, { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" })
        .end(value ? "Authorization received. You can return to Class Manager." : "Authorization was declined. Return to Class Manager.");
      finish(value ? null : new Error("Email access was declined."), value);
    });
    const timeout = setTimeout(() => finish(new Error("Email authorization expired. Try connecting again.")), 180000);
    function finish(error, result) {
      clearTimeout(timeout);
      server.close();
      server.closeIdleConnections();
      if (error) reject(error); else resolve(result);
    }
    server.once("error", finish);
    server.listen(0, "127.0.0.1", () => {
      redirect = "http://" + config.host + ":" + server.address().port + "/oauth/callback";
      const params = new URLSearchParams({ client_id: client.id, redirect_uri: redirect, state, response_type: "code",
        scope: config.scope, code_challenge: challenge, code_challenge_method: "S256", ...config.extra });
      Promise.resolve().then(() => openBrowser(config.auth + "?" + params)).catch(finish);
    });
  });
  return { code, redirect_uri: redirect, code_verifier: verifier, grant_type: "authorization_code" };
}

async function json(fetcher, url, options, name) {
  const response = await fetcher(url, { ...options, redirect: "error", signal: AbortSignal.timeout(15000) });
  if (!response.ok) {
    const error = new Error(name + " returned " + response.status + ". Check the connection or reconnect the account.");
    error.status = response.status;
    throw error;
  }
  return response.json();
}

function plainGmail(payload) {
  const parts = [], visit = part => {
    if (!part || part.filename) return;
    if (part.body?.data && /^text\/(plain|html)$/i.test(part.mimeType || "")) parts.push(part);
    for (const child of part.parts || []) visit(child);
  };
  visit(payload);
  const plain = parts.filter(part => part.mimeType.toLowerCase() === "text/plain");
  const content = (plain.length ? plain : parts).map(part => Buffer.from(part.body.data, "base64url").toString("utf8")).join("\n");
  if (plain.length) return content.slice(0, 100000);
  return content.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, "")
    .replace(/<\/?(?:p|br|div|li|tr)\b[^>]*>/gi, "\n").replace(/<[^>]*>/g, "")
    .replace(/&(amp|lt|gt|quot|apos|nbsp);/g, (_, key) => ({ amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " })[key])
    .slice(0, 100000).trim();
}

function createMail(file, getVault, openBrowser, fetcher = fetch, openAuthorization = authorize) {
  const inflight = new Set();
  const db = () => createSealedStore(file, getVault(), () => ({ version: 1, accounts: {} }),
    state => state?.version === 1 && state.accounts && typeof state.accounts === "object" && !Array.isArray(state.accounts));
  function configOf(id) {
    if (!Object.hasOwn(providers, id)) throw new Error("Choose Gmail or Outlook.");
    return providers[id];
  }
  async function token(config, client, fields) {
    const body = new URLSearchParams({ ...fields, client_id: client.id });
    if (client.secret) body.set("client_secret", client.secret);
    const result = await json(fetcher, config.token, { method: "POST", body }, config.name);
    if (!result.access_token) throw new Error("The provider did not return email access.");
    return { access: result.access_token, refresh: result.refresh_token || "", expires: Date.now() + Number(result.expires_in || 3600) * 1000 };
  }
  const status = () => {
    const { accounts } = db().read();
    return Object.keys(providers).map(id => ({ id, label: providers[id].name, connected: !!accounts[id] }));
  };
  async function connect(id, input) {
    const config = configOf(id);
    if (!getVault().protected) throw new Error("Enable OS credential storage before connecting email.");
    const client = { id: String(input?.clientId || "").trim(), secret: id === "gmail" ? String(input?.clientSecret || "").trim() : "" };
    if (!/^[a-z0-9._-]{8,240}$/i.test(client.id) || client.secret.length > 300) throw new Error("Enter the provider's desktop application client ID.");
    if (inflight.has(id)) throw new Error("A connection for this provider is already being updated.");
    inflight.add(id);
    try {
      const fields = await openAuthorization(config, client, openBrowser);
      const credentials = await token(config, client, fields);
      db().change(state => { state.accounts[id] = { client, credentials }; });
      return status();
    } finally { inflight.delete(id); }
  }
  function disconnect(id) {
    configOf(id);
    if (inflight.has(id)) throw new Error("Wait for the pending authorization or mailbox request.");
    db().change(state => { delete state.accounts[id]; });
    return status();
  }
  async function request(id, fn) {
    const config = configOf(id), account = db().read().accounts[id];
    if (!account) throw new Error("Connect " + config.name + " first.");
    if (inflight.has(id)) throw new Error("A request for this mailbox is already running.");
    inflight.add(id);
    try {
      let credentials = account.credentials;
      async function refresh() {
        if (!credentials.refresh) throw new Error("Reconnect " + config.name + " to renew email access.");
        const renewed = await token(config, account.client, { grant_type: "refresh_token", refresh_token: credentials.refresh, ...(id === "outlook" ? { scope: config.scope } : {}) });
        credentials = { ...renewed, refresh: renewed.refresh || credentials.refresh };
        db().change(state => { state.accounts[id] = { ...account, credentials }; });
      }
      const get = (url, headers) => json(fetcher, url, { headers: { Authorization: "Bearer " + credentials.access, ...headers } }, config.name);
      if (credentials.expires - Date.now() < 60000) await refresh();
      try { return await fn(get); }
      catch (error) { if (error.status !== 401) throw error; await refresh(); return fn(get); }
    } finally { inflight.delete(id); }
  }
  function safeId(value) {
    if (typeof value !== "string" || !/^[A-Za-z0-9_+=/-]{1,300}$/.test(value)) throw new Error("Choose a valid message.");
    return encodeURIComponent(value);
  }
  function fromGmail(message) {
    const headers = message.payload?.headers || [];
    const header = name => headers.find(h => h.name.toLowerCase() === name)?.value || "";
    return { id: message.id, subject: header("subject"), from: header("from"), date: header("date"),
      preview: message.snippet || "", text: plainGmail(message.payload) || message.snippet || "" };
  }
  function fromOutlook(message) {
    return { id: message.id, subject: message.subject, from: message.from?.emailAddress?.address, date: message.receivedDateTime,
      preview: message.bodyPreview, text: message.body?.contentType === "text" ? message.body.content.slice(0, 100000) : message.bodyPreview || "" };
  }
  function list(id) {
    return request(id, async get => {
      if (id === "outlook") {
        const data = await get(outlook + "/mailFolders/inbox/messages?$top=20&$select=id,subject,from,receivedDateTime,bodyPreview");
        return (data.value || []).map(fromOutlook);
      }
      const data = await get(gmail + "?labelIds=INBOX&maxResults=20");
      const urls = (data.messages || []).slice(0, 20).map(item => gmail + "/" + safeId(item.id) + "?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date");
      return (await Promise.all(urls.map(url => get(url)))).map(fromGmail);
    });
  }
  function message(id, messageId) {
    const key = safeId(messageId);
    return request(id, async get => id === "gmail" ? fromGmail(await get(gmail + "/" + key + "?format=full")) :
      fromOutlook(await get(outlook + "/messages/" + key + "?$select=id,subject,from,receivedDateTime,body,bodyPreview", { Prefer: 'outlook.body-content-type="text"' })));
  }
  return { status, connect, disconnect, list, message };
}

module.exports = { createMail, authorize, plainGmail };
