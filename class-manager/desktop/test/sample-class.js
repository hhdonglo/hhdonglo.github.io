/* A made-up class for the tests and the preview screenshots: 30 students, 8 attendance sessions, 4 live quizzes
   with every answer, and practice attempts. The pattern is fixed (a seeded generator), so results are repeatable.
   Nothing here is real student data. */
"use strict";

const NAMES = ["Ama Mensah", "Kwame Owusu", "Efua Asante", "Kofi Boateng", "Akosua Darko", "Yaw Appiah", "Abena Osei", "Kojo Adjei",
  "Esi Ofori", "Kwabena Agyeman", "Adwoa Nkrumah", "Fiifi Quaye", "Afia Sarpong", "Kweku Amoah", "Yaa Frimpong", "Nana Acheampong",
  "Akua Badu", "Kwesi Addo", "Araba Tetteh", "Ekow Annan", "Adjoa Boakye", "Paa Kwesi Ansah", "Maame Yeboah", "Kobby Danso",
  "Serwaa Antwi", "Kofi Larbi", "Dzifa Agbeko", "Selorm Kumah", "Edem Tsikata", "Mawuli Dogbe"];

function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

// Each student has a fixed profile: how often they attend, how well they score, how much they practise.
// The first rows are chosen so that every engagement group appears.
const PROFILES = [
  [0.95, 0.85, 1], [0.95, 0.35, 1], [0.35, 0.85, 0], [0.30, 0.30, 0], [0.90, 0.75, 1], [0.95, 0.40, 1],
  [0.85, 0.65, 1], [0.20, 0.25, 0], [1.00, 0.90, 1], [0.90, 0.55, 1]
];
const sp = (i, r) => PROFILES[i] || [0.55 + 0.45 * r(), 0.35 + 0.55 * r(), r() < 0.6 ? 1 : 0];

