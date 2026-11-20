"use strict";

(() => {
  const api = window.cmApp;
  const $ = id => document.getElementById(id);
  const node = (tag, value = "", className = "") => {
    const el = document.createElement(tag);
    el.textContent = value;
    if (className) el.className = className;
    return el;
  };
  function button(label, fn, className) {
    const el = node("button", label, className);
    el.type = "button";
    el.onclick = () => run(fn);
    return el;
  }
  function link(label, href) { const a = node("a", label); a.href = href; return a; }
  function section(title, content) { const el = node("section"); el.append(node("h3", title), content); return el; }
  function row(...items) { const el = node("div", "", "row"); el.append(...items); return el; }
  const meta = value => node("p", value, "meta");
  const date = value => value ? new Date(value).toLocaleString() : "";
  const title = value => String(value || "").replace(/^./, c => c.toUpperCase());
  const route = (id, page) => "/c/" + encodeURIComponent(id) + "/app/" + page;
  const state = { view: "workspaces", workspace: "", ticket: 0, model: null, selected: null };

  async function call(action, input) {
    if (!api?.academic) throw new Error("Open Academic Work in the CM desktop app.");
    const result = await api.academic(action, input);
    if (!result?.ok) throw new Error(result?.why || "Class Manager could not complete this action.");
    return result.value;
  }
  async function run(fn) {
    $("status").textContent = "";
    try { await fn(); }
    catch (error) { $("status").textContent = error.message; }
  }
  function items(records, render, empty) {
    if (!records.length) return meta(empty);
    const list = node("ul", "", "list");
    for (const item of records) {
      const li = node("li", "", "list-row");
      render(li, item);
      list.append(li);
    }
    return list;
  }
  function reader(name, content) {
    $("reader-title").textContent = name;
    $("reader-content").replaceChildren(content);
    if (!$("reader").open) $("reader").showModal();
  }
  function showText(name, value) { reader(name, node("pre", value)); }
  function select(entries, current) {
    const el = node("select");
    for (const [value, text] of entries) { const opt = node("option", text); opt.value = value; el.append(opt); }
    el.value = current ?? entries[0]?.[0] ?? "";
    return el;
  }
  function label(name, input) { const el = node("label", name); el.append(input); return el; }
  function valueField(name, value, type) {
    const el = node(type === "textarea" ? "textarea" : "input");
    if (type !== "textarea") el.type = type || "text";
    if (type === "checkbox") el.checked = !!value;
    else el.value = value ?? "";
    el.name = name;
    if (type === "textarea") el.rows = 4;
    return el;
  }
  function editor(name, fields, submit, caption = "Save") {
    $("edit-title").textContent = name;
    const form = $("edit-form"), notice = node("p", "", "meta"), save = node("button", caption, "primary");
    form.replaceChildren(...fields, notice, save);
    form.onsubmit = async event => {
      event.preventDefault();
      if (save.disabled) return;
      save.disabled = true;
      notice.textContent = "";
      try { await submit(Object.fromEntries(new FormData(form)), form); $("editor").close(); }
      catch (error) { notice.textContent = error.message; }
      finally { save.disabled = false; }
    };
    if (!$("editor").open) $("editor").showModal();
  }
  async function selectWorkspace(id, view = state.view) {
    state.workspace = id;
    await show(view);
  }
  async function refresh() {
    state.model = await call("overview");
    const active = state.model.cards.map(({ info }) => [info.id, info.title || info.code]);
    if (!active.some(([id]) => id === state.workspace)) state.workspace = "";
    $("scope").replaceChildren(...select([["", "All workspaces"], ...active], state.workspace).children);
    $("scope").value = state.workspace;
    if (state.model.unavailable.length) $("status").textContent = "Some sources need attention: " + state.model.unavailable.join(", ");
  }
  async function show(view = state.view, reload = false) {
    const ticket = ++state.ticket;
    state.view = view;
    if (reload || !state.model) await refresh();
    if (ticket !== state.ticket) return;
    document.querySelectorAll(".view").forEach(el => { el.hidden = el.id !== view; });
    document.querySelectorAll("[data-view]").forEach(el => el.setAttribute("aria-current", String(el.dataset.view === view)));
    if (view === "workspaces") { renderCards(); return; }
    if (view === "mail") { await renderMail(ticket); return; }
    if (view === "timeline" || view === "activity") { renderFeed(view); return; }
    if (view === "plans") { await renderPlans(ticket); return; }
    const result = await (state.workspace ? call("browse", { workspaceId: state.workspace }) : call("links"));
    if (ticket !== state.ticket) return;
    state.selected = result;
    renderMemory();
  }
  function renderCards() {
    const cards = state.model.cards.filter(({ info }) => !state.workspace || info.id === state.workspace);
    $("workspace-cards").replaceChildren(...cards.map(({ info, totals, health }) => {
      const el = node("article", "", "card");
      const dl = node("dl", "", "metrics");
      for (const [label, key] of [["Open plans", "open"], ["Overdue", "overdue"], ["Pending reminders", "reminders"], ["Goals completed", "completedGoals"]]) {
        const div = node("div");
        div.append(node("dt", label), node("dd", key === "completedGoals" ? totals[key] + " / " + totals.goals : String(totals[key])));
        dl.append(div);
      }
      el.append(meta(title(info.type)), node("h3", info.title || info.code), meta(info.description || info.term || ""), dl);
      if (health?.length) {
        const details = node("details"); details.append(node("summary", "Course measures"), items(health, (li, m) => {
          li.append(node("strong", m.label + " · " + m.value + (m.percent ? "%" : "")),
            meta("n = " + m.sample + " " + m.unit + " · " + m.evidence), meta(m.window + " · " + m.denominator));
        }, ""));
        el.append(details);
      }
      const controls = row(button("Plans", () => selectFromCard(info, "plans")), button("Memory", () => selectFromCard(info, "memory")));
      if (info.type === "course") controls.append(link("Open course", route(info.id, "home.html")));
      else controls.append(button("Edit", () => workspaceEditor(info)), button("Archive", async () => {
        await call("archive", { workspaceId: info.id, archived: true }); await show("workspaces", true);
      }));
      el.append(controls);
      return el;
    }));
    const archived = state.model.archived;
    $("archives").hidden = !archived.length;
    $("archived-list").replaceChildren(...archived.map(info => {
      const li = node("li", info.title + " ");
      li.append(button("Restore", async () => { await call("archive", { workspaceId: info.id, archived: false }); await show("workspaces", true); }));
      return li;
    }));
  }
  async function selectFromCard(info, view) { $("scope").value = info.id; await selectWorkspace(info.id, view); }
  function workspaceEditor(info = {}) {
    const type = select(state.model.workspaceTypes.map(t => [t, title(t)]), info.type || "personal");
    type.name = "type";
    type.disabled = !!info.id;
    editor(info.id ? "Edit workspace" : "New workspace", [
      label("Type", type), label("Title", valueField("title", info.title)), label("Description", valueField("description", info.description, "textarea"))
    ], async input => {
      const next = await call("workspace", { ...input, id: info.id });
      state.workspace = next.id; await show("workspaces", true);
    });
  }
  async function renderPlans(ticket) {
    const plans = await call("plans", { workspaceId: state.workspace });
    if (ticket !== state.ticket) return;
    plans.sort((a, b) => Number(a.done) - Number(b.done) || (a.when || "Z").localeCompare(b.when || "Z"));
    $("plan-items").replaceChildren(items(plans, (li, item) => {
      const details = [title(item.kind), item.info.title || item.info.code, date(item.when), item.kind === "goal" ? item.progress + "%" : "", item.done ? "Complete" : "", item.remindAt ? "Reminder " + date(item.remindAt) : ""].filter(Boolean);
      li.append(node("strong", item.title), meta(details.join(" · ")));
      if (item.notes) li.append(node("p", item.notes));
      const w = item.info.id;
      const controls = row(button("Edit", () => planEditor(item)), button(item.done ? "Reopen" : "Complete", async () => {
        await call("complete", { workspaceId: w, id: item.id, done: !item.done }); await show("plans", true);
      }));
      if (["meeting", "event"].includes(item.kind)) controls.append(button("Export calendar event", () => call("exportEvent", { workspaceId: w, id: item.id })));
      if (item.provider) controls.append(button("Launch meeting", () => call("meeting", { provider: item.provider, link: item.link })));
      li.append(controls);
    }, "No goals or plans in this scope."));
  }
  function localDate(value) {
    if (!value) return "";
    const t = new Date(value);
    return new Date(+t - t.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  }
  function planEditor(item = {}) {
    const available = state.model.cards.map(({ info }) => [info.id, info.title || info.code]);
    const w = select(available, item.info?.id || state.workspace || undefined); w.name = "workspaceId"; w.disabled = !!item.id;
    const kind = select(state.model.planTypes.map(t => [t, title(t)]), item.kind); kind.name = "kind"; kind.disabled = !!item.id;
    const provider = select([["", "None"], ...state.model.providers.map(p => [p.id, p.label])], item.provider); provider.name = "provider";
    const fields = [label("Workspace", w), label("Type", kind), label("Title", valueField("title", item.title)),
      label("Notes", valueField("notes", item.notes, "textarea")), label("Scheduled time or deadline", valueField("when", localDate(item.when), "datetime-local")),
      label("End time", valueField("end", localDate(item.end), "datetime-local")), label("Reminder time", valueField("remindAt", localDate(item.remindAt), "datetime-local")),
      label("Progress (%)", valueField("progress", item.progress || 0, "number")), label("Meeting provider", provider),
      label("Meeting link", valueField("link", item.link, "url"))];
    function sync() {
      for (const [idx, show] of [[5, ["meeting", "event"].includes(kind.value)], [7, kind.value === "goal"], [8, kind.value === "meeting"], [9, kind.value === "meeting"]]) {
        fields[idx].hidden = !show; fields[idx].lastElementChild.disabled = !show;
      }
    }
    kind.onchange = sync; sync();
    editor(item.id ? "Edit plan" : "Add plan", fields, async input => {
      for (const key of ["when", "end", "remindAt"]) if (input[key]) input[key] = new Date(input[key]).toISOString();
      await call("plan", { ...input, id: item.id, done: item.done, workspaceId: item.info?.id || input.workspaceId, kind: item.kind || input.kind });
      await show("plans", true);
    });
  }
  function renderFeed(view) {
    const scoped = list => list.filter(item => !state.workspace || item.workspaceId === state.workspace);
    const draw = (list, empty) => items(scoped(list), (li, item) => {
      li.append(node("strong", item.title), meta([item.workspaceTitle, title(item.kind), date(item.date)].join(" · ")));
      if (item.source === "memory") li.append(button("View source", () => openResult(item)));
      if (item.source === "plan") li.append(button("Open plans", async () => { $("scope").value = item.workspaceId; await selectWorkspace(item.workspaceId, "plans"); }));
    }, empty);
    $(view + "-items").replaceChildren(...(view === "timeline" ? [
      section("Upcoming", draw(state.model.upcoming, "No upcoming plans in this scope.")),
      section("History", draw(state.model.timeline, "No historical events in this scope."))
    ] : [draw(state.model.activity, "No recent activity in this scope.")]));
  }
  function openMemory() {
    if (!state.workspace || !state.selected?.memory) throw new Error("Choose an editable workspace first.");
    return state.selected.memory;
  }
  async function updateMemory(input) {
    await call("memory", { ...input, workspaceId: state.workspace });
    await show("memory", true);
  }
  function noteEditor(note = {}) {
    const memory = openMemory(), selected = new Set(note.attachments || []);
    const attachments = node("fieldset"); attachments.append(node("legend", "Attachments"));
    for (const file of memory.documents) {
      const check = valueField("attachments", selected.has(file.id), "checkbox");
      check.value = file.id;
      attachments.append(label(file.title + (file.missing ? " (unavailable)" : ""), check));
    }
    editor(note.id ? "Edit note or discussion" : "New note or discussion", [
      label("Title", valueField("title", note.title)), label("Notes", valueField("notes", note.notes, "textarea")),
      label("Decisions, one per line", valueField("decisions", note.decisions?.join("\n"), "textarea")),
      label("Action items, one per line", valueField("actionItems", note.actionItems?.join("\n"), "textarea")),
      label("Tags, separated by commas", valueField("tags", note.tags?.join(", "))), attachments,
      label("Include in cross-workspace search", valueField("searchable", note.searchable, "checkbox"))
    ], (values, form) => updateMemory({ ...values, id: note.id, operation: "discussion",
      searchable: values.searchable === "on", decisions: values.decisions.split(/\r?\n/), actionItems: values.actionItems.split(/\r?\n/),
      tags: values.tags.split(","), attachments: new FormData(form).getAll("attachments") }));
  }
  function tagEditor(memory) {
    const refs = memory.targets.filter(ref => ref.kind !== "workspace" || ref.id === state.workspace);
    const target = select(refs.map(ref => [JSON.stringify({ kind: ref.kind, id: ref.id }), ref.title + " · " + ref.kind]));
    target.name = "target";
    const tags = valueField("tags", "");
    function sync() {
      tags.value = memory.tags.find(t => t.target.id === JSON.parse(target.value).id && t.target.kind === JSON.parse(target.value).kind)?.tags.join(", ") || "";
    }
    if (target.value) sync(); target.onchange = sync;
    editor("Tag a memory item", [label("Item", target), label("Tags, separated by commas", tags)],
      values => updateMemory({ operation: "tags", target: JSON.parse(values.target), tags: values.tags.split(",") }));
  }
  function linkEditor(memory) {
    const own = memory.targets.map(ref => [JSON.stringify({ kind: ref.kind, id: ref.id }), ref.title + " · " + ref.kind]);
    const from = select(own); from.name = "from";
    const to = select(own); to.name = "to";
    const relation = select([["related", "Related to"], ["supports", "Supports"], ["follows", "Follows"]]); relation.name = "relation";
    const query = valueField("linkQuery", ""), linkStatus = meta("");
    const scopedId = state.workspace;
    const find = button("Find cross-workspace targets", async () => {
      linkStatus.textContent = "Searching…";
      try {
        const { results } = await call("search", { query: query.value });
        const matches = results.filter(r => r.workspaceId !== scopedId && ["document", "discussion", "event"].includes(r.kind));
        const options = [...own, ...matches.map(r => [JSON.stringify({ kind: r.kind, id: r.id, workspaceId: r.workspaceId, created: r.created }), r.workspaceTitle + " · " + r.title])];
        to.replaceChildren(...select(options).children);
        if (matches.length) to.selectedIndex = own.length;
        linkStatus.textContent = matches.length + " cross-workspace targets found.";
      } catch (error) { linkStatus.textContent = error.message; }
    });
    editor("Create a memory link", [label("From", from), label("Relationship", relation), label("To", to),
      label("Search shared items in other workspaces", query), find, linkStatus],
      input => updateMemory({ operation: "link", from: JSON.parse(input.from), to: JSON.parse(input.to), relation: input.relation }), "Create link");
  }
  async function documentOpen(workspaceId, id, approvedOnly) {
    const doc = await call("document", { workspaceId, id, approvedOnly });
    if (doc.kind === "text") showText(doc.title, doc.text + (doc.truncated ? "\n\nPreview ends at 512 KiB." : ""));
  }
  function openLink(ref, resolved) {
    if (ref.kind === "workspace") return selectFromCard({ id: ref.id }, "memory");
    if (ref.workspaceId) return openResult({ ...ref, source: "memory" });
    if (ref.kind === "document") return documentOpen(state.workspace, ref.id, !state.selected?.memory);
    if (ref.kind === "discussion") {
      const note = state.selected?.memory?.discussions.find(n => n.id === ref.id && !n.archived);
      if (note) return noteEditor(note);
    }
    return openResult({ ...ref, workspaceId: state.workspace, title: resolved.title, source: "memory" });
  }
  function renderMemory() {
    const area = $("knowledge"), selected = state.selected;
    $("new-note").disabled = $("link-file").disabled = !selected?.memory;
    if (!selected?.info) {
      area.replaceChildren(meta("Choose a workspace to browse its notes and files."),
        section("Cross-workspace links", items(selected?.links || [], (li, item) => {
          li.append(node("strong", item.ownerTitle), meta([item.fromTarget?.title || "Unavailable item", item.relation, item.toTarget?.title || "Unavailable item"].join(" · ")),
            button("Browse links in workspace", () => selectFromCard({ id: item.ownerId }, "memory")));
        }, "No cross-workspace links yet.")));
      if (selected?.unavailable.length) area.append(meta("Unavailable sources: " + selected.unavailable.join(", ")));
      return;
    }
    const { info, memory } = selected;
    area.replaceChildren(node("h3", info.title || info.code));
    if (info.type === "course") area.append(link("Open this course’s memory and records", route(info.id, "academic-memory.html")));
    if (memory) {
      area.append(section("Knowledge and discussions", items(memory.discussions, (li, note) => {
        li.append(node("strong", note.title), meta([note.archived ? "Archived" : note.searchable ? "Searchable" : "Workspace only", ...note.tags].join(" · ")),
          row(button("Edit", () => noteEditor(note)), button(note.archived ? "Restore" : "Archive", () => updateMemory({
            operation: "archiveDiscussion", id: note.id, archived: !note.archived
          }))));
      }, "No notes or discussions yet.")));
      area.append(section("Documents", items(memory.documents, (li, doc) => {
        li.append(node("strong", doc.title), doc.missing ? meta("File unavailable") : button("Read in CM", () => documentOpen(info.id, doc.id, false)));
      }, "No documents linked.")));
      area.append(row(button("Create link", () => linkEditor(memory)), button("Edit tags", () => tagEditor(memory))));
      if (memory.tags.length) area.append(section("Tags", items(memory.tags, (li, item) => {
        li.append(node("strong", item.resolved?.title || "Unavailable item"), meta(item.tags.join(", ")));
      }, "")));
    }
    if (!memory) area.append(section("Shared course entries", items(selected.entries, (li, item) => {
      li.append(node("strong", item.title), meta(item.kind), button("View source", () => openResult({ ...item, source: "memory" })));
    }, "No approved entries.")));
    area.append(section("Links", items(selected.links, (li, item) => {
      const sides = [];
      for (const [ref, target] of [[item.from, item.fromTarget], [item.to, item.toTarget]]) {
        const name = !target ? "Unavailable " + ref.kind : target.title + (target.archived ? " (archived)" : "");
        sides.push(target && !target.archived && !target.private ? button(name, () => openLink(ref, target)) : node("span", name));
      }
      li.append(row(sides[0], node("span", item.relation), sides[1]));
      if (memory) li.append(button("Remove link", () => updateMemory({ operation: "unlink", id: item.id })));
    }, "No links in this workspace.")));
  }
  async function openResult(result) {
    if (result.source === "student") {
      location.href = route(result.workspaceId, "home.html") + "?academicStudent=" + encodeURIComponent(result.id);
      return;
    }
    if (result.source === "plan") { await selectFromCard({ id: result.workspaceId }, "plans"); return; }
    if (result.kind === "workspace") { await selectFromCard({ id: result.workspaceId }, "memory"); return; }
    const item = await call("source", result);
    if (item.kind === "document") { await documentOpen(item.workspaceId, item.id, true); return; }
    if (item.kind === "discussion") {
      const note = item.discussion, body = node("div");
      body.append(meta(item.workspaceTitle), node("pre", [note.notes, ...note.decisions.map(s => "Decision · " + s), ...note.actionItems.map(s => "Action · " + s)].filter(Boolean).join("\n")));
      for (const id of note.attachments) body.append(button("Read attachment", () => documentOpen(item.workspaceId, id, true)));
      reader(note.title, body);
    } else showText(item.title, [item.workspaceTitle, date(item.date), item.source?.table].filter(Boolean).join("\n"));
  }
  async function command(id) {
    if (state.model.providers.some(p => p.id === id)) { await call("meeting", { provider: id }); return; }
    if (id === "create-workspace") { workspaceEditor(); return; }
    if (id === "create-note") { await show("memory"); noteEditor(); return; }
    if (id.startsWith("create-")) { planEditor({ kind: id.slice(7) }); return; }
    await show(id);
  }
  function searchDialog() {
    if (!state.model) throw new Error("Academic Work is still loading.");
    if (!$("search-dialog").open) $("search-dialog").showModal();
    $("search-results").replaceChildren(...state.model.commands.map(c => button(c.title, async () => { $("search-dialog").close(); await command(c.id); })));
  }
  $("search-form").onsubmit = event => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    const query = values.query.trim();
    const search = $("search-results");
    search.replaceChildren(meta("Searching…"));
    const ticket = search.dataset.ticket = String((Number(search.dataset.ticket) || 0) + 1);
    void call("search", { query, workspaceId: values.scoped ? state.workspace || undefined : undefined }).then(result => {
      if (search.dataset.ticket !== ticket) return;
      const commands = result.commands.map(c => button(c.title, async () => { $("search-dialog").close(); await command(c.id); }));
      search.replaceChildren(row(...commands), items(result.results, (li, item) => {
        li.append(button(item.title, async () => { $("search-dialog").close(); await openResult(item); }),
          meta([item.workspaceTitle, title(item.kind), date(item.date)].filter(Boolean).join(" · ")));
        if (item.kind === "workspace" && state.model.cards.some(({ info }) => info.id === item.workspaceId && info.type === "course")) {
          li.append(link("Open course", route(item.workspaceId, "home.html")));
        }
      }, commands.length ? "" : "No matches."));
      if (result.unreadable.length) search.append(meta("Unavailable sources: " + result.unreadable.join(", ")));
    }).catch(error => { if (search.dataset.ticket === ticket) search.replaceChildren(meta(error.message)); });
  };
  function mailEditor(provider) {
    const instructions = node("p", provider.id === "gmail" ?
      "Use a Google Desktop app OAuth client with the Gmail API enabled." :
      "Use a Microsoft public-client app registration with delegated Mail.Read and the redirect http://localhost/oauth/callback.");
    const fields = [instructions, label("Application client ID", valueField("clientId", ""))];
    if (provider.id === "gmail") fields.push(label("Desktop client secret", valueField("clientSecret", "", "password")));
    editor("Connect " + provider.label, fields, async values => {
      await call("mailConnect", { ...values, provider: provider.id });
      await show("mail");
    }, "Authorize in browser");
  }
  async function renderMail(ticket) {
    const accounts = await call("mailStatus");
    if (ticket !== state.ticket) return;
    $("mail-items").replaceChildren();
    $("mail-accounts").replaceChildren(...accounts.map(account => {
      const card = node("article", "", "card");
      card.append(node("h3", account.label), meta(account.connected ? "Connected · read only" : "Disconnected"));
      if (account.connected) card.append(row(button("Read inbox", () => inbox(account)), button("Disconnect", async () => {
        await call("mailDisconnect", { provider: account.id }); await show("mail");
      })));
      else card.append(button("Connect", () => mailEditor(account)));
      return card;
    }));
  }
  async function inbox(account) {
    const box = $("mail-items");
    box.replaceChildren(meta("Loading " + account.label + "…"));
    let messages;
    try { messages = await call("mailList", { provider: account.id }); }
    catch (error) { box.replaceChildren(meta(error.message)); return; }
    if (state.view !== "mail") return;
    box.replaceChildren(section(account.label + " inbox", items(messages, (li, message) => {
      li.append(button(message.subject || "No subject", async () => {
        const full = await call("mailMessage", { provider: account.id, id: message.id });
        showText(full.subject || "No subject", [full.from, date(full.date), "", full.text].filter(s => s !== undefined).join("\n"));
      }), meta([message.from, date(message.date)].filter(Boolean).join(" · ")), node("p", message.preview || ""));
    }, "The inbox is empty.")));
  }

  const params = new URLSearchParams(location.search);
  state.workspace = params.get("workspace") || "";
  $("scope").onchange = event => run(() => selectWorkspace(event.target.value));
  $("refresh").onclick = () => run(() => show(state.view, true));
  $("views").onclick = event => { const view = event.target.dataset.view; if (view) void run(() => show(view)); };
  $("new-workspace").onclick = () => run(() => workspaceEditor());
  $("new-plan").onclick = () => run(() => planEditor());
  $("new-note").onclick = () => run(() => noteEditor());
  $("link-file").onclick = () => run(async () => { await call("linkFile", { workspaceId: state.workspace }); await show("memory", true); });
  $("open-search").onclick = () => run(searchDialog);
  document.querySelectorAll("[data-close]").forEach(el => { el.onclick = () => $(el.dataset.close).close(); });
  document.addEventListener("keydown", event => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k" && state.model) {
      event.preventDefault(); searchDialog();
    }
  });
  void run(async () => { await show(params.get("workspace") ? "plans" : "workspaces"); if (params.has("command")) searchDialog(); });
})();
