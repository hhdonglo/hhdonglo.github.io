/* The relay end to end against a fake D1: automatic registration, abuse controls, signed requests, phones, live state, and forgetting. */
import test from "node:test";
import assert from "node:assert/strict";
import { newEnv, call, newCourseKeys, registerCourse, signed, NOW } from "./helpers.js";
import { courseIdOf } from "../src/crypto.js";
import { cleanup } from "../src/db.js";

const sealed = { k: "a", iv: "b", c: "c" };

test("a course registers itself, with no invite, and gets a self-certifying id", async () => {
  const env = await newEnv(), keys = await newCourseKeys();
  const r = await registerCourse(env, keys, NOW);
  assert.equal(r.status, 200, JSON.stringify(r.body)); assert.equal(r.body.course, await courseIdOf(keys.pub));
  const again = await registerCourse(env, keys, NOW); assert.equal(again.status, 409, "a second unsigned registration changes nothing");
  const page = await call(env, "GET", "/v1/course/" + r.body.course, {}, NOW);
  assert.equal(page.body.enc, "RSA-PUBLIC-KEY"); assert.deepEqual(page.body.state, {});
});

test("registration needs the work, a real key, and respects the kill switch and build list", async () => {
  const env = await newEnv(), keys = await newCourseKeys();
  const ch = (await call(env, "GET", "/v1/challenge", {}, NOW)).body;
  const bad = await call(env, "POST", "/v1/register", { body: JSON.stringify({ pub: keys.pub, enc: "x", challenge: ch.challenge, work: "0" }) }, NOW);
  assert.equal(bad.status, 403, "no work, no course");
  assert.equal((await call(env, "POST", "/v1/register", { body: JSON.stringify({ pub: { kty: "RSA" }, enc: "x" }) }, NOW)).status, 400);
  const off = await newEnv({ REGISTRATION_OPEN: "0" }); assert.equal((await registerCourse(off, keys, NOW)).status, 503);
  const closed = await newEnv({ BUILD_KEYS: "good-build" });
  assert.equal((await registerCourse(closed, keys, NOW)).status, 403, "an unknown build is refused");
  assert.equal((await registerCourse(closed, keys, NOW, { body: { build: "good-build" } })).status, 200);
});

test("too many new courses from one address are refused, others are not", async () => {
  const env = await newEnv(); let last;
  for (let i = 0; i < 6; i++) last = await registerCourse(env, await newCourseKeys(), NOW, { ip: "9.9.9.9" });
  assert.equal(last.status, 429);
  assert.equal((await registerCourse(env, await newCourseKeys(), NOW, { ip: "8.8.8.8" })).status, 200);
  assert.equal((await registerCourse(env, await newCourseKeys(), NOW + 3700, { ip: "9.9.9.9" })).status, 200, "an hour later it works again");
});

test("signed requests: only the course's own key, fresh, once", async () => {
  const env = await newEnv(), keys = await newCourseKeys(), other = await newCourseKeys();
  const id = (await registerCourse(env, keys, NOW)).body.course;
  assert.equal((await signed(env, keys, id, "/v1/pull", {}, NOW)).status, 200);
  assert.equal((await signed(env, other, id, "/v1/pull", {}, NOW)).status, 403, "another key");
  assert.equal((await signed(env, keys, id, "/v1/pull", {}, NOW, { time: NOW - 1000 })).status, 401, "old request");
  const one = await signed(env, keys, id, "/v1/pull", {}, NOW, { nonce: "same-nonce" }); assert.equal(one.status, 200);
  assert.equal((await signed(env, keys, id, "/v1/pull", {}, NOW, { nonce: "same-nonce" })).status, 409, "a copied request is refused");
  assert.equal((await call(env, "POST", "/v1/pull", { body: "{}" }, NOW)).status, 401, "unsigned");
});

test("phones drop sealed items; CM pulls and acknowledges them; each is delivered once", async () => {
  const env = await newEnv(), keys = await newCourseKeys(), id = (await registerCourse(env, keys, NOW)).body.course;
  for (let i = 0; i < 3; i++) assert.equal((await call(env, "POST", "/v1/drop", { headers: { "CF-Connecting-IP": "5.5.5." + i }, body: JSON.stringify({ course: id, sealed }) }, NOW)).status, 200);
  const p = await signed(env, keys, id, "/v1/pull", {}, NOW); assert.equal(p.body.items.length, 3); assert.deepEqual(p.body.items[0].sealed, sealed);
  const a = await signed(env, keys, id, "/v1/ack", { ids: p.body.items.map((x) => x.id) }, NOW); assert.equal(a.body.removed, 3);
  assert.equal((await signed(env, keys, id, "/v1/pull", {}, NOW)).body.items.length, 0);
  assert.equal((await call(env, "POST", "/v1/drop", { body: JSON.stringify({ course: "cnope", sealed }) }, NOW)).status, 404);
  assert.equal((await call(env, "POST", "/v1/drop", { body: JSON.stringify({ course: id, sealed: { k: 1 } }) }, NOW)).status, 400);
});

