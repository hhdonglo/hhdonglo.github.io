// Module communication. Communication: the course calendar, messages and announcements.
// Edit the files in apps_script/src/; apps_script/quiz_receiver.gs is built from them (node apps_script/build.js).

// ---------- Course calendar: lectures, tutorials, quizzes, examinations, deadlines and office hours, each with an agenda ----------
// One row per event in the Calendar tab. Times are local to the script's time zone and stored as text (YYYY-MM-DDTHH:MM)
// so that the sheet does not reformat them. Events marked "Lecturer only" never leave the server without the host key.
var CAL_TAB = 'Calendar';
var CAL_HEAD = ['Event ID', 'Title', 'Kind', 'Start', 'End', 'All day', 'Location', 'Agenda', 'Resources', 'Week', 'Linked session', 'Visibility', 'Series', 'Created', 'Updated'];
var CAL_KINDS = ['lecture', 'tutorial', 'lab', 'quiz', 'exam', 'deadline', 'office hours', 'other'];

function calTxt_(v, n) { return String(v == null ? '' : v).replace(/^'/, '').replace(/\r/g, '').slice(0, n || 200).trim(); }
function calWhen_(s) { // 'YYYY-MM-DD' or 'YYYY-MM-DDTHH:MM' -> the same text, or '' if invalid
  var m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?$/.exec(String(s || '').replace(/^'/, '').trim());
  if (!m || Number(m[2]) < 1 || Number(m[2]) > 12 || Number(m[3]) < 1 || Number(m[3]) > 31 || (m[4] && (Number(m[4]) > 23 || Number(m[5]) > 59))) return '';
  return m[1] + '-' + m[2] + '-' + m[3] + (m[4] ? 'T' + m[4] + ':' + m[5] : '');
}
function calDate_(s) { // local date from the stored text
  var m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?$/.exec(s);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4] || 0), Number(m[5] || 0)) : null;
}
function calLocal_(d, withTime) { var tz = Session.getScriptTimeZone(); return Utilities.formatDate(d, tz, 'yyyy-MM-dd') + (withTime ? 'T' + Utilities.formatDate(d, tz, 'HH:mm') : ''); }
function calUtc_(d) { return d.toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z'); }
function calRows_() {
  var sh = sheetWith_(CAL_TAB, CAL_HEAD);
  return bodyRows_(sh, CAL_HEAD.length).filter(function (r) { return calTxt_(r[0]); }).map(function (r) {
    return { id: calTxt_(r[0], 40), title: calTxt_(r[1], 200), kind: calTxt_(r[2], 30) || 'other', start: calWhen_(r[3]), end: calWhen_(r[4]),
      allDay: String(r[5]).toLowerCase() === 'yes', location: calTxt_(r[6], 200), agenda: calTxt_(r[7], 4000), resources: calTxt_(r[8], 2000),
      week: Number(r[9]) || 0, link: calTxt_(r[10], 30), visibility: calTxt_(r[11], 20) === 'lecturer' ? 'lecturer' : 'students',
      series: calTxt_(r[12], 40), created: calTxt_(r[13], 40), updated: calTxt_(r[14], 40) };
  }).filter(function (ev) { return ev.start; });
}
function calSave_(list) {
  var sh = sheetWith_(CAL_TAB, CAL_HEAD);
  list.sort(function (a, b) { return a.start < b.start ? -1 : a.start > b.start ? 1 : 0; });
  rewriteBody_(sh, CAL_HEAD.length, list.map(function (ev) {
    return [ev.id, ev.title, ev.kind, "'" + ev.start, ev.end ? "'" + ev.end : '', ev.allDay ? 'yes' : 'no', ev.location, ev.agenda, ev.resources, ev.week || '', ev.link, ev.visibility, ev.series, ev.created, ev.updated];
  }));
  try { CacheService.getScriptCache().remove('cal_pub'); } catch (err) { /* cache only */ }
}
// Start and end in UTC for calendar programs, and the end filled in when it was left out.
function calOut_(ev) {
  var o = JSON.parse(JSON.stringify(ev)), s = calDate_(ev.start), e = ev.end ? calDate_(ev.end) : null;
  if (ev.allDay) { e = e || new Date(s.getTime()); e = new Date(e.getFullYear(), e.getMonth(), e.getDate() + 1); o.utcStart = calLocal_(s, false).replace(/-/g, ''); o.utcEnd = calLocal_(e, false).replace(/-/g, ''); }
  else {
    if (!e || e <= s) e = new Date(s.getTime() + (ev.kind === 'deadline' ? 0 : 3600000));
    o.utcStart = calUtc_(s); o.utcEnd = calUtc_(e);
    if (!ev.end) o.end = calLocal_(e, true);
  }
  return o;
}
function calendar_(p) { // public: events for students; with the host key, every event
  var host = !!(p && p.hostkey) && hostOk_(p);
  var list = calRows_().filter(function (ev) { return host || ev.visibility === 'students'; }).map(calOut_);
  var weeks = {}; try { weeks = siteJson_('/apps_script/live_quizzes.json').weeks || {}; } catch (err) { /* titles are a nicety */ }
  return { ok: true, host: host, tz: Session.getScriptTimeZone(), kinds: CAL_KINDS, weeks: weeks, events: list };
}
function calendarAct_(p) { // host only: save, delete, delete_series, series (add a weekly series)
  var op = String(p.op || '');
  var list = calRows_(), now = new Date().toISOString();
  function fromParams(ev) {
    ev.title = calTxt_(p.title, 200); ev.kind = CAL_KINDS.indexOf(String(p.kind)) >= 0 ? String(p.kind) : 'other';
    ev.allDay = String(p.allday) === 'yes';
    ev.start = calWhen_(p.start); ev.end = calWhen_(p.end);
    if (ev.allDay) { ev.start = ev.start.slice(0, 10); ev.end = ev.end ? ev.end.slice(0, 10) : ''; }
    ev.location = calTxt_(p.location, 200); ev.agenda = calTxt_(p.agenda, 4000); ev.resources = calTxt_(p.resources, 2000);
    ev.week = Math.max(0, Math.min(99, Number(p.week) || 0)); ev.link = ['', 'attendance', 'quiz', 'both'].indexOf(String(p.link || '')) >= 0 ? String(p.link || '') : '';
    ev.visibility = String(p.visibility) === 'lecturer' ? 'lecturer' : 'students'; ev.updated = now;
    return ev;
  }
  function check(ev) {
    if (!ev.title) return 'give the event a title';
    if (!ev.start) return 'give a valid start date';
    if (ev.end && ev.end < ev.start) return 'the end is before the start';
    return '';
  }
  if (op === 'save') {
    var id = calTxt_(p.id, 40), ev = id ? list.filter(function (x) { return x.id === id; })[0] : null;
    if (id && !ev) return { ok: false, why: 'event not found' };
    var isNew = !ev; ev = fromParams(ev || { id: 'E' + Utilities.getUuid().replace(/-/g, '').slice(0, 10), series: '', created: now });
    var why = check(ev); if (why) return { ok: false, why: why };
    if (isNew) list.push(ev);
    calSave_(list); return calendar_(p);
  }
  if (op === 'series') { // the same event every week (or every n days) for a number of occurrences
    var base = fromParams({}), why2 = check(base); if (why2) return { ok: false, why: why2 };
    var n = Math.max(1, Math.min(30, Number(p.count) || 1)), every = Math.max(1, Math.min(31, Number(p.every) || 7));
    var s0 = calDate_(base.start), e0 = base.end ? calDate_(base.end) : null, sid = 'S' + Utilities.getUuid().replace(/-/g, '').slice(0, 10);
    var wk = base.week, titles = calTxt_(p.titles, 4000).split('\n');
    for (var i = 0; i < n; i++) {
      var ev2 = JSON.parse(JSON.stringify(base));
      ev2.id = 'E' + Utilities.getUuid().replace(/-/g, '').slice(0, 10); ev2.series = sid; ev2.created = now;
      var si = new Date(s0.getFullYear(), s0.getMonth(), s0.getDate() + i * every, s0.getHours(), s0.getMinutes());
      ev2.start = calLocal_(si, !base.allDay);
      if (e0) { var ei = new Date(si.getTime() + (e0.getTime() - s0.getTime())); ev2.end = calLocal_(ei, !base.allDay); }
      if (wk) ev2.week = wk + i;
      var t = (titles[i] || '').trim(); ev2.title = (t || base.title).replace(/\{n\}/g, String(wk ? wk + i : i + 1)).slice(0, 200);
      list.push(ev2);
    }
    calSave_(list); return calendar_(p);
  }
  if (op === 'delete' || op === 'delete_series') {
    var did = calTxt_(p.id, 40), hit = list.filter(function (x) { return x.id === did; })[0];
    if (!hit) return { ok: false, why: 'event not found' };
    list = list.filter(function (x) { return op === 'delete' ? x.id !== did : !(hit.series ? x.series === hit.series : x.id === did); });
    calSave_(list); return calendar_(p);
  }
  return calendar_(p);
}
// iCalendar (RFC 5545) for one event or the whole calendar, for calendar programs to import or subscribe to.
function calIcsText_(s) { return String(s || '').replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\n/g, '\\n'); }
function calFold_(line) { var out = [], i = 0; while (line.length - i > 73) { out.push((i ? ' ' : '') + line.slice(i, i + 73)); i += 73; } out.push((i ? ' ' : '') + line.slice(i)); return out.join('\r\n'); }
function calendarIcs_(p) {
  var host = !!(p && p.hostkey) && hostOk_(p);
  var course = String((p && p.course) || 'Course calendar').slice(0, 80);
  var list = calRows_().filter(function (ev) { return (host || ev.visibility === 'students') && (!p.id || ev.id === String(p.id)); }).map(calOut_);
  var stamp = calUtc_(new Date());
  var L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Class Manager//Course calendar//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:' + calIcsText_(course), 'X-WR-TIMEZONE:' + Session.getScriptTimeZone(), 'REFRESH-INTERVAL;VALUE=DURATION:PT6H', 'X-PUBLISHED-TTL:PT6H'];
  list.forEach(function (ev) {
    var desc = [];
    if (ev.agenda) desc.push('Agenda:\n' + ev.agenda);
    if (ev.resources) desc.push('Resources:\n' + ev.resources);
    if (ev.week) desc.push('Week ' + ev.week);
    L.push('BEGIN:VEVENT', 'UID:' + ev.id + '@class-manager', 'DTSTAMP:' + stamp, 'SEQUENCE:' + Math.floor(new Date(ev.updated || ev.created || 0).getTime() / 1000 || 0));
    if (ev.allDay) L.push('DTSTART;VALUE=DATE:' + ev.utcStart, 'DTEND;VALUE=DATE:' + ev.utcEnd);
    else L.push('DTSTART:' + ev.utcStart, 'DTEND:' + ev.utcEnd);
    L.push('SUMMARY:' + calIcsText_(ev.title), 'CATEGORIES:' + calIcsText_(ev.kind.toUpperCase()));
    if (ev.location) L.push('LOCATION:' + calIcsText_(ev.location));
    if (desc.length) L.push('DESCRIPTION:' + calIcsText_(desc.join('\n\n')));
    if (ev.kind === 'deadline' || ev.kind === 'exam' || ev.kind === 'quiz') L.push('BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + calIcsText_(ev.title), 'TRIGGER:-P1D', 'END:VALARM');
    L.push('END:VEVENT');
  });
  L.push('END:VCALENDAR');
  return ContentService.createTextOutput(L.map(calFold_).join('\r\n') + '\r\n').setMimeType(ContentService.MimeType.ICAL);
}

// ---------- Messages and announcements ----------
// Students sign in with their Student ID and personal access code; the lecturer with the host key. Messages are stored in
// the Messages tab and delivered when each person next opens the page (store and forward), with unread counts.
// Conversations: the whole class; each lecturer-made group (Groups tab); groups that students make themselves; a private
// conversation between each student and the lecturer; and, when the lecturer allows it, between two students.
// A student sees only conversations they belong to. The lecturer sees every conversation and can remove messages, mute a
// student, set the rules, make the class conversation announcement-only, or switch chat off. A sender's name (from the
// class list) is shown to the people in the conversation; Student IDs are shown only to the lecturer.
var MSG_TAB = 'Messages', MSG_HEAD = ['Message ID', 'Time', 'Conversation', 'From', 'Name', 'Text', 'Status', 'Removed by'];
var CHG_TAB = 'Chat_Groups', CHG_HEAD = ['Group ID', 'Name', 'Owner', 'Members', 'Created'];
var CHR_TAB = 'Chat_Read', CHR_HEAD = ['Who', 'Conversation', 'Last read'];
var ANN_TAB = 'Announcements', ANN_HEAD = ['ID', 'Title', 'Text', 'Audience', 'Pinned', 'Show from', 'Link', 'Event ID', 'Created', 'Updated', 'Status'];
var CHAT_MAX = 1000, CHAT_PER_MIN = 8, CHAT_GROUP_MAX = 12, CHAT_OWN_MAX = 5;

function chatCfg_() {
  var pr = PropertiesService.getScriptProperties();
  var muted = {}; try { muted = JSON.parse(pr.getProperty('chat_muted') || '{}'); } catch (err) { muted = {}; }
  return { mode: pr.getProperty('chat_mode') || 'on', dm: pr.getProperty('chat_dm') || 'no', groups: pr.getProperty('chat_groups') || 'yes', rules: pr.getProperty('chat_rules') || '', muted: muted };
}
function chatTxt_(s, n) { return String(s == null ? '' : s).replace(/\r/g, '').replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, '').slice(0, n).trim(); }
function chatNames_() { var o = {}; rosterRows_().forEach(function (r) { o[r[0]] = r[1] || ('Student …' + r[0].slice(-4)); }); return o; }
function chatWho_(p) { // 'LECTURER', a rostered Student ID, or an error text
  if (p.hostkey) return hostOk_(p) ? 'LECTURER' : { why: 'host key not accepted' };
  var id = normId_(p.id), given = normCode_(p.code);
  if (id.length < 4 || id.length > 12) return { why: 'bad id' };
  if (attFails_('c' + id) >= ATT_MAX_FAILS) return { why: 'slow down' };
  var mine = rosterSet_()[id] ? codesMap_()[id] : null;
  if (!mine || !given || mine.code !== given) { attFailAdd_('c' + id); return { why: 'not recognised' }; }
  return id;
}
function chatGroups_() {
  return bodyRows_(sheetWith_(CHG_TAB, CHG_HEAD), CHG_HEAD.length).map(function (r) {
    return { id: String(r[0]).trim(), name: String(r[1]).trim(), owner: normId_(r[2]), members: splitIds_(r[3]).map(normId_).filter(String), created: r[4] };
  }).filter(function (g) { return g.id; });
}
// Every conversation this person may see, with its members.
function chatConvs_(who, cfg) {
  var names = chatNames_(), out = [];
  out.push({ id: 'CLASS', name: 'Whole class', kind: 'class', members: null });
  var lg = {}; groupRows_().forEach(function (r) { var k = 'L:' + r.set + '|' + r.group; (lg[k] = lg[k] || { id: k, name: r.set + ', group ' + r.group, kind: 'lecturer group', members: [] }).members.push(r.id); });
  Object.keys(lg).forEach(function (k) { out.push(lg[k]); });
  chatGroups_().forEach(function (g) { out.push({ id: 'S:' + g.id, name: g.name, kind: 'student group', owner: g.owner, members: [g.owner].concat(g.members.filter(function (m) { return m !== g.owner; })) }); });
  if (who === 'LECTURER') {
    var seen = {}; bodyRows_(sheetWith_(MSG_TAB, MSG_HEAD), 3).forEach(function (r) { var c = String(r[2]); if (/^(DM|P):/.test(c)) seen[c] = 1; });
    Object.keys(seen).forEach(function (c) {
      var ids = c.slice(c.indexOf(':') + 1).split(':');
      out.push({ id: c, name: c.indexOf('DM:') === 0 ? (names[ids[0]] || ids[0]) + ' and you' : ids.map(function (i) { return names[i] || i; }).join(' and '), kind: c.indexOf('DM:') === 0 ? 'private' : 'between students', members: ids });
    });
    return out;
  }
  var mine = out.filter(function (c) { return !c.members || c.members.indexOf(who) >= 0; });
  mine.push({ id: 'DM:' + who, name: 'The lecturer', kind: 'private', members: [who] });
  if (cfg.dm === 'yes') {
    var pc = {}; bodyRows_(sheetWith_(MSG_TAB, MSG_HEAD), 3).forEach(function (r) { var c = String(r[2]); if (c.indexOf('P:') === 0 && c.split(':').indexOf(who) > 0) pc[c] = 1; });
    Object.keys(pc).forEach(function (c) { var other = c.split(':').filter(function (x, i) { return i > 0 && x !== who; })[0]; mine.push({ id: c, name: names[other] || 'Classmate', kind: 'between students', members: c.split(':').slice(1) }); });
  }
  return mine;
}
function chatMsgs_() {
  return bodyRows_(sheetWith_(MSG_TAB, MSG_HEAD), MSG_HEAD.length).map(function (r) {
    return { id: String(r[0]), t: Number(r[1]) || 0, conv: String(r[2]), from: String(r[3]), name: String(r[4]), text: String(r[5]), status: String(r[6] || 'ok'), removedBy: String(r[7] || '') };
  }).filter(function (m) { return m.id; });
}
function chatReads_() { var o = {}; bodyRows_(sheetWith_(CHR_TAB, CHR_HEAD), 3).forEach(function (r) { o[String(r[0]) + '|' + String(r[1])] = Number(r[2]) || 0; }); return o; }
function chatMarkRead_(who, conv, t) {
  var sh = sheetWith_(CHR_TAB, CHR_HEAD), rows = bodyRows_(sh, 3);
  for (var i = 0; i < rows.length; i++) if (String(rows[i][0]) === who && String(rows[i][1]) === conv) { if ((Number(rows[i][2]) || 0) < t) { sh.getRange(i + 2, 3).setValue(t); chatBump_(); } return; }
  sh.appendRow([who, conv, t]); chatBump_();
}
function chatBump_() { try { CacheService.getScriptCache().put('chat_ver', String(Date.now()), 21600); } catch (err) { /* cache only */ } }
function chatVer_() { try { return CacheService.getScriptCache().get('chat_ver') || '0'; } catch (err) { return '0'; } }

// One request does everything a page needs: op = sync (default), send, read, group_make, group_add, group_remove, group_leave,
// and for the lecturer: remove, restore, mute, unmute, settings, group_delete, export.
function chat_(p) {
  var who = chatWho_(p);
  if (typeof who !== 'string') return { ok: false, why: who.why };
  var op = String(p.op || 'sync'), cfg = chatCfg_(), host = who === 'LECTURER';
  if (!host && cfg.mode === 'off' && op !== 'sync') return { ok: false, why: 'Chat is switched off by the lecturer.' };
  if (p.v && String(p.v) === chatVer_() && op === 'sync') return { ok: true, same: true, v: chatVer_() }; // nothing new: answer at once
  var convs = chatConvs_(who, cfg), byId = {}; convs.forEach(function (c) { byId[c.id] = c; });
  var sh = sheetWith_(MSG_TAB, MSG_HEAD), names = chatNames_();
  function can(conv) { return host || !!byId[conv] || (cfg.dm === 'yes' && /^P:\d+:\d+$/.test(conv) && conv.split(':').indexOf(who) > 0); }
  var conv = chatTxt_(p.conv, 80);
  if (op === 'send') {
    var text = chatTxt_(p.text, CHAT_MAX);
    if (!text) return { ok: false, why: 'The message is empty.' };
    if (!host) {
      if (cfg.muted[who]) return { ok: false, why: 'The lecturer has paused your messages.' };
      if (conv === 'CLASS' && cfg.mode === 'announce') return { ok: false, why: 'Only the lecturer posts in the whole-class conversation at present.' };
      var c = CacheService.getScriptCache(), k = 'chatn:' + who, n = Number(c.get(k) || 0);
      if (n >= CHAT_PER_MIN) return { ok: false, why: 'Too many messages in a short time. Wait a minute.' };
      if (/^P:/.test(conv)) { if (cfg.dm !== 'yes') return { ok: false, why: 'Messages between students are switched off.' }; var ids = conv.split(':').slice(1); if (ids.length !== 2 || ids.indexOf(who) < 0 || !rosterSet_()[ids[0]] || !rosterSet_()[ids[1]] || ids[0] === ids[1]) return { ok: false, why: 'No such classmate.' }; }
    }
    if (/^DM:/.test(conv) && host && !rosterSet_()[conv.slice(3)]) return { ok: false, why: 'That Student ID is not on the class list.' };
    if (!can(conv)) return { ok: false, why: 'You are not in that conversation.' };
    if (!host) { var c2 = CacheService.getScriptCache(); c2.put('chatn:' + who, String(Number(c2.get('chatn:' + who) || 0) + 1), 60); }
    var t = Date.now();
    sh.appendRow(['M' + t + Utilities.getUuid().slice(0, 4), t, conv, host ? 'LECTURER' : who, host ? 'Lecturer' : (names[who] || 'Student'), text, 'ok', '']);
    chatMarkRead_(who, conv, t); chatBump_();
  }
  if (op === 'dm_start' && !host) { // a private conversation with a classmate, by Student ID
    if (cfg.dm !== 'yes') return { ok: false, why: 'Messages between students are switched off.' };
    var other = normId_(p.other); if (!rosterSet_()[other] || other === who) return { ok: false, why: 'That Student ID is not on the class list.' };
    conv = 'P:' + [who, other].sort().join(':'); byId[conv] = { id: conv, name: names[other] || 'Classmate', kind: 'between students', members: [who, other] }; convs.push(byId[conv]);
  }
  if (/^group_/.test(op)) {
    var gs = sheetWith_(CHG_TAB, CHG_HEAD), list = chatGroups_(), gid = String(p.group || '').replace(/^S:/, '');
    var g = list.filter(function (x) { return x.id === gid; })[0];
    var save = function () { rewriteBody_(gs, CHG_HEAD.length, list.map(function (x) { return [x.id, x.name, x.owner, x.members.join(','), x.created]; })); chatBump_(); };
    if (op === 'group_make') {
      if (!host && cfg.groups !== 'yes') return { ok: false, why: 'Students cannot make groups at present.' };
      var nm = chatTxt_(p.name, 60); if (!nm) return { ok: false, why: 'Give the group a name.' };
      if (!host && list.filter(function (x) { return x.owner === who; }).length >= CHAT_OWN_MAX) return { ok: false, why: 'You already have ' + CHAT_OWN_MAX + ' groups.' };
      g = { id: 'G' + Utilities.getUuid().replace(/-/g, '').slice(0, 8), name: nm, owner: host ? '' : who, members: [], created: new Date() }; list.push(g); gid = g.id; conv = 'S:' + g.id;
    } else if (!g) return { ok: false, why: 'No such group.' };
    if (op === 'group_make' || op === 'group_add') {
      if (!host && g.owner !== who) return { ok: false, why: 'Only the person who made the group can add members.' };
      var add = splitIds_(p.ids).map(normId_).filter(function (i) { return i && i !== g.owner; }), bad = add.filter(function (i) { return !rosterSet_()[i]; });
      if (bad.length) return { ok: false, why: 'Not on the class list: ' + bad.join(', ') + '.' };
      add.forEach(function (i) { if (g.members.indexOf(i) < 0) g.members.push(i); });
      if (g.members.length + 1 > CHAT_GROUP_MAX) return { ok: false, why: 'A group can have at most ' + CHAT_GROUP_MAX + ' members.' };
      save();
    }
    if (op === 'group_remove') { if (!host && g.owner !== who) return { ok: false, why: 'Only the person who made the group can remove members.' }; g.members = g.members.filter(function (i) { return i !== normId_(p.other); }); save(); }
    if (op === 'group_leave') { if (g.owner === who) { if (!g.members.length) list = list.filter(function (x) { return x !== g; }); else { g.owner = g.members.shift(); } } else g.members = g.members.filter(function (i) { return i !== who; }); save(); conv = ''; }
    if (op === 'group_delete') { if (!host && g.owner !== who) return { ok: false, why: 'Only the person who made the group can close it.' }; list = list.filter(function (x) { return x !== g; }); save(); conv = ''; }
    convs = chatConvs_(who, cfg); byId = {}; convs.forEach(function (c2) { byId[c2.id] = c2; });
  }
  if (host && (op === 'remove' || op === 'restore')) {
    var rows = bodyRows_(sh, 1);
    for (var i = 0; i < rows.length; i++) if (String(rows[i][0]) === String(p.msg)) { sh.getRange(i + 2, 7, 1, 2).setValues([[op === 'remove' ? 'removed' : 'ok', op === 'remove' ? new Date().toISOString() : '']]); break; }
    chatBump_();
  }
  if (host && (op === 'mute' || op === 'unmute')) {
    var mid = normId_(p.other); if (op === 'mute') cfg.muted[mid] = 1; else delete cfg.muted[mid];
    PropertiesService.getScriptProperties().setProperty('chat_muted', JSON.stringify(cfg.muted)); chatBump_();
  }
  if (host && op === 'settings') {
    var pr = PropertiesService.getScriptProperties();
    if (['on', 'announce', 'off'].indexOf(String(p.mode)) >= 0) pr.setProperty('chat_mode', String(p.mode));
    if (['yes', 'no'].indexOf(String(p.dm)) >= 0) pr.setProperty('chat_dm', String(p.dm));
    if (['yes', 'no'].indexOf(String(p.groups)) >= 0) pr.setProperty('chat_groups', String(p.groups));
    if (p.rules !== undefined) pr.setProperty('chat_rules', chatTxt_(p.rules, 1500));
    cfg = chatCfg_(); chatBump_();
  }
  var msgs = chatMsgs_(), reads = chatReads_();
  if (host && op === 'export') return { ok: true, messages: msgs.map(function (m) { return [new Date(m.t).toISOString(), m.conv, (byId[m.conv] || {}).name || m.conv, m.from, m.name, m.text, m.status]; }) };
  if (op === 'read' && conv && can(conv)) { var last = 0; msgs.forEach(function (m) { if (m.conv === conv && m.t > last) last = m.t; }); if (last) { chatMarkRead_(who, conv, last); reads[who + '|' + conv] = last; } }
  // The list of conversations with unread counts, and the messages of the open one.
  var outConvs = convs.map(function (c) {
    var r = reads[who + '|' + c.id] || 0, unread = 0, lastT = 0, lastText = '';
    msgs.forEach(function (m) { if (m.conv !== c.id) return; if (m.t > lastT) { lastT = m.t; lastText = m.status === 'ok' ? m.text.slice(0, 80) : ''; } if (m.t > r && m.from !== who && m.status === 'ok') unread++; });
    var o = { id: c.id, name: c.name, kind: c.kind, unread: unread, last: lastT, preview: lastText };
    if (c.members) { o.count = c.members.length; if (host || c.kind === 'student group') o.members = c.members.map(function (i) { return { id: host || c.owner === who ? i : '', name: names[i] || 'Classmate', owner: i === c.owner, muted: host ? !!cfg.muted[i] : undefined }; }); }
    if (c.kind === 'student group') o.mine = c.owner === who;
    return o;
  }).sort(function (a, b) { return (a.id === 'CLASS' ? -1 : b.id === 'CLASS' ? 1 : b.last - a.last); });
  var out = { ok: true, v: chatVer_(), me: host ? 'LECTURER' : who, myName: host ? 'Lecturer' : names[who] || '', host: host, mode: cfg.mode, dm: cfg.dm, groups: cfg.groups, rules: cfg.rules, muted: !host && !!cfg.muted[who], conversations: outConvs, conv: '' };
  if (host) out.mutedIds = Object.keys(cfg.muted);
  if (conv && can(conv) && (host || cfg.mode !== 'off')) {
    var after = Number(p.after) || 0, inConv = msgs.filter(function (m) { return m.conv === conv; });
    var others = (byId[conv] && byId[conv].members || []).filter(function (i) { return i !== who; });
    var seenBy = function (t) { // delivery state for the sender's own messages: read by everyone else, by some, or not yet
      if (conv === 'CLASS') return '';
      var ids = /^DM:/.test(conv) ? (host ? [conv.slice(3)] : ['LECTURER']) : others;
      var n = ids.filter(function (i) { return (reads[i + '|' + conv] || 0) >= t; }).length;
      return n && n === ids.length ? 'read' : n ? 'read by ' + n : 'sent';
    };
    out.conv = conv;
    out.messages = inConv.filter(function (m) { return m.t > after; }).slice(after ? 0 : -150).map(function (m) {
      var o = { id: m.id, t: m.t, mine: m.from === who, name: m.name, text: m.status === 'ok' || host ? m.text : '', removed: m.status !== 'ok', lecturer: m.from === 'LECTURER' };
      if (host) o.from = m.from;
      if (o.mine) o.state = seenBy(m.t);
      return o;
    });
  }
  out.unread = outConvs.reduce(function (s, c) { return s + c.unread; }, 0);
  return out;
}

// ---------- Announcements: posted by the lecturer, read by students ----------
// Audience: 'all' (shown on the portal to anyone), 'class' (students signed in with their access code) or a list of
// conversations (lecturer-made or student-made groups). An announcement can be pinned, held until a date and time,
// carry a link and point to a calendar event.
function annRows_() {
  return bodyRows_(sheetWith_(ANN_TAB, ANN_HEAD), ANN_HEAD.length).map(function (r) {
    return { id: String(r[0]), title: String(r[1]), text: String(r[2]), audience: String(r[3] || 'all'), pinned: String(r[4]) === 'yes', from: calWhen_(r[5]), link: String(r[6] || ''), event: String(r[7] || ''), created: String(r[8] || ''), updated: String(r[9] || ''), status: String(r[10] || 'ok') };
  }).filter(function (a) { return a.id && a.status !== 'deleted'; });
}
function annSave_(list) { rewriteBody_(sheetWith_(ANN_TAB, ANN_HEAD), ANN_HEAD.length, list.map(function (a) { return [a.id, a.title, a.text, a.audience, a.pinned ? 'yes' : 'no', a.from ? "'" + a.from : '', a.link, a.event, a.created, a.updated, a.status || 'ok']; })); try { CacheService.getScriptCache().remove('ann_pub'); } catch (err) { /* cache only */ } }
function announcements_(p) { // public for audience 'all'; signed-in students also get their own; the lecturer gets all, with edit ops
  var who = (p.hostkey || p.code) ? chatWho_(p) : null;
  if (who && typeof who !== 'string') return { ok: false, why: who.why };
  var host = who === 'LECTURER', list = annRows_(), now = calLocal_(new Date(), true);
  if (host && p.op) {
    var a = p.ann ? list.filter(function (x) { return x.id === String(p.ann); })[0] : null, ts = new Date().toISOString();
    if (p.op === 'save') {
      var title = chatTxt_(p.title, 160), text = chatTxt_(p.text, 4000);
      if (!title) return { ok: false, why: 'Give the announcement a title.' };
      var aud = String(p.audience || 'all'); if (!/^(all|class|([LS]:[^,]+)(,[LS]:[^,]+)*)$/.test(aud)) aud = 'all';
      var link = chatTxt_(p.link, 400); if (link && !/^(https?:\/\/|[\w.-]+\.(html|pdf)([#?].*)?$)/i.test(link)) return { ok: false, why: 'The link must be a web address or a course page.' };
      if (!a) { a = { id: 'A' + Utilities.getUuid().replace(/-/g, '').slice(0, 10), created: ts }; list.unshift(a); }
      a.title = title; a.text = text; a.audience = aud; a.pinned = String(p.pinned) === 'yes'; a.from = calWhen_(p.from); a.link = link; a.event = chatTxt_(p.event, 40); a.updated = ts; a.status = 'ok';
      annSave_(list); chatBump_();
    } else if (p.op === 'delete' && a) { list = list.filter(function (x) { return x !== a; }); annSave_(list); chatBump_(); }
  }
  var groups = {};
  if (who && !host) { chatConvs_(who, chatCfg_()).forEach(function (c) { groups[c.id] = 1; }); }
  var reads = who ? chatReads_() : {}, lastRead = who ? (reads[who + '|ANN'] || 0) : 0;
  var events = {}; try { calRows_().forEach(function (ev) { events[ev.id] = ev; }); } catch (err) { /* no calendar */ }
  var visible = list.filter(function (a2) {
    if (host) return true;
    if (a2.from && a2.from > now) return false;
    if (a2.audience === 'all') return true;
    if (!who) return false;
    if (a2.audience === 'class') return true;
    return a2.audience.split(',').some(function (g) { return groups[g]; });
  }).map(function (a3) {
    var ev = events[a3.event], o = { id: a3.id, title: a3.title, text: a3.text, pinned: a3.pinned, link: a3.link, at: a3.from ? a3.from : a3.created.slice(0, 16), audience: host ? a3.audience : undefined, scheduled: host && a3.from > now ? a3.from : undefined, unread: !!who && !host && Date.parse(a3.updated) > lastRead };
    if (ev && (host || ev.visibility === 'students')) o.event = { id: ev.id, title: ev.title, start: ev.start };
    return o;
  }).sort(function (x, y) { return (y.pinned - x.pinned) || (x.at < y.at ? 1 : x.at > y.at ? -1 : 0); });
  if (who && !host && p.read === 'yes') chatMarkRead_(who, 'ANN', Date.now());
  return { ok: true, host: host, announcements: visible.slice(0, host ? 200 : 50), unread: visible.filter(function (a4) { return a4.unread; }).length };
}
