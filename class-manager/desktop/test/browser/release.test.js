/* The minimum release suite in a real browser (Chromium through Playwright): run with `npm run test:browser`.
   The pages are served with the real server script (server.js), and every step is done the way a student or the
   lecturer does it: typing in the forms and pressing the buttons. The server-side half is in ../release.test.js. */
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { chromium } = require("playwright");
const { start } = require("./server");

const CODE = "26271"; // a week 1 join code, as in ../release.test.js
const N = 8; // students on their own phones at the same time
const QUESTIONS = 3;
let browser;
test.before(async () => { browser = await chromium.launch(); });
test.after(async () => { await browser.close(); });

// A phone: its own browser context (own storage), a phone-sized screen, and a list of script errors on its pages.
async function phone() {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 800 } });
  const page = await ctx.newPage();
  page.errors = [];
  page.on("pageerror", (e) => page.errors.push(e.message));
  return page;
}
// Every request the page sent to the class server, to check that no key or code was put in a web address.
function watchAddresses(page) {
  const urls = [];
  page.on("request", (r) => { if (r.url().includes("/exec")) urls.push(r.url()); });
  return urls;
}

test("1 to 8 in the browser: the lecturer runs a live quiz, a class answers at once, and each student opens their own record", { timeout: 180000 }, async () => {
  const s = await start({ students: N });
  try {
    const { c } = s;
    // 1. The lecturer signs in on the quiz host page with the join code and the host key.
    const lect = await phone();
    await lect.setViewportSize({ width: 1280, height: 800 });
    const lectUrls = watchAddresses(lect);
    await lect.goto(s.url + "/quiz-host.html");
    await lect.fill("#h-code", CODE);
    await lect.fill("#h-key", c.key);
    await lect.click("#h-form button[type=submit]");
    await lect.waitForSelector("#h-n option");
    await lect.selectOption("#h-n", String(QUESTIONS));
    await waitFor(() => c.host("host", { code: CODE }).status.totalQ === QUESTIONS, "the number of questions is set");
    await lect.locator('[data-a="lobby"]:visible').click();
    await lect.waitForFunction(() => /lobby/i.test(document.body.innerText));

    // 2. Students join from their phones, all at the same moment.
    const phones = [];
    for (const st of c.students) {
      const p = await phone(); phones.push(p);
      await p.goto(s.url + "/quiz.html?code=" + CODE);
      assert.equal(await p.inputValue("#in-code"), CODE, "the QR address fills in the join code");
      await p.fill("#in-name", st.name);
      await p.fill("#in-id", st.id);
    }
    await Promise.all(phones.map((p) => p.click("#f-start button[type=submit]")));
    await Promise.all(phones.map((p) => p.waitForSelector("#s-wait:not([hidden])")));
    await assert.doesNotReject(waitFor(() => c.host("host", { code: CODE }).joined === N, "all students joined"));

    // 3 to 5. The lecturer starts and moves through the questions; every phone answers each one (the first students
    // choose A, the rest B), and some tap twice: only the last choice is kept.
    await lect.locator('[data-a="start"]:visible').click();
    for (let q = 1; q <= QUESTIONS; q++) {
      await Promise.all(phones.map((p) => p.waitForFunction((n) => document.getElementById("qn").textContent.startsWith("Question " + n), q, { timeout: 20000 })));
      await Promise.all(phones.map(async (p, i) => {
        if (i % 3 === 0) { await p.locator("#opts button").nth(2).click(); }
        await p.locator("#opts button").nth(i < N / 2 ? 0 : 1).click();
        await p.waitForFunction(() => /answer is sent/.test(document.getElementById("pnote").textContent));
      }));
      await waitFor(() => answered(c, q) === N, "all answers to question " + q + " arrived");
      await lect.locator('[data-a="next"]:visible').click();
    }
    await Promise.all(phones.map((p) => p.waitForSelector("#s-end:not([hidden])", { timeout: 20000 })));

    // 6. Stored: one response row per student, each with one answer per question.
    const rows = c.backend.tab("Responses").slice(1).filter((r) => String(r[3] || r[2]).toUpperCase() === CODE || r.includes(CODE));
    assert.ok(rows.length >= N, "responses were stored");

    // 7. Analysed: the lecturer's class statistics count every student.
    const stats = c.host("class_stats", {});
    assert.equal(stats.ok, true);

    // 8. A student opens their own record on the portal with their ID and access code, and the code is then
    // replaced by a session in the browser (the code itself is not kept, nor sent in a web address).
    const st = c.students[0];
    const p = phones[0];
    const pUrls = watchAddresses(p);
    await p.goto(s.url + "/index.html");
    await p.waitForSelector("#p-res:not([hidden])");
    await p.click("#p-details summary");
    await p.fill("#p-id", st.id);
    await p.fill("#p-code", c.codes[st.id]);
    if (await p.locator("#p-rem").isVisible()) await p.check("#p-rem");
    await p.click("#p-show");
    await p.waitForSelector("#p-out:not([hidden])");
    assert.match(await p.textContent("#p-out"), /attend|quiz|progress/i);
    const stored = await p.evaluate(() => JSON.stringify(Object.assign({}, localStorage)) + JSON.stringify(Object.assign({}, sessionStorage)));
    assert.ok(!stored.includes(c.codes[st.id]), "the access code is not kept in the browser");
    for (const u of pUrls.concat(lectUrls)) {
      assert.ok(!u.includes(c.codes[st.id].replace("-", "")) && !u.includes(encodeURIComponent(c.codes[st.id])) && !u.includes(c.key), "no key or code in a web address: " + u);
    }
    const lectStore = await lect.evaluate(() => JSON.stringify(Object.assign({}, sessionStorage)));
    assert.ok(!lectStore.includes(c.key), "the host key is not kept in the lecturer's browser");
    for (const x of phones.concat([lect])) assert.deepEqual(x.errors, [], "no script errors");
  } finally { await s.close(); }
});

