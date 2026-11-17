/* The lecturer's message on a student's phone (quiz.html).
   One job: show the message from the quiz status, on every screen the phone can be on (waiting room, question, between questions, results),
   and remove it when the lecturer clears it. The status answer is the single source: whatever the latest status says is what the phone shows,
   so a phone that joins late sees the current message, and Clear takes it away on the next status answer. */
(function (root) {
  "use strict";
  var el = null;

  // The text to show for a status answer, or null when the answer says nothing about the message (no answer, an unknown quiz).
  function textOf(d) {
    if (!d || typeof d !== "object" || d.known === false) return null;
    return typeof d.message === "string" ? d.message.trim() : "";
  }

  function make(doc) {
    var b = doc.createElement("div");
    b.id = "lecturer-msg"; b.setAttribute("role", "alert"); b.hidden = true;
    var s = doc.createElement("style");
    s.textContent = "#lecturer-msg{position:sticky;top:0;z-index:50;margin:.5rem .6rem .8rem;padding:.8rem 1rem;border:2px solid #c9a227;border-radius:8px;background:#14284b;color:#fff;font:600 1.05rem/1.4 system-ui,sans-serif;text-align:center;box-shadow:0 2px 8px rgba(0,0,0,.25)}#lecturer-msg[hidden]{display:none}#lecturer-msg small{display:block;font-weight:500;font-size:.8rem;letter-spacing:.04em;text-transform:uppercase;color:#e7c85a;margin-bottom:.15rem}";
    doc.head.appendChild(s);
    var m = doc.querySelector("main") || doc.body;
    m.insertBefore(b, m.firstChild);
    return b;
  }

  // Shows or hides the message for a status answer. Returns what is now shown.
  function apply(d, doc) {
    var t = textOf(d); doc = doc || root.document;
    if (t === null) return el && !el.hidden ? el.lastChild.textContent : "";
    if (!el) { if (!t) return ""; el = make(doc); }
    if (!t) { el.hidden = true; return ""; }
    if (el.hidden || !el.lastChild || el.lastChild.textContent !== t) {
      el.textContent = "";
      var h = doc.createElement("small"); h.textContent = "Message from your lecturer";
      var p = doc.createElement("span"); p.textContent = t;
      el.appendChild(h); el.appendChild(p);
    }
    el.hidden = false;
    return t;
  }

  var api = { textOf: textOf, apply: apply, reset: function () { el = null; } };
  root.LecturerMessage = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
