// The web import, step one: read what a Class Manager workbook from the web (or a CSV of one tab) holds, compare it with this course's workbook,
// and say exactly what applying it would change. Nothing is written here; import-apply.js does the writing from the plan made here.
// Pure functions: the workbook is passed in as rows, so this is tested in plain Node (test/import.test.js).
//
//   plan(book, local, options) -> { report, ops }
//     book    [{ name, rows }]     sheets of the file (xlsx-book.js)
//     local   { read(name) }       rows of a tab of this course's workbook, or null
//     options { onlyClassList, addMissing }
//     report  what the lecturer sees: counts per tab, students, warnings (no student data beyond counts and a few IDs)
//     ops     what import-apply.js writes
"use strict";
const V = require("./import-values");
const S = require("./import-specs");
const { MAX_ROWS } = require("./xlsx-book");
const T = require("./import-template");

const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
const rowBlank = (r) => !Array.isArray(r) || r.every(V.blank);
const body = (rows) => (rows || []).slice(1).filter((r) => !rowBlank(r));

// ---------- which tab is a sheet? ----------

function matchesHeader(spec, head) {
  const names = head.map(V.headOf);
  const found = spec.header.map((h) => names.indexOf(V.headOf(h)));
  return found.slice(0, spec.need).every((i) => i >= 0);
}
function looksLikeAttendance(head) {
  return V.headOf(head[0]) === "studentid" && head.slice(1).some((h) => /^\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4}/.test(V.sessionOf(h)));
}
// The known tab a sheet stands for: by its name; for a file of one sheet (a CSV) also by its columns.
function identify(sheet, onlySheet) {
  const n = norm(sheet.name);
  const named = S.LOG_TABS.find((t) => norm(t.name) === n);
  if (named) return { kind: "log", spec: named };
  if (n === norm(S.ATTENDANCE_TAB)) return { kind: "attendance" };
  const skipped = Object.keys(S.SKIPPED).find((k) => norm(k) === n);
  if (skipped) return { kind: "skipped", name: skipped, why: S.SKIPPED[skipped] };
  if (n === "roster") return { kind: "names" };
  if (n === norm(T.SCORE_TAB)) return { kind: "scores" };
  if (onlySheet && sheet.rows.length) {
    const head = sheet.rows[0];
    if (looksLikeAttendance(head)) return { kind: "attendance" };
    const spec = S.LOG_TABS.find((t) => matchesHeader(t, head));
    if (spec) return { kind: "log", spec };
  }
  return { kind: "unknown" };
}

// ---------- columns ----------

// Where each column of the tab's target layout comes from in the file: { target: [heading], pick: [file column or -1] }.
// The target is this course's own heading row when it has one (the script reads by position), else the script's. Extra columns of the file follow.
function layout(spec, head, localHead) {
  const names = head.map(V.headOf), taken = new Set();
  const byName = (h) => { // the column with this heading, or with a heading that means the same
    const key = V.headOf(h);
    let i = names.indexOf(key);
    if (i < 0) i = names.findIndex((n, j) => !taken.has(j) && (S.ALIASES[key] || []).indexOf(n) >= 0);
    if (i >= 0) taken.add(i);
    return i;
  };
  const target = (localHead && localHead.some((h) => !V.blank(h)) ? localHead.slice() : []);
  while (target.length && V.blank(target[target.length - 1])) target.pop();
  spec.header.forEach((h, i) => { if (V.blank(target[i])) target[i] = h; });
  const named = spec.header.map(byName);
  const byNames = named.slice(0, spec.need).every((i) => i >= 0);
  if (!byNames && !(spec.positional && head.length >= spec.need)) return { missing: spec.header.slice(0, spec.need).filter((h, i) => named[i] < 0) };
  const pick = target.map((t, k) => (k < spec.header.length ? (byNames ? named[k] : (k < head.length ? k : -1)) : byName(t)));
  head.forEach((h, j) => { // columns of the file that the layout does not have yet
    if (V.blank(h) || pick.indexOf(j) >= 0 || target.some((t) => V.headOf(t) === V.headOf(h))) return;
    target.push(String(h).trim()); pick.push(j);
  });
  return { target, pick, named: spec.header.slice(0, spec.need).map((h, i) => ({ need: h, found: byNames ? String(head[named[i]]) : String(head[i] == null ? "" : head[i]) })) };
}

