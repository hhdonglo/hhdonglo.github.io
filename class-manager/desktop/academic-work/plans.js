"use strict";

const { randomUUID } = require("node:crypto");

const types = ["goal", "task", "meeting", "event", "reminder"];
const providers = {
  meet: { label: "Google Meet", launch: "https://meet.google.com/new", host: host => host === "meet.google.com" },
  teams: { label: "Microsoft Teams", launch: "https://teams.microsoft.com/", host: host => ["teams.microsoft.com", "teams.live.com", "teams.cloud.microsoft"].includes(host) },
  zoom: { label: "Zoom", launch: "https://zoom.us/join", host: host => host === "zoom.us" || host.endsWith(".zoom.us") }
};
const clean = (value, max) => typeof value === "string" ? value.trim().slice(0, max) : "";
function date(value) {
  if (!value) return null;
  if (typeof value !== "string" || !/^\d{4}-\d\d-\d\dT\d\d:\d\d(?::\d\d(?:\.\d{1,3})?)?(?:Z|[+-]\d\d:\d\d)$/.test(value)) throw new Error("Choose a valid date and time.");
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (year < 100 || month < 1 || month > 12 || day < 1 || day > days) throw new Error("Choose a valid date and time.");
  const time = new Date(value);
  if (!Number.isFinite(+time)) throw new Error("Choose a valid date and time.");
  return time.toISOString();
}

function meetingUrl(provider, input) {
  if (!Object.hasOwn(providers, provider)) throw new Error("Choose a meeting provider.");
  if (!input) return providers[provider].launch;
  let url;
  try { url = new URL(input); } catch { throw new Error("Enter a valid meeting link."); }
  if (url.protocol !== "https:" || url.username || url.password || url.port || !providers[provider].host(url.hostname)) {
    throw new Error("Use an HTTPS meeting link from the selected provider.");
  }
  return url.href;
}

function plan(input, current, now) {
  const kind = current?.kind || input.kind;
  if (!types.includes(kind)) throw new Error("Choose a plan type.");
  const title = clean(input.title, 160);
  if (!title) throw new Error("Enter a title.");
  const when = date(input.when), end = date(input.end), remindAt = date(input.remindAt);
  if (["meeting", "event", "reminder"].includes(kind) && !when) throw new Error("Choose a date and time.");
  if (end && (!when || end <= when || !["meeting", "event"].includes(kind))) throw new Error("The end must be after the start of an event or meeting.");
  if (remindAt && when && remindAt > when) throw new Error("The reminder must be at or before the scheduled time.");
  const progress = kind === "goal" ? Number(input.progress ?? 0) : 0;
  if (!Number.isInteger(progress) || progress < 0 || progress > 100) throw new Error("Enter goal progress from 0 to 100.");
  const provider = kind === "meeting" ? clean(input.provider, 20) : "";
  if (kind === "meeting" && input.link && !provider) throw new Error("Choose the provider for this meeting link.");
  const link = provider && input.link ? meetingUrl(provider, clean(input.link, 4000)) : "";
  if (provider) meetingUrl(provider);
  const reminder = remindAt || (kind === "reminder" ? when : null);
  return {
    id: current?.id || randomUUID(), kind, title, notes: clean(input.notes, 12000), when, end,
    remindAt: reminder, remindedAt: reminder === current?.remindAt ? current.remindedAt : null, provider, link, progress,
    done: kind === "goal" ? progress === 100 : input.done === true, created: current?.created || now, updated: now
  };
}

function calendarFile(item, now = new Date().toISOString()) {
  if (!["event", "meeting"].includes(item.kind) || !item.when) throw new Error("Choose a scheduled meeting or event.");
  const escape = value => value.replace(/\\/g, "\\\\").replace(/\r?\n|\r/g, "\\n").replace(/[,;]/g, s => "\\" + s);
  const utc = value => value.replace(/[-:]|\.\d{3}/g, "");
  function fold(line) {
    const lines = [];
    let part = "", bytes = 0;
    for (const char of line) {
      const size = Buffer.byteLength(char);
      if (bytes + size > 75) { lines.push(part); part = " "; bytes = 1; }
      part += char; bytes += size;
    }
    return [...lines, part].join("\r\n");
  }
  const alarm = item.remindAt ? ["BEGIN:VALARM", "TRIGGER;VALUE=DATE-TIME:" + utc(item.remindAt), "ACTION:DISPLAY", "DESCRIPTION:" + escape(item.title), "END:VALARM"] : [];
  return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Class Manager//Academic Work//EN", "BEGIN:VEVENT",
    "UID:" + item.id + "@class-manager.local", "DTSTAMP:" + utc(now), "DTSTART:" + utc(item.when),
    ...(item.end ? ["DTEND:" + utc(item.end)] : []), "SUMMARY:" + escape(item.title),
    "DESCRIPTION:" + escape([item.notes, item.link].filter(Boolean).join("\n")), ...alarm, "END:VEVENT", "END:VCALENDAR", ""
  ].map(fold).join("\r\n");
}

module.exports = { clean, plan, types, providers, meetingUrl, calendarFile };
