#!/usr/bin/env node
// A small read-only MCP server for Class Manager. It answers questions about ONE exported snapshot (snapshot.json) and
// nothing else: it cannot reach CM, the workbook, the network or any other file. It needs only Node 18 or later.
// Usage: node cm-mcp-server.js <folder holding snapshot.json>      (CM saves this file beside the snapshot)
// Speaks MCP over standard input and output, one JSON message per line. No dependencies, so a lecturer can read it all.
"use strict";
const fs = require("fs");
const path = require("path");

const PROTOCOL = "2025-06-18";
const text = (s) => ({ content: [{ type: "text", text: typeof s === "string" ? s : JSON.stringify(s, null, 1) }] });
const fail = (s) => ({ content: [{ type: "text", text: s }], isError: true });

function load(dir) { return JSON.parse(fs.readFileSync(path.join(dir, "snapshot.json"), "utf8")); }
const tableOf = (snap, name) => snap.tables[name] || snap.tables[Object.keys(snap.tables).find((n) => n.toLowerCase() === String(name).toLowerCase())] || null;

// ---------- the tools: each one is a short function over the snapshot ----------
const TOOLS = {
  course_overview: {
    description: "The course, how the data was made private, and which tables exist with their sizes.",
    schema: { type: "object", properties: {} },
    run: (snap) => text({ course: snap.course, privacy: snap.privacy, generated: snap.generated, students: snap.students, tables: Object.keys(snap.tables).map((n) => ({ name: n, rows: snap.tables[n].rows.length, columns: snap.tables[n].columns })) })
  },
  get_table: {
    description: "Rows of one table (for example Master, Attendance, Item_Log). Use limit and offset to page.",
    schema: { type: "object", properties: { name: { type: "string" }, limit: { type: "integer", minimum: 1, maximum: 500 }, offset: { type: "integer", minimum: 0 } }, required: ["name"] },
    run: (snap, a) => {
      const t = tableOf(snap, a.name); if (!t) return fail("No table called " + a.name + ". Tables: " + Object.keys(snap.tables).join(", "));
      const off = Math.max(0, a.offset | 0), lim = Math.min(500, Math.max(1, a.limit | 0 || 50));
      return text({ name: a.name, columns: t.columns, total: t.rows.length, offset: off, rows: t.rows.slice(off, off + lim) });
    }
  },
  student_record: {
    description: "Every row about one student, from every table, found by the student's pseudonym (or ID, if the export holds real IDs).",
    schema: { type: "object", properties: { student: { type: "string" } }, required: ["student"] },
    run: (snap, a) => {
      const who = String(a.student || "").trim(), out = {};
      for (const [n, t] of Object.entries(snap.tables)) {
        const cols = t.columns.map((c, i) => (/^(student\s*)?id$|student id/i.test(c) ? i : -1)).filter((i) => i >= 0);
        const rows = t.rows.filter((r) => cols.some((i) => String(r[i]).toLowerCase() === who.toLowerCase()));
        if (rows.length) out[n] = { columns: t.columns, rows: rows.slice(0, 200) };
      }
      return Object.keys(out).length ? text(out) : fail("No student " + who + " in this snapshot.");
    }
  },
  attendance_summary: {
    description: "Attendance rate for each session and for each student (1 present, 0 absent), and the students below a threshold.",
    schema: { type: "object", properties: { below_percent: { type: "number", minimum: 0, maximum: 100 } } },
    run: (snap, a) => {
      const t = snap.tables.Attendance; if (!t) return fail("This snapshot has no Attendance table.");
      const idCol = t.columns.findIndex((c) => /id/i.test(c)), cols = t.columns.map((c, i) => i).filter((i) => i !== idCol);
      const mark = (v) => (String(v) === "1" ? 1 : 0), pct = (n, d) => (d ? Math.round((1000 * n) / d) / 10 : 0);
      const sessions = cols.map((i) => ({ session: t.columns[i], rate: pct(t.rows.reduce((s, r) => s + mark(r[i]), 0), t.rows.length) }));
      const students = t.rows.map((r) => ({ student: r[idCol], present: cols.reduce((s, i) => s + mark(r[i]), 0), of: cols.length, rate: pct(cols.reduce((s, i) => s + mark(r[i]), 0), cols.length) }));
      const limit = a.below_percent == null ? 60 : a.below_percent;
      return text({ sessions, class_rate: pct(students.reduce((s, x) => s + x.present, 0), students.length * cols.length), below_threshold: { percent: limit, students: students.filter((x) => x.rate < limit) } });
    }
  }
};

// ---------- the protocol ----------
function handle(snap, msg) { // returns a response object, or null for a notification
  const id = msg.id, reply = (result) => ({ jsonrpc: "2.0", id, result }), error = (code, message) => ({ jsonrpc: "2.0", id, error: { code, message } });
  if (msg.id === undefined) return null;
  switch (msg.method) {
    case "initialize": return reply({ protocolVersion: PROTOCOL, capabilities: { tools: {} }, serverInfo: { name: "class-manager-snapshot", version: "1.0.0" }, instructions: "Read-only view of one exported Class Manager snapshot. Student IDs are pseudonyms unless the lecturer exported real IDs." });
    case "ping": return reply({});
    case "tools/list": return reply({ tools: Object.entries(TOOLS).map(([name, t]) => ({ name, description: t.description, inputSchema: t.schema, annotations: { readOnlyHint: true } })) });
    case "tools/call": {
      const tool = TOOLS[msg.params && msg.params.name];
      if (!tool) return error(-32602, "Unknown tool");
      try { return reply(tool.run(snap, (msg.params && msg.params.arguments) || {})); } catch (e) { return reply(fail("Tool failed: " + e.message)); }
    }
    default: return error(-32601, "Method not found");
  }
}

function serve(dir, input, output) {
  const snap = load(dir);
  let buf = "";
  input.setEncoding("utf8");
  input.on("data", (chunk) => {
    buf += chunk;
    let nl;
    while ((nl = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, nl).trim(); buf = buf.slice(nl + 1);
      if (!line) continue;
      let msg; try { msg = JSON.parse(line); } catch (e) { output.write(JSON.stringify({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }) + "\n"); continue; }
      const res = handle(snap, msg);
      if (res) output.write(JSON.stringify(res) + "\n");
    }
  });
}

if (require.main === module) {
  const dir = process.argv[2];
  if (!dir) { process.stderr.write("Usage: node cm-mcp-server.js <folder holding snapshot.json>\n"); process.exit(1); }
  try { serve(path.resolve(dir), process.stdin, process.stdout); } catch (e) { process.stderr.write("Cannot read snapshot.json: " + e.message + "\n"); process.exit(1); }
}

module.exports = { handle, serve, TOOLS };
