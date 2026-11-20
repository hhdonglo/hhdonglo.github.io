"use strict";

// Shared by HTTP, IPC and the relay mailbox. Mixed screens keep their platform actions.
const { modules } = require("./module-registry");

const views = { overview: "analytics", attendance: "attendance", quizzes: "liveQuizzes", progress: "analytics", students: "analytics", course: "content" };

function lookup(field) {
  return new Map(Object.values(modules).flatMap(module => module[field].map(name => [name, module.id])));
}
const actionOwners = lookup("actions"), channelOwners = lookup("channels"), pageOwners = lookup("pages"), kindOwners = lookup("kinds");
const sharedOwners = new Map();
for (const module of Object.values(modules)) {
  for (const page of module.sharedPages) {
    if (!sharedOwners.has(page)) sharedOwners.set(page, []);
    sharedOwners.get(page).push(module.id);
  }
}

function requestModule(params, isPost) {
  // Calendar edit's kind is the event type, rather than a submission kind.
  if (params.action === "calendar_edit") return "calendar";
  if (isPost && (params.kind || !params.action)) {
    if (params.kind === "roster_sync") return null;
    return kindOwners.get(params.kind) || "liveQuizzes";
  }
  const action = String(params.action || "");
  return action === "attend" || action.startsWith("attend_") ? "attendance" : actionOwners.get(action);
}

function pageModule(name, enabled) {
  const shared = sharedOwners.get(name.toLowerCase());
  if (shared) return shared.find(id => enabled.includes(id)) || shared[0];
  if (/^(?:lecture-\d+|introduction)-practice\.html$/i.test(name)) return "practice";
  if (/^(?:lecture-\d+|introduction)\.html$/i.test(name)) return "content";
  return pageOwners.get(name.toLowerCase());
}

function refusal(enabled, module) {
  return module && !enabled.includes(module) ? { ok: false, disabled: module, why: "This feature is disabled for this course." } : null;
}

function browserAccess(enabled) {
  const disabledPages = Object.values(modules).flatMap(module => enabled.includes(module.id) ? [] : module.pages);
  for (const [page, owners] of sharedOwners) {
    if (!owners.some(id => enabled.includes(id))) disabledPages.push(page);
  }
  return {
    disabledPages,
    disabledViews: Object.keys(views).filter(view => !enabled.includes(views[view]))
  };
}

function filterReply(params, result, enabled) {
  const action = params.action;
  if (!["portal_status", "my_results", "held_status", "held_items", "preclass"].includes(action)) return result;
  if (action !== "my_results" && enabled.includes("attendance") && enabled.includes("liveQuizzes")) return result;
  if (action === "my_results" && ["attendance", "liveQuizzes", "practice", "groups", "assignments"].every(id => enabled.includes(id))) return result;
  // Preserve JSONP for older read-only callers.
  const callback = /^[A-Za-z_][A-Za-z0-9_]*$/.test(params.callback || "") ? params.callback + "(" : "";
  const wrapped = callback && result.text.startsWith(callback) && result.text.endsWith(")");
  let data;
  try { data = JSON.parse(wrapped ? result.text.slice(callback.length, -1) : result.text); } catch { return result; }
  if (!data || typeof data !== "object") return result;
  if (!enabled.includes("attendance")) {
    if (action === "portal_status" || action === "preclass") data.attendance = "closed";
    if (Array.isArray(data.attendance)) data.attendance = [];
    if (Array.isArray(data.sessions)) data.sessions = [];
  }
  if (!enabled.includes("liveQuizzes")) {
    if (action === "portal_status" || action === "preclass") data.quiz = "none";
    if (action === "held_status") data.quiz = 0;
    if (Array.isArray(data.quizzes)) data.quizzes = [];
  }
  if (action === "my_results" && data.ok) {
    if (!enabled.includes("practice") && Array.isArray(data.practice)) data.practice = [];
    if (!enabled.includes("groups") && Array.isArray(data.groups)) data.groups = [];
    if (!enabled.includes("assignments") && data.groupWork !== undefined) data.groupWork = 0;
  }
  const json = JSON.stringify(data);
  return Object.assign({}, result, { text: wrapped ? callback + json + ")" : json });
}

function channelModule(channel, enabled) {
  const owner = channelOwners.get(channel);
  // Bank setup is shared by the materials screen and the live quiz workflow.
  if (owner === "liveQuizzes" && enabled.includes("content")) return "content";
  return owner;
}

module.exports = { requestModule, pageModule, channelModule, refusal, browserAccess, filterReply };
