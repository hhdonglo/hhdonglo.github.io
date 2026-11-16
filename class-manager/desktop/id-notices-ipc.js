// The Duplicate IDs screen's calls: list the open notices and record the lecturer's answer (the right name).
// One responsibility: pass the two calls to the backend (backend.js idNotices and resolveIdNotice). Nothing is merged or changed here.
"use strict";

function register({ on }) {
  on("cm:idNotices", (c) => ({ ok: true, notices: c.backend.idNotices() }));
  on("cm:idResolve", (c, e, tab, id, name) => {
    if (typeof id !== "string" || !/^\d{1,12}$/.test(id)) return { ok: false, why: "That ID is not valid." };
    return { ok: c.backend.resolveIdNotice(String(tab || "Roster"), id, name == null ? "" : String(name)) };
  });
}

module.exports = { register };
