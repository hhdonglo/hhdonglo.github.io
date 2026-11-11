/* Three-way merge of keyed data, the rule behind course synchronisation.
   base: the data at the last synchronisation; local: this computer now; remote: another computer's data.
   All three are plain objects of key -> text (a missing key means absent). For each key:
     same on both sides            -> that value
     only the remote changed       -> the remote's value (including "removed")
     only this computer changed    -> this computer's value (including "removed")
     both changed, differently     -> resolve(local, remote, key): a conflict, counted.
   Pure functions: tested in test/sync.test.js. */
"use strict";

function merge3(base, local, remote, resolve) {
  const out = {}; let conflicts = 0, taken = 0;
  const keys = new Set([].concat(Object.keys(base), Object.keys(local), Object.keys(remote)));
  const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  for (const k of keys) {
    const b = has(base, k) ? base[k] : undefined, l = has(local, k) ? local[k] : undefined, r = has(remote, k) ? remote[k] : undefined;
    let v;
    if (l === r) v = l;
    else if (l === b) { v = r; taken++; }
    else if (r === b) v = l;
    else { conflicts++; v = resolve ? resolve(l, r, k) : l; }
    if (v !== undefined) out[k] = v;
  }
  return { data: out, conflicts, taken };
}

// Attendance: present (1) wins over absent (0); anything else keeps this computer's value.
const presentWins = (l, r) => (Number(l) === 1 || Number(r) === 1 ? 1 : l === undefined ? r : l);
// Class list: this computer's row is kept.
const keepLocal = (l, r) => (l === undefined ? r : l);

module.exports = { merge3, presentWins, keepLocal };
