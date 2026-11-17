/* Where a quiz answer, join or submission goes: the live tabs for a student on the class list, the holding area for one who is not.
   One responsibility: give rules/quiz-submit.js one set of five calls (hasPresence, presence, addAnswer, addHeld, seen) that does the right thing for the ID.
   An unlisted student's answers never reach Answers, Presence, Staged_Quiz, Item_Log, Master, Scores or any class figure; they wait in Unlisted_Records
   (rules/unlisted.js) until the lecturer adds the student (rules/unlisted-move.js) or rejects. */
"use strict";
const R = require("./quiz-results");
const U = require("./unlisted");
const { normalizeId } = require("../ids");

const up = (v) => String(v).trim().toUpperCase();

function live(store) {
  return {
    listed: true,
    hasPresence: (code, id) => R.hasPresence(store, code, id),
    presence: (code, id, name, status) => R.presence(store, code, id, name, status),
    addAnswer: (row) => R.addAnswer(store, row),
    addHeld: (row) => R.addHeld(store, row),
    seen: (code, id, rnd) => R.respRows(store).some((r) => String(r[2]).trim() === id && up(r[3]) === code && (Number(r[10]) || 0) === rnd)
  };
}

function held(store) {
  const mine = (id, code, kind) => U.recordsOf(store, id).filter((r) => r.kind === kind && up(r.ref) === up(code));
  return {
    listed: false,
    hasPresence: (code, id) => mine(id, code, "quiz join").length > 0,
    presence: (code, id, name, status) => { // a submitted join is never moved back to "joined"
      const cur = mine(id, code, "quiz join")[0]; if (cur && cur.detail.status === "submitted") return true;
      U.note(store, { id, name, kind: "quiz join", ref: up(code), detail: { status, name }, replace: true }); return true;
    },
    addAnswer: (row) => { U.note(store, { id: row[1], name: row[2], kind: "quiz answer", ref: up(row[3]), detail: { q: Number(row[4]), answer: String(row[5]), round: Number(row[6]) || 0, conf: String(row[7] || ""), vote: Number(row[8]) || 0 } }); },
    addHeld: (row) => { U.note(store, { id: row[2], name: row[1], kind: "quiz submit", ref: up(row[3]), detail: { ans: row.slice(4, 9).map(String), round: Number(row[10]) || 0, n: Number(row[11]) || 5, week: row[13] || "" } }); },
    seen: (code, id, rnd) => mine(id, code, "quiz submit").some((r) => (Number(r.detail.round) || 0) === rnd)
  };
}

// The sink for this student: held when there is a class list and the ID is not on it.
const sinkFor = (store, rawId) => (U.isUnlisted(store, normalizeId(rawId)) ? held(store) : live(store));

module.exports = { sinkFor, live, held };
