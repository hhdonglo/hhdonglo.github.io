"use strict";

const { randomUUID } = require("node:crypto");
const { createSealedStore } = require("./sealed-store");
const { clean, plan } = require("./plans");

const workspaceTypes = ["personal", "research", "supervision", "committee", "conference", "talk", "meeting", "reminder"];

function openWork(file, vault, courses, now = () => new Date()) {
  const db = createSealedStore(file, vault, () => ({ version: 1, workspaces: [], buckets: [] }),
    state => state?.version === 1 && Array.isArray(state.workspaces) && Array.isArray(state.buckets));
  const listOf = state => [...courses().map(c => ({ ...c, type: "course" })), ...state.workspaces];
  const find = (state, id) => listOf(state).find(info => info.id === id);
  function active(state, id) {
    const info = find(state, id);
    if (!info || info.archived) throw new Error("This workspace is unavailable.");
    return info;
  }
  function bucket(state, info, create = false) {
    let records = state.buckets.find(x => x.workspaceId === info.id && x.created === info.created);
    if (!records && create) {
      records = { workspaceId: info.id, created: info.created, plans: [], activity: [], memory: null };
      state.buckets.push(records);
    }
    return records;
  }
  function activity(records, kind, item, date) {
    records.activity.unshift({ id: randomUUID(), kind, targetId: item.id, title: item.title, date });
    records.activity.length = Math.min(records.activity.length, 500);
  }
  function saveWorkspace(input) {
    return db.change(state => {
      const current = input.id && state.workspaces.find(x => x.id === input.id);
      if (input.id && !current) throw new Error("Choose a workspace created in Academic Work.");
      const type = current?.type || input.type;
      if (!workspaceTypes.includes(type)) throw new Error("Choose a workspace type.");
      const title = clean(input.title, 120);
      if (!title) throw new Error("Enter a workspace title.");
      const date = now().toISOString();
      const next = { id: current?.id || "work-" + randomUUID(), type, title, description: clean(input.description, 1500),
        created: current?.created || date, archived: current?.archived || false };
      if (current) Object.assign(current, next); else state.workspaces.push(next);
      activity(bucket(state, next, true), current ? "Workspace updated" : "Workspace created", next, date);
      return next;
    });
  }

  function archiveWorkspace(id, archived) {
    return db.change(state => {
      const item = state.workspaces.find(x => x.id === id);
      if (!item) throw new Error("Choose a workspace created in Academic Work.");
      if (item.archived !== archived) {
        item.archived = archived;
        activity(bucket(state, item, true), archived ? "Workspace archived" : "Workspace restored", item, now().toISOString());
      }
      return item;
    });
  }

  function plans(id) { const state = db.read(); return bucket(state, active(state, id))?.plans || []; }
  function savePlan(id, input) {
    return db.change(state => {
      const records = bucket(state, active(state, id), true);
      const current = input.id && records.plans.find(item => item.id === input.id);
      if (input.id && !current) throw new Error("This plan is no longer available in this workspace.");
      const time = now().toISOString();
      const next = plan(input, current, time);
      const wasDone = current?.done;
      if (current) Object.assign(current, next); else records.plans.push(next);
      activity(records, next.done && !wasDone ? "Plan completed" : current ? "Plan updated" : "Plan added", next, time);
      return next;
    });
  }

  function controlPlan(id, planId, done) {
    const current = plans(id).find(item => item.id === planId);
    if (!current) throw new Error("This plan is no longer available in this workspace.");
    return savePlan(id, { ...current, done, progress: current.kind === "goal" ? (done ? 100 : 0) : 0 });
  }

  function readMemory(id) {
    const state = db.read();
    return bucket(state, active(state, id))?.memory || null;
  }
  function saveMemory(id, raw, change) {
    db.change(state => {
      const records = bucket(state, active(state, id), true);
      records.memory = raw;
      if (change) activity(records, change.kind, change.item, now().toISOString());
    });
  }

  function due() {
    const state = db.read(), time = now().toISOString();
    return listOf(state).filter(info => !info.archived).flatMap(info => (bucket(state, info)?.plans || [])
      .filter(item => !item.done && item.remindAt && item.remindAt <= time && !item.remindedAt)
      .map(item => ({ ...item, workspaceId: info.id, workspaceTitle: info.title || info.code })));
  }
  function markReminded(id, planId, expectedTime) {
    return db.change(state => {
      const records = bucket(state, active(state, id));
      const item = records?.plans.find(p => p.id === planId);
      if (!item || item.done || item.remindedAt || item.remindAt !== expectedTime) return false;
      item.remindedAt = now().toISOString();
      return true;
    });
  }

  return { list: () => listOf(db.read()), get: id => find(db.read(), id), saveWorkspace, archiveWorkspace,
    plans, savePlan, controlPlan, readMemory, saveMemory, due, markReminded,
    overview: () => { const state = db.read(); return listOf(state).filter(info => !info.archived).map(info => ({
      info, plans: bucket(state, info)?.plans || [], activity: bucket(state, info)?.activity || []
    })); } };
}

module.exports = { openWork, workspaceTypes };
