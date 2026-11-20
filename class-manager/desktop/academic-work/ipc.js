"use strict";

const fs = require("node:fs");
const { calendarFile } = require("./plans");
const { openDocument } = require("./documents");

function register({ on, academics, mail, dialog, winOf, BrowserWindow, shell, isLocal = () => false }) {
  const safe = fn => async (...args) => {
    try { return { ok: true, value: await fn(...args) }; }
    catch (error) { return { ok: false, why: error.message }; }
  };
  on("cm:academic", safe(async (course, event, action, input = {}) => {
    if (!isLocal(event)) throw new Error("Open Academic Work in a CM desktop window.");
    const work = academics();
    switch (action) {
      case "overview": return work.overview();
      case "list": return work.list();
      case "links": return work.allLinks();
      case "plans": return work.planList(input.workspaceId);
      case "browse": return work.browse(input.workspaceId);
      case "search": return work.search(input.query, input.workspaceId, course.id, query => course.backend.students.find(query));
      case "source": return work.approvedSource(input);
      case "workspace": return work.saveWorkspace(input);
      case "archive": return work.archiveWorkspace(input.workspaceId, input.archived === true);
      case "plan": return work.savePlan(input.workspaceId, input);
      case "complete": return work.controlPlan(input.workspaceId, input.id, input.done === true);
      case "memory": return work.changeMemory(input.workspaceId, input);
      case "linkFile": {
        const choice = await dialog.showOpenDialog(winOf(event), { title: "Link a document to this workspace", properties: ["openFile"] });
        return choice.canceled || !choice.filePaths.length ? null : work.linkFile(input.workspaceId, choice.filePaths[0]);
      }
      case "document": return openDocument(work.document(input.workspaceId, input.id, input.approvedOnly === true), BrowserWindow, winOf(event));
      case "meeting": {
        await shell.openExternal(work.meeting(input.provider, input.link));
        return null;
      }
      case "exportEvent": {
        const item = work.plans(input.workspaceId).find(plan => plan.id === input.id);
        if (!item) throw new Error("This event is unavailable.");
        const file = calendarFile(item);
        const choice = await dialog.showSaveDialog(winOf(event), { title: "Export to a calendar", defaultPath: "cm-event.ics", filters: [{ name: "Calendar", extensions: ["ics"] }] });
        if (!choice.canceled && choice.filePath) fs.writeFileSync(choice.filePath, file, { mode: 0o600 });
        return !choice.canceled;
      }
      case "mailStatus": return mail.status();
      case "mailConnect": return mail.connect(input.provider, input);
      case "mailDisconnect": return mail.disconnect(input.provider);
      case "mailList": return mail.list(input.provider);
      case "mailMessage": return mail.message(input.provider, input.id);
      default: throw new Error("Choose an Academic Work action.");
    }
  }));
}

function createReminderDelivery(academics, Notification, canNotify, open, report) {
  const visible = new Set();
  return function deliver() {
    if (!canNotify() || !Notification?.isSupported()) return;
    try {
      const work = academics(), pending = work.due();
      const keys = new Set(pending.map(item => item.id + "|" + item.remindAt));
      for (const key of visible) if (!keys.has(key)) visible.delete(key);
      for (const item of pending) {
        const key = item.id + "|" + item.remindAt;
        if (visible.has(key)) continue;
        const notice = new Notification({ title: "Academic Work reminder", body: "A planned item is due in Class Manager." });
        visible.add(key);
        notice.on("show", () => {
          try { work.markReminded(item.workspaceId, item.id, item.remindAt); }
          catch (error) { visible.delete(key); report(error); }
        });
        notice.on("failed", () => visible.delete(key));
        notice.on("click", () => open(item.workspaceId));
        try { notice.show(); } catch (error) { visible.delete(key); throw error; }
      }
    } catch (error) { report(error); }
  };
}

module.exports = { register, createReminderDelivery };
