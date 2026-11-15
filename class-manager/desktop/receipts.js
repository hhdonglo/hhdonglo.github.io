/* Safe retries: a request that carries a client key (ckey) is carried out once.
   A phone that did not hear the answer sends the same request again; CM returns the first answer and records nothing twice.
   One responsibility: look up the key, run the request if it is new, remember the answer (db table "receipt"). */
"use strict";

// run() returns the server's output ({text, mime}). Requests without a ckey run as they always did.
function once(backend, params, run) {
  const key = params && params.ckey ? String(params.ckey).slice(0, 80) : "";
  if (!key || !/^[\w.-]+$/.test(key)) return run();
  const seen = backend.receipts.get(key);
  if (seen !== null) { const o = { text: seen, mime: "application/json", mimeSet: true, getContent: () => seen }; return o; }
  const out = run();
  if (out && typeof out.text === "string") backend.receipts.put(key, out.text);
  return out;
}

module.exports = { once };