const letters = (head) => head.map((h, i) => (V.blank(h) ? "" : String(h))).filter(Boolean).slice(0, 14).join(", ");

function cellOf(spec, k, v) {
  if (V.blank(v)) return "";
  if (k === spec.id) return V.idOf(v);
  if (spec.text.indexOf(k) >= 0) return typeof v === "number" ? V.numOf(v) : String(v).trim();
  return v;
}

// ---------- the log tabs: add what is new ----------

function planLog(spec, rows, localRows, ctx) {
  const rep = { tab: spec.name, label: spec.label, total: 0, add: 0, duplicates: 0, offList: 0, noId: 0, note: "" };
  const lay = layout(spec, rows[0] || [], localRows && localRows[0]);
  if (!lay.target) {
    rep.status = "skipped"; rep.missing = lay.missing;
    rep.note = "cannot be imported: no column found for " + lay.missing.join(", ") + ". The file's columns are: " + (letters(rows[0] || []) || "none") + ".";
    return { rep, op: null };
  }
  rep.columns = lay.named;
  const have = new Set(body(localRows).map(spec.key));
  const codes = {}; body(localRows).forEach((r) => { if (spec.session) codes[V.codeOf(r[0])] = V.sessionOf(r[1]); });
  const add = [];
  body(rows).forEach((r) => {
    rep.total++;
    const out = lay.pick.map((j, k) => (j >= 0 ? cellOf(spec, k, r[j]) : ""));
    if (spec.session && !prepareSession(out, codes, rep)) return;
    if (spec.id >= 0) {
      const id = V.idOf(out[spec.id]);
      if (!id) { rep.noId++; return; }
      if (spec.onList !== false) ctx.activity.add(id);
      if (spec.onList !== false && ctx.onlyClassList && !ctx.classIds.has(id)) { rep.offList++; return; }
    }
    const key = spec.key(out);
    if (have.has(key)) { rep.duplicates++; return; }
    have.add(key); add.push(out);
  });
  rep.add = add.length; rep.status = add.length ? "new" : "nothing";
  if (spec.id >= 0 && rep.total && rep.noId === rep.total) rep.note = "no valid student IDs (4 to 12 digits) were found in the ID column, so nothing was imported";
  return { rep, op: add.length || lay.target.length > (localRows && localRows[0] ? localRows[0].length : 0) ? { tab: spec.name, header: lay.target, rows: add } : null };
}

// Attendance_Control: only finished sessions (Submitted, Discarded) are copied, never the link secret, and never a code another session here uses.
function prepareSession(out, codes, rep) {
  const status = String(out[2] || "").trim().toLowerCase();
  if (status !== "submitted" && status !== "discarded") { rep.open = (rep.open || 0) + 1; rep.note = "sessions still open or waiting to be submitted on the web are not copied"; return false; }
  out[5] = "";
  const code = V.codeOf(out[0]), label = V.sessionOf(out[1]);
  if (code && codes[code] !== undefined && codes[code] !== label) { rep.conflicts = (rep.conflicts || 0) + 1; return false; }
  if (code) codes[code] = label;
  return true;
}

// ---------- attendance: one column per session, 1 present, 0 absent ----------

