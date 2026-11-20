"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { randomUUID } = require("node:crypto");

function createIndex(file, vault) {
  function read() {
    try {
      const bytes = fs.readFileSync(file);
      if (!vault.isSealed(bytes)) return {};
      const parsed = JSON.parse(vault.decode(bytes));
      if (parsed.version === 1 && parsed.workspaces && !Array.isArray(parsed.workspaces) && typeof parsed.workspaces === "object") {
        return parsed.workspaces;
      }
    } catch { /* Missing, stale or unreadable index can be rebuilt from source. */ }
    return {};
  }

  function write(workspaces) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const temp = file + "." + randomUUID() + ".tmp";
    try {
      fs.writeFileSync(temp, vault.encode(JSON.stringify({ version: 1, workspaces })), { mode: 0o600, flag: "wx" });
      fs.renameSync(temp, file);
    } finally {
      fs.rmSync(temp, { force: true });
    }
  }

  function reconcile(metadata) {
    // Only the registry can be reconciled without opening courses. Opened courses
    // rebuild their authoritative entries independently.
    write(Object.fromEntries(metadata.map(entry => [entry.workspaceId, [entry]])));
  }

  function replace(workspaceId, entries, force = false) {
    const current = read();
    if (force || JSON.stringify(current[workspaceId]) !== JSON.stringify(entries)) {
      write({ ...current, [workspaceId]: entries });
    }
  }

  function remove(workspaceId) {
    const current = read();
    if (!Object.hasOwn(current, workspaceId)) return;
    delete current[workspaceId];
    write(current);
  }

  function replaceMany(batches) {
    const current = read();
    if (Object.entries(batches).some(([id, entries]) => JSON.stringify(current[id]) !== JSON.stringify(entries))) write({ ...current, ...batches });
  }

  function searchAcross(workspaceIds, query, limit = 80) {
    const tokens = String(query ?? "").trim().slice(0, 160).toLowerCase().split(/\s+/).filter(Boolean);
    if (!tokens.length) return [];
    const current = read();
    return workspaceIds.flatMap(id => {
      const entries = Object.hasOwn(current, id) && current[id];
      return Array.isArray(entries) ? entries.filter(item => item?.workspaceId === id &&
        typeof item.content === "string" && tokens.every(token => item.content.toLowerCase().includes(token))
      ) : [];
    }).slice(0, limit).map(({ content, ...entry }) => entry);
  }

  const search = (workspaceId, query) => searchAcross([workspaceId], query, 30);

  return { reconcile, replace, replaceMany, remove, search, searchAcross };
}

module.exports = { createIndex };
