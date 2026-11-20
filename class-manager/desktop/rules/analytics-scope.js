"use strict";

// Calculations keep their existing rules, but can only read evidence owned by enabled modules.
const { modules } = require("../module-registry");
const sourceModules = ["attendance", "liveQuizzes", "practice", "groups", "assignments"];

function scopedStore(store, enabled) {
  const hidden = new Set(sourceModules.filter(id => !enabled.includes(id)).flatMap(id => modules[id].records));
  if (!hidden.size) return store;
  return { ...store, rows: table => hidden.has(table) ? null : store.rows(table) };
}

module.exports = { scopedStore };
