/* Class Manager: the rules behind the lecture view and presentation mode. One responsibility: plain functions with no screen and no files,
   so they can be tested and changed in one place. Used by view.js and present.js. */
(function (root) {
  "use strict";

  // Where a lecture stands, from the numbers of lecture-progress/ipc.js ({ target, held, schedule: { due, next, missed } }).
  // Returns { key, label } or null when the course has no lecture target (nothing is guessed).
  function lectureState(n, p) {
    if (!p || !(p.target > 0) || !(n >= 1) || n > p.target) return null;
    const sch = p.schedule || {}, held = Math.max(0, Math.floor(p.held || 0));
    if (n <= held) return { key: "held", label: "Held" };
    if ((sch.missed || []).some((m) => m.number === n)) return { key: "missed", label: "Due and not yet held" };
    if (sch.due && sch.due.number === n) return { key: "due", label: "Due now" };
    if (sch.next && sch.next.number === n) return { key: "next", label: "Next to teach" };
    return { key: "later", label: "Not yet due" };
  }

  // The slides can be shown page by page only when they are a PDF.
  function slidesKind(chip) {
    if (!chip) return "none";
    return /\.pdf$/i.test(chip.rel || "") ? "pdf" : "other";
  }

  function clampPage(page, pages) {
    const total = Math.max(1, Math.floor(pages) || 1);
    return Math.min(total, Math.max(1, Math.floor(page) || 1));
  }

  // The key a presenter presses -> what happens. Letters are matched in either case.
  const KEYS = {
    ArrowRight: "next", ArrowDown: "next", PageDown: "next", " ": "next", Enter: "next",
    ArrowLeft: "prev", ArrowUp: "prev", PageUp: "prev", Backspace: "prev",
    Home: "first", End: "last", Escape: "exit",
    b: "blank", ".": "blank", t: "theme", r: "reset", p: "pause", f: "full", "?": "help", h: "help"
  };
  function keyAction(key) { return KEYS[key] || KEYS[String(key).toLowerCase()] || null; }

  function movePage(page, action, pages) {
    const to = action === "next" ? page + 1 : action === "prev" ? page - 1 : action === "first" ? 1 : action === "last" ? pages : page;
    return clampPage(to, pages);
  }

  // Elapsed milliseconds -> "mm:ss", or "h:mm:ss" from one hour.
  function clock(ms) {
    const s = Math.max(0, Math.floor(ms / 1000)), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
    const two = (v) => (v < 10 ? "0" : "") + v;
    return h ? h + ":" + two(m) + ":" + two(x) : two(m) + ":" + two(x);
  }

  // The address of one page of a PDF in the viewer built into CM, without its toolbar.
  function pageUrl(url, page) { return String(url).split("#")[0] + "#page=" + page + "&toolbar=0&navpanes=0&scrollbar=0&view=Fit"; }

  const api = { lectureState, slidesKind, clampPage, keyAction, movePage, clock, pageUrl, KEYS };
  if (typeof module === "object" && module.exports) module.exports = api; else root.cmLectureState = api;
})(typeof window !== "undefined" ? window : globalThis);
