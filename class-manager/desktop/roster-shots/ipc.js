// The Class Roster page's calls (cm:rosterShots*): read screenshots, show a preview, save the confirmed list.
// This is the ONLY place that adds students to a course (roster-shots/README.md). Every other file is checked against the list and never adds to it.
"use strict";
const { readShots } = require("./vision");
const { review } = require("./review");

const listOf = (c) => { const names = {}; (c.backend.rawRows("Roster") || []).slice(1).forEach((r) => { if (r && r[0] !== "" && r[0] != null) names[String(r[0])] = String(r[1] || ""); }); return { names }; };

function register({ on }) {
  // Screenshots from the screen (chosen, dropped or pasted) -> what was read, checked, for the lecturer to correct.
  on("cm:rosterShotsRead", async (c, e, images) => {
    if (!c.authoring.status().hasKey) return { ok: false, needKey: true, why: "Reading screenshots uses your Anthropic API key. Add it under Settings, or type the list into the table instead." };
    try {
      const found = await readShots(images, c.authoring.askJson);
      return { ok: true, found, review: review(found, listOf(c)), listed: Object.keys(listOf(c).names).length };
    } catch (err) { return { ok: false, why: err.message }; }
  });

  // What the rows in the table amount to, asked of CM so that the screen holds no rules of its own.
  on("cm:rosterShotsPreview", (c, e, o) => review((o && Array.isArray(o.rows) ? o.rows : []), listOf(c), o && o.choices));

  // The same check again on what the lecturer confirmed (never trust the screen), then a backup, then the save. Re-adding the same screenshot adds nobody.
  on("cm:rosterShotsSave", (c, e, o) => {
    o = o || {};
    const r = review(Array.isArray(o.rows) ? o.rows : [], listOf(c), o.choices);
    if (r.conflicts.length) return { ok: false, why: r.conflicts.length + " ID" + (r.conflicts.length === 1 ? " was" : "s were") + " read with two different names. Choose one name for each before saving.", review: r };
    if (r.ambiguous.length) return { ok: false, why: r.ambiguous.length + " ID" + (r.ambiguous.length === 1 ? " cannot" : "s cannot") + " be read with certainty. Correct or delete " + (r.ambiguous.length === 1 ? "it" : "them") + " before saving.", review: r };
    if (!r.students.length) return { ok: false, why: "No student IDs to save." };
    c.backend.flush();
    const backup = c.backups && c.backups.make(o.replace ? "before replacing the class list" : "before adding to the class list");
    if (backup && backup.ok === false) return { ok: false, why: "A backup could not be made first, so nothing was saved: " + backup.why };
    const done = c.backend.rosterSync(r.students.map((s) => [s.id, s.name]), !!o.replace);
    if (!done || done.ok === false) return { ok: false, why: (done && done.why) || "The class list could not be saved." };
    const built = c.backend.buildFromRoster(); // a row for every student in Attendance, Master and Scores
    c.backend.flush();
    return { ok: true, added: done.added, unchanged: done.unchanged, removed: done.removed || 0, differsFromList: r.differsFromList, merged: r.merged, built, backup: backup && backup.name ? backup.name : "" };
  });
}

module.exports = { register, listOf };
