// The lecture progress calls: the status for the screen and the lecturer's corrections. One responsibility: pass them to rules/lecture-log.js.
"use strict";
const log = require("../rules/lecture-log");
const { fromBackend } = require("../rules/store");
const schedule = require("../rules/lecture-schedule");

function register({ on, saveSettings, dirOf }) {
  const store = (c) => fromBackend(c.backend);
  // The status plus which lectures are due, next and missed (named from the course's lecture list).
  const progress = (c) => { const p = log.report(store(c), c.settings); p.schedule = schedule.plan(p, c.course.lectures()); return p; };
  on("cm:lectureProgress", (c) => ({ ok: true, progress: progress(c) }));
  on("cm:lectureMark", (c, e, date, kind) => {
    const r = log.mark(store(c), String(date || ""), kind == null || kind === "" ? null : String(kind));
    return r.ok ? { ok: true, progress: progress(c) } : r;
  });
  on("cm:lectureOverview", async (c) => { // Lecture 1 to the last, from the course folder and what the course lists
    try { const files = (await require("../autoload/scan").listFiles(dirOf(c))).files; return Object.assign({ ok: true }, require("./overview").overview(files, c.course.lectures())); } catch (e) { return { ok: false, why: e.message }; }
  });
  on("cm:lectureNotify", (c, e, yes) => { saveSettings(c, { lectureNotify: yes === true }); return { ok: true, notify: !!c.settings.lectureNotify }; });
}

module.exports = { register };
