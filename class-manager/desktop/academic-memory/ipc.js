"use strict";

const { project } = require("./records");
const log = require("./log");

function createMemory({ index, workspace, workspaces, dirOf, externalTarget }) {
  function context(course) {
    const stored = log.read(course.backend);
    const projection = project(course.id, course.backend.rawRows, course.backend.enabledModules());
    const targets = Object.fromEntries(Object.entries({
      record: projection.records, event: projection.events,
      document: stored.documents, discussion: stored.discussions
    }).map(([kind, items]) => [kind, new Map(items.map(item => [item.id, item]))]));
    return { workspaceId: course.id, log: stored, workspace, root: dirOf(course), projection, targets, externalTarget };
  }

  function metadata(info) {
    const title = info.title || info.code || info.id;
    return { id: info.id, workspaceId: info.id, kind: "workspace", title, date: null,
      content: [info.code, title, info.term].filter(Boolean).join(" ") };
  }

  function reconcile() {
    index.reconcile(workspaces().filter(info => !info.archived).map(metadata));
  }

  const approved = stored => stored.discussions.filter(note => !note.archived && note.searchable);

  function entries(course) {
    const info = workspace(course.id);
    if (!info || info.archived) return [];
    const c = context(course), { projection, log: stored } = c;
    const entries = [metadata(info)];
    const searchable = (kind, item, content) => entries.push({
      id: item.id, kind, title: item.title, date: item.date || null, workspaceId: course.id, content
    });
    for (const event of projection.events) {
      const display = event.kind === "quizRound" ? "Live quiz" : "Attendance " + event.title;
      searchable("event", { ...event, title: display }, display);
    }
    const documents = new Set();
    for (const note of approved(stored)) {
      searchable("discussion", note, [note.title, note.notes, ...note.decisions, ...note.actionItems, ...note.tags].join(" "));
      for (const id of note.attachments) documents.add(id);
    }
    for (const doc of stored.documents) {
      if (documents.has(doc.id) && log.targetOf({ kind: "document", id: doc.id }, c)) searchable("document", doc, doc.title);
    }
    return entries;
  }

  function refresh(course, force = false) {
    const batch = entries(course);
    if (batch.length) index.replace(course.id, batch, force);
    else index.remove(course.id);
  }
  function searchAcross(courses, query) {
    const batches = Object.fromEntries(courses.map(course => [course.id, entries(course)]));
    index.replaceMany(batches);
    return index.searchAcross(Object.keys(batches), query);
  }

  function describe(course) {
    const c = context(course), stored = c.log;
    const target = ref => log.targetOf(ref, c);
    const refs = [
      ...workspaces().filter(item => !item.archived).map(item => ({ kind: "workspace", id: item.id, title: item.title || item.code || item.id })),
      ...c.projection.events.map(item => ({ kind: "event", id: item.id, title: item.title })),
      ...c.projection.records.map(item => ({ kind: "record", id: item.id, title: item.kind + " · " + item.studentId + (item.date ? " · " + item.date : "") })),
      ...stored.documents.map(item => ({ kind: "document", id: item.id, title: item.title })),
      ...stored.discussions.map(item => ({ kind: "discussion", id: item.id, title: item.title }))
    ];
    return {
      ok: true, workspaceId: course.id, ...c.projection,
      discussions: stored.discussions,
      documents: stored.documents.map(({ id, title }) => ({ id, title, missing: !target({ kind: "document", id }) })),
      links: stored.links.map(item => ({ ...item, fromTarget: log.targetOf(item.from, c, true), toTarget: log.targetOf(item.to, c, true) })),
      tags: stored.tags.map(item => ({ ...item, resolved: log.targetOf(item.target, c, true) })),
      targets: refs.filter(ref => { const item = target(ref); return item && !item.archived; })
    };
  }

  function source(course, ref) {
    const info = workspace(course.id);
    if (!info || info.archived || !ref || ref.workspaceId !== course.id) throw new Error("This result is outside the current course.");
    if (ref.kind === "workspace" && ref.id === course.id) {
      return { kind: "workspace", code: info.code, title: info.title || info.code, term: info.term };
    }
    const c = context(course), notes = approved(c.log);
    if (ref.kind === "event") {
      const event = c.targets.event.get(ref.id);
      if (event) return { kind: "event", title: event.title, date: event.date, source: event.source };
    }
    if (ref.kind === "discussion") {
      const discussion = notes.find(note => note.id === ref.id);
      if (discussion) return { kind: "discussion", discussion };
    }
    if (ref.kind === "document" && notes.some(note => note.attachments.includes(ref.id))) {
      const document = c.targets.document.get(ref.id);
      if (document && log.targetOf(ref, c)) return { kind: "document", id: document.id, title: document.title };
    }
    throw new Error("This result is no longer available. Refresh the index and search again.");
  }

  return { context, reconcile, refresh, describe, source, entries, searchAcross, remove: index.remove, search: (course, query) => {
    refresh(course);
    return index.search(course.id, query);
  } };
}

function register({ on, memory, dialog, winOf, shell, readDocument, isCurrent }) {
  const safe = fn => async (...args) => {
    try { return await fn(...args); } catch (error) { return { ok: false, why: error.message }; }
  };
  on("cm:memory", safe(course => memory.describe(course)));
  on("cm:memoryRefresh", safe(course => { memory.refresh(course, true); return memory.describe(course); }));
  on("cm:memorySearch", safe((course, e, query) => ({ ok: true, results: memory.search(course, query) })));
  on("cm:memorySource", safe((course, e, ref) => ({ ok: true, item: memory.source(course, ref) })));
  on("cm:memoryChange", safe((course, e, input = {}) => {
    const c = memory.context(course);
    switch (input.operation) {
      case "discussion": log.saveDiscussion(c.log, input); break;
      case "link": log.saveLink(c, input); break;
      case "tags": log.setTags(c, input.target, input.tags); break;
      case "clearTags": log.clearTags(c, input.target); break;
      case "archiveDiscussion": {
        const note = c.log.discussions.find(item => item.id === input.id);
        if (!note) throw new Error("This discussion is no longer available.");
        note.archived = input.archived === true;
        break;
      }
      case "unlink": c.log.links = c.log.links.filter(item => item.id !== input.id); break;
      default: throw new Error("Choose a supported memory operation.");
    }
    log.publish(course.backend, c.log);
    return memory.describe(course);
  }));
  on("cm:memoryAttach", safe(async (course, event) => {
    const selection = await dialog.showOpenDialog(winOf(event), { title: "Link a file from this course", properties: ["openFile"] });
    if (selection.canceled) return null;
    if (!isCurrent(course)) throw new Error("This course changed while the file picker was open.");
    const c = memory.context(course);
    const document = log.addDocument(c.root, selection.filePaths[0], c.log);
    log.publish(course.backend, c.log);
    return { ...memory.describe(course), attached: document.id };
  }));
  function documentPath(course, id) {
    const c = memory.context(course);
    const doc = c.log.documents.find(item => item.id === id);
    if (!doc) throw new Error("This document is no longer linked.");
    return log.resolveDocument(c.root, doc);
  }
  if (readDocument) on("cm:memoryReadDocument", safe(async (course, event, id) => ({
    ok: true, document: await readDocument(documentPath(course, id), event)
  })));
  on("cm:memoryOpenDocument", safe(async (course, e, id) => {
    const real = documentPath(course, id);
    const error = await shell.openPath(real);
    if (error) throw new Error(error);
    return { ok: true };
  }));
}

module.exports = { createMemory, register };
