// Puts the sheets of several files into one book for the existing import: sheets with the same name are joined (rows under one heading row),
// so the same tab found in two files is planned once and no record is added twice. Pure.
"use strict";

function mergeBooks(books) {
  const by = new Map(), order = [];
  books.forEach((book) => (book || []).forEach((sh) => {
    const cur = by.get(sh.name);
    if (!cur) { by.set(sh.name, { name: sh.name, rows: sh.rows.slice(), truncated: !!sh.truncated }); order.push(sh.name); }
    else { cur.rows = cur.rows.concat(sh.rows.slice(1)); cur.truncated = cur.truncated || !!sh.truncated; }
  }));
  return order.map((n) => by.get(n));
}

module.exports = { mergeBooks };
