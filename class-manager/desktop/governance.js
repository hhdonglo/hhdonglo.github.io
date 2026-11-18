/* Privacy and governance for one course. Pure of Electron: works on a backend with rawRows(tab), setRows(tab, rows) and tabs().
   - audit: every sensitive action (export, erase, term close, role use) is written to the Audit_Log tab: when, who, action, subject ID, detail. No marks or answers.
   - studentExport: everything held about one student ID, tab by tab, as plain rows (for a data request).
   - studentErase: permanently removes that student's rows from every tab that holds a student ID column. The lecturer must type the ID to confirm. Cannot be undone.
   - term: closing the term stops new student writes (check-ins, quiz attempts, reports, chat). The lecturer can still read and export everything.
   The ID is the unique key. Tabs are found by a column headed "Student ID" or "ID"; the class tabs (Roster, Attendance, Master, Scores, Totals) use their first column. */
"use strict";

const AUDIT = "Audit_Log", TERM = "Term_Status", KEPT = "Removed_Students";
const AUDIT_HEAD = ["When", "Who", "Action", "Student ID", "Detail"];
const CLASS_TABS = ["Roster", "Attendance", "Master", "Scores", "Totals"];
const SKIP = [AUDIT, TERM]; // never exported or erased as student data
const digits = (v) => String(v == null ? "" : v).replace(/\D/g, "");
const isId = (id) => id.length >= 4 && id.length <= 12;

// Who may do what. "lecturer" holds the host key; "assistant" has a read-only, limited sign-in. Enforced by the callers that check roles.
const ROLES = {
  lecturer: ["read", "write", "export", "erase", "term", "settings"],
  assistant: ["read:class"],
  student: ["own"]
};
const can = (role, what) => (ROLES[role] || []).indexOf(what) >= 0;

const PRIVACY_NOTICE = [
  "What CM holds about you: your student ID and name from the class list, your attendance check-ins, your quiz and practice answers and scores, and any group you are placed in.",
  "Why: to run the class, mark attendance and quizzes, and help the lecturer see where students need support.",
  "Who sees it: your lecturer and the teaching assistants they name. Other students never see your results. Results shown to the whole class are totals, not names.",
  "How long: until the end of the course and the assessment period, then it is deleted or anonymised.",
  "Your rights: you may ask the lecturer for a copy of what is held about you, or for it to be corrected or deleted, subject to the course's record-keeping duties.",
  "Contact: ask your lecturer."
].join("\n");

function audit(backend, who, action, id, detail, now) {
  const rows = backend.rawRows(AUDIT) || [AUDIT_HEAD.slice()];
  rows.push([(now ? now() : new Date()).toISOString(), who || "lecturer", action, id || "", detail || ""]);
  backend.setRows(AUDIT, rows);
}
const auditList = (backend, limit) => (backend.rawRows(AUDIT) || []).slice(1).reverse().slice(0, limit || 200).map((r) => ({ when: r[0], who: r[1], action: r[2], id: r[3], detail: r[4] }));

function idColumns(tab, header) {
  const cols = []; (header || []).forEach((h, i) => { if (/^\s*(student\s*id|id)\s*$/i.test(String(h))) cols.push(i); });
  if (!cols.length && CLASS_TABS.indexOf(tab) >= 0) cols.push(0);
  if (!cols.length && tab === KEPT) cols.push(1);
  return cols;
}
const mine = (row, cols, id) => cols.some((c) => digits(row[c]) === id);

function studentExport(backend, idIn, now) {
  const id = digits(idIn); if (!isId(id)) return { ok: false, why: "That is not a student ID." };
  const out = {};
  (backend.tabs() || []).forEach((t) => {
    if (SKIP.indexOf(t.name) >= 0) return;
    const rows = backend.rawRows(t.name) || [], cols = idColumns(t.name, rows[0]);
    if (!cols.length) return;
    const hit = rows.slice(1).filter((r) => mine(r, cols, id));
    if (hit.length) out[t.name] = [rows[0]].concat(hit);
  });
  if (!Object.keys(out).length) return { ok: false, why: "Nothing is held for that student ID." };
  audit(backend, "lecturer", "export", id, Object.keys(out).length + " tabs", now);
  return { ok: true, id, tabs: out };
}

function studentErase(backend, idIn, confirm, now) {
  const id = digits(idIn); if (!isId(id)) return { ok: false, why: "That is not a student ID." };
  if (digits(confirm) !== id) return { ok: false, why: "Type the student ID exactly to confirm. Nothing was erased." };
  let removed = 0, tabs = 0;
  (backend.tabs() || []).forEach((t) => {
    if (SKIP.indexOf(t.name) >= 0) return;
    const rows = backend.rawRows(t.name) || [], cols = idColumns(t.name, rows[0]);
    if (!cols.length) return;
    const keep = rows.filter((r, i) => i === 0 || !mine(r, cols, id));
    if (keep.length < rows.length) { removed += rows.length - keep.length; tabs++; backend.setRows(t.name, keep); }
  });
  if (!removed) return { ok: false, why: "Nothing is held for that student ID." };
  audit(backend, "lecturer", "erase", id, removed + " rows in " + tabs + " tabs", now); // the log keeps the ID and counts, nothing else
  return { ok: true, id, rows: removed, tabs };
}

const termClosed = (backend) => { const r = backend.rawRows(TERM); return !!(r && r[1] && String(r[1][0]) === "closed"); };
function setTerm(backend, closed, now) {
  backend.setRows(TERM, [["State", "Changed"], [closed ? "closed" : "open", (now ? now() : new Date()).toISOString()]]);
  audit(backend, "lecturer", closed ? "term closed" : "term reopened", "", "", now);
  return { ok: true, closed: !!closed };
}
// null when the request may go on; otherwise the answer to send. Lecturer requests (with a hostkey) always pass.
const STUDENT_ACTIONS = ["attend", "chat"], STUDENT_KINDS = ["attempt", "report"];
function closedRefusal(params, closed) {
  if (!closed || !params || params.hostkey) return null;
  if (STUDENT_ACTIONS.indexOf(params.action) >= 0 || STUDENT_KINDS.indexOf(params.kind) >= 0) return { ok: false, why: "closed", detail: "This term is closed. New check-ins and answers are no longer accepted." };
  return null;
}

module.exports = { AUDIT, ROLES, can, PRIVACY_NOTICE, audit, auditList, studentExport, studentErase, termClosed, setTerm, closedRefusal };
