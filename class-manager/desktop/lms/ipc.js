/* The LMS connector as CM's screens call it (cm:lms*). Thin on purpose: each handler reads the course, calls one module in this folder and returns the result.
   The roster found (from a file or from the LMS) waits in memory, per course, until the lecturer chooses to apply it. */
"use strict";
const fs = require("fs");
const path = require("path");
const { readTable } = require("../table");
const profiles = require("./profiles");
const config = require("./config");
const keys = require("./keys");
const { readRoster } = require("./roster-read");
const { planRoster } = require("./roster-plan");
const { applyRoster } = require("./roster-apply");
const { listAssessments } = require("./assessments");
const { buildGradebook } = require("./gradebook");
const { getToken, SCOPES } = require("./token");
const { fetchMembers } = require("./members");
const { pushGrades } = require("./push-grades");
const { toolConfig } = require("./tool-config");

const pending = new Map(); // course id -> { source, students }

function register({ on, dialog, winOf, shell, dirOf, fetchFn }) {
  const doFetch = fetchFn || ((...a) => fetch(...a));
  const classRows = (c) => c.backend.rawRows("Roster") || [];
  const summary = (c, source, students, extra) => { pending.set(c.id, { source, students }); return Object.assign({ ok: true, source, plan: planRoster(students, classRows(c)) }, extra || {}); };
  const stop = (why) => ({ ok: false, why });

  on("cm:lmsState", (c) => {
    const cfg = config.load(dirOf(c));
    return { ok: true, config: cfg, profiles: profiles.list(), assessments: listAssessments(c.backend.rawRows("Master")), pending: !!pending.get(c.id) };
  });
  on("cm:lmsSave", (c, e, s) => ({ ok: true, config: config.save(dirOf(c), s) }));

  on("cm:lmsRosterFile", async (c, e, o) => { // a roster exported from the LMS
    const r = await dialog.showOpenDialog(winOf(e), { title: "Choose the roster exported from the LMS", properties: ["openFile"], filters: [{ name: "Roster", extensions: ["csv", "xlsx", "txt", "tsv"] }] });
    if (r.canceled || !r.filePaths[0]) return null;
    try {
      const read = readRoster(await readTable(r.filePaths[0]), { profile: (o && o.profile) || config.load(dirOf(c)).profile, idColumn: o && o.idColumn });
      if (read.problem) return Object.assign(stop(read.problem), { columns: read.columns });
      return summary(c, path.basename(r.filePaths[0]), read.students, { skipped: read.skipped, repeats: read.repeats.length });
    } catch (err) { return stop(err.message); }
  });

  on("cm:lmsRosterService", async (c) => { // the roster, from the LMS directly
    const cfg = config.load(dirOf(c)), gaps = config.missing(cfg, "members");
    if (gaps.length) return stop("Not ready: " + gaps.join(" "));
    try {
      const token = await getToken(cfg, keys.loadKey(dirOf(c)), [SCOPES.members], doFetch);
      const got = await fetchMembers(cfg.membersUrl, token, doFetch);
      return summary(c, "the LMS", got.students, { unmatched: got.unmatched });
    } catch (err) { return stop(err.message); }
  });

  on("cm:lmsRosterApply", (c, e, o) => {
    const p = pending.get(c.id);
    if (!p) return stop("Read a roster first.");
    const plan = planRoster(p.students, classRows(c));
    const toAdd = o && o.addMissing ? plan.toAdd : [];
    if (toAdd.length) { const b = c.backups && c.backups.make("before LMS roster"); if (b && b.ok === false) return stop("A backup could not be made first, so nothing was added: " + b.why); }
    const done = applyRoster(c.backend, toAdd);
    pending.delete(c.id);
    return Object.assign({ ok: true }, done);
  });

  on("cm:lmsGradebookFile", async (c, e, o) => { // the file to upload to the LMS gradebook
    const cols = (o && o.columns) || [];
    if (!cols.length) return stop("Choose at least one assessment.");
    const built = buildGradebook(c.backend.rawRows("Master"), cols, (o && o.profile) || config.load(dirOf(c)).profile);
    if (!built.students) return stop("No student has a score in the chosen assessments.");
    const r = await dialog.showSaveDialog(winOf(e), { title: "Save the gradebook file", defaultPath: "class-manager-gradebook.csv", filters: [{ name: "CSV", extensions: ["csv"] }] });
    if (r.canceled || !r.filePath) return null;
    fs.writeFileSync(r.filePath, built.csv);
    shell.showItemInFolder(r.filePath);
    return { ok: true, file: r.filePath, students: built.students, noScores: built.noScores, assessments: built.assessments };
  });

  on("cm:lmsGradesService", async (c, e, o) => { // scores to the LMS gradebook; dryRun only reports
    const cfg = config.load(dirOf(c)), gaps = config.missing(cfg, "grades");
    if (gaps.length) return stop("Not ready: " + gaps.join(" "));
    if (!cfg.membersUrl) return stop("Not ready: the roster address is needed to match students to the LMS.");
    const cols = (o && o.columns) || [];
    if (!cols.length) return stop("Choose at least one assessment.");
    try {
      const key = keys.loadKey(dirOf(c));
      const members = (await fetchMembers(cfg.membersUrl, await getToken(cfg, key, [SCOPES.members], doFetch), doFetch)).students;
      const token = await getToken(cfg, key, [SCOPES.lineitem, SCOPES.score], doFetch);
      return { ok: true, dryRun: !!(o && o.dryRun), report: await pushGrades({ master: c.backend.rawRows("Master"), columns: cols, members, cfg, token, fetchFn: doFetch, dryRun: !!(o && o.dryRun) }) };
    } catch (err) { return stop(err.message); }
  });

  on("cm:lmsToolConfig", async (c, e) => { // the public key and services, for the LMS administrator
    const r = await dialog.showSaveDialog(winOf(e), { title: "Save the registration file", defaultPath: "class-manager-lms-registration.json" });
    if (r.canceled || !r.filePath) return null;
    fs.writeFileSync(r.filePath, JSON.stringify(toolConfig(keys.loadKey(dirOf(c)), "Class Manager"), null, 2));
    return { ok: true, file: r.filePath };
  });
}

module.exports = { register, pending };
