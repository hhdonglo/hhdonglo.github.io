// The order of first-run setup, and which calls wait for which stage. Pure: no disk, no screen.
// Order (Hope, 2026-11-16): 1 password, 2 class roster, 3 course material (folder, quizzes). A later stage never opens before an earlier one is done.
"use strict";

const ORDER = ["password", "roster", "material"];

// the password counts once it is chosen; the temporary key at the start does not.
function stageOf(s) {
  s = s || {};
  const done = { password: !!s.passwordChosen, roster: Number(s.roster || 0) > 0, material: Number(s.banks || 0) > 0 || !!s.hasContent };
  const open = { password: true, roster: done.password, material: done.password && done.roster };
  const current = ORDER.find((k) => !done[k]) || "done";
  return { done, open, current, complete: current === "done" };
}

// Calls that wait for a stage (everything else is never held back).
const NEEDS = {
  "cm:saveCourse": "password",
  "cm:rosterShotsRead": "password", "cm:rosterShotsPreview": "password", "cm:rosterShotsSave": "password",
  "cm:saveLecture": "roster", "cm:removeLecture": "roster", "cm:lectureFile": "roster", "cm:importPack": "roster",
  "cm:libAdd": "roster", "cm:libAddPaths": "roster", "cm:generate": "roster", "cm:autoQuestions": "roster", "cm:autoCourseSave": "roster",
  "cm:bankFolderPick": "roster", "cm:bankFolderLoad": "roster",
  // Every other upload: it is checked against the roster, so it waits for the roster too.
  "cm:importPick": "roster", "cm:importPlan": "roster", "cm:importApply": "roster", "cm:importFile": "roster", "cm:importText": "roster",
  "cm:autoPick": "roster", "cm:autoPickFiles": "roster", "cm:autoScan": "roster", "cm:autoPlan": "roster", "cm:autoCourse": "roster",
  "cm:lmsRosterFile": "roster", "cm:lmsRosterService": "roster"
};
// Where the button on a refusal takes the lecturer, per missing stage.
const GOTO = { password: "login.html", roster: "setup.html#class" };
const BUTTON = { password: "Choose the password", roster: "Add the class roster" };
const WHY = {
  password: "Choose the password first. It is the first step of setting up a course in CM.",
  roster: "Add the class roster first. Everything else you add to CM (course material, quizzes, results, attendance, files from a learning management system) is checked against it."
};

// null when the call may go ahead, otherwise the refusal the screen shows. A call waits until the stage it needs is done (and so every stage before it).
function refusal(channel, stage) {
  const need = NEEDS[channel];
  if (!need) return null;
  const missing = ORDER.slice(0, ORDER.indexOf(need) + 1).find((k) => !stage.done[k]);
  return missing ? { ok: false, needs: missing, why: WHY[missing], goto: GOTO[missing], button: BUTTON[missing] } : null;
}

// Page requests that would give one course its own password or recovery code. There is one CM password and one recovery code (central-login.js); these are refused.
const changesPassword = (p) => { const a = String((p && p.action) || ""); return a === "setkey" || a === "password_recover"; };
const passwordRefusal = () => JSON.stringify({ ok: false, why: "There is one password for the whole of CM. Change it in CM, under More tools, CM password." });

module.exports = { GOTO, changesPassword, passwordRefusal, ORDER, NEEDS, stageOf, refusal };
