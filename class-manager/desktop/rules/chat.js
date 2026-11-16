/* Messages: the whole class, lecturer groups, student groups, private conversations with the lecturer and (when allowed) between students.
   Store and forward, with unread counts. A port of chat_ and its helpers (apps_script/src/50-communication.gs), with the same answers.
   o = {random, counters} as auth.studentCheck; req = {post, session}. Tabs: Messages, Chat_Groups, Chat_Read. */
"use strict";
const AC = require("./access-codes");
const AT = require("./attendance");
const AU = require("./auth");
const G = require("./groups");
const T = require("./text");
const { normalizeId } = require("../ids");
const { append } = require("./store");

const MSG = "Messages", MSG_HEAD = ["Message ID", "Time", "Conversation", "From", "Name", "Text", "Status", "Removed by"];
const CHG = "Chat_Groups", CHG_HEAD = ["Group ID", "Name", "Owner", "Members", "Created"];
const CHR = "Chat_Read", CHR_HEAD = ["Who", "Conversation", "Last read"];
const CHAT_MAX = 1000, CHAT_PER_MIN = 8, CHAT_GROUP_MAX = 12, CHAT_OWN_MAX = 5;

function cfgOf(store) {
  let muted = {}; try { muted = JSON.parse(store.prop("chat_muted") || "{}"); } catch (e) { muted = {}; }
  return { mode: store.prop("chat_mode") || "on", dm: store.prop("chat_dm") || "no", groups: store.prop("chat_groups") || "yes", rules: store.prop("chat_rules") || "", muted };
}
function names(store) { const o = {}; AC.rosterRows(store).forEach((r) => { o[r[0]] = r[1] || ("Student …" + r[0].slice(-4)); }); return o; }
function who(store, p, req, o) { // 'LECTURER', a rostered Student ID, or {why}
  if (p.hostkey) return AU.hostOk(store, p, req, o) ? "LECTURER" : { why: "host key not accepted" };
  const w = AU.studentCheck(store, p.id, p.code, "c", req, o);
  return w.id ? w.id : { why: w.why };
}
function groups(store) {
  return T.body(store, CHG, 5).map((r) => ({ id: String(r[0]).trim(), name: String(r[1]).trim(), owner: normalizeId(r[2]), members: T.splitIds(r[3]).map(normalizeId).filter(String), created: r[4] })).filter((g) => g.id);
}
function messages(store) {
  return T.body(store, MSG, 8).map((r) => ({ id: String(r[0]), t: Number(r[1]) || 0, conv: String(r[2]), from: String(r[3]), name: String(r[4]), text: String(r[5]), status: String(r[6] || "ok"), removedBy: String(r[7] || "") })).filter((m) => m.id);
}
function reads(store) { const o = {}; T.body(store, CHR, 3).forEach((r) => { o[String(r[0]) + "|" + String(r[1])] = Number(r[2]) || 0; }); return o; }
const bump = (store, o) => { try { o.counters.put("chat_ver", store.now().getTime(), 21600); } catch (e) { /* cache only */ } };
const version = (o) => { try { return String(o.counters.get("chat_ver") || "0"); } catch (e) { return "0"; } };
function markRead(store, o, who_, conv, t) {
  const rows = store.rows(CHR) || [CHR_HEAD.slice()];
  for (let i = 1; i < rows.length; i++) if (String(rows[i][0]) === who_ && String(rows[i][1]) === conv) { if ((Number(rows[i][2]) || 0) < t) { rows[i][2] = t; store.setRows(CHR, rows); bump(store, o); } return; }
  append(store, CHR, CHR_HEAD, [who_, conv, t]); bump(store, o);
}

