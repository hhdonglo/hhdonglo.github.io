"use strict";

(() => {
  if (!window.cmApp?.academic) return;
  const student = new URLSearchParams(location.search).get("academicStudent");
  if (!student || !/^\d{1,24}$/.test(student)) return;
  if (window.CM?.modules && !window.CM.modules.includes("analytics")) {
    window.cmGo?.("class");
    return;
  }
  window.cmInsights?.open(student);
})();
