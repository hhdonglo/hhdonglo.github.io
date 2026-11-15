/* Asks the LMS for a short-lived access token, proving who CM is with a signed assertion (the LTI 1.3 service flow). `fetch` is passed in so tests need no network. */
"use strict";
const crypto = require("crypto");
const jwt = require("./jwt");

const SCOPES = {
  members: "https://purl.imsglobal.org/spec/lti-nrps/scope/contextmembership.readonly",
  lineitem: "https://purl.imsglobal.org/spec/lti-ags/scope/lineitem",
  score: "https://purl.imsglobal.org/spec/lti-ags/scope/score"
};

async function getToken(cfg, key, scopes, fetchFn, now) {
  const t = Math.floor((now || Date.now()) / 1000);
  const assertion = jwt.sign({ iss: cfg.clientId, sub: cfg.clientId, aud: cfg.tokenUrl, iat: t, exp: t + 300, jti: crypto.randomUUID() }, key);
  const body = new URLSearchParams({
    grant_type: "client_credentials", client_assertion_type: "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
    client_assertion: assertion, scope: scopes.join(" ")
  });
  const r = await fetchFn(cfg.tokenUrl, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: body.toString() });
  if (!r.ok) throw new Error("The LMS refused the token request (" + r.status + "). Check the client ID and that CM's public key is registered.");
  const j = await r.json();
  if (!j.access_token) throw new Error("The LMS did not return an access token.");
  return j.access_token;
}

module.exports = { getToken, SCOPES };
