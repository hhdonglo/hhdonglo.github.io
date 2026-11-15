// CM's screens call these (cm:llm*): preview what an assistant would see, save the snapshot, look up a pseudonym.
// Nothing is saved until the lecturer presses Save, and nothing leaves the computer: CM writes files to a folder the
// lecturer chooses. What the lecturer then gives to an assistant is their decision.
"use strict";
const fs = require("fs");
const path = require("path");
const { buildSnapshot, preview } = require("./snapshot");
const { toMarkdown } = require("./markdown");
const { createPseudonyms } = require("./pseudonym");
const { saltOf } = require("./salt");
const { ALLOWED_TABS } = require("./policy");

const choices = (o) => ({ includeNames: !!(o && o.includeNames), realIds: !!(o && o.realIds) });

function snapshotOf(c, dir, o) {
  const s = c.settings || {};
  return buildSnapshot(Object.assign({ course: { code: s.courseCode, title: s.courseTitle, term: s.semester }, salt: saltOf(dir), readTab: (n) => c.backend.tab(n) }, choices(o)));
}

// What to paste into the assistant's settings so it can read the snapshot folder.
function mcpConfig(folder) {
  return { mcpServers: { "class-manager": { command: "node", args: [path.join(folder, "cm-mcp-server.js"), folder] } } };
}

function register(opts) {
  const { on, dialog, winOf, shell, dirOf } = opts;
  on("cm:llmPreview", (c, e, o) => { try { return Object.assign({ ok: true, tabs: ALLOWED_TABS }, preview(snapshotOf(c, dirOf(c), o))); } catch (err) { return { ok: false, why: err.message }; } });
  on("cm:llmSave", async (c, e, o) => {
    const r = await dialog.showOpenDialog(winOf(e), { title: "Choose a folder for the assistant files", properties: ["openDirectory", "createDirectory"] });
    if (r.canceled || !r.filePaths[0]) return null;
    try {
      const snap = snapshotOf(c, dirOf(c), o);
      const label = String((c.settings && c.settings.courseCode) || c.id).replace(/[^\w .-]+/g, "_");
      const folder = path.join(r.filePaths[0], "Class Manager for assistants " + label);
      fs.mkdirSync(folder, { recursive: true });
      fs.writeFileSync(path.join(folder, "snapshot.json"), JSON.stringify(snap, null, 1));
      fs.writeFileSync(path.join(folder, "snapshot.md"), toMarkdown(snap));
      fs.copyFileSync(path.join(__dirname, "mcp-server.js"), path.join(folder, "cm-mcp-server.js"));
      fs.writeFileSync(path.join(folder, "mcp-config.json"), JSON.stringify(mcpConfig(folder), null, 2));
      if (shell) shell.openPath(folder);
      return { ok: true, folder, files: ["snapshot.md", "snapshot.json", "cm-mcp-server.js", "mcp-config.json"] };
    } catch (err) { return { ok: false, why: err.message }; }
  });
  // The lecturer pastes a pseudonym from an assistant's answer and sees which student it is. Only on this computer.
  on("cm:llmLookup", (c, e, pseudonym) => {
    try {
      const ps = createPseudonyms(saltOf(dirOf(c)));
      const rows = c.backend.tab("Roster") || [];
      rows.slice(1).forEach((r) => ps.of(r[0]));
      const id = ps.back(pseudonym);
      if (!id) return { ok: false, why: "That pseudonym is not in this course's class list." };
      const row = rows.find((r) => String(r[0]) === id);
      return { ok: true, id, name: row ? String(row[1] || "") : "" };
    } catch (err) { return { ok: false, why: err.message }; }
  });
}

module.exports = { register, snapshotOf, mcpConfig };
