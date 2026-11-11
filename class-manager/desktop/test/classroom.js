/* A test classroom: the real server script (through backend.js) with a fresh workbook, the PHYS 143 course pack's
   banks as the course content, a class list and personal access codes. Every request goes through doGet or doPost
   exactly as a page sends it, so the tests exercise the same path as students and the lecturer. */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const { createBackend } = require("../backend");

const WEB = path.resolve(__dirname, "..", "..");
const PACK = path.join(WEB, "course-packs", "phys143", "files");

function classroom(opts) {
  opts = opts || {};
  const dir = opts.dir || fs.mkdtempSync(path.join(os.tmpdir(), "cm-class-"));
  const state = { offline: false };
  const resolve = (p) => {
    if (state.offline) return null; // the course content cannot be reached
    const a = path.join(PACK, p);
    return fs.existsSync(a) ? a : path.join(WEB, p);
  };
  const make = () => createBackend({ webRoot: WEB, resolve, dataFile: path.join(dir, "workbook.json"), log: () => {} });
  let backend = make();
  const parse = (out) => { const t = out.text; try { return JSON.parse(t); } catch (e) { return t; } };
  const c = {
    dir, state,
    get backend() { return backend; },
    key: backend.hostKey(),
    reopen() { backend.flush(); backend = make(); return c; }, // as after a restart of the app
    get: (params) => parse(backend.doGet(Object.assign({}, params))), // a GET (JSONP) request, as older pages sent
    post: (params) => parse(backend.doPost(Object.assign({}, params), new URLSearchParams(params).toString())),
    call: (params) => c.post(params), // what the pages send now: every request by POST (CM.call)
    host: (action, params) => c.call(Object.assign({ action, hostkey: c.key }, params || {})),
    students: [],
    codes: {}
  };
  const n = opts.students || 0;
  for (let i = 0; i < n; i++) c.students.push({ id: String(20000001 + i), name: "Student" + (i + 1) });
  if (n) {
    backend.rosterSync(c.students.map((s) => [s.id, s.name]), true);
    const r = c.host("access_codes", { op: "generate" });
    (r.rows || []).forEach((x) => { c.codes[x.id] = x.code; });
  }
  return c;
}

module.exports = { classroom, WEB, PACK };
