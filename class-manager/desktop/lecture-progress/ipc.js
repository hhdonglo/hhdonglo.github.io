// The lecture progress calls: the status for the screen and the lecturer's corrections. One responsibility: pass them to rules/lecture-log.js.
"use strict";
const log = require("../rules/lecture-log");
const { fromBackend } = require("../rules/store");

function register({ on, saveSettings }) {
  const store = (c) => fromBackend(c.backend);
  on("cm:lectureProgress", (c) => ({ ok: true, progress: log.report(store(c), c.settings) }));
  on("cm:lectureMark", (c, e, date, kind) => {
    const r = log.mark(store(c), String(date || ""), kind == null || kind === "" ? null : String(kind));
    return r.ok ? { ok: true, progress: log.report(store(c), c.settings) } : r;
  });
  on("cm:lectureNotify", (c, e, yes) => { saveSettings(c, { lectureNotify: yes === true }); return { ok: true, notify: !!c.settings.lectureNotify }; });
}

module.exports = { register };
