/* The course calendar: lectures, tutorials, quizzes, examinations, deadlines and office hours, each with an agenda, and the iCalendar feed.
   A port of calendar_, calendarAct_, calendarIcs_ and helpers (apps_script/src/50-communication.gs), with the same answers.
   o = {site, random}. Tab: Calendar. Times are local text (YYYY-MM-DDTHH:MM). */
"use strict";
const AU = require("./auth");
const T = require("./text");

const TAB = "Calendar", HEAD = ["Event ID", "Title", "Kind", "Start", "End", "All day", "Location", "Agenda", "Resources", "Week", "Linked session", "Visibility", "Series", "Created", "Updated"];
const KINDS = ["lecture", "tutorial", "lab", "quiz", "exam", "deadline", "office hours", "other"];
const txt = (v, n) => String(v == null ? "" : v).replace(/^'/, "").replace(/\r/g, "").slice(0, n || 200).trim();
const pad = (n) => String(n).padStart(2, "0");
const local = (d, withTime) => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()) + (withTime ? "T" + pad(d.getHours()) + ":" + pad(d.getMinutes()) : "");
const utc = (d) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
const tz = () => Intl.DateTimeFormat().resolvedOptions().timeZone;
const uid = (o) => String(o.random()).replace(/-/g, "").slice(0, 10);

function rows(store) {
  return T.body(store, TAB, 15).filter((r) => txt(r[0])).map((r) => ({ id: txt(r[0], 40), title: txt(r[1], 200), kind: txt(r[2], 30) || "other", start: T.calWhen(r[3]), end: T.calWhen(r[4]),
    allDay: String(r[5]).toLowerCase() === "yes", location: txt(r[6], 200), agenda: txt(r[7], 4000), resources: txt(r[8], 2000), week: Number(r[9]) || 0, link: txt(r[10], 30),
    visibility: txt(r[11], 20) === "lecturer" ? "lecturer" : "students", series: txt(r[12], 40), created: txt(r[13], 40), updated: txt(r[14], 40) })).filter((ev) => ev.start);
}
function save(store, list) {
  list.sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0));
  T.rewrite(store, TAB, HEAD, list.map((ev) => [ev.id, ev.title, ev.kind, "'" + ev.start, ev.end ? "'" + ev.end : "", ev.allDay ? "yes" : "no", ev.location, ev.agenda, ev.resources, ev.week || "", ev.link, ev.visibility, ev.series, ev.created, ev.updated]));
}
function out(ev) { // start and end in UTC for calendar programs, and the end filled in when it was left out
  const o = JSON.parse(JSON.stringify(ev)), s = T.calDate(ev.start); let e = ev.end ? T.calDate(ev.end) : null;
  if (ev.allDay) { e = e || new Date(s.getTime()); e = new Date(e.getFullYear(), e.getMonth(), e.getDate() + 1); o.utcStart = local(s, false).replace(/-/g, ""); o.utcEnd = local(e, false).replace(/-/g, ""); }
  else {
    if (!e || e <= s) e = new Date(s.getTime() + (ev.kind === "deadline" ? 0 : 3600000));
    o.utcStart = utc(s); o.utcEnd = utc(e);
    if (!ev.end) o.end = local(e, true);
  }
  return o;
}
function isHost(store, p, req, o) { return !!(p && p.hostkey) && AU.hostOk(store, p, req, o); }
function calendar(store, p, req, o) { // public: events for students; with the host key, every event
  const host = isHost(store, p, req, o), list = rows(store).filter((ev) => host || ev.visibility === "students").map(out);
  let weeks = {}; try { weeks = o.site("/apps_script/live_quizzes.json").weeks || {}; } catch (e) { /* titles are a nicety */ }
  return { ok: true, host, tz: tz(), kinds: KINDS, weeks, events: list };
}
function act(store, p, req, o) { // host only: save, delete, delete_series, series
  const op = String(p.op || ""); let list = rows(store); const now = store.now().toISOString();
  const fromParams = (ev) => {
    ev.title = txt(p.title, 200); ev.kind = KINDS.indexOf(String(p.kind)) >= 0 ? String(p.kind) : "other"; ev.allDay = String(p.allday) === "yes";
    ev.start = T.calWhen(p.start); ev.end = T.calWhen(p.end);
    if (ev.allDay) { ev.start = ev.start.slice(0, 10); ev.end = ev.end ? ev.end.slice(0, 10) : ""; }
    ev.location = txt(p.location, 200); ev.agenda = txt(p.agenda, 4000); ev.resources = txt(p.resources, 2000);
    ev.week = Math.max(0, Math.min(99, Number(p.week) || 0)); ev.link = ["", "attendance", "quiz", "both"].indexOf(String(p.link || "")) >= 0 ? String(p.link || "") : "";
    ev.visibility = String(p.visibility) === "lecturer" ? "lecturer" : "students"; ev.updated = now;
    return ev;
  };
  const check = (ev) => (!ev.title ? "give the event a title" : !ev.start ? "give a valid start date" : ev.end && ev.end < ev.start ? "the end is before the start" : "");
  if (op === "save") {
    const id = txt(p.id, 40); let ev = id ? list.filter((x) => x.id === id)[0] : null;
    if (id && !ev) return { ok: false, why: "event not found" };
    const isNew = !ev; ev = fromParams(ev || { id: "E" + uid(o), series: "", created: now });
    const why = check(ev); if (why) return { ok: false, why };
    if (isNew) list.push(ev);
    save(store, list); return calendar(store, p, req, o);
  }
  if (op === "series") { // the same event every week (or every n days) for a number of occurrences
    const base = fromParams({}), why2 = check(base); if (why2) return { ok: false, why: why2 };
    const n = Math.max(1, Math.min(30, Number(p.count) || 1)), every = Math.max(1, Math.min(31, Number(p.every) || 7));
    const s0 = T.calDate(base.start), e0 = base.end ? T.calDate(base.end) : null, sid = "S" + uid(o), wk = base.week, titles = txt(p.titles, 4000).split("\n");
    for (let i = 0; i < n; i++) {
      const ev2 = JSON.parse(JSON.stringify(base)); ev2.id = "E" + uid(o); ev2.series = sid; ev2.created = now;
      const si = new Date(s0.getFullYear(), s0.getMonth(), s0.getDate() + i * every, s0.getHours(), s0.getMinutes());
      ev2.start = local(si, !base.allDay);
      if (e0) { const ei = new Date(si.getTime() + (e0.getTime() - s0.getTime())); ev2.end = local(ei, !base.allDay); }
      if (wk) ev2.week = wk + i;
      const t = (titles[i] || "").trim(); ev2.title = (t || base.title).replace(/\{n\}/g, String(wk ? wk + i : i + 1)).slice(0, 200);
      list.push(ev2);
    }
    save(store, list); return calendar(store, p, req, o);
  }
  if (op === "delete" || op === "delete_series") {
    const did = txt(p.id, 40), hit = list.filter((x) => x.id === did)[0];
    if (!hit) return { ok: false, why: "event not found" };
    list = list.filter((x) => (op === "delete" ? x.id !== did : !(hit.series ? x.series === hit.series : x.id === did)));
    save(store, list); return calendar(store, p, req, o);
  }
  return calendar(store, p, req, o);
}

