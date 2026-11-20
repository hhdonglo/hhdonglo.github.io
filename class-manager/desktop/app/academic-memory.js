"use strict";

(() => {
  if (!window.cmApp) return;
  const $ = id => document.getElementById(id);
  const api = window.cmApp;
  let state, editId = "", busy = false;
  const lines = value => value.split(/\r?\n/);
  const tags = value => value.split(",");
  const showError = error => { $("status").textContent = error.message; };

  function button(label, action) {
    const el = document.createElement("button");
    el.type = "button";
    el.textContent = label;
    el.addEventListener("click", action);
    return el;
  }

  function list(id, entries, render, empty) {
    const node = $(id);
    node.replaceChildren();
    if (!entries.length) {
      const li = document.createElement("li");
      li.textContent = empty;
      node.append(li);
      return;
    }
    for (const entry of entries) {
      const li = document.createElement("li");
      render(li, entry);
      node.append(li);
    }
  }

  async function readInCM(id) {
    try {
      const result = await api.memoryReadDocument(id);
      if (!result.ok) throw new Error(result.why);
      const doc = result.document;
      if (doc.kind === "text") {
        $("memory-reader-title").textContent = doc.title;
        $("memory-reader-text").textContent = doc.text + (doc.truncated ? "\n\nPreview ends at 512 KiB." : "");
        $("memory-reader").showModal();
      }
    } catch (error) { showError(error); }
  }

  function documents(selected = new Set()) {
    $("attachments").replaceChildren();
    for (const doc of state.documents) {
      const row = document.createElement("div");
      const label = document.createElement("label");
      const input = document.createElement("input");
      input.type = "checkbox";
      input.value = doc.id;
      input.checked = selected.has(doc.id);
      label.append(input, " " + doc.title + (doc.missing ? " (unavailable)" : ""));
      row.append(label);
      if (!doc.missing) {
        if (/\.(pdf|txt|csv|md|log)$/i.test(doc.title) && api.memoryReadDocument) row.append(" ", button("Read in CM", () => readInCM(doc.id)));
        row.append(" ", button("Open file", () => act(() => api.memoryOpenDocument(doc.id))));
      }
      $("attachments").append(row);
    }
  }

  function selectTarget(id, refs) {
    const select = $(id);
    const previous = select.value;
    select.replaceChildren();
    for (const ref of refs) {
      const option = document.createElement("option");
      option.value = JSON.stringify({ kind: ref.kind, id: ref.id });
      option.textContent = ref.title + " (" + ref.kind + ")";
      select.append(option);
    }
    if ([...select.options].some(option => option.value === previous)) select.value = previous;
  }

  function edit(note) {
    editId = note?.id || "";
    $("title").value = note?.title || "";
    $("notes").value = note?.notes || "";
    $("decisions").value = (note?.decisions || []).join("\n");
    $("actions").value = (note?.actionItems || []).join("\n");
    $("tags").value = (note?.tags || []).join(", ");
    $("searchable").checked = !!note?.searchable;
    documents(new Set(note?.attachments));
    $("title").focus();
  }

  function render(data) {
    const selected = new Set(Array.from($("attachments").querySelectorAll(":checked"), el => el.value));
    if (data.attached) selected.add(data.attached);
    state = data;
    documents(selected);
    list("discussions", data.discussions, (li, note) => {
      li.textContent = note.title + (note.archived ? " (archived)" : "");
      li.append(button("Edit", () => edit(note)), button(note.archived ? "Restore" : "Archive", () => update({
        operation: "archiveDiscussion", id: note.id, archived: !note.archived
      })));
    }, "No discussions");
    const label = (target, ref) => target ? target.title + (target.archived ? " (archived)" : "") : "Unavailable " + ref.kind;
    list("links", data.links, (li, link) => {
      li.textContent = label(link.fromTarget, link.from) + " · " + link.relation + " · " + label(link.toTarget, link.to);
      li.append(button("Remove link", () => update({ operation: "unlink", id: link.id })));
    }, "No links");
    list("target-tag-list", data.tags, (li, item) => {
      li.textContent = label(item.resolved, item.target) + " · " + item.tags.join(", ");
      li.append(button("Remove tags", () => update({ operation: "clearTags", target: item.target })));
    }, "No target tags");
    for (const id of ["from", "to"]) selectTarget(id, data.targets);
    selectTarget("target", data.targets.filter(ref => ref.kind !== "workspace" || ref.id === data.workspaceId));
    const events = data.events.slice().sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
    list("events", events.slice(0, 100), (li, event) => {
      li.textContent = event.title + (event.date ? " · " + new Date(event.date).toLocaleString() : "");
    }, "No events from enabled modules");
    $("record-count").textContent = data.records.length + " source records" + (events.length > 100 ? " · showing the latest 100 events" : "");
  }

  async function act(fn) {
    if (busy) return;
    busy = true;
    $("status").textContent = "";
    try {
      const result = await fn();
      if (result && !result.ok) throw new Error(result.why || "The request failed.");
      if (result?.workspaceId) render(result);
      return result;
    } catch (error) { showError(error); }
    finally { busy = false; }
  }

  const update = input => act(() => api.memoryChange(input));
  function submit(id, handler) {
    $(id).addEventListener("submit", event => { event.preventDefault(); if (state) handler(); });
  }
  submit("discussion", async () => {
    const result = await update({
      operation: "discussion", id: editId, title: $("title").value, notes: $("notes").value,
      decisions: lines($("decisions").value), actionItems: lines($("actions").value), tags: tags($("tags").value),
      searchable: $("searchable").checked,
      attachments: Array.from($("attachments").querySelectorAll(":checked"), el => el.value)
    });
    if (result) { $("status").textContent = "Discussion saved."; edit(null); }
  });
  submit("link", () => update({ operation: "link", from: JSON.parse($("from").value), to: JSON.parse($("to").value), relation: $("relation").value }));
  function showTags() {
    const target = JSON.parse($("target").value);
    const item = state.tags.find(entry => entry.target.kind === target.kind && entry.target.id === target.id);
    $("target-tags").value = item ? item.tags.join(", ") : "";
  }
  $("target").addEventListener("change", showTags);
  submit("tag-form", () => update({ operation: "tags", target: JSON.parse($("target").value), tags: tags($("target-tags").value) }));
  async function showSource(ref) {
    const result = await act(() => api.memorySource(ref));
    if (!result) return;
    const item = result.item;
    if (item.kind === "discussion") { edit(item.discussion); return; }
    if (item.kind === "document") { await act(() => api.memoryOpenDocument(item.id)); return; }
    if (item.kind === "workspace") {
      $("search-source").textContent = [item.code, item.title, item.term].filter(Boolean).join(" · ");
      return;
    }
    const key = Object.entries(item.source.key).map(([name, value]) => name + " " + value).join(", ");
    $("search-source").textContent = [item.title, item.date && new Date(item.date).toLocaleString(), item.source.table, key].filter(Boolean).join(" · ");
  }

  submit("search", async () => {
    $("search-source").textContent = "";
    const data = await act(() => api.memorySearch($("query").value));
    if (!data) return;
    list("results", data.results, (li, item) => {
      li.textContent = item.title + " (" + item.kind + ")";
      li.append(button(item.kind === "document" ? "Open file" : "View source", () => showSource(item)));
    }, "No matches");
  });
  $("refresh").addEventListener("click", async () => {
    if (await act(() => api.memoryRefresh())) {
      $("results").replaceChildren();
      $("search-source").textContent = "";
      $("status").textContent = "Index refreshed.";
    }
  });
  $("attach").addEventListener("click", () => act(() => api.memoryAttach()));
  $("new").addEventListener("click", () => { if (state) edit(null); });
  $("workspace").textContent = [window.CM.courseCode, window.CM.courseTitle].filter(Boolean).join(" · ");
  act(() => api.memory());
})();
