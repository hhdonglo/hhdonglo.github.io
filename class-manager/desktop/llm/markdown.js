// A snapshot as Markdown: one file that can be pasted or attached to any assistant (Claude, ChatGPT, Gemini, a local model).
"use strict";

const cell = (v) => String(v == null ? "" : v).replace(/\|/g, "/").replace(/\s+/g, " ").trim();

function toMarkdown(snap, opts) {
  const max = (opts && opts.maxRows) || 200;
  const c = snap.course, out = [];
  out.push("# " + ([c.code, c.title].filter(Boolean).join(" ") || "Course") + (c.term ? " (" + c.term + ")" : ""));
  out.push("");
  out.push("Exported from Class Manager on " + snap.generated.slice(0, 10) + ". Student IDs are " + (snap.privacy.studentIds === "real" ? "the real IDs." : "pseudonyms (S-XXXXXX); the same student has the same pseudonym in every table.") + " Names are " + snap.privacy.names + ".");
  out.push("Use only the figures below. Do not guess who a pseudonym is.");
  for (const name of Object.keys(snap.tables)) {
    const t = snap.tables[name];
    out.push("", "## " + name + " (" + t.rows.length + " rows)", "");
    if (!t.columns.length) continue;
    out.push("| " + t.columns.map(cell).join(" | ") + " |", "| " + t.columns.map(() => "---").join(" | ") + " |");
    t.rows.slice(0, max).forEach((r) => out.push("| " + r.map(cell).join(" | ") + " |"));
    if (t.rows.length > max) out.push("", "(" + (t.rows.length - max) + " more rows are in snapshot.json.)");
  }
  return out.join("\n") + "\n";
}

module.exports = { toMarkdown };
