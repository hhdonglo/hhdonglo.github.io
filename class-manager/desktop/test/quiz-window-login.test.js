/* The quiz window opened from CM on this computer needs no password and no join code; any other device still does. */
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { classroom } = require("./classroom");
const { isThisComputerUrl } = require("../local-window");

test("only CM's own windows on this computer are given the signed-in password", () => {
  const lan = ["192.168.1.20"];
  assert.equal(isThisComputerUrl("http://127.0.0.1:8080/c/a/quiz-host.html", 8080, lan), true);
  assert.equal(isThisComputerUrl("http://localhost:8080/quiz-host.html", 8080, lan), true);
  assert.equal(isThisComputerUrl("http://192.168.1.20:8080/quiz-host.html", 8080, lan), true);
  assert.equal(isThisComputerUrl("http://192.168.1.77:8080/quiz-host.html", 8080, lan), false, "another device's address");
  assert.equal(isThisComputerUrl("http://192.168.1.20:9999/quiz-host.html", 8080, lan), false, "another port");
  assert.equal(isThisComputerUrl("https://abc.trycloudflare.com/quiz-host.html", 8080, lan), false, "the internet address");
  assert.equal(isThisComputerUrl("file:///etc/passwd", 8080, lan), false);
  assert.equal(isThisComputerUrl("not a url", 8080, lan), false);
});

test("the quiz window finds the join code itself, and only for a request with the host key", () => {
  const c = classroom({ students: 2, engine: "js" });
  try {
    assert.equal(c.host("quiz_default").code, "26271", "no quiz yet: the code of the chosen week");
    c.host("control", { code: "26273", act: "init" });
    assert.deepEqual(c.host("quiz_default").code, "26273", "latest quiz");
    c.host("control", { code: "26272", act: "init" }); c.host("control", { code: "26272", act: "start" });
    const d = c.host("quiz_default"); assert.equal(d.code, "26272"); assert.equal(d.source, "open", "the quiz that is open now wins");
    const refused = c.call({ action: "quiz_default" });
    assert.equal(refused.ok, false); assert.equal(refused.code, undefined, "no host key: no code");
    assert.equal(c.call({ action: "quiz_default", hostkey: "wrong" }).code, undefined, "wrong key: no code");
  } finally { c.backend.close(); }
});
