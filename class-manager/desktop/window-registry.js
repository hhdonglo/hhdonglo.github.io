/* One window per tool and course. Asking for a tool whose window is already open brings that window to the front
   (restored if minimised) instead of opening a second copy. Every window CM opens goes through here: the buttons
   and shortcuts (cm:openWindow) and pages that open their own (window.open, links that open a new window).
   The key is the page's own address path, which begins /c/<course>/, so two courses keep their own windows.
   The query and the # part are ignored: a running quiz window is never reloaded by a second request. */
"use strict";

function keyOf(url) {
  try { return new URL(String(url), "http://cm.local").pathname; } catch (e) { return ""; }
}

// all: optional function giving every window CM has, so a window that was opened by hand or has moved to another page is found by the page it shows now
function createWindowRegistry(all) {
  const open = new Map(); // key -> window
  const alive = (w) => !!w && !(typeof w.isDestroyed === "function" && w.isDestroyed());
  function find(url) {
    const k = keyOf(url), w = open.get(k);
    if (w && !alive(w)) open.delete(k);
    else if (w) return w;
    for (const x of (all ? all() : [])) {
      try { if (alive(x) && keyOf(x.webContents.getURL()) === k) return x; } catch (e) {}
    }
    return null;
  }
  function raise(w) {
    if (typeof w.isMinimized === "function" && w.isMinimized()) w.restore();
    if (typeof w.show === "function") w.show();
    w.focus();
  }
  // true when a window for this address was open and has been brought forward
  function focusExisting(url) {
    const w = find(url); if (!w) return false;
    raise(w); return true;
  }
  // remember a newly made window; it is forgotten when it closes
  function track(url, w) {
    const k = keyOf(url); if (!k) return w;
    open.set(k, w);
    if (typeof w.once === "function") w.once("closed", () => { if (open.get(k) === w) open.delete(k); });
    return w;
  }
  return { find, focusExisting, track, keyOf };
}

module.exports = { createWindowRegistry, keyOf };
