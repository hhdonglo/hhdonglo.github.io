/* Adds the students the lecturer agreed to add. Uses the backend's own class-list function, so IDs stay unique and existing names are kept. */
"use strict";

function applyRoster(backend, toAdd) {
  if (!toAdd.length) return { ok: true, added: 0 };
  backend.flush();
  backend.rosterSync(toAdd.map((s) => [s.id, s.name]), false);
  backend.flush();
  return { ok: true, added: toAdd.length };
}

module.exports = { applyRoster };
