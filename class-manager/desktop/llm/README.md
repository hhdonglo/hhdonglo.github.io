# llm/: using a course with an AI assistant

Lets the lecturer give an assistant (Claude, ChatGPT, Gemini, a local model) a **private copy** of one course, and ask questions about it. CM never sends anything: it writes files to a folder the lecturer chooses, and the lecturer decides what to share.

## What the lecturer gets (Settings, "Use this course with an AI assistant")

| File | Use |
| --- | --- |
| `snapshot.md` | Paste or attach to any assistant. |
| `snapshot.json` | The same data, for tools and scripts. |
| `cm-mcp-server.js` and `mcp-config.json` | A read-only MCP connector for assistants that support it (Claude Desktop and others). Needs Node.js 18 or later. Add the contents of `mcp-config.json` to the assistant's MCP settings. |

**Show what would be saved** lists every table, its columns, and an example row before anything is written.

## Privacy rules (policy.js, edit there)

- Only these tabs are read: Roster, Attendance, Form Responses 1, Item_Log, Attempts, Master, Scores, Totals, Question_Stats, Groups. The host key, access codes, check-in log (device marks), notes, messages and everything else are never read.
- Student IDs become pseudonyms (`S-3F9A1C`): stable, one per ID, the same in every table. The salt is in the course's data folder (`llm-salt.json`) and is never exported, so only this computer can map a pseudonym back (**Look up**).
- Names are removed. The lecturer can tick "Include student names" or "Keep real student IDs".
- Columns named like a key, code, secret, device, e-mail or phone are always dropped.

## Files

- `policy.js`: allowed tabs and the column rule.
- `pseudonym.js`, `salt.js`: pseudonyms and their local salt.
- `snapshot.js`: builds the snapshot and the preview (pure functions).
- `markdown.js`: snapshot to Markdown.
- `mcp-server.js`: the stand-alone MCP server (no dependencies, reads `snapshot.json` only). Tools: `course_overview`, `get_table`, `student_record`, `attendance_summary`, all read-only.
- `ipc.js`: connects the screen (`cm:llmPreview`, `cm:llmSave`, `cm:llmLookup`). The screen is `app/llm.js`.

Tests: `test/llm.test.js`. To add a table, add its name to `ALLOWED_TABS`. To add a question the assistant can ask, add a tool to `TOOLS` in `mcp-server.js` (a short function over the snapshot).

## Not built yet

Provider-neutral generation (OpenAI, Gemini, local models) for the existing question-writing feature, and an "ask about my class" panel inside CM. Both would send data from CM itself, so each needs its own preview and consent step.