// iCalendar (RFC 5545) for one event or the whole calendar. Returns the text; the router sets the type (text/calendar).
const icsText = (s) => String(s || "").replace(/\\/g, "\\\\").replace(/;/g, ";").replace(/,/g, "\\,").replace(/\n/g, "\\n");
function fold(line) { const o = []; let i = 0; while (line.length - i > 73) { o.push((i ? " " : "") + line.slice(i, i + 73)); i += 73; } o.push((i ? " " : "") + line.slice(i)); return o.join("\r\n"); }
function ics(store, p, req, o) {
  const host = isHost(store, p, req, o), course = String((p && p.course) || "Course calendar").slice(0, 80);
  const list = rows(store).filter((ev) => (host || ev.visibility === "students") && (!p.id || ev.id === String(p.id))).map(out), stamp = utc(store.now());
  const L = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Class Manager//Course calendar//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH", "X-WR-CALNAME:" + icsText(course), "X-WR-TIMEZONE:" + tz(), "REFRESH-INTERVAL;VALUE=DURATION:PT6H", "X-PUBLISHED-TTL:PT6H"];
  list.forEach((ev) => {
    const desc = [];
    if (ev.agenda) desc.push("Agenda:\n" + ev.agenda);
    if (ev.resources) desc.push("Resources:\n" + ev.resources);
    if (ev.week) desc.push("Week " + ev.week);
    L.push("BEGIN:VEVENT", "UID:" + ev.id + "@class-manager", "DTSTAMP:" + stamp, "SEQUENCE:" + Math.floor(new Date(ev.updated || ev.created || 0).getTime() / 1000 || 0));
    if (ev.allDay) L.push("DTSTART;VALUE=DATE:" + ev.utcStart, "DTEND;VALUE=DATE:" + ev.utcEnd); else L.push("DTSTART:" + ev.utcStart, "DTEND:" + ev.utcEnd);
    L.push("SUMMARY:" + icsText(ev.title), "CATEGORIES:" + icsText(ev.kind.toUpperCase()));
    if (ev.location) L.push("LOCATION:" + icsText(ev.location));
    if (desc.length) L.push("DESCRIPTION:" + icsText(desc.join("\n\n")));
    if (ev.kind === "deadline" || ev.kind === "exam" || ev.kind === "quiz") L.push("BEGIN:VALARM", "ACTION:DISPLAY", "DESCRIPTION:" + icsText(ev.title), "TRIGGER:-P1D", "END:VALARM");
    L.push("END:VEVENT");
  });
  L.push("END:VCALENDAR");
  return L.map(fold).join("\r\n") + "\r\n";
}

module.exports = { calendar, act, ics, rows, save, out, KINDS, TAB, HEAD };