test("phones are rate limited per address, items are capped in size", async () => {
  const env = await newEnv(), keys = await newCourseKeys(), id = (await registerCourse(env, keys, NOW)).body.course; let last;
  for (let i = 0; i < 32; i++) last = await call(env, "POST", "/v1/drop", { headers: { "CF-Connecting-IP": "7.7.7.7" }, body: JSON.stringify({ course: id, sealed }) }, NOW);
  assert.equal(last.status, 429);
  const big = await call(env, "POST", "/v1/drop", { headers: { "CF-Connecting-IP": "6.6.6.6" }, body: JSON.stringify({ course: id, sealed: { k: "a", iv: "b", c: "x".repeat(20000) } }) }, NOW);
  assert.equal(big.status, 413);
});

test("live state: CM sets small values, phones read them, limits hold", async () => {
  const env = await newEnv(), keys = await newCourseKeys(), id = (await registerCourse(env, keys, NOW)).body.course;
  assert.equal((await signed(env, keys, id, "/v1/state", { set: { quiz: '{"q":1}', att: "open" } }, NOW)).body.set, 2);
  assert.deepEqual((await call(env, "GET", "/v1/course/" + id, {}, NOW)).body.state, { quiz: '{"q":1}', att: "open" });
  assert.equal((await signed(env, keys, id, "/v1/state", { remove: ["att"] }, NOW)).body.removed, 1);
  assert.deepEqual((await call(env, "GET", "/v1/course/" + id, {}, NOW)).body.state, { quiz: '{"q":1}' });
  assert.equal((await signed(env, keys, id, "/v1/state", { set: { "bad key!": "x" } }, NOW)).status, 400);
  assert.equal((await signed(env, keys, id, "/v1/state", { set: { big: "x".repeat(9000) } }, NOW)).status, 400);
});

test("a course sees only its own data", async () => {
  const env = await newEnv(), a = await newCourseKeys(), b = await newCourseKeys();
  const ia = (await registerCourse(env, a, NOW, { ip: "1.1.1.1" })).body.course, ib = (await registerCourse(env, b, NOW, { ip: "2.2.2.2" })).body.course;
  await call(env, "POST", "/v1/drop", { body: JSON.stringify({ course: ia, sealed }) }, NOW);
  assert.equal((await signed(env, b, ib, "/v1/pull", {}, NOW)).body.items.length, 0);
  const stolen = await signed(env, b, ia, "/v1/pull", {}, NOW); assert.equal(stolen.status, 403, "B's key does not open A");
});

test("cleanup forgets: old items, unused courses (with their data), old nonces and counters", async () => {
  const env = await newEnv(), keys = await newCourseKeys(), id = (await registerCourse(env, keys, NOW)).body.course;
  await call(env, "POST", "/v1/drop", { body: JSON.stringify({ course: id, sealed }) }, NOW);
  await signed(env, keys, id, "/v1/state", { set: { a: "1" } }, NOW);
  let r = await cleanup(env.DB, NOW + 15 * 86400); assert.equal(r.items, 1, "an item nobody collected for 14 days");
  assert.equal((await env.DB.prepare("SELECT COUNT(*) AS n FROM course").first()).n, 1, "the course is still used");
  r = await cleanup(env.DB, NOW + 61 * 86400); assert.equal(r.courses, 1, "unused for 60 days");
  for (const t of ["course", "item", "state", "nonce"]) assert.equal((await env.DB.prepare("SELECT COUNT(*) AS n FROM " + t).first()).n, 0, t + " is empty");
});

test("closing a course forgets everything for it at once", async () => {
  const env = await newEnv(), keys = await newCourseKeys(), id = (await registerCourse(env, keys, NOW)).body.course;
  await call(env, "POST", "/v1/drop", { body: JSON.stringify({ course: id, sealed }) }, NOW);
  assert.equal((await signed(env, keys, id, "/v1/close", {}, NOW)).body.closed, true);
  assert.equal((await call(env, "GET", "/v1/course/" + id, {}, NOW)).status, 404);
  assert.equal((await env.DB.prepare("SELECT COUNT(*) AS n FROM item").first()).n, 0);
});

test("the relay refuses to run without its secret and answers health", async () => {
  const env = await newEnv({ RELAY_SECRET: "" });
  assert.equal((await call(env, "GET", "/health", {}, NOW)).body.ok, true);
  assert.equal((await call(env, "GET", "/v1/challenge", {}, NOW)).status, 500);
});
