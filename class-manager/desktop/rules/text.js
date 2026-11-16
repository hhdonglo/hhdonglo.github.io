/* Small text and date helpers shared by the collaboration and communication rules: calendar dates, message text, links, day format.
   Ports of calWhen_, calDate_, chatTxt_, safeLink_, fmtDay_ and splitIds_ (apps_script/src). One responsibility: tidy text. */
"use strict";

function calWhen(s) { // 'YYYY-MM-DD' or 'YYYY-MM-DDTHH:MM' -> the same text, or '' if invalid
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?$/.exec(String(s || "").replace(/^'/, "").trim());
  if (!m || Number(m[2]) < 1 || Number(m[2]) > 12 || Number(m[3]) < 1 || Number(m[3]) > 31 || (m[4] && (Number(m[4]) > 23 || Number(m[5]) > 59))) return "";
  return m[1] + "-" + m[2] + "-" + m[3] + (m[4] ? "T" + m[4] + ":" + m[5] : "");
}
function calDate(s) { // local date from the stored text
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?$/.exec(s);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4] || 0), Number(m[5] || 0)) : null;
}
const chatTxt = (s, n) => String(s == null ? "" : s).replace(/\r/g, "").replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, "").slice(0, n).trim();
const safeLink = (s) => { const t = String(s || "").trim().slice(0, 300); return /^https?:\/\/[^\s<>"']+$/i.test(t) ? t : ""; };
const fmtDay = (t) => { if (!t) return ""; const d = new Date(t), p = (n) => String(n).padStart(2, "0"); return p(d.getDate()) + "/" + p(d.getMonth() + 1) + "/" + d.getFullYear(); };
const splitIds = (s) => String(s || "").split(/[\s,]+/).map((x) => x.replace(/^'/, "").trim()).filter(String);
const body = (store, tab, w) => { const r = store.rows(tab); return r && r.length > 1 ? r.slice(1).map((x) => x.slice(0, w)) : []; };
// Rewrites a tab's body under its header (the header is created when the tab is missing).
const rewrite = (store, tab, header, rows) => store.setRows(tab, [header.slice()].concat(rows));
// One of 12 hex digits of a random text, as the script's randInt_: n choices.
const randInt = (o, n) => parseInt(String(o.random()).replace(/[^0-9a-f]/gi, "").slice(0, 12), 16) % n;
const shuffled = (o, a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = randInt(o, i + 1), t = a[i]; a[i] = a[j]; a[j] = t; } return a; };

module.exports = { calWhen, calDate, chatTxt, safeLink, fmtDay, splitIds, body, rewrite, randInt, shuffled };
