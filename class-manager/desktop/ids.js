/* One student ID, one form. The same student must never exist twice because of how a file or a phone wrote the ID.
   " 22583439 ", "22583439.0" (what Excel adds to a number), "022583439" and 22583439 are all "22583439".
   Digits only; no leading zeros. Keep in step with normId_ in apps_script/src/00-core.gs. Pure. */
"use strict";

function normalizeId(v) {
  if (v === undefined || v === null) return "";
  if (typeof v === "number") return Number.isFinite(v) ? String(Math.round(v)).replace(/\D/g, "").replace(/^0+(?=\d)/, "") : "";
  return String(v).trim().replace(/\.0+$/, "").replace(/\D/g, "").replace(/^0+(?=\d)/, "");
}
const sameId = (a, b) => { const x = normalizeId(a); return x !== "" && x === normalizeId(b); };

module.exports = { normalizeId, sameId };
