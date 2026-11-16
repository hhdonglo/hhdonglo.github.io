/* The store the rules work on: rows of named tabs and a few settings. One responsibility: adapt a CM backend (backend.js) to that interface.
   A later stage gives the same interface to SQL tables directly. */
"use strict";

function fromBackend(backend, now) {
  return {
    rows: (tab) => backend.rawRows(tab),
    setRows: (tab, rows) => backend.setRows(tab, rows),
    prop: (k) => backend.prop(k),
    setProp: (k, v) => backend.setProp(k, v),
    now: now || (() => new Date())
  };
}

// Adds a line to a tab, creating the tab with its header when it is missing.
function append(store, tab, header, row) {
  const rows = store.rows(tab) || [header.slice()];
  if (!rows.length) rows.push(header.slice());
  rows.push(row);
  store.setRows(tab, rows);
}

// One line in the Log tab, as the script's log_ writes it: [time, outcome, first name, ID, join code].
function logLine(store, outcome, name, id, code) {
  try { append(store, "Log", ["Timestamp", "Outcome", "First Name", "ID", "Join Code"], [store.now(), outcome, name || "", id || "", code || ""]); } catch (e) { /* logging never stops a request */ }
}

module.exports = { fromBackend, append, logLine };
