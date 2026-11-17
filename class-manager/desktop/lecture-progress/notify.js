// The optional desktop notice when CM starts and the course is behind its lecture target.
// One responsibility: decide whether to show it and what it says. Uses the same report as the card and the banner. Off unless the lecturer switches it on.
"use strict";
const log = require("../rules/lecture-log");
const { fromBackend } = require("../rules/store");

function startNotice(c, Notification) {
  try {
    if (!c.settings.lectureNotify || !Notification || !Notification.isSupported()) return false;
    const p = log.report(fromBackend(c.backend), c.settings);
    if (p.state !== "behind" && p.state !== "ended") return false;
    new Notification({ title: "Class Manager: " + (c.settings.courseCode || "lectures"), body: p.headline + ". " + p.detail }).show();
    return true;
  } catch (e) { return false; }
}

module.exports = { startNotice };
