"use strict";
// The lecture plan card must survive every redraw of the Class Analytics board (app/board/lp-slot.js). A small fake page stands in for the document:
// elements with an id, children, parentNode, and the one thing that matters here, replacing #ov's contents (innerHTML) throws away what was inside.
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const S = require("../app/board/lp-slot");

function page() {
  const all = new Set();
  function el(id) {
    const e = { id, parentNode: null, children: [], hidden: false,
      appendChild(c) { if (c.parentNode) c.parentNode.children.splice(c.parentNode.children.indexOf(c), 1); c.parentNode = e; e.children.push(c); return c; },
      insertBefore(c, ref) { if (c.parentNode) c.parentNode.children.splice(c.parentNode.children.indexOf(c), 1); c.parentNode = e; e.children.splice(e.children.indexOf(ref), 0, c); return c; },
      get firstChild() { return e.children[0] || null; } };
    all.add(e); return e;
  }
  const main = el("main"), ov = el("ov"), card = el("lp-card"); main.appendChild(ov); main.appendChild(card);
  const root = el("root"); root.appendChild(main);
  function inTree(e) { for (let p = e; p; p = p.parentNode) if (p === root) return true; return false; }
  const doc = { getElementById(id) { return [...all].find((e) => e.id === id && inTree(e)) || null; }, createElement(t) { return el(""); } };
  // What a redraw does: everything inside #ov is thrown away, then a new top row with an empty slot is built.
  function redraw(withSlot) { ov.children.forEach((c) => { c.parentNode = null; }); ov.children = []; if (withSlot) { const s = el("bd-lpslot"); ov.appendChild(s); } }
  return { doc, ov, card, main, redraw, inTree };
}

test("the card is still on the page after many redraws, each parked first and mounted after", () => {
  const p = page();
  for (let i = 0; i < 20; i++) {
    S.park(p.doc); p.redraw(true); assert.strictEqual(S.mount(p.doc), true, "redraw " + i);
    assert.ok(p.inTree(p.card), "card on the page after redraw " + i);
    assert.strictEqual(p.card.parentNode.id, "bd-lpslot");
  }
});

test("without parking, a redraw loses the card (the old fault), so parking is what keeps it", () => {
  const p = page(); S.park(p.doc); S.mount(p.doc); // not mounted: no slot yet, card parked
  p.redraw(true); S.mount(p.doc); // mounted into the first slot
  p.redraw(true); // a second redraw with no park first
  assert.strictEqual(p.inTree(p.card), false);
});

test("a redraw that shows a message instead of a board (no class yet, an error) keeps the card parked, and the next board gets it back", () => {
  const p = page();
  S.park(p.doc); p.redraw(true); S.mount(p.doc);
  S.park(p.doc); p.redraw(false); assert.strictEqual(S.mount(p.doc), false);
  assert.ok(p.inTree(p.card)); assert.strictEqual(p.card.parentNode.id, "lp-park");
  S.park(p.doc); p.redraw(true); assert.strictEqual(S.mount(p.doc), true);
  assert.strictEqual(p.card.parentNode.id, "bd-lpslot");
});

test("the holder sits next to #ov, never inside it, and is hidden", () => {
  const p = page(); S.park(p.doc);
  const h = p.doc.getElementById("lp-park");
  assert.strictEqual(h.parentNode, p.main); assert.strictEqual(h.hidden, true);
});

test("wiring: insights.js parks before every write to #ov, and mounts after the board is drawn; the page loads the module first", () => {
  const app = path.join(__dirname, "..", "app"), ins = fs.readFileSync(path.join(app, "insights.js"), "utf8"), home = fs.readFileSync(path.join(app, "home.html"), "utf8");
  const writes = ins.split("\n").filter((l) => /\$\("ov"\)\.innerHTML\s*=/.test(l) || /\["ov",/.test(l) && /innerHTML/.test(l));
  assert.ok(writes.length >= 3, "found the writes to #ov");
  // each function holding a write calls parkLp() before it
  const fns = ins.split(/\n  function /).filter((b) => /\$\("ov"\)\.innerHTML\s*=|\["ov", "st"/.test(b));
  fns.forEach((b) => assert.ok(b.indexOf("parkLp()") >= 0 && b.indexOf("parkLp()") < b.search(/\$\("ov"\)\.innerHTML\s*=|\["ov", "st"/), "parkLp before the write in: " + b.slice(0, 40)));
  assert.ok(/cmBoardLpSlot\.mount\(document\)/.test(ins));
  assert.ok(home.indexOf("board/lp-slot.js") > 0 && home.indexOf("board/lp-slot.js") < home.indexOf("insights.js"));
});
