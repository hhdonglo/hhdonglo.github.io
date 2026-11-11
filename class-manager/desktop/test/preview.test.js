"use strict";
// Preview in Load from a folder: web exports chosen together with other lists, big lists left unticked, and an error shown when a preview fails.
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { makeXlsx } = require("./web-export");
const { classroom } = require("./classroom");
const { sampleClass } = require("./sample-class");

const tmp = (p) => fs.mkdtempSync(path.join(os.tmpdir(), p));

async function setup() {
  const root = tmp("cm-pv-"), data = tmp("cm-pvd-"), s = sampleClass({ now: Date.UTC(2026, 10, 10, 12, 0, 0) });
  const tabs = Object.entries(s.tabs).map(([name, rows]) => ({ name, rows }));
  const x = await makeXlsx(tabs);
  fs.writeFileSync(path.join(root, "Quizzes (Responses) - roster only.xlsx"), x);
  fs.writeFileSync(path.join(root, "Quizzes (Responses).xlsx"), x); // the same export saved twice
  let g = "Student ID,Surname,First name\n", big = "Student ID,Surname,First name\n";
  for (let i = 0; i < 30; i++) g += (20000001 + i) + ",S" + i + ",F" + i + "\n";
  for (let i = 0; i < 1500; i++) big += (30000001 + i) + ",B" + i + ",G" + i + "\n";
  fs.writeFileSync(path.join(root, "GROUP_E.csv"), g);
  fs.writeFileSync(path.join(root, "attendance-list.csv"), big);
  fs.writeFileSync(path.join(root, "attendance-list_marked.csv"), big);
  fs.writeFileSync(path.join(root, "class-list-template.xlsx"), await makeXlsx([{ name: "Class list", rows: [["Student ID", "Surname", "First name"], [20000001, "S0", "F0"]] }]));
  const handlers = new Map(), c = classroom();
  c.id = "t1"; c.backups = { make: () => ({ ok: true, name: "b1" }) };
  const dialog = { showOpenDialog: async () => ({ canceled: false, filePaths: [root] }) };
  require("../autoload-ipc").register({ on: (ch, fn) => handlers.set(ch, fn), dialog, winOf: () => null, shell: null, dirOf: () => data });
  require("../import-ipc").register({ on: (ch, fn) => handlers.set(ch, fn), dialog, winOf: () => null, shell: null });
  const e = { sender: { send() {} } };
  return { call: (ch, ...a) => handlers.get(ch)(c, e, ...a) };
}

test("the screen's Preview works for web exports, a class list and a template ticked together", async () => {
  const { call } = await setup();
  const found = await call("cm:autoPick");
  const ids = found.files.filter((f) => f.useful && !/^attendance-list/.test(f.rel)).map((f) => f.id);
  assert.ok(ids.length >= 4);
  const p = await call("cm:autoPlan", { ids });
  assert.ok(p.ok, p.why); assert.ok(p.report && p.working);
  assert.doesNotThrow(() => JSON.stringify(p)); // must cross the window boundary
});

test("every control the folder screen wires up exists in its page (a missing one used to stop Preview working)", () => {
  const src = fs.readFileSync(path.join(__dirname, "../app/folder.js"), "utf8");
  const wired = [...src.matchAll(/body\.querySelector\("#([\w-]+)"\)\.onclick/g)].map((m) => m[1]);
  assert.ok(wired.length > 8);
  wired.forEach((id) => assert.ok(src.includes("id='" + id + "'"), "#" + id + " is wired but never drawn"));
  assert.ok(/function failed\(/.test(src) && /\.catch\(function \(err\) \{ failed\(err\)/.test(src), "a failed preview shows a message");
});
