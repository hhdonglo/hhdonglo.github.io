"use strict";

const { courseStats } = require("./course-analytics");

// Class analytics reads use the course context resolved by the desktop IPC wrapper.
function statOpts(options) {
  const params = {};
  for (const key of ["effort", "perf", "idle", "misses", "id"]) {
    if (options && options[key] !== undefined && options[key] !== "") {
      params[key] = String(options[key]).slice(0, 20);
    }
  }
  return params;
}

function register({ on }) {
  on("cm:stats", (c, e, o) => { try { return courseStats(c.backend, statOpts(o)); } catch (err) { return { ok: false, why: err.message }; } });
  on("cm:studentStats", (c, e, o) => { try { return c.backend.studentStats(statOpts(o)); } catch (err) { return { ok: false, why: err.message }; } });
  on("cm:progress", (c) => { try { return c.backend.progress({}); } catch (err) { return { ok: false, why: err.message }; } });
}

module.exports = { register };