function planAttendance(rows, localRows, ctx) {
  const rep = { tab: S.ATTENDANCE_TAB, label: "Attendance record (one column per session)", total: 0, add: 0, duplicates: 0, offList: 0, newSessions: [], filled: 0, upgraded: 0, rowsAdded: 0, note: "" };
  const head = rows[0] || [];
  let idCol = head.findIndex((h) => V.headOf(h) === "studentid"); if (idCol < 0) idCol = 0;
  const sessions = []; head.forEach((h, j) => { const s = V.sessionOf(h); if (j !== idCol && s && V.headOf(s) !== "name" && V.headOf(s) !== "note") sessions.push({ j, label: s }); });
  const lh = localRows && localRows[0] ? localRows[0].map(V.sessionOf) : ["Student ID"];
  const grid = (localRows && localRows.length ? localRows : [lh]).map((r) => r.slice());
  grid[0] = lh.slice();
  const rowOf = {}; grid.forEach((r, i) => { if (i && V.idOf(r[0])) rowOf[V.idOf(r[0])] = i; });
  const colOf = {}; lh.forEach((h, i) => { if (i) colOf[h] = i; });
  let changed = 0;
  body(rows).forEach((r) => {
    const id = V.idOf(r[idCol]); if (!id) return;
    rep.total++;
    if (sessions.some((s) => V.markOf(r[s.j]) === 1)) ctx.activity.add(id);
    if (ctx.onlyClassList && !ctx.classIds.has(id)) { rep.offList++; return; }
    sessions.forEach((s) => {
      const v = V.markOf(r[s.j]); if (v === "") return;
      if (colOf[s.label] === undefined) { colOf[s.label] = grid[0].length; grid[0].push(s.label); rep.newSessions.push(s.label); }
      let ri = rowOf[id]; if (!ri) { ri = grid.length; rowOf[id] = ri; grid.push([id]); rep.rowsAdded++; changed++; }
      const c = colOf[s.label], cur = V.markOf(grid[ri][c]);
      if (cur === "") { grid[ri][c] = v; rep.filled++; changed++; } else if (v === 1 && cur === 0) { grid[ri][c] = 1; rep.upgraded++; changed++; }
      else rep.duplicates++;
    });
  });
  const width = grid[0].length;
  grid.forEach((r, i) => { for (let k = 0; k < width; k++) if (r[k] === undefined) r[k] = ""; if (i) r[0] = V.idOf(r[0]); });
  rep.add = rep.filled + rep.upgraded;
  rep.status = changed ? "new" : "nothing";
  if (rep.newSessions.length) rep.note = "new sessions: " + rep.newSessions.join(", ");
  return { rep, op: changed ? { tab: S.ATTENDANCE_TAB, grid } : null };
}

// ---------- students ----------

function nameMap(book) { // ID -> name, from the file's own Roster, Master and Totals tabs
  const out = {};
  S.NAME_TABS.forEach((tab) => {
    const sh = book.find((s) => norm(s.name) === norm(tab)); if (!sh || !sh.rows.length) return;
    const head = sh.rows[0].map(V.headOf);
    const at = (...names) => head.findIndex((h) => names.indexOf(h) >= 0);
    const idc = Math.max(0, at("studentid", "id")), nc = at("name", "studentname"), fc = at("firstname"), lc = at("lastname");
    body(sh.rows).forEach((r) => {
      const id = V.idOf(r[idc]); if (!id || out[id]) return;
      const name = nc >= 0 ? String(r[nc] || "").trim() : fc >= 0 ? (String(r[fc] || "").trim() + " " + (lc >= 0 ? String(r[lc] || "").trim() : "")).trim() : "";
      if (name) out[id] = name;
    });
  });
  return out;
}

function rosterIdsOf(book) { // IDs on the file's own Roster tab: the class list the web version was run with
  const sh = book.find((x) => norm(x.name) === "roster");
  return sh ? [...classIdsOf(body(sh.rows).map((r) => r.slice()))] : [];
}

// Names are compared without case, commas or order, so "Mensah, Ama" and "ama mensah" are the same name.
const nameKey = (s) => String(s || "").toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter(Boolean).sort().join(" ");

// Against the class list on this computer: names to fill in where there is none, and names that disagree (existing name kept).
function nameChecks(localRows, incoming) {
  const have = {}; (localRows || []).forEach((r) => { const id = V.idOf(r[0]); if (id && !(id in have)) have[id] = String(r[1] || "").trim(); });
  const fills = [], conflicts = [];
  Object.keys(incoming).forEach((id) => {
    if (!(id in have)) return;
    if (!have[id]) fills.push([id, incoming[id]]);
    else if (nameKey(have[id]) !== nameKey(incoming[id])) conflicts.push({ id, existing: have[id], incoming: incoming[id] });
  });
  return { fills, conflicts };
}