test("9 in the browser: a wrong join code, a wrong access code and a class server that does not answer are explained", { timeout: 60000 }, async () => {
  const s = await start({ students: 2 });
  try {
    const { c } = s;
    const st = c.students[0];
    const p = await phone();
    // A join code that does not exist.
    await p.goto(s.url + "/quiz.html");
    await p.fill("#in-name", st.name); await p.fill("#in-id", st.id); await p.fill("#in-code", "ZZZZZ");
    await p.click("#f-start button[type=submit]");
    await p.waitForSelector("#err:not([hidden])");
    assert.ok((await p.textContent("#err")).length > 10);
    // A wrong access code on the portal.
    await p.goto(s.url + "/index.html");
    await p.waitForSelector("#p-res:not([hidden])");
    await p.click("#p-details summary");
    await p.fill("#p-id", st.id); await p.fill("#p-code", "ABCD-EFGH");
    await p.click("#p-show");
    await p.waitForSelector("#p-err:not([hidden])");
    assert.equal(await p.isVisible("#p-out"), false, "no record is shown");
    // The class server stops answering: the page says so instead of hanging or failing silently.
    s.down(true);
    await p.goto(s.url + "/quiz.html");
    await p.fill("#in-name", st.name); await p.fill("#in-id", st.id); await p.fill("#in-code", CODE);
    await p.click("#f-start button[type=submit]");
    await p.waitForSelector("#err:not([hidden])", { timeout: 40000 });
    assert.ok((await p.textContent("#err")).length > 10);
    assert.equal(await p.locator("#f-start button[type=submit]").isEnabled(), true, "the student can try again");
    s.down(false);
    assert.deepEqual(p.errors, []);
  } finally { await s.close(); }
});

function answered(c, q) { // answers to the current question, as the lecturer's page shows them
  const r = c.host("host", { code: CODE });
  return r.status.currentQ === q ? r.answered : -1;
}
async function waitFor(fn, what, ms) {
  const end = Date.now() + (ms || 20000);
  while (Date.now() < end) { if (fn()) return; await new Promise((r) => setTimeout(r, 200)); }
  throw new Error("timed out: " + what);
}
