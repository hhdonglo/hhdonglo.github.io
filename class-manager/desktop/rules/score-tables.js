/* Score tables: Master (one row per student, a cell per quiz), Scores (the clean grid with totals) and Totals (the live quizzes per student).
   A port of updateMaster_, updateScores_, collectResults_, practiceEntries_ and refreshTotals_ (apps_script/src/10-assessment.gs), with the same
   answers. o = {site, today()}; today() gives the date as dd/MM/yyyy (the local date when not passed). */
"use strict";
const { normalizeId } = require("../ids");
const { rosterRows } = require("./access-codes");

const MASTER = "Master", SCORES = "Scores", TOTALS = "Totals", RESPONSES = "Form Responses 1", KEY = "Key";
const norm = normalizeId, text = (v) => String(v == null ? "" : v);
const rowsOf = (store, tab) => (store.rows(tab) || []).map((r) => r.slice());
const pad = (r, w) => { while (r.length < w) r.push(""); return r; };
const todayDefault = () => { const d = new Date(), p = (n) => String(n).padStart(2, "0"); return p(d.getDate()) + "/" + p(d.getMonth() + 1) + "/" + d.getFullYear(); };

// Key!L2 = Off switches Master and Scores off.
function masterOn(store) { const k = store.rows(KEY); return !k || k.length < 2 || text(k[1][11]).trim().toLowerCase() !== "off"; }
function masterLabel(quiz) { // a practice or mock quiz name from the pages -> its column, or '' when it should not be recorded
  const q = text(quiz).trim(); if (/mock/i.test(q)) return "Mock exam"; if (/\(missed/i.test(q)) return "";
  const m = /^Lecture\s+(\d+)/i.exec(q); if (m) return "Practice " + Number(m[1]);
  if (/^Introduction/i.test(q)) return "Practice Intro";
  return q ? "Practice " + q : "";
}

// entries: [{id, name, label, score, n}]. Rows are matched by ID, columns by header text (created when missing), the cell is overwritten.
function updateMaster(store, entries, o) {
  try {
    if (!entries.length || !masterOn(store)) return;
    let rows = rowsOf(store, MASTER); if (!rows.length) rows = [["Student ID", "Name", "Last updated"]];
    entries.forEach((e) => {
      const id = text(e.id).trim(), label = text(e.label).trim(); if (!id || !label) return;
      const W = Math.max(3, rows.reduce((m, r) => Math.max(m, r.length), 0)), head = pad(rows[0], W).map((h) => text(h).trim());
      let col = head.indexOf(label) + 1; if (col < 4) { col = W + 1; rows[0][col - 1] = label; }
      let at = rows.findIndex((r, i) => i > 0 && text(r[0]).trim() === id);
      if (at < 0) { rows.push([id]); at = rows.length - 1; }
      const r = pad(rows[at], col); if (e.name) r[1] = e.name; r[2] = store.now(); r[col - 1] = e.score + " / " + e.n;
    });
    const W = rows.reduce((m, r) => Math.max(m, r.length), 0); store.setRows(MASTER, rows.map((r) => pad(r, W)));
    updateScores(store, entries, o);
  } catch (e) { /* the master sheet must never stop a submission */ }
}

function scoreKey(label) {
  let m;
  if ((m = /^Week (\d+)$/.exec(label))) return "W" + m[1]; if ((m = /^Practice (\d+)$/.exec(label))) return "P" + m[1];
  if (label === "Practice Intro") return "P0"; if (label === "Mock exam") return "MOCK";
  if ((m = /^Quiz (.+)$/.exec(label))) return "Q:" + m[1];
  return label;
}
function scoreHeader(label, live, weeks, today) {
  let m, t;
  if ((m = /^Week (\d+)$/.exec(label))) { t = weeks[String(Number(m[1]))]; return today + " " + label + (t ? " " + t : ""); }
  if ((m = /^Practice (\d+)$/.exec(label))) { t = weeks[String(Number(m[1]))]; return label + (t ? " " + t : ""); }
  return live ? today + " " + label : label;
}
// entries: [{id, label, score, n}]. The grid is read, changed in memory and written back.
function updateScores(store, entries, o) {
  try {
    if (!entries.length || !masterOn(store)) return;
    let weeks = {}; try { weeks = o.site("/apps_script/live_quizzes.json").weeks || {}; } catch (e) { /* headings are a nicety */ }
    let grid = rowsOf(store, SCORES);
    if (grid.length < 3) { grid = [["Student ID", "Total", "Out of", "Average %"], ["key", "", "", ""], ["Out of", "", "", ""]]; rosterRows(store).forEach((r) => grid.push([r[0], "", "", ""])); }
    let W = 4; grid.forEach((r) => { W = Math.max(W, r.length); }); const padAll = () => grid.forEach((r) => pad(r, W));
    padAll(); const today = (o && o.today ? o.today : todayDefault)(), rowOf = {}, touched = {}; let headChanged = false;
    grid.forEach((r, i) => { if (i >= 3) rowOf[norm(r[0])] = i; });
    entries.forEach((e) => {
      const id = norm(e.id), label = text(e.label).trim(); if (!id || !label || isNaN(Number(e.score))) return;
      const key = scoreKey(label), live = /^(Week \d|Quiz )/.test(label), head = scoreHeader(label, live, weeks, today); let c = -1;
      for (let j = 4; j < W; j++) if (text(grid[1][j]) === key) { c = j; break; }
      if (c < 0) { c = W; W++; padAll(); grid[0][c] = head; grid[1][c] = key; grid[2][c] = Number(e.n) || ""; headChanged = true; }
      else {
        if (live && grid[0][c] !== head) { grid[0][c] = head; headChanged = true; }
        if ((Number(grid[2][c]) || 0) < Number(e.n)) { grid[2][c] = Number(e.n); headChanged = true; }
      }
      let r = rowOf[id]; if (r === undefined) { const nr = pad([], W); nr[0] = id; grid.push(nr); r = grid.length - 1; rowOf[id] = r; }
      grid[r][c] = Number(e.score); touched[r] = true;
    });
    const total = (r) => {
      let tot = 0, out = 0, any = false;
      for (let j = 4; j < W; j++) {
        const v = grid[r][j], kk = text(grid[1][j]); if (kk.charAt(0) !== "W" && kk.indexOf("Q:") !== 0) continue; // only live quizzes count
        if (v !== "" && !isNaN(Number(v))) { tot += Number(v); out += Number(grid[2][j]) || 0; any = true; }
      }
      grid[r][1] = any ? tot : ""; grid[r][2] = any ? out : ""; grid[r][3] = any && out ? Math.round(tot / out * 1000) / 10 : "";
    };
    (headChanged ? grid.map((r, i) => i).slice(3) : Object.keys(touched).map(Number)).forEach(total);
    store.setRows(SCORES, grid);
  } catch (e) { /* the scores sheet must never stop a submission */ }
}

// Practice and mock tries sit in the Attempts log; only IDs on the Roster join Master and Scores (test IDs stay out when there is a roster).
function attemptEntries(store, onlyRoster) {
  const at = store.rows("Attempts"); if (!at || at.length < 2) return [];
  const roster = {}; rosterRows(store).forEach((r) => { roster[r[0]] = 1; }); const has = Object.keys(roster).length > 0, best = {};
  at.slice(1).forEach((r) => {
    const id = norm(r[1]), lab = masterLabel(text(r[2])), ts = new Date(r[0]).getTime() || 0;
    if (!id || !lab || r[4] === "" || r[4] == null || (onlyRoster && has && !roster[id])) return;
    const k = id + "|" + lab; if (!best[k] || ts >= best[k].ts) best[k] = { ts, id, label: lab, score: Number(r[4]), n: Number(r[5]) || 0 };
  });
  return Object.keys(best).map((k) => ({ id: best[k].id, name: "", label: best[k].label, score: best[k].score, n: best[k].n }));
}
const practiceEntries = (store) => attemptEntries(store, true);

// Every student's latest live result (the latest round wins) and latest practice or mock result.
function collectResults(store) {
  const data = (store.rows(RESPONSES) || []).slice(1), latest = {};
  data.forEach((r) => {
    const id = text(r[2]).trim(), code = text(r[3]).trim().toUpperCase(); if (!id || !code || r[9] === "" || r[9] == null) return;
    const week = Number(r[13]) || 0, k = id + "|" + (week ? "W" + week : code), rnd = Number(r[10]) || 0, ts = new Date(r[0]).getTime() || 0, cur = latest[k];
    if (!cur || rnd > cur.rnd || (rnd === cur.rnd && ts >= cur.ts)) latest[k] = { rnd, ts, id, name: text(r[1]), label: week ? "Week " + week : "Quiz " + code, score: Number(r[9]), n: Number(r[11]) || 5 };
  });
  return Object.keys(latest).map((k) => ({ id: latest[k].id, name: latest[k].name, label: latest[k].label, score: latest[k].score, n: latest[k].n })).concat(attemptEntries(store, false));
}

// One row per student ID. A column per quiz holds the counted score. Key!K2 chooses between the best round and the latest.
function refreshTotals(store, o) {
  const k = store.rows(KEY), latest = !!k && k.length > 1 && text(k[1][10]).trim().toLowerCase() === "latest"; let weeks = {};
  try { weeks = o.site("/apps_script/live_quizzes.json").weeks || {}; } catch (e) { /* titles are a nicety */ }
  const data = (store.rows(RESPONSES) || []).slice(1), students = {}, cols = {};
  data.forEach((r) => {
    const id = text(r[2]).trim(), code = text(r[3]).trim().toUpperCase(); if (!id || !code || r[9] === "" || r[9] == null) return;
    const week = Number(r[13]) || 0, ck = (week ? "W" + week + ":" : "Q:") + code, score = Number(r[9]), rnd = Number(r[10]) || 0, nq = Number(r[11]) || 5;
    cols[ck] = { week, code }; const st = students[id] || (students[id] = { name: "", best: {} }); st.name = text(r[1]) || st.name;
    const cur = st.best[ck]; if (!cur || (latest ? rnd >= cur.rnd : score / nq > cur.score / cur.n)) st.best[ck] = { score, rnd, n: nq };
  });
  const keys = Object.keys(cols).sort((a, b) => (cols[a].week - cols[b].week) || cols[a].code.localeCompare(cols[b].code));
  const label = (key) => { const c = cols[key]; return c.week ? "Week " + c.week + (weeks[String(c.week)] ? " " + weeks[String(c.week)] : "") + " (" + c.code + ")" : "Quiz " + c.code; };
  const header = ["Student ID", "First name", "Quizzes taken"].concat(keys.map(label), ["Total", "Out of", "Average %"]);
  const rows = Object.keys(students).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).map((id) => {
    const st = students[id]; let taken = 0, total = 0, outOf = 0;
    const cells = keys.map((key) => { const b = st.best[key]; if (!b) return ""; taken++; total += b.score; outOf += b.n; return b.score + " / " + b.n; });
    return [id, st.name, taken].concat(cells, [total, outOf, outOf ? Math.round(total / outOf * 1000) / 10 : ""]);
  });
  store.setRows(TOTALS, [header].concat(rows)); return rows.length;
}
function totalsSafe(store, o) { try { refreshTotals(store, o); } catch (e) { /* totals only */ } }

// Fills the Scores grid, or Master and Scores, from everything already recorded.
function rebuildScores(store, o) { const e = collectResults(store); if (!e.length) return "No results yet."; updateScores(store, e, o); return "Scores updated with " + e.length + " results."; }
function rebuildMaster(store, o) { const e = collectResults(store); if (!e.length) return "No results yet."; updateMaster(store, e, o); return "Master and Scores updated with " + e.length + " results."; }
// The hooks quiz-results' commit() calls on a release.
const hooks = (store, o) => ({ master: (entries) => updateMaster(store, entries.concat(practiceEntries(store)), o), totals: () => totalsSafe(store, o) });

module.exports = { masterLabel, updateMaster, updateScores, collectResults, practiceEntries, refreshTotals, rebuildScores, rebuildMaster, hooks, scoreKey, scoreHeader };