// Every conversation this person may see, with its members.
function convs(store, w, cfg) {
  const nm = names(store), out = [{ id: "CLASS", name: "Whole class", kind: "class", members: null }], lg = {};
  G.rows(store).forEach((r) => { const k = "L:" + r.set + "|" + r.group; (lg[k] = lg[k] || { id: k, name: r.set + ", group " + r.group, kind: "lecturer group", members: [] }).members.push(r.id); });
  Object.keys(lg).forEach((k) => out.push(lg[k]));
  groups(store).forEach((g) => out.push({ id: "S:" + g.id, name: g.name, kind: "student group", owner: g.owner, members: [g.owner].concat(g.members.filter((m) => m !== g.owner)) }));
  if (w === "LECTURER") {
    const seen = {}; T.body(store, MSG, 3).forEach((r) => { const c = String(r[2]); if (/^(DM|P):/.test(c)) seen[c] = 1; });
    Object.keys(seen).forEach((c) => {
      const ids = c.slice(c.indexOf(":") + 1).split(":");
      out.push({ id: c, name: c.indexOf("DM:") === 0 ? (nm[ids[0]] || ids[0]) + " and you" : ids.map((i) => nm[i] || i).join(" and "), kind: c.indexOf("DM:") === 0 ? "private" : "between students", members: ids });
    });
    return out;
  }
  const mine = out.filter((c) => !c.members || c.members.indexOf(w) >= 0);
  mine.push({ id: "DM:" + w, name: "The lecturer", kind: "private", members: [w] });
  if (cfg.dm === "yes") {
    const pc = {}; T.body(store, MSG, 3).forEach((r) => { const c = String(r[2]); if (c.indexOf("P:") === 0 && c.split(":").indexOf(w) > 0) pc[c] = 1; });
    Object.keys(pc).forEach((c) => { const other = c.split(":").filter((x, i) => i > 0 && x !== w)[0]; mine.push({ id: c, name: nm[other] || "Classmate", kind: "between students", members: c.split(":").slice(1) }); });
  }
  return mine;
}

function send(store, p, o, c) { // returns {ok:false, why} or null
  const text = T.chatTxt(p.text, CHAT_MAX);
  if (!text) return { ok: false, why: "The message is empty." };
  const rs = AT.rosterSet(store);
  if (!c.host) {
    if (c.cfg.muted[c.w]) return { ok: false, why: "The lecturer has paused your messages." };
    if (c.conv === "CLASS" && c.cfg.mode === "announce") return { ok: false, why: "Only the lecturer posts in the whole-class conversation at present." };
    const k = "chatn:" + c.w, n = Number(o.counters.get(k) || 0);
    if (n >= CHAT_PER_MIN) return { ok: false, why: "Too many messages in a short time. Wait a minute." };
    if (/^P:/.test(c.conv)) {
      if (c.cfg.dm !== "yes") return { ok: false, why: "Messages between students are switched off." };
      const ids = c.conv.split(":").slice(1);
      if (ids.length !== 2 || ids.indexOf(c.w) < 0 || !rs[ids[0]] || !rs[ids[1]] || ids[0] === ids[1]) return { ok: false, why: "No such classmate." };
    }
  }
  if (/^DM:/.test(c.conv) && c.host && !rs[c.conv.slice(3)]) return { ok: false, why: "That Student ID is not on the class list." };
  if (!c.can(c.conv)) return { ok: false, why: "You are not in that conversation." };
  if (!c.host) o.counters.put("chatn:" + c.w, Number(o.counters.get("chatn:" + c.w) || 0) + 1, 60);
  const t = store.now().getTime();
  append(store, MSG, MSG_HEAD, ["M" + t + String(o.random()).slice(0, 4), t, c.conv, c.host ? "LECTURER" : c.w, c.host ? "Lecturer" : (c.names[c.w] || "Student"), text, "ok", ""]);
  markRead(store, o, c.w, c.conv, t); bump(store, o);
  return null;
}

