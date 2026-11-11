/* The small set of app functions that the app's own screens may call. Student phones never see this. */
"use strict";
const { contextBridge, ipcRenderer } = require("electron");
const call = (ch) => (...a) => ipcRenderer.invoke(ch, ...a);
contextBridge.exposeInMainWorld("cmApp", {
  info: call("cm:info"), live: call("cm:live"), stats: call("cm:stats"), studentStats: call("cm:studentStats"), progress: call("cm:progress"), save: call("cm:save"), openWindow: call("cm:openWindow"), openExternal: call("cm:openExternal"),
  classList: call("cm:classList"), classListFile: call("cm:classListFile"), tab: call("cm:tab"), exportResults: call("cm:export"), exportExcel: call("cm:exportExcel"), saveExcel: call("cm:saveExcel"),
  openData: call("cm:openData"), run: call("cm:run"),
  authStatus: call("cm:authStatus"), authSettings: call("cm:authSettings"), libList: call("cm:libList"), libAdd: call("cm:libAdd"),
  libAddPaths: call("cm:libAddPaths"), libRemove: call("cm:libRemove"), libSet: call("cm:libSet"), libPassages: call("cm:libPassages"),
  search: call("cm:search"), summarise: call("cm:summarise"), generate: call("cm:generate"), banks: call("cm:banks"), bankTitle: call("cm:bankTitle"),
  drafts: call("cm:drafts"), draftsAdd: call("cm:draftsAdd"), draftUpdate: call("cm:draftUpdate"), draftsReject: call("cm:draftsReject"),
  approve: call("cm:approve"), withdraw: call("cm:withdraw"), importFile: call("cm:importFile"), importText: call("cm:importText"), saveTemplate: call("cm:saveTemplate"),
  filePath: (f) => { try { return require("electron").webUtils.getPathForFile(f); } catch (e) { return ""; } },
  setup: call("cm:setup"), saveCourse: call("cm:saveCourse"), setupSeen: call("cm:setupSeen"), chooseLogo: call("cm:chooseLogo"),
  tableFile: call("cm:tableFile"), tableText: call("cm:tableText"), classRows: call("cm:classRows"), sampleClassList: call("cm:sampleClassList"),
  lectures: call("cm:lectures"), saveLecture: call("cm:saveLecture"), removeLecture: call("cm:removeLecture"), lectureFile: call("cm:lectureFile"),
  importPack: call("cm:importPack"), exportPack: call("cm:exportPack"),
  courses: call("cm:courses"), addCourse: call("cm:addCourse"), updateCourse: call("cm:updateCourse"), archiveCourse: call("cm:archiveCourse"),
  switchCourse: call("cm:switchCourse"), linkFolder: call("cm:linkFolder"), pullCourse: call("cm:pullCourse"), openContent: call("cm:openContent"),
  readme: call("cm:readme"), tunnelStart: call("cm:tunnelStart"), tunnelStop: call("cm:tunnelStop"), security: call("cm:security"), saveSecurity: call("cm:saveSecurity"),
  backups: call("cm:backups"), backupNow: call("cm:backupNow"), backupCheck: call("cm:backupCheck"), backupRestore: call("cm:backupRestore"), backupExport: call("cm:backupExport"), backupImport: call("cm:backupImport"),
  linkedState: call("cm:linkedState"), linkedChoose: call("cm:linkedChoose"), linkedLink: call("cm:linkedLink"), linkedCopy: call("cm:linkedCopy"), linkedUnlink: call("cm:linkedUnlink"), linkedOpen: call("cm:linkedOpen"), linkedRestore: call("cm:linkedRestore"),
  syncState: call("cm:syncState"), syncItems: call("cm:syncItems"), syncNow: call("cm:syncNow"), openNotes: call("cm:openNotes"),
  onTunnel: (fn) => { ipcRenderer.on("cm:tunnel", (e, st) => fn(st)); },
  resetPassword: call("cm:resetPassword"), googleSignIn: call("cm:googleSignIn"), googleSignOut: call("cm:googleSignOut"), googleSync: call("cm:googleSync")
});
