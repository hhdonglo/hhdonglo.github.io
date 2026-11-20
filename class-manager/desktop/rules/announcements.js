/* Announcements: posted by the lecturer, read by students. Audience 'all' (public), 'class' (signed-in students) or a list of conversations;
   pinned, held until a date, with a link and a calendar event. A port of announcements_ and helpers (apps_script/src/50-communication.gs).
   o = {random, counters}; req = {post, session}. Tab: Announcements. */
"use strict";
const CH = require("./chat");
const CA = require("./calendar");
const T = require("./text");

const TAB = "Announcements", HEAD = ["ID", "Title", "Text", "Audience", "Pinned", "Show from", "Link", "Event ID", "Created", "Updated", "Status"];
const localNow = (d) => { const p = (n) => String(n).padStart(2, "0"); return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()) + "T" + p(d.getHours()) + ":" + p(d.getMinutes()); };

function rows(store) {
  return T.body(store, TAB, 11).map((r) => ({ id: String(r[0]), title: String(r[1]), text: String(r[2]), audience: String(r[3] || "all"), pinned: String(r[4]) === "yes", from: T.calWhen(r[5]), link: String(r[6] || ""), event: String(r[7] || ""), created: String(r[8] || ""), updated: String(r[9] || ""), status: String(r[10] || "ok") }))
    .filter((a) => a.id && a.status !== "deleted");
}
const save = (store, list) => T.rewrite(store, TAB, HEAD, list.map((a) => [a.id, a.title, a.text, a.audience, a.pinned ? "yes" : "no", a.from ? "'" + a.from : "", a.link, a.event, a.created, a.updated, a.status || "ok"]));

function announcements(store, p, req, o) { // public for 'all'; signed-in students also get their own; the lecturer gets all, with edit ops
  const w = (p.hostkey || p.code) ? CH.who(store, p, req, o) : null;
  if (w && typeof w !== "string") return { ok: false, why: w.why };
  const host = w === "LECTURER", now = localNow(store.now()), calendarEnabled = !o.enabled || o.enabled("calendar"); let list = rows(store);
  if (host && p.op) {
    let a = p.ann ? list.filter((x) => x.id === String(p.ann))[0] : null; const ts = store.now().toISOString();
    if (p.op === "save") {
      const title = T.chatTxt(p.title, 160), text = T.chatTxt(p.text, 4000);
      if (!title) return { ok: false, why: "Give the announcement a title." };
      let aud = String(p.audience || "all"); if (!/^(all|class|([LS]:[^,]+)(,[LS]:[^,]+)*)$/.test(aud)) aud = "all";
      const link = T.chatTxt(p.link, 400); if (link && !/^(https?:\/\/|[\w.-]+\.(html|pdf)([#?].*)?$)/i.test(link)) return { ok: false, why: "The link must be a web address or a course page." };
      if (!a) { a = { id: "A" + String(o.random()).replace(/-/g, "").slice(0, 10), created: ts }; list.unshift(a); }
      a.title = title; a.text = text; a.audience = aud; a.pinned = String(p.pinned) === "yes"; a.from = T.calWhen(p.from); a.link = link; a.event = calendarEnabled ? T.chatTxt(p.event, 40) : a.event || ""; a.updated = ts; a.status = "ok";
      save(store, list); CH.bump(store, o);
    } else if (p.op === "delete" && a) { list = list.filter((x) => x !== a); save(store, list); CH.bump(store, o); }
  }
  const groups = {};
  if (w && !host) CH.convs(store, w, CH.cfgOf(store)).forEach((c) => { groups[c.id] = 1; });
  const rd = w ? CH.reads(store) : {}, lastRead = w ? (rd[w + "|ANN"] || 0) : 0, events = {};
  if (calendarEnabled) try { CA.rows(store).forEach((ev) => { events[ev.id] = ev; }); } catch (e) { /* no calendar */ }
  const visible = list.filter((a2) => {
    if (host) return true;
    if (a2.from && a2.from > now) return false;
    if (a2.audience === "all") return true;
    if (!w) return false;
    if (a2.audience === "class") return true;
    return a2.audience.split(",").some((g) => groups[g]);
  }).map((a3) => {
    const ev = events[a3.event], x = { id: a3.id, title: a3.title, text: a3.text, pinned: a3.pinned, link: a3.link, at: a3.from ? a3.from : a3.created.slice(0, 16), audience: host ? a3.audience : undefined, scheduled: host && a3.from > now ? a3.from : undefined, unread: !!w && !host && Date.parse(a3.updated) > lastRead };
    if (ev && (host || ev.visibility === "students")) x.event = { id: ev.id, title: ev.title, start: ev.start };
    return x;
  }).sort((x, y) => ((y.pinned ? 1 : 0) - (x.pinned ? 1 : 0)) || (x.at < y.at ? 1 : x.at > y.at ? -1 : 0));
  if (w && !host && p.read === "yes") CH.markRead(store, o, w, "ANN", store.now().getTime());
  return { ok: true, host, announcements: visible.slice(0, host ? 200 : 50), unread: visible.filter((a4) => a4.unread).length };
}

module.exports = { announcements, rows, save, TAB, HEAD };
