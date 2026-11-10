/* Class manager configuration. This is the one file to edit when the package is
   set up for a course or a new Apps Script deployment. Public values only:
   never put the host key, a class list or student data here.
   The desktop app writes this part itself from its Course settings. */
window.CM = {
  courseCode: "",                         // for example "BIO 101"
  courseTitle: "",
  institution: "",
  lecturer: "",
  semester: "",
  contact: "",                            // shown to students for questions about their records, for example an email address
  accent: "",                             // optional header colour, for example "#1F3A68"
  logo: "",                               // optional logo image next to the course code
  notice: null,                           // optional notice on course pages: { text, linkLabel, linkUrl }
  reportForm: null,                       // optional Google Form for question reports: { FORM_URL, ENTRY: { lecture, id, question, answer, comment } }
  leaderboardCsv: "",                     // optional published CSV of the live quiz ranking
  // The Apps Script web app address (Deploy > Manage deployments > Web app URL).
  scriptUrl: ""
};

/* Helpers used by the pages. Nothing below needs editing. */
(function (CM) {
  "use strict";
  // Full address of a page that sits next to the current one, wherever the package is served.
  CM.pageUrl = function (name) { return new URL(name, CM.publicBase || location.href).href.replace(/[?#].*$/, ""); }; // publicBase: the desktop app's internet address, when it is on
  // The quiz page with the join code filled in, for QR codes on the projector and on students' phones.
  CM.joinUrl = function (code) { return CM.pageUrl("quiz.html") + (code ? "?code=" + encodeURIComponent(String(code).toUpperCase()) : ""); };
  CM.drawQr = function (img, url) {
    if (!img || typeof qrcode !== "function") return;
    if (img.getAttribute("data-qr-url") === url) return; // already drawn
    try { var q = qrcode(0, "M"); q.addData(url); q.make(); img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(q.createSvgTag({ cellSize: 8, margin: 2, scalable: true })); img.setAttribute("data-qr-url", url); } catch (e) { /* the address is shown beside the code */ }
  };
  // Every request to the class server goes through CM.call: by POST, so that host keys, access codes and sessions never
  // appear in a web address (browser history, server logs). When a key or code is accepted, the answer carries _session,
  // a signed session that expires; it then replaces that key or code in this page and wherever the page remembered it,
  // so the key or code itself is not kept. cb(data or null, milliseconds).
  var swap = {};
  function remember(old, tok) {
    swap[old] = tok;
    [window.sessionStorage, window.localStorage].forEach(function (st) {
      try { for (var i = 0; i < st.length; i++) { var k = st.key(i); if (st.getItem(k) === old) st.setItem(k, tok); } } catch (e) { /* storage off */ }
    });
  }
  CM.call = function (params, cb, ms) {
    var b = new URLSearchParams(params), t0 = Date.now(), done = false, timer;
    b.delete("callback");
    ["hostkey", "code", "access"].forEach(function (k) { var v = b.get(k); if (v && swap[v]) b.set(k, swap[v]); });
    function end(d) { if (done) return; done = true; clearTimeout(timer); cb(d, Date.now() - t0); }
    if (!CM.scriptUrl) { setTimeout(function () { end(null); }, 0); return; }
    timer = setTimeout(function () { end(null); }, ms || 30000);
    fetch(CM.scriptUrl, { method: "POST", body: b, cache: "no-store", credentials: "omit" })
      .then(function (r) { return r.text(); })
      .then(function (t) {
        var d = null; try { d = JSON.parse(t); } catch (e) { d = null; }
        var tok = d && d._session; if (tok) delete d._session;
        end(d);
        if (tok) { var old = tok.split(".")[1] === "h" ? b.get("hostkey") : (b.get("access") || b.get("code")); if (old && old !== tok) remember(old, tok); } // after the page has saved what it typed
      }, function () { end(null); });
  };
  var parts = [CM.courseCode, CM.courseTitle, CM.institution].filter(Boolean);
  CM.footer = parts.length ? parts.join(" · ") + " · " : "";
  CM.courseHeading = (CM.courseCode || "Course") + (CM.courseTitle ? ": " + CM.courseTitle : "");
  // Accent colour for the header, buttons and links.
  if (/^#[0-9a-f]{6}$/i.test(CM.accent || "")) {
    var r = document.documentElement.style;
    r.setProperty("--navy", CM.accent); r.setProperty("--primary-bg", CM.accent); r.setProperty("--link", CM.accent); r.setProperty("--btn-text", CM.accent);
    r.setProperty("--navy-deep", "color-mix(in srgb, " + CM.accent + " 70%, #000)");
  }
  function fill() {
    // Course labels in the header, crumbs and footer.
    document.querySelectorAll("[data-cm]").forEach(function (el) {
      var v = CM[el.getAttribute("data-cm")]; if (v) el.textContent = v;
    });
    if (CM.courseCode && document.title.indexOf(CM.courseCode) < 0) document.title += " | " + CM.courseCode;
    if (CM.logo) document.querySelectorAll("header.banner h1").forEach(function (h) {
      if (h.querySelector(".cm-logo")) return;
      var i = document.createElement("img"); i.className = "cm-logo"; i.src = CM.logo; i.alt = ""; i.height = 48;
      i.style.cssText = "height:1.4em;width:auto;vertical-align:-.25em;margin-right:.45em;border-radius:4px;background:#fff";
      h.insertBefore(i, h.firstChild);
    });
    var n = CM.notice;
    document.querySelectorAll("[data-cm-notice]").forEach(function (a) {
      if (!n || !n.text) return;
      var w = document.createElement("div"); w.className = "wrap cm-notice"; w.setAttribute("role", "note");
      var p = document.createElement("p"); p.textContent = n.text; w.appendChild(p);
      if (n.linkUrl && /^https?:/.test(n.linkUrl)) { var l = document.createElement("a"); l.className = "cm-notice-link"; l.href = n.linkUrl; l.target = "_blank"; l.rel = "noopener"; l.textContent = n.linkLabel || n.linkUrl; w.appendChild(l); }
      a.appendChild(w); a.hidden = false;
    });
    // Join addresses and QR codes for the live quiz (host and projector pages).
    document.querySelectorAll("[data-addr]").forEach(function (el) {
      el.textContent = CM.pageUrl(el.getAttribute("data-addr")).replace(/^https?:\/\//, "");
    });
    document.querySelectorAll("img[data-qr]").forEach(function (img) {
      if (typeof qrcode !== "function") return;
      try {
        var q = qrcode(0, "M"); q.addData(CM.pageUrl(img.getAttribute("data-qr"))); q.make();
        img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(q.createSvgTag({ cellSize: 8, margin: 2, scalable: true }));
      } catch (e) { /* the address is shown beside the code */ }
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fill); else fill();
})(window.CM);