function classIdsOf(rows) { // IDs on this course's class list
  const set = new Set(); (rows || []).forEach((r) => { const id = V.idOf(r[0]); if (id.length >= 4 && id.length <= 12) set.add(id); });
  return set;
}

// ---------- a simple table of quiz scores (one row per student per quiz) ----------

// Turned into the rows of Form Responses 1, so the same key, filter and marks apply. Returns { rows } or { missing }.
function scoresAsResponses(rows, names) {
  const head = (rows[0] || []).map(V.headOf), find = (...w) => head.findIndex((h) => w.indexOf(h) >= 0);
  const c = { id: find("studentid", "id", "studentnumber", "indexnumber"), quiz: find("quiz", "quizname", "assessment", "test", "title"), score: find("score", "marks", "mark", "points"),
    out: find("outof", "total", "maximum", "max"), date: find("date", "timestamp", "time") };
  const missing = [["id", "Student ID"], ["quiz", "Quiz"], ["score", "Score"]].filter((x) => c[x[0]] < 0).map((x) => x[1]);
  if (missing.length) return { missing };
  const out = [["Timestamp", "First Name", "ID", "Join Code", "Q1", "Q2", "Q3", "Q4", "Q5", "Score", "Round", "Questions", "Answers", "Week"]];
  body(rows).forEach((r) => {
    const id = V.idOf(r[c.id]), quiz = String(r[c.quiz] == null ? "" : r[c.quiz]).trim();
    if (!id || !quiz || V.blank(r[c.score])) return;
    const when = c.date >= 0 && !V.blank(r[c.date]) ? r[c.date] : "";
    out.push([when, (names[id] || "").split(" ")[0], id, quiz, "", "", "", "", "", Number(r[c.score]), 0, c.out >= 0 && !V.blank(r[c.out]) ? Number(r[c.out]) : 5, "", ""]);
  });
  return { rows: out };
}

// ---------- the whole plan ----------

