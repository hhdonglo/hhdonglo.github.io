/* A stand-in for Cloudflare D1 made from Node's built-in SQLite (D1 is SQLite), with the same calls the relay uses:
   prepare(sql).bind(...).first() / all() / run(). It lets the whole relay be tested without a Cloudflare account. */
import { DatabaseSync } from "node:sqlite";

export function fakeD1() {
  const db = new DatabaseSync(":memory:");
  return {
    raw: db,
    prepare(sql) {
      let args = [];
      const stmt = { bind(...a) { args = a; return stmt; },
        async first() { const r = db.prepare(sql).get(...args); return r === undefined ? null : Object.assign({}, r); },
        async all() { return { results: db.prepare(sql).all(...args).map((r) => Object.assign({}, r)) }; },
        async run() { const r = db.prepare(sql).run(...args); return { success: true, meta: { changes: Number(r.changes) } }; } };
      return stmt;
    }
  };
}
