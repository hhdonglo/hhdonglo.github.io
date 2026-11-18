/* Only one main CM window set per computer. A second launch (the icon clicked again, or a second copy started) does not open a second CM:
   it quits at once and the CM that is already running comes to the front. One responsibility: the lock and the "second launch" reaction.
   Electron's app and the lookup of the window to show are passed in, so this runs without a display (test/single-instance.test.js). */
"use strict";

// Returns true when this process is the first one and may carry on starting. Returns false when another CM already runs (this one has been asked to quit).
function ensureSingle(app, frontWindow) {
  if (!app.requestSingleInstanceLock()) { app.quit(); return false; }
  app.on("second-instance", () => {
    const w = frontWindow(); if (!w) return;
    if (typeof w.isMinimized === "function" && w.isMinimized()) w.restore();
    if (typeof w.show === "function") w.show();
    w.focus();
  });
  return true;
}

module.exports = { ensureSingle };
