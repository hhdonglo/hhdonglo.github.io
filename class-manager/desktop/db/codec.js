/* How a row or a setting is written into the database file.
   One responsibility: text in, bytes out (and back). With a vault the bytes are encrypted (AES-256-GCM), exactly as the
   old workbook.json was, so student records are never readable in the database file. Without a vault (tests) they are plain JSON. */
"use strict";

const isDate = (v) => Object.prototype.toString.call(v) === "[object Date]"; // dates made inside the script come from another realm

// JSON with dates kept as dates ({"$d": "..."}), the same convention as the old workbook.json.
function toJson(value) {
  return JSON.stringify(value, function (k, v) { const raw = this[k]; return isDate(raw) ? { $d: raw.toISOString() } : v; });
}
function fromJson(text) {
  return JSON.parse(text, (k, v) => (v && typeof v === "object" && v.$d ? new Date(v.$d) : v));
}

function createCodec(vault) {
  return {
    pack: (value) => { const json = toJson(value); return vault ? vault.encode(json) : json; },
    unpack: (stored) => {
      const text = Buffer.isBuffer(stored) || stored instanceof Uint8Array
        ? (vault ? vault.decode(Buffer.from(stored)) : Buffer.from(stored).toString("utf8"))
        : String(stored);
      return fromJson(text);
    }
  };
}

module.exports = { createCodec, toJson, fromJson, isDate };