// Student and lecturer group operations. Returns {ok:false, why} or null; c.conv may change.
function groupOps(store, p, o, c) {
  const op = c.op, rs = AT.rosterSet(store); let list = groups(store), gid = String(p.group || "").replace(/^S:/, ""), g = list.filter((x) => x.id === gid)[0];
  const save = () => { T.rewrite(store, CHG, CHG_HEAD, list.map((x) => [x.id, x.name, x.owner, x.members.join(","), x.created])); bump(store, o); };
  if (op === "group_make") {
    if (!c.host && c.cfg.groups !== "yes") return { ok: false, why: "Students cannot make groups at present." };
    const nm = T.chatTxt(p.name, 60); if (!nm) return { ok: false, why: "Give the group a name." };
    if (!c.host && list.filter((x) => x.owner === c.w).length >= CHAT_OWN_MAX) return { ok: false, why: "You already have " + CHAT_OWN_MAX + " groups." };
    g = { id: "G" + String(o.random()).replace(/-/g, "").slice(0, 8), name: nm, owner: c.host ? "" : c.w, members: [], created: store.now() }; list.push(g); gid = g.id; c.conv = "S:" + g.id;
  } else if (!g) return { ok: false, why: "No such group." };
  if (op === "group_make" || op === "group_add") {
    if (!c.host && g.owner !== c.w) return { ok: false, why: "Only the person who made the group can add members." };
    const add = T.splitIds(p.ids).map(normalizeId).filter((i) => i && i !== g.owner), bad = add.filter((i) => !rs[i]);
    if (bad.length) return { ok: false, why: "Not on the class list: " + bad.join(", ") + "." };
    add.forEach((i) => { if (g.members.indexOf(i) < 0) g.members.push(i); });
    if (g.members.length + 1 > CHAT_GROUP_MAX) return { ok: false, why: "A group can have at most " + CHAT_GROUP_MAX + " members." };
    save();
  }
  if (op === "group_remove") { if (!c.host && g.owner !== c.w) return { ok: false, why: "Only the person who made the group can remove members." }; g.members = g.members.filter((i) => i !== normalizeId(p.other)); save(); }
  if (op === "group_leave") { if (g.owner === c.w) { if (!g.members.length) list = list.filter((x) => x !== g); else g.owner = g.members.shift(); } else g.members = g.members.filter((i) => i !== c.w); save(); c.conv = ""; }
  if (op === "group_delete") { if (!c.host && g.owner !== c.w) return { ok: false, why: "Only the person who made the group can close it." }; list = list.filter((x) => x !== g); save(); c.conv = ""; }
  return null;
}

