"use strict";

const { randomUUID } = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const key = "academic-memory";
const empty = () => ({ version: 1, discussions: [], documents: [], links: [], tags: [] });
const text = (value, length) => String(value ?? "").trim().slice(0, length);
const entries = (values, length) => (Array.isArray(values) ? values : []).slice(0, 50).map(value => text(value, length)).filter(Boolean);
const tagsOf = values => [...new Set((Array.isArray(values) ? values : []).slice(0, 50).map(value =>
  String(value ?? "").normalize("NFKC").toLowerCase().trim().replace(/\s+/g, " ").slice(0, 60).trim()
).filter(Boolean))];
const relationTypes = new Set(["related", "supports", "follows"]);

function read(backend) {
  const raw = backend.secret(key);
  if (!raw) return empty();
  const log = JSON.parse(raw);
  if (log.version !== 1 || ["discussions", "documents", "links", "tags"].some(name => !Array.isArray(log[name]))) {
    throw new Error("Unsupported academic memory format.");
  }
  return log;
}

function publish(backend, log) {
  const before = backend.secret(key) || "";
  backend.setSecret(key, JSON.stringify(log));
  try { backend.flush(); }
  catch (error) {
    backend.setSecret(key, before);
    throw error;
  }
}

function fileIn(root, file) {
  const realRoot = fs.realpathSync(root);
  const real = fs.realpathSync(file);
  const relative = path.relative(realRoot, real);
  if (!relative || relative === ".." || relative.startsWith(".." + path.sep) || path.isAbsolute(relative) || !fs.statSync(real).isFile()) {
    throw new Error("Choose a file inside this course's materials folder.");
  }
  return { relative, real, root: realRoot };
}

function addDocument(root, file, log) {
  const { relative, root: sourceRoot } = fileIn(root, file);
  const previous = log.documents.find(doc => doc.path === relative && doc.sourceRoot === sourceRoot);
  if (previous) return previous;
  const doc = { id: randomUUID(), path: relative, sourceRoot, title: path.basename(relative) };
  log.documents.push(doc);
  return doc;
}

function resolveDocument(root, document) {
  const file = fileIn(root, path.resolve(root, document.path));
  if (file.root !== document.sourceRoot) throw new Error("The course materials folder has changed. Link the file again.");
  return file.real;
}

function saveDiscussion(log, input) {
  const existing = input.id ? log.discussions.find(item => item.id === input.id) : null;
  if (input.id && !existing) throw new Error("This discussion is no longer available.");
  const title = text(input.title, 160);
  if (!title) throw new Error("Enter a discussion title.");
  const date = new Date().toISOString();
  const item = {
    id: existing?.id || randomUUID(), kind: "discussion", date: existing?.date || date, updated: date,
    title, notes: text(input.notes, 12000), decisions: entries(input.decisions, 1000), actionItems: entries(input.actionItems, 1000),
    attachments: [...new Set(entries(input.attachments, 60))], tags: tagsOf(input.tags), searchable: input.searchable === true, archived: !!existing?.archived
  };
  if (item.attachments.some(id => !log.documents.some(doc => doc.id === id))) throw new Error("An attachment is outside this course or no longer exists.");
  if (existing) Object.assign(existing, item);
  else log.discussions.push(item);
  return item;
}

function targetOf(ref, context, stored = false) {
  if (!ref || typeof ref !== "object" || typeof ref.id !== "string" || !ref.id) return null;
  const { workspaceId, targets, workspace, root, externalTarget } = context;
  if (ref.kind === "workspace") {
    const course = workspace(ref.id);
    if (!course || (ref.created && ref.created !== course.created)) return null;
    // Unqualified references from older backups cannot prove the course is the original target.
    if (stored && !ref.created) return null;
    return { title: course.title || course.code || course.id, archived: !!course.archived };
  }
  if (ref.workspaceId && ref.workspaceId !== workspaceId) {
    const info = workspace(ref.workspaceId);
    if (!externalTarget || !info || (stored && ref.created !== info.created) || (ref.created && ref.created !== info.created)) return null;
    if (info.archived) return { title: "Archived workspace item", archived: true };
    return externalTarget(ref);
  }
  const target = Object.hasOwn(targets, ref.kind) ? targets[ref.kind].get(ref.id) : null;
  if (!target) return null;
  if (ref.kind === "document") {
    try { resolveDocument(typeof root === "function" ? root(target) : root, target); } catch { return null; }
  }
  return { title: target.title || target.kind, archived: !!target.archived };
}

function localRef(ref, context) {
  const target = targetOf(ref, context);
  if (!target || target.archived) throw new Error("Choose an available target from this course or an active workspace.");
  if (ref.kind === "workspace") {
    const created = context.workspace(ref.id).created;
    if (!created) throw new Error("This workspace has no stable creation marker.");
    return { kind: ref.kind, id: ref.id, created };
  }
  if (ref.workspaceId && ref.workspaceId !== context.workspaceId) {
    return { kind: ref.kind, id: ref.id, workspaceId: ref.workspaceId, created: context.workspace(ref.workspaceId).created };
  }
  return { kind: ref.kind, id: ref.id };
}

const sameRef = (a, b) => !!b && a.kind === b.kind && a.id === b.id && a.created === b.created && a.workspaceId === b.workspaceId;

function saveLink(context, input) {
  if (!relationTypes.has(input.relation)) throw new Error("Choose a supported link type.");
  const from = localRef(input.from, context), to = localRef(input.to, context);
  if (sameRef(from, to)) throw new Error("Choose two different targets.");
  const link = { id: randomUUID(), from, to, relation: input.relation };
  const duplicate = context.log.links.find(item => item.relation === link.relation &&
    sameRef(item.from, from) && sameRef(item.to, to));
  if (duplicate) return duplicate;
  context.log.links.push(link);
  return link;
}

function setTags(context, target, values) {
  const ref = localRef(target, context);
  if (ref.workspaceId || ref.kind === "workspace" && ref.id !== context.workspaceId) throw new Error("Tag a workspace from its own log.");
  const tags = tagsOf(values);
  context.log.tags = context.log.tags.filter(item => item.target.kind !== ref.kind || item.target.id !== ref.id);
  if (tags.length) context.log.tags.push({ target: ref, tags });
}

function clearTags(context, ref) {
  context.log.tags = context.log.tags.filter(item => !sameRef(item.target, ref));
}

module.exports = { key, read, publish, saveDiscussion, saveLink, targetOf, setTags, clearTags, addDocument, fileIn, resolveDocument };
