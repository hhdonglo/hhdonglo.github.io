/* Unlisted IDs card: remembers what the lecturer has ticked and typed, so a refresh of the list never clears it.
   CM refreshes the card every few seconds while students check in. Before this file, each refresh rebuilt the table and unticked every box,
   so a click on Discard (or Add, or Keep aside) found nothing selected and said "Select at least one student first."
   Pure logic, no screen code; tested in Node (test/unlisted-select.test.js). */
(function (root) {
  "use strict";
  function create() {
    var picked = {}, names = {}, last = "";
    return {
      tick: function (id, on) { if (on) picked[id] = true; else delete picked[id]; },
      isTicked: function (id) { return !!picked[id]; },
      type: function (id, value) { names[id] = String(value == null ? "" : value); },
      nameFor: function (id, fallback) { return Object.prototype.hasOwnProperty.call(names, id) ? names[id] : fallback; },
      // After a fresh list arrives: forget IDs that are no longer shown (decided, or gone), keep the rest.
      prune: function (items) {
        var ids = {}; items.forEach(function (x) { ids[x.id] = true; });
        Object.keys(picked).forEach(function (id) { if (!ids[id]) delete picked[id]; });
        Object.keys(names).forEach(function (id) { if (!ids[id]) delete names[id]; });
      },
      // True when the list differs from the one drawn last time; an unchanged list is not redrawn at all.
      changed: function (items) { var s = JSON.stringify(items); if (s === last) return false; last = s; return true; },
      forget: function () { last = ""; },
      clearTicks: function () { picked = {}; }
    };
  }
  var api = { create: create };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.cmUnlistedSelect = api;
})(typeof window !== "undefined" ? window : this);