function plan(book, local, options) {
  const opt = Object.assign({ onlyClassList: true, addMissing: false }, options);
  const localList = classIdsOf(local.read("Roster"));
  const ctx = { onlyClassList: opt.onlyClassList, classIds: new Set(localList), activity: new Set() };
  const names = Object.assign({}, ...(local.read("Roster") || []).map((r) => ({ [V.idOf(r[0])]: String(r[1] || "").trim() })), nameMap(book));
  const reports = [], ops = [], ignored = [], warnings = [];
  const only = book.length === 1;
  const found = [];
  book.forEach((sh) => {
    const what = identify(sh, only);
    if (what.kind !== "scores") return found.push({ sh, what });
    const conv = scoresAsResponses(sh.rows, names); // the simple table of quiz scores becomes live quiz results
    if (conv.missing) reports.push({ tab: sh.name, label: "Quiz scores", total: 0, add: 0, duplicates: 0, offList: 0, status: "skipped", note: "cannot be imported: no column found for " + conv.missing.join(", ") + ". The file's columns are: " + (letters(sh.rows[0] || []) || "none") + "." });
    else found.push({ sh: { name: sh.name, rows: conv.rows, truncated: sh.truncated }, what: { kind: "log", spec: S.LOG_TABS[0], label: "Quiz scores" } });
  });

  // Pass 1 finds every ID with activity so that "add the missing students" knows them before the tabs are filtered.
  if (opt.addMissing) {
    const probe = { onlyClassList: false, classIds: new Set(), activity: new Set() };
    found.forEach(({ sh, what }) => {
      if (what.kind === "log") planLog(what.spec, sh.rows, null, probe); else if (what.kind === "attendance") planAttendance(sh.rows, null, probe);
    });
    probe.activity.forEach((id) => ctx.classIds.add(id));
    rosterIdsOf(book).forEach((id) => { ctx.classIds.add(id); ctx.activity.add(id); }); // the file's own class list comes too
  }

  found.forEach(({ sh, what }) => {
    if (what.kind === "log") { const r = planLog(what.spec, sh.rows, local.read(what.spec.name), ctx); if (what.label) r.rep.label = what.label; reports.push(r.rep); if (r.op) ops.push(r.op); }
    else if (what.kind === "attendance") { const r = planAttendance(sh.rows, local.read(S.ATTENDANCE_TAB), ctx); reports.push(r.rep); if (r.op) ops.push(r.op); }
    else if (what.kind === "skipped" && sh.rows.length > 1) ignored.push({ tab: what.name, why: what.why });
    else if (what.kind === "unknown" && sh.rows.length > 1) ignored.push({ tab: sh.name, why: "not recognised. Its columns are: " + (letters(sh.rows[0]) || "none") });
    if (sh.truncated) warnings.push("Only the first " + MAX_ROWS.toLocaleString() + " rows of \"" + sh.name + "\" were read. Split the file and import it in parts.");
  });
  if (!reports.length) warnings.push("This file holds none of the tabs the import knows (live quiz results, practice attempts, attendance). Choose a workbook downloaded from the web version's Google Sheet, or a CSV of one of its tabs.");

  // Every ID in the files that does not conform to the class list is flagged for the lecturer, whether or not it is added: not on the list, or not in the list's format.
  const seenIds = new Set([...ctx.activity]);
  if (!opt.addMissing) { const probe2 = { onlyClassList: false, classIds: new Set(), activity: new Set() }; found.forEach(({ sh, what }) => { if (what.kind === "log") planLog(what.spec, sh.rows, null, probe2); else if (what.kind === "attendance") planAttendance(sh.rows, null, probe2); }); probe2.activity.forEach((id) => seenIds.add(id)); }
  const badFormat = (id) => !/^\d{4,12}$/.test(id);
  const flaggedAll = [...seenIds].filter((id) => localList.size && !localList.has(id)).map((id) => ({ id, why: badFormat(id) ? "not a valid student ID (4 to 12 digits)" : "not on the class list" }));
  const noIdRows = reports.reduce((n, r) => n + (r.noId || 0), 0);
  const validId = (id) => id.length >= 4 && id.length <= 12; // the class list only holds IDs of this length, so an ID of another length (a typo in a log) is never added
  const addIds = opt.addMissing ? [...ctx.activity].filter((id) => !localList.has(id) && validId(id)) : [];
  const offIds = opt.addMissing ? [] : [...ctx.activity].filter((id) => !localList.has(id));
  const offList = reports.reduce((n, r) => n + (r.offList || 0), 0);
  if (!localList.size && !opt.addMissing) warnings.push("This course has no class list yet, so no student can be matched. Add the class list first, or tick \"Add the students in the file to the class list\".");
  else if (offList && !opt.addMissing) warnings.push(offList + " row(s) belong to IDs that are not on this course's class list and are left out.");
  // The student ID is the key. The same ID never gets a second name: a name that differs from the one already on the class list is flagged, never written;
  // a student on the list with no name yet is given the name the file has.
  const { fills, conflicts } = nameChecks(local.read("Roster"), nameMap(book));
  const students = { classList: localList.size, withData: [...ctx.activity].filter((id) => localList.has(id)).length, notOnList: offIds.length, notOnListSample: offIds.slice(0, 5), toAdd: addIds.length, flagged: flaggedAll.slice(0, 50), flaggedCount: flaggedAll.length, noIdRows,
    namesFilled: fills.length, nameConflicts: conflicts.length, conflicts: conflicts.slice(0, 50) };
  const roster = addIds.map((id) => [id, names[id] || ""]).concat(fills);
  const blocked = !localList.size && !opt.addMissing; // with nobody to match, nothing is written
  const changes = blocked ? 0 : reports.reduce((n, r) => n + (r.add || 0), 0) + roster.length;
  if (flaggedAll.length) warnings.push(flaggedAll.length + " ID(s) in the files do not conform to the class list. They are flagged below" + (opt.addMissing ? ", and only valid IDs are added." : " and are not added."));
  if (conflicts.length) warnings.push(conflicts.length + " student ID(s) have a different name in the file than on the class list. The class list name is kept. Review them below.");
  return { report: { tabs: reports, ignored, students, warnings, changes, blocked }, ops: blocked ? { tabs: [], roster: [] } : { tabs: ops, roster } };
}

module.exports = { plan, identify, layout, classIdsOf, nameChecks, nameKey };
