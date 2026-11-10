/* A test web server for the browser tests: it serves the course pages and the class server (/exec) of a test
   classroom (../classroom.js), as the desktop app does on the lecturer's computer, on a free port of this computer.
   Only what the pages need is served: files, config.js with the test address, and /exec by GET and POST. */
"use strict";
const fs = require("fs");
const http = require("http");
const path = require("path");
const { classroom, WEB, PACK } = require("../classroom");
const { configScript } = require("../../courses");

const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml",
  ".png": "image/png", ".jpg": "image/jpeg", ".webmanifest": "application/manifest+json", ".pdf": "application/pdf", ".ico": "image/x-icon" };

function file(p) { // the course pack first, then the package, never outside them
  for (const root of [PACK, WEB]) {
    const f = path.normalize(path.join(root, p));
    if (f.startsWith(root + path.sep) && fs.existsSync(f) && fs.statSync(f).isFile()) return f;
  }
  return null;
}

function readBody(req) {
  return new Promise((resolve) => { const parts = []; req.on("data", (c) => parts.push(c)); req.on("end", () => resolve(Buffer.concat(parts).toString("utf8"))); });
}

// Starts a server for a new classroom. Returns { url, c (the classroom), down(on) (the class server stops answering), close() }.
async function start(opts) {
  const c = classroom(opts);
  let down = false;
  const server = http.createServer(async (req, res) => {
    const u = new URL(req.url, "http://x");
    let p = decodeURIComponent(u.pathname);
    if (p === "/exec") {
      if (down) { res.writeHead(503); return res.end(); }
      const params = Object.fromEntries(u.searchParams);
      let out;
      if (req.method === "POST") {
        const body = await readBody(req);
        Object.assign(params, Object.fromEntries(new URLSearchParams(body)));
        out = c.backend.doPost(params, body);
      } else out = c.backend.doGet(params);
      res.writeHead(200, { "Content-Type": out.mime + "; charset=utf-8", "Cache-Control": "no-store", "Access-Control-Allow-Origin": "*" });
      return res.end(out.text);
    }
    if (p === "/") p = "/index.html";
    if (p === "/config.js") {
      const cm = { courseCode: "PHYS 143", courseTitle: "Test course", contact: "the lecturer", scriptUrl: url + "/exec", desktop: true };
      res.writeHead(200, { "Content-Type": TYPES[".js"] });
      return res.end(configScript(fs.readFileSync(path.join(WEB, "config.js"), "utf8"), cm, ""));
    }
    const f = file(p);
    if (!f) { res.writeHead(404, { "Content-Type": "text/plain" }); return res.end("Not found"); }
    res.writeHead(200, { "Content-Type": TYPES[path.extname(f).toLowerCase()] || "application/octet-stream" });
    fs.createReadStream(f).pipe(res);
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const url = "http://127.0.0.1:" + server.address().port;
  return { url, c, down: (on) => { down = on; }, close: () => new Promise((r) => server.close(r)) };
}

module.exports = { start };
