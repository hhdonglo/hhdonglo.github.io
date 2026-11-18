// The Sign-in problems list on the Attendance screen: read the list, or dismiss one ID. One responsibility: pass those two calls to rules/signin-attempts.js.
// Nothing here reads or shows an access code; the list holds only ID, name, counts, times and reasons.
"use strict";
const SA = require("./rules/signin-attempts");
const { fromBackend } = require("./rules/store");

function register({ on }) {
  on("cm:signinProblems", (c) => { try { return SA.list(fromBackend(c.backend)); } catch (e) { return { ok: false, why: e.message, items: [], stuck: 0 }; } });
  on("cm:signinDismiss", (c, e, id) => SA.dismiss(fromBackend(c.backend), String(id == null ? "" : id).slice(0, 20)));
}

module.exports = { register };
