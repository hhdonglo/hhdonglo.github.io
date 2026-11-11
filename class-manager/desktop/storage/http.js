/* Shared helpers for the storage providers. fetch is handed in (Electron's or a test double), so no provider
   touches the network by itself and every provider is tested without one. */
"use strict";
const enc = encodeURIComponent;
const dirOf = (p) => String(p).split("/").slice(0, -1).join("/");
const baseOf = (p) => String(p).split("/").pop();
// One request with a time limit. Returns the response; the caller reads status and body.
async function send(fetchFn, method, url, o) {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 60000);
  try { return await fetchFn(url, Object.assign({ method, signal: ctl.signal }, o || {})); }
  catch (e) { throw new Error("Could not reach " + new URL(url).host + ": " + (e.name === "AbortError" ? "timed out" : e.message)); }
  finally { clearTimeout(t); }
}
module.exports = { send, enc, dirOf, baseOf };
