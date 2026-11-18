/* The small set of app functions that CM's own screens may call. Student phones never see this. */
"use strict";
const { contextBridge, ipcRenderer } = require("electron");
try { const k = ipcRenderer.sendSync("cm:sessionKey"); if (k) sessionStorage.setItem("cm_hk", k); } catch (e) { /* not signed in yet */ }
// A call refused because an earlier setup stage is not done (first-run/stages.js) shows one notice, with a button to that stage, on whichever page made the call.
function gateNotice(r) {
  try {
    const old = document.getElementById("cm-gate"); if (old) old.remove();
    const box = document.createElement("div"); box.id = "cm-gate"; box.setAttribute("role", "alert");
    box.style.cssText = "position:fixed;left:50%;bottom:1.2rem;transform:translateX(-50%);z-index:99999;max-width:36rem;padding:.9rem 1.1rem;border-radius:10px;background:#1f3a68;color:#fff;border:2px solid #c9a227;font:15px/1.4 system-ui,sans-serif;box-shadow:0 6px 24px rgba(0,0,0,.35)";
    const t = document.createElement("p"); t.style.margin = "0 0 .6rem"; t.textContent = r.why; box.appendChild(t);
    const go = document.createElement("button"); go.textContent = r.button || "Continue setup"; go.style.cssText = "margin-right:.6rem;padding:.4rem .9rem;border-radius:8px;border:0;background:#c9a227;color:#1f3a68;font-weight:700;cursor:pointer";
    go.onclick = () => { location.href = r.goto; }; box.appendChild(go);
    const x = document.createElement("button"); x.textContent = "Close"; x.style.cssText = "padding:.4rem .9rem;border-radius:8px;border:1px solid #fff;background:transparent;color:#fff;cursor:pointer"; x.onclick = () => box.remove(); box.appendChild(x);
    (document.body || document.documentElement).appendChild(box);
  } catch (e) { /* the page is not ready; the refusal still reaches it */ }
}
const call = (ch) => async (...a) => { const r = await ipcRenderer.invoke(ch, ...a); if (r && r.ok === false && r.needs && r.goto) gateNotice(r); return r; };
contextBridge.exposeInMainWorld("cmApp", {
  info: call("cm:info"), live: call("cm:live"), stamp: call("cm:stamp"), folderDetails: call("cm:folderDetails"), removeStudent: call("cm:removeStudent"), restoreStudent: call("cm:restoreStudent"), removeEntries: call("cm:removeEntries"), restoreEntries: call("cm:restoreEntries"), stats: call("cm:stats"), analyticsExtra: call("cm:analyticsExtra"), addIntervention: call("cm:addIntervention"), govern: call("cm:govern"), weeklySummary: call("cm:weeklySummary"), studentStats: call("cm:studentStats"), progress: call("cm:progress"), save: call("cm:save"), openWindow: call("cm:openWindow"), openExternal: call("cm:openExternal"),
  tab: call("cm:tab"), exportResults: call("cm:export"), exportExcel: call("cm:exportExcel"), saveExcel: call("cm:saveExcel"),
  openData: call("cm:openData"), backToTools: call("cm:backToTools"), run: call("cm:run"),
  authStatus: call("cm:authStatus"), authSettings: call("cm:authSettings"), libList: call("cm:libList"), libAdd: call("cm:libAdd"),
  libAddPaths: call("cm:libAddPaths"), libRemove: call("cm:libRemove"), libSet: call("cm:libSet"), libPassages: call("cm:libPassages"),
  search: call("cm:search"), summarise: call("cm:summarise"), generate: call("cm:generate"), banks: call("cm:banks"), bankTitle: call("cm:bankTitle"),
  drafts: call("cm:drafts"), draftsAdd: call("cm:draftsAdd"), draftUpdate: call("cm:draftUpdate"), draftsReject: call("cm:draftsReject"),
  approve: call("cm:approve"), withdraw: call("cm:withdraw"), importFile: call("cm:importFile"), importText: call("cm:importText"), saveTemplate: call("cm:saveTemplate"),
  filePath: (f) => { try { return require("electron").webUtils.getPathForFile(f); } catch (e) { return ""; } },
  centralStatus: call("cm:centralStatus"), centralLogin: call("cm:centralLogin"), centralCreate: call("cm:centralCreate"), centralRecover: call("cm:centralRecover"),
  firstRunState: call("cm:firstRunState"), bankFolderPick: call("cm:bankFolderPick"), bankFolderLoad: call("cm:bankFolderLoad"),
  setup: call("cm:setup"), saveCourse: call("cm:saveCourse"), setupSeen: call("cm:setupSeen"), chooseLogo: call("cm:chooseLogo"),
  rosterShotsRead: call("cm:rosterShotsRead"), rosterShotsPreview: call("cm:rosterShotsPreview"), rosterShotsSave: call("cm:rosterShotsSave"),
  lectures: call("cm:lectures"), saveLecture: call("cm:saveLecture"), removeLecture: call("cm:removeLecture"), lectureFile: call("cm:lectureFile"),
  importPack: call("cm:importPack"), exportPack: call("cm:exportPack"),
  courses: call("cm:courses"), addCourse: call("cm:addCourse"), updateCourse: call("cm:updateCourse"), archiveCourse: call("cm:archiveCourse"),
  switchCourse: call("cm:switchCourse"), linkFolder: call("cm:linkFolder"), pullCourse: call("cm:pullCourse"), openContent: call("cm:openContent"),
  lectureProgress: call("cm:lectureProgress"), lectureMark: call("cm:lectureMark"), lectureNotify: call("cm:lectureNotify"), lectureOverview: call("cm:lectureOverview"), lectureFileView: call("cm:lectureFileView"), lectureFileUpdate: call("cm:lectureFileUpdate"), lectureFileChoose: call("cm:lectureFileChoose"), lectureFileReplace: call("cm:lectureFileReplace"), lectureFileDetach: call("cm:lectureFileDetach"), lectureFileUndo: call("cm:lectureFileUndo"), lectureDescription: call("cm:lectureDescription"),
  unlistedList: call("cm:unlistedList"), unlistedCount: call("cm:unlistedCount"), unlistedAdd: call("cm:unlistedAdd"), unlistedReject: call("cm:unlistedReject"), unlistedRestore: call("cm:unlistedRestore"),
  idNotices: call("cm:idNotices"), signinProblems: call("cm:signinProblems"), signinDismiss: call("cm:signinDismiss"), idResolve: call("cm:idResolve"), addIntervention: call("cm:addIntervention"),
  importPick: call("cm:importPick"), resetDescribe: call("cm:resetDescribe"), importPlan: call("cm:importPlan"), importApply: call("cm:importApply"), importForget: call("cm:importForget"), importTemplate: call("cm:importTemplate"),
  offListScan: call("cm:offListScan"), offListSetAside: call("cm:offListSetAside"), offListRestore: call("cm:offListRestore"), autoState: call("cm:autoState"), resetList: call("cm:resetList"), resetCourse: call("cm:resetCourse"), resetRestore: call("cm:resetRestore"), autoPick: call("cm:autoPick"), autoPickFiles: call("cm:autoPickFiles"), autoScan: call("cm:autoScan"), autoWatch: call("cm:autoWatch"), autoPlan: call("cm:autoPlan"), autoQuestions: call("cm:autoQuestions"), autoCourse: call("cm:autoCourse"), studentNote: call("cm:studentNote"), autoCourseSave: call("cm:autoCourseSave"), autoExport: call("cm:autoExport"), autoOpenWorking: call("cm:autoOpenWorking"),
  onAutoProgress: (fn) => { ipcRenderer.on("cm:autoProgress", (e, p) => fn(p)); }, onAutoChanged: (fn) => { ipcRenderer.on("cm:autoChanged", () => fn()); },
  onAutoQuestionsProgress: (fn) => { ipcRenderer.on("cm:autoQuestionsProgress", (e, p) => fn(p)); },
  onImportProgress: (fn) => { ipcRenderer.on("cm:importProgress", (e, p) => fn(p)); },
  llmPreview: call("cm:llmPreview"), llmSave: call("cm:llmSave"), llmLookup: call("cm:llmLookup"),
  grades: call("cm:grades"), gradesTimeline: call("cm:gradesTimeline"),
  mailboxStatus: call("cm:mailboxStatus"), mailboxSetup: call("cm:mailboxSetup"), mailboxClear: call("cm:mailboxClear"), mailboxPull: call("cm:mailboxPull"),
  lmsState: call("cm:lmsState"), lmsSave: call("cm:lmsSave"), lmsRosterFile: call("cm:lmsRosterFile"), lmsRosterService: call("cm:lmsRosterService"), lmsGradebookFile: call("cm:lmsGradebookFile"), lmsGradesService: call("cm:lmsGradesService"), lmsToolConfig: call("cm:lmsToolConfig"),
  readme: call("cm:readme"), tunnelStart: call("cm:tunnelStart"), tunnelStop: call("cm:tunnelStop"), security: call("cm:security"), saveSecurity: call("cm:saveSecurity"),
  backups: call("cm:backups"), backupNow: call("cm:backupNow"), backupCheck: call("cm:backupCheck"), backupRestore: call("cm:backupRestore"), backupExport: call("cm:backupExport"), backupImport: call("cm:backupImport"),
  linkedState: call("cm:linkedState"), linkedChoose: call("cm:linkedChoose"), linkedLink: call("cm:linkedLink"), linkedCopy: call("cm:linkedCopy"), linkedUnlink: call("cm:linkedUnlink"), linkedOpen: call("cm:linkedOpen"), linkedRestore: call("cm:linkedRestore"),
  syncState: call("cm:syncState"), syncItems: call("cm:syncItems"), syncNow: call("cm:syncNow"), openNotes: call("cm:openNotes"),
  onTunnel: (fn) => { ipcRenderer.on("cm:tunnel", (e, st) => fn(st)); },
  passwordStatus: call("cm:passwordStatus"), setPassword: call("cm:setPassword")
});
