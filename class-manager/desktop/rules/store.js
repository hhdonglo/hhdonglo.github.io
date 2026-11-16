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

module.exports = { fromBackend, append };