function sampleClass(opts) {
  const r = rng((opts && opts.seed) || 143);
  const now = (opts && opts.now) || Date.now();
  const day = 864e5, ids = NAMES.map((n, i) => String(10690001 + i * 37));
  const prof = NAMES.map((n, i) => sp(i, r));
  const fmt = (t) => { const d = new Date(t); return [d.getDate(), d.getMonth() + 1, d.getFullYear()].map((x, i) => (i < 2 ? String(x).padStart(2, "0") : x)).join("/"); };
  const D = (t) => new Date(t);

  // Attendance: two sessions a week for four weeks; recent weeks are a little thinner, and student 4 and 8 stopped coming.
  const sessions = [];
  for (let w = 0; w < 4; w++) for (const off of [0, 2]) sessions.push(now - (27 - w * 7 - off) * day + 8 * 3600e3);
  const control = [["Code", "Label", "Status", "Opened", "Closed", "Secret", "Lat", "Lon", "Radius m"]];
  const log = [["Timestamp", "Session", "Student ID", "On roster", "Device", "Location"]];
  const grid = [["Student ID"].concat(sessions.map((t) => fmt(t)))];
  ids.forEach((id) => grid.push([id]));
  sessions.forEach((t, si) => {
    const label = fmt(t) + " #1";
    control.push([String(4100 + si), label, "Submitted", D(t).toISOString(), D(t + 25 * 60e3).toISOString(), "x", "", "", ""]);
    ids.forEach((id, i) => {
      let p = prof[i][0] - (si >= 6 ? 0.08 : 0);
      if ((i === 3 || i === 7) && si >= 5) p = 0;
      const here = r() < p ? 1 : 0;
      grid[i + 1].push(here);
      if (here) {
        const lag = (prof[i][0] > 0.8 ? 0.4 : 3) + r() * (prof[i][0] > 0.8 ? 4 : 14);
        log.push([D(t + lag * 60e3), label, id, "Yes", "d" + i, ""]);
      }
    });
  });

  // Live quizzes: weeks 1 to 4, five questions each, released.
  const resp = [["Timestamp", "First Name", "ID", "Join Code", "Q1", "Q2", "Q3", "Q4", "Q5", "Score", "Round", "Questions", "Answers", "Week"]];
  const items = [["Timestamp", "Join Code", "Round", "Week", "Student ID", "Q", "Question ID", "Answer", "Correct answer", "Correct", "Confidence"]];
  const presence = [["Timestamp", "ID", "First Name", "Join Code", "Status"]];
  const keys = ["B", "D", "A", "C", "E"], hard = [0.15, 0.05, 0.3, 0, 0.2];
  for (let w = 1; w <= 4; w++) {
    const code = String(5200 + w), t = sessions[(w - 1) * 2 + 1] + 40 * 60e3;
    ids.forEach((id, i) => {
      const attended = grid[i + 1][(w - 1) * 2 + 2];
      if (!attended) return;
      const first = NAMES[i].split(" ")[0];
      presence.push([D(t - 5 * 60e3), id, first, code, "joined"]);
      if (r() < 0.06) return; // joined but did not submit
      let score = 0; const ans = [];
      for (let q = 0; q < 5; q++) {
        const skill = prof[i][1] + (w - 2.5) * (i === 1 ? 0.08 : i === 5 ? -0.05 : 0.02);
        const ok = r() < skill - hard[q] + (q === 0 ? 0.1 : 0);
        const blank = !ok && r() < 0.05;
        const wrong = q === 1 ? "B" : ["A", "B", "C", "D", "E"].filter((x) => x !== keys[q])[Math.floor(r() * 4)];
        const a = ok ? keys[q] : blank ? "" : wrong;
        ans.push(a); score += ok ? 1 : 0;
        items.push([D(t), code, 0, w, id, q + 1, "L" + w + "-Q" + (q + 1), a, keys[q], ok ? 1 : 0, ok ? (r() < 0.7 ? "H" : "M") : (r() < 0.3 ? "H" : "L")]);
      }
      presence.push([D(t + 8 * 60e3), id, first, code, "submitted"]);
      resp.push([D(t + 8 * 60e3), first, id, code].concat(ans, [score, 0, 5, ans.join(","), w]));
    });
  }

  // Practice: students who practise take the lecture's practice set a day or two after its live quiz. The questions are the same
  // as in the quiz, so the class's first and later answers to the same question can be compared. Lecture 2 does not improve.
  const attempts = [["Timestamp", "Student ID", "Quiz", "Attempt", "Score", "Total", "Seconds", "Wrong question ids", "Question ids"]];
  const gain = [0, 0.2, -0.05, 0.15, 0.2];
  ids.forEach((id, i) => {
    if (!prof[i][2]) { if (r() < 0.4) attempts.push([D(sessions[1] + 3 * day), id, "Lecture 1 practice", 1, 2, 5, 410, "L1-Q2,L1-Q4,L1-Q5", "L1-Q1,L1-Q2,L1-Q3,L1-Q4,L1-Q5"]); return; }
    for (let l = 1; l <= 4; l++) {
      const n = 1 + Math.floor(r() * 2), t0 = sessions[(l - 1) * 2 + 1] + day;
      for (let k = 1; k <= n; k++) {
        const asked = [1, 2, 3, 4, 5].map((q) => "L" + l + "-Q" + q);
        const wrong = asked.filter((q, j) => !(r() < prof[i][1] - hard[j] + gain[l] + 0.05 * k + (j === 0 ? 0.1 : 0)));
        attempts.push([D(Math.min(now - 3600e3, t0 + k * day / 2)), id, "Lecture " + l + " practice", k, 5 - wrong.length, 5, Math.round(300 + r() * 600), wrong.join(","), asked.join(",")]);
      }
    }
  });

  const roster = [["Student ID", "Name"]].concat(ids.map((id, i) => [id, NAMES[i]]));
  return {
    ids, names: NAMES, sessions,
    tabs: { Roster: roster, Attendance: grid, Attendance_Control: control, Attendance_Log: log, "Form Responses 1": resp, Item_Log: items, Presence: presence, Attempts: attempts }
  };
}

// Writes the sample tabs into a Class Manager workbook file (workbook.json), replacing those tabs and keeping the others.
function writeSample(file, opts) {
  const fs = require("fs");
  const s = sampleClass(opts);
  let book = { sheets: [], props: {} };
  try { book = JSON.parse(fs.readFileSync(file, "utf8")); } catch (e) { /* new file */ }
  const enc = (v) => (v instanceof Date ? { $d: v.toISOString() } : v);
  for (const [name, rows] of Object.entries(s.tabs)) {
    const data = { name, id: 9000 + book.sheets.length, rows: rows.map((r) => r.map(enc)) };
    const i = book.sheets.findIndex((x) => x.name === name);
    if (i >= 0) book.sheets[i] = Object.assign(book.sheets[i], { rows: data.rows }); else book.sheets.push(data);
  }
  fs.writeFileSync(file, JSON.stringify(book));
  return s;
}

module.exports = { sampleClass, writeSample };
