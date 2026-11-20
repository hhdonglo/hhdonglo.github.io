"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { register } = require("../analytics-ipc");

function handlers() {
  const registered = new Map();
  register({ on: (channel, handler) => registered.set(channel, handler) });
  return registered;
}

test("class analytics uses the supplied course and preserves option filtering", () => {
  const ipc = handlers();
  const course = { backend: {
    stats: (options) => ({ course: "first", options }),
    studentStats: (options) => ({ course: "first", options }),
    progress: (options) => ({ course: "first", options })
  } };
  const otherCourse = { backend: { stats: (options) => ({ course: "second", options }) } };
  const options = { effort: 0, perf: "", idle: undefined, misses: null, id: "123456789012345678901", extra: "ignored" };
  const expected = { effort: "0", misses: "null", id: "12345678901234567890" };

  assert.deepEqual(ipc.get("cm:stats")(course, {}, options), { course: "first", options: expected });
  assert.deepEqual(ipc.get("cm:studentStats")(course, {}, options), { course: "first", options: expected });
  assert.deepEqual(ipc.get("cm:stats")(otherCourse, {}, null), { course: "second", options: {} });
  assert.deepEqual(ipc.get("cm:progress")(course, {}, options), { course: "first", options: {} });
});

test("class analytics returns the existing error response for backend errors", () => {
  for (const [channel, handler] of handlers()) {
    const method = channel.slice("cm:".length);
    const course = { backend: { [method]: () => { throw new Error("read failed"); } } };
    assert.deepEqual(handler(course, {}, {}), { ok: false, why: "read failed" });
  }
});