// One request does everything a page needs: op = sync (default), send, read, dm_start, group_make, group_add, group_remove, group_leave,
// and for the lecturer: remove, restore, mute, unmute, settings, group_delete, export.
function chat(store, p, req, o) {
  const w = who(store, p, req, o);
  if (typeof w !== "string") return { ok: false, why: w.why };
  const op = String(p.op || "sync");
  let cfg = cfgOf(store); const host = w === "LECTURER";
  if (!host && cfg.mode === "off" && op !== "sync") return { ok: false, why: "Chat is switched off by the lecturer." };
  if (p.v && String(p.v) === version(o) && op === "sync") return { ok: true, same: true, v: version(o) };
  let cs = convs(store, w, cfg), byId = {}; cs.forEach((x) => { byId[x.id] = x; });
  const nm = names(store);
  const c = { w, host, cfg, op, names: nm, conv: T.chatTxt(p.conv, 80), can: (conv) => host || !!byId[conv] || (cfg.dm === "yes" && /^P:\d+:\d+$/.test(conv) && conv.split(":").indexOf(w) > 0) };
  let refuse;
  if (op === "send" && (refuse = send(store, p, o, c))) return refuse;
  if (op === "dm_start" && !host) { // a private conversation with a classmate, by Student ID
    if (cfg.dm !== "yes") return { ok: false, why: "Messages between students are switched off." };
    const other = normalizeId(p.other); if (!AT.rosterSet(store)[other] || other === w) return { ok: false, why: "That Student ID is not on the class list." };
    c.conv = "P:" + [w, other].sort().join(":"); byId[c.conv] = { id: c.conv, name: nm[other] || "Classmate", kind: "between students", members: [w, other] }; cs.push(byId[c.conv]);
  }
  if (/^group_/.test(op)) {
    if ((refuse = groupOps(store, p, o, c))) return refuse;
    cs = convs(store, w, cfg); byId = {}; cs.forEach((x) => { byId[x.id] = x; });
  }
  if (host && (op === "remove" || op === "restore")) {
    const rows = store.rows(MSG) || [MSG_HEAD.slice()];
    for (let i = 1; i < rows.length; i++) if (String(rows[i][0]) === String(p.msg)) { rows[i][6] = op === "remove" ? "removed" : "ok"; rows[i][7] = op === "remove" ? store.now().toISOString() : ""; store.setRows(MSG, rows); break; }
    bump(store, o);
  }
  if (host && (op === "mute" || op === "unmute")) {
    const mid = normalizeId(p.other); if (op === "mute") cfg.muted[mid] = 1; else delete cfg.muted[mid];
    store.setProp("chat_muted", JSON.stringify(cfg.muted)); bump(store, o);
  }
  if (host && op === "settings") {
    if (["on", "announce", "off"].indexOf(String(p.mode)) >= 0) store.setProp("chat_mode", String(p.mode));
    if (["yes", "no"].indexOf(String(p.dm)) >= 0) store.setProp("chat_dm", String(p.dm));
    if (["yes", "no"].indexOf(String(p.groups)) >= 0) store.setProp("chat_groups", String(p.groups));
    if (p.rules !== undefined) store.setProp("chat_rules", T.chatTxt(p.rules, 1500));
    cfg = cfgOf(store); c.cfg = cfg; bump(store, o);
  }
  const msgs = messages(store), rd = reads(store); let conv = c.conv;
  if (host && op === "export") return { ok: true, messages: msgs.map((m) => [new Date(m.t).toISOString(), m.conv, (byId[m.conv] || {}).name || m.conv, m.from, m.name, m.text, m.status]) };
  if (op === "read" && conv && c.can(conv)) { let last = 0; msgs.forEach((m) => { if (m.conv === conv && m.t > last) last = m.t; }); if (last) { markRead(store, o, w, conv, last); rd[w + "|" + conv] = last; } }
  const outConvs = cs.map((x) => {
    const r = rd[w + "|" + x.id] || 0; let unread = 0, lastT = 0, lastText = "";
    msgs.forEach((m) => { if (m.conv !== x.id) return; if (m.t > lastT) { lastT = m.t; lastText = m.status === "ok" ? m.text.slice(0, 80) : ""; } if (m.t > r && m.from !== w && m.status === "ok") unread++; });
    const out = { id: x.id, name: x.name, kind: x.kind, unread, last: lastT, preview: lastText };
    if (x.members) { out.count = x.members.length; if (host || x.kind === "student group") out.members = x.members.map((i) => ({ id: host || x.owner === w ? i : "", name: nm[i] || "Classmate", owner: i === x.owner, muted: host ? !!cfg.muted[i] : undefined })); }
    if (x.kind === "student group") out.mine = x.owner === w;
    return out;
  }).sort((a, b) => (a.id === "CLASS" ? -1 : b.id === "CLASS" ? 1 : b.last - a.last));
  const out = { ok: true, v: version(o), me: host ? "LECTURER" : w, myName: host ? "Lecturer" : nm[w] || "", host, mode: cfg.mode, dm: cfg.dm, groups: cfg.groups, rules: cfg.rules, muted: !host && !!cfg.muted[w], conversations: outConvs, conv: "" };
  if (host) out.mutedIds = Object.keys(cfg.muted);
  if (conv && c.can(conv) && (host || cfg.mode !== "off")) {
    const after = Number(p.after) || 0, inConv = msgs.filter((m) => m.conv === conv), others = ((byId[conv] && byId[conv].members) || []).filter((i) => i !== w);
    const seenBy = (t) => { // delivery state for the sender's own messages: read by everyone else, by some, or not yet
      if (conv === "CLASS") return "";
      const ids = /^DM:/.test(conv) ? (host ? [conv.slice(3)] : ["LECTURER"]) : others, n = ids.filter((i) => (rd[i + "|" + conv] || 0) >= t).length;
      return n && n === ids.length ? "read" : n ? "read by " + n : "sent";
    };
    out.conv = conv;
    out.messages = inConv.filter((m) => m.t > after).slice(after ? 0 : -150).map((m) => {
      const x = { id: m.id, t: m.t, mine: m.from === w, name: m.name, text: m.status === "ok" || host ? m.text : "", removed: m.status !== "ok", lecturer: m.from === "LECTURER" };
      if (host) x.from = m.from;
      if (x.mine) x.state = seenBy(m.t);
      return x;
    });
  }
  out.unread = outConvs.reduce((s, x) => s + x.unread, 0);
  return out;
}

module.exports = { chat, who, cfgOf, convs, reads, markRead, bump, version, names, groups, messages, MSG, MSG_HEAD, CHG, CHR };
