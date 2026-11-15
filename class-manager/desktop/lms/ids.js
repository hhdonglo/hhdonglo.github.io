/* Student IDs are the unique key everywhere in CM. One place decides what an ID looks like, so the roster reader,
   the gradebook writer and the LMS services all agree. */
"use strict";

const digits = (v) => String(v == null ? "" : v).replace(/\D/g, "");
const isId = (id) => id.length >= 4 && id.length <= 12;
const clean = (v) => { const d = digits(v); return isId(d) ? d : ""; };

module.exports = { digits, isId, clean };
