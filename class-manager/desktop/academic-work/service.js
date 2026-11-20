"use strict";

const { createMemory } = require("../academic-memory/ipc");
const log = require("../academic-memory/log");
const { workspaceTypes } = require("./store");
const { clean, types, providers, meetingUrl } = require("./plans");

const commands = [
  { id: "workspaces", title: "Browse workspaces" }, { id: "timeline", title: "Open Academic Timeline" },
  { id: "activity", title: "Open Activity Feed" }, { id: "plans", title: "Open Goals and plans" },
  { id: "memory", title: "Open Academic Memory and knowledge" }, { id: "mail", title: "Read email" },
  { id: "create-workspace", title: "Create a workspace" }, { id: "create-goal", title: "Create an academic goal" },
  { id: "create-task", title: "Add a to-do task" }, { id: "create-meeting", title: "Schedule a meeting" },
  { id: "create-event", title: "Plan an event" }, { id: "create-reminder", title: "Set a reminder" },
  { id: "create-note", title: "Write a knowledge note" },
  ...Object.entries(providers).map(([id, p]) => ({ id, title: "Launch " + p.label }))
];
const matches = (query, value) => query.split(/\s+/).every(token => value.toLowerCase().includes(token));

function createAcademicWork({ work, index, courseSource, courseRoot, courseHealth }) {
  function context(id) {
    const info = work.get(id);
    if (!info || info.archived) throw new Error("This workspace is unavailable.");
    if (info.type === "course") return { id, info, backend: courseSource(id) };
    let next;
    return { id, info, backend: {
      rawRows: () => [], enabledModules: () => [],
      secret: () => work.readMemory(id), setSecret: (k, value) => { next = value; },
      flush: () => work.saveMemory(id, next)
    } };
  }
  const memory = createMemory({
    index, workspace: work.get, workspaces: work.list,
    dirOf: c => c.info.type === "course" ? courseRoot(c.id) : document => document.sourceRoot,
    externalTarget: ref => {
      try { return { title: approvedSource(ref).title, archived: false }; } catch { return null; }
    }
  });

  function approvedSource(ref) {
    const c = context(ref.workspaceId);
    if (ref.created && ref.created !== c.info.created) throw new Error("The original workspace is unavailable.");
    let item = memory.source(c, ref);
    if (c.info.type === "course" && ref.kind === "event") {
      item = { kind: "event", title: item.source.table.startsWith("Attendance") ? "Attendance " + item.title : "Live quiz",
        date: item.date, source: { table: item.source.table } };
    }
    return { ...item, title: item.title || item.discussion?.title, workspaceId: c.id, workspaceTitle: c.info.title || c.info.code, created: c.info.created };
  }

  function overview() {
    const unavailable = [], timeline = [], activity = [];
    const cards = work.overview().map(({ info, plans, activity: recent }) => {
      const now = new Date().toISOString(), title = info.title || info.code;
      const totals = { open: 0, overdue: 0, goals: 0, completedGoals: 0, reminders: 0 };
      for (const plan of plans) {
        if (plan.kind === "goal") { totals.goals++; if (plan.done) totals.completedGoals++; }
        if (!plan.done) {
          totals.open++;
          if (plan.when && plan.when < now) totals.overdue++;
          if (plan.remindAt && !plan.remindedAt) totals.reminders++;
        }
        if (plan.when) timeline.push({ id: plan.id, workspaceId: info.id, workspaceTitle: title, kind: plan.kind, title: plan.title, date: plan.when, source: "plan", done: plan.done });
      }
      for (const item of recent) {
        const privateTitle = /^(Discussion|Document) /.test(item.kind);
        activity.push({ ...item, title: privateTitle ? item.kind : item.title, workspaceId: info.id, workspaceTitle: title, source: "activity" });
      }
      try {
        const c = context(info.id);
        for (const entry of memory.entries(c).filter(e => e.kind === "event" || e.kind === "discussion")) {
          if (!entry.date) continue;
          const item = { ...entry, workspaceTitle: title, source: "memory", created: info.created };
          delete item.content;
          if (entry.kind === "event") timeline.push(item);
          activity.push(item);
        }
      } catch { unavailable.push(title); }
      let health = null;
      if (info.type === "course") {
        try { health = courseHealth(info.id); } catch { /* course may require recovery */ }
      }
      return { info, totals, health };
    });
    const now = new Date().toISOString();
    const upcoming = timeline.filter(item => item.date >= now && !item.done).sort((a, b) => a.date.localeCompare(b.date));
    const history = timeline.filter(item => item.date < now || item.done).sort((a, b) => b.date.localeCompare(a.date));
    return { cards, archived: work.list().filter(info => info.archived && info.type !== "course"), upcoming: upcoming.slice(0, 150), timeline: history.slice(0, 150),
      activity: activity.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 200), unavailable,
      workspaceTypes, planTypes: types, providers: Object.entries(providers).map(([id, p]) => ({ id, label: p.label })), commands };
  }

  function browse(id) {
    const c = context(id), own = memory.context(c), available = new Map(memory.entries(c).map(entry => [entry.kind + ":" + entry.id, entry]));
    const display = ref => {
      if (ref.kind === "workspace" || ref.workspaceId || c.info.type !== "course") return log.targetOf(ref, own, true);
      const item = available.get(ref.kind + ":" + ref.id);
      return item ? { title: item.title, archived: false } : { title: "Private course item", private: true };
    };
    return {
      info: c.info, plans: work.plans(id),
      memory: c.info.type === "course" ? null : memory.describe(c),
      entries: [...available.values()].filter(e => e.kind !== "workspace").map(({ content, ...e }) => ({ ...e, created: c.info.created })),
      links: own.log.links.map(link => ({ ...link, fromTarget: display(link.from), toTarget: display(link.to) }))
    };
  }

  function search(query, selected, currentCourse, students) {
    query = clean(query, 160).toLowerCase();
    if (!query) return { results: [], commands };
    if (selected && !work.list().some(info => info.id === selected && !info.archived)) throw new Error("This workspace is unavailable.");
    const unreadable = [], contexts = [];
    for (const info of work.list().filter(x => !x.archived && (!selected || x.id === selected))) {
      try { const c = context(info.id); log.read(c.backend); contexts.push(c); }
      catch { unreadable.push(info.title || info.code); }
    }
    const results = memory.searchAcross(contexts, query).map(entry => {
      const info = work.get(entry.workspaceId);
      return { ...entry, workspaceTitle: info.title || info.code, created: info.created, source: "memory" };
    });
    for (const ctx of contexts) for (const item of work.plans(ctx.id)) {
      if (matches(query, [item.title, item.notes, item.kind].join(" "))) results.push({
        id: item.id, title: item.title, kind: item.kind, date: item.when, workspaceId: ctx.id, workspaceTitle: ctx.info.title || ctx.info.code, source: "plan"
      });
    }
    const localStudents = !selected || selected === currentCourse ? students(query) : [];
    for (const student of localStudents) results.unshift({ id: student.id, title: student.name || student.id, kind: "student", workspaceId: currentCourse, source: "student" });
    return { results: results.slice(0, 120), commands: commands.filter(command => matches(query, command.title)), unreadable };
  }

  function editable(id) {
    const c = context(id);
    if (c.info.type === "course") throw new Error("Edit course discussions and links from that course's Academic Memory.");
    return { c, context: memory.context(c) };
  }

  function changeMemory(id, input) {
    const { context: c } = editable(id);
    let item, kind;
    switch (input.operation) {
      case "discussion": item = log.saveDiscussion(c.log, input); kind = "Discussion saved"; break;
      case "archiveDiscussion":
        item = c.log.discussions.find(d => d.id === input.id);
        if (!item) throw new Error("This discussion is unavailable.");
        item.archived = input.archived === true; kind = item.archived ? "Discussion archived" : "Discussion restored"; break;
      case "link": item = log.saveLink(c, input); item = { id: item.id, title: "Academic Memory link" }; kind = "Link added"; break;
      case "unlink": c.log.links = c.log.links.filter(link => link.id !== input.id); break;
      case "tags": log.setTags(c, input.target, input.tags); break;
      default: throw new Error("Choose a supported memory operation.");
    }
    work.saveMemory(id, JSON.stringify(c.log), item ? { item, kind } : null);
    return browse(id);
  }

  function linkFile(id, file) {
    const { context: c } = editable(id);
    const doc = log.addDocument(require("node:path").dirname(file), file, c.log);
    work.saveMemory(id, JSON.stringify(c.log), { item: doc, kind: "Document linked" });
    return browse(id);
  }

  function document(id, docId, approvedOnly) {
    const c = context(id);
    if (approvedOnly || c.info.type === "course") approvedSource({ workspaceId: id, kind: "document", id: docId });
    const stored = memory.context(c);
    const doc = stored.targets.document.get(docId);
    if (!doc) throw new Error("This document is unavailable.");
    return log.resolveDocument(typeof stored.root === "function" ? stored.root(doc) : stored.root, doc);
  }

  function allLinks() {
    const links = [], unavailable = [];
    for (const info of work.list().filter(info => !info.archived)) {
      try {
        const result = browse(info.id);
        for (const link of result.links) {
          const cross = [link.from, link.to].some(ref => (ref.workspaceId || (ref.kind === "workspace" && ref.id)) &&
            (ref.workspaceId || ref.id) !== info.id);
          if (!cross) continue;
          const safe = (ref, target) => ref.workspaceId || ref.kind === "workspace" ? target : { title: "Workspace item", private: true };
          links.push({ ...link, fromTarget: safe(link.from, link.fromTarget), toTarget: safe(link.to, link.toTarget),
            ownerId: info.id, ownerTitle: info.title || info.code });
        }
      } catch { unavailable.push(info.title || info.code); }
    }
    return { links: links.slice(0, 250), unavailable };
  }

  function planList(id) {
    return work.overview().filter(group => !id || group.info.id === id)
      .flatMap(({ info, plans }) => plans.map(item => ({ ...item, info: { id: info.id, title: info.title || info.code } })));
  }

  return { overview, browse, search, planList, allLinks, approvedSource, changeMemory, linkFile, document, list: work.list,
    meeting: (provider, input) => meetingUrl(provider, input), archiveWorkspace: work.archiveWorkspace, saveWorkspace: work.saveWorkspace,
    savePlan: work.savePlan, controlPlan: work.controlPlan, plans: work.plans, due: work.due, markReminded: work.markReminded };
}

module.exports = { createAcademicWork };
