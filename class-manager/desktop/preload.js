/* The small set of app functions that the app's own screens may call. Student phones never see this. */
"use strict";
const { contextBridge, ipcRenderer } = require("electron");
const call = (ch) => (...a) => ipcRenderer.invoke(ch, ...a);
contextBridge.exposeInMainWorld("cmApp", {
  info: call("cm:info"), save: call("cm:save"), openWindow: call("cm:openWindow"), openExternal: call("cm:openExternal"),
  classList: call("cm:classList"), classListFile: call("cm:classListFile"), tab: call("cm:tab"), exportResults: call("cm:export"),
  openData: call("cm:openData"), run: call("cm:run"),
  googleSignIn: call("cm:googleSignIn"), googleSignOut: call("cm:googleSignOut"), googleSync: call("cm:googleSync")
});
