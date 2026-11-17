// The lecture progress calls: the status for the screen and the lecturer's corrections. One responsibility: pass them to rules/lecture-log.js.
"use strict";
const log = require("../rules/lecture-log");
const { fromBackend } = require("../rules/store");

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
  on("cm:lectureProgress", (c) => ({ ok: true, progress: log.report(store(c), c.settings) }));
  on("cm:lectureMark", (c, e, date, kind) => {
    const r = log.mark(store(c), String(date || ""), kind == null || kind === "" ? null : String(kind));
    return r.ok ? { ok: true, progress: log.report(store(c), c.settings) } : r;
  });
  on("cm:lectureOverview", async (c) => { // Lecture 1 to the last, from the course folder and what the course lists
    try { const files = (await require("../autoload/scan").listFiles(dirOf(c))).files; return Object.assign({ ok: true }, require("./overview").overview(files, c.course.lectures(), bankCounts(c))); } catch (e) { return { ok: false, why: e.message }; }
  });
  on("cm:lectureNotify", (c, e, yes) => { saveSettings(c, { lectureNotify: yes === true }); return { ok: true, notify: !!c.settings.lectureNotify }; });
}

module.exports = { register };
