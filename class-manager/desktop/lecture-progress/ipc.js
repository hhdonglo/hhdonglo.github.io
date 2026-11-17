// The lecture progress calls: the status for the screen and the lecturer's corrections. One responsibility: pass them to rules/lecture-log.js.
"use strict";
const log = require("../rules/lecture-log");
const { fromBackend } = require("../rules/store");
const schedule = require("../rules/lecture-schedule");

// Questions per lecture in the course's banks (quizzes/lectureN.json: a list of questions, or an object holding one).
function bankCounts(c) {
  const out = {};
  c.course.bankNumbers().forEach((n) => {
    try {
      const f = c.course.resolve("quizzes/lecture" + n + ".json"), j = f ? JSON.parse(require("fs").readFileSync(f, "utf8")) : null;
      out[n] = Array.isArray(j) ? j.length : j && Array.isArray(j.questions) ? j.questions.length : 0;
    } catch (e) { out[n] = 0; }
  });
  return out;
}

function register({ on, saveSettings, dirOf }) {
  const store = (c) => fromBackend(c.backend);
  // The status plus which lectures are due, next and missed (named from the course's lecture list).
  const progress = (c) => { const p = log.report(store(c), c.settings); p.schedule = schedule.plan(p, c.course.lectures()); return p; };
  on("cm:lectureProgress", (c) => ({ ok: true, progress: progress(c) }));
  on("cm:lectureMark", (c, e, date, kind) => {
    const r = log.mark(store(c), String(date || ""), kind == null || kind === "" ? null : String(kind));
    return r.ok ? { ok: true, progress: progress(c) } : r;
  });
  on("cm:lectureNotify", (c, e, yes) => { saveSettings(c, { lectureNotify: yes === true }); return { ok: true, notify: !!c.settings.lectureNotify }; });
}

module.exports = { register, bankCounts };
