/* The course runs on the JavaScript rules alone (engine "js"): a class, a quiz, attendance and My results, with no Apps Script answering. */
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { classroom } = require("./classroom");

test("a class runs a quiz, takes attendance and shows My results on the JavaScript engine", () => {
  const c = classroom({ students: 4, engine: "js" });
  try {
    assert.equal(c.backend.engine, "js");
    assert.equal(c.call({ action: "hostcheck", hostkey: c.key }).ok, true);
    const code = "26271", ctl = (p) => c.host("control", Object.assign({ code }, p));
    ctl({ act: "init" }); ctl({ act: "set", field: "q_seconds", value: "0" }); assert.equal(ctl({ act: "start" }).ok, true);
    c.students.forEach((s, i) => { c.call({ kind: "join", name: s.name, id: s.id, code }); assert.equal(c.call({ kind: "answer", name: s.name, id: s.id, code, q: 1, answer: "ABC"[i % 3] }), "ok"); });
    assert.equal(c.call({ action: "status", code }).state, "running");
    assert.equal(c.host("host", { code }).submitted >= 0, true);
    ctl({ act: "end" }); assert.equal(ctl({ act: "release" }).ok, true);
    const rows = c.host("class_stats", {}); assert.equal(rows.ok, true); assert.equal(rows.students.length, 4);
    const codes = c.host("access_codes", { op: "list" }).rows, mine = codes[0];
    const r = c.call({ action: "my_results", id: mine.id, code: mine.code }); assert.equal(r.ok, true); assert.ok(r._session);
    assert.equal(c.host("attend_open", { nogeo: "1" }).ok, true); assert.equal(c.host("attend_close", {}).ok, true);
    assert.match(c.call({ action: "nothing" }).toString(), /running/);
  } finally { c.backend.close(); }
});
