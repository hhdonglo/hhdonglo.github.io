/* Class manager configuration. This is the one file to edit when the package is
   set up for a new course or a new Apps Script deployment. Public values only:
   never put the host key, a class list or student data here. */
window.CM = {
  courseCode: "PHYS 143",
  courseTitle: "Mechanics and Thermal Physics",
  institution: "University of Ghana",
  // The Apps Script web app address (Deploy > Manage deployments > Web app URL).
  scriptUrl: "https://script.google.com/macros/s/AKfycbzso5-FCU4erf_grbktH-AH-RKaPDap7TfJAw_TOSxNarTrJDe-PgyBzgIH7Fj2fjZ3/exec"
};

/* Helpers used by the pages. Nothing below needs editing. */
(function (CM) {
  "use strict";
  // Full address of a page that sits next to the current one, wherever the package is served.
  CM.pageUrl = function (name) { return new URL(name, location.href).href.replace(/[?#].*$/, ""); };
  function fill() {
    // Course labels in the header and footer.
    document.querySelectorAll("[data-cm]").forEach(function (el) {
      var v = CM[el.getAttribute("data-cm")]; if (v) el.textContent = v;
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
