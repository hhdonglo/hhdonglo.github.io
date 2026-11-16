// The page-request door to the class list. A request from a page or a script (doGet and doPost) may read the class list and remove a student,
// but never add one: students are added only on the Class Roster page (roster-shots/ipc.js). Pure.
"use strict";

const refusal = () => JSON.stringify({ ok: false, why: "The class list is changed only on the Class Roster page in CM. Other files and pages are checked against it and never add students." });

function addsStudents(p) {
  p = p || {};
  return p.kind === "roster_sync" || (p.action === "roster_edit" && String(p.op || "") === "add");
}

module.exports = { addsStudents, refusal };
