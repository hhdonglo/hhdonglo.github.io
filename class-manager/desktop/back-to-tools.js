/* "Back to Class Tools" in a tool window (Attendance, Quiz): bring the one main CM window to the front and close the tool window.
   The main window is never reloaded or navigated, so the dashboard keeps its state; nothing opens a second main window unless the main window is gone.
   One responsibility: choose the main window and do the raise-then-close. Electron's windows are passed in, so this runs without a display (test/back-to-tools.test.js). */
"use strict";

const alive = (w) => !!w && !(typeof w.isDestroyed === "function" && w.isDestroyed());

// opts: { from: the window that asked, main: () => the main window (or null), all: () => every window, reopen: () => a new main window }
// Returns {ok, target: the window now in front, closed: bool}.
function backToTools(opts) {
  const from = opts.from, all = opts.all ? opts.all() : [];
  let target = opts.main ? opts.main() : null;
  if (!alive(target)) {
    // the main window was replaced: any other window that is showing Class Tools or the CM home
    target = all.find((w) => alive(w) && w !== from && /\/app\/home\.html/.test(safeUrl(w))) || null;
  }
  if (!target && opts.reopen) target = opts.reopen();
  if (!alive(target)) return { ok: false, closed: false };
  if (typeof target.isMinimized === "function" && target.isMinimized()) target.restore();
  if (typeof target.show === "function") target.show();
  target.focus();
  let closed = false;
  if (alive(from) && from !== target) { from.close(); closed = true; } // the tool window goes away; its address is forgotten by the window registry when it closes
  return { ok: true, target, closed };
}

function safeUrl(w) { try { return w.webContents.getURL(); } catch (e) { return ""; } }

module.exports = { backToTools };
