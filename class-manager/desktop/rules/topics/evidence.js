/* Topic evidence: every answer behind the topic figures, in one list. Reads the tabs CM keeps; nothing is estimated.
   Rule (the same as a student's own record, learning.js): every released live answer, each student's latest full practice attempt for a lecture, and the latest mock exam.
   Only students on the class list are counted for the class; a student's own view takes their ID only.
   A row is {id, qid, ok, src: live|practice|mock, quiz, t, option, key} where quiz is the live quiz it belongs to ("" for practice and mock). */
"use strict";
const AC = require("../access-codes");
const L = require("../learning");
const { normalizeId } = require("../../ids");

const ITEMS = "Item_Log", RESPONSES = "Form Responses 1";
const up = (v) => String(v).trim().toUpperCase();
const body = (store, tab, w) => { const r = store.rows(tab); return r && r.length > 1 ? r.slice(1).map((x) => x.slice(0, w)) : []; };

// The live quiz name each join code belongs to ("Week 3" when the week is known, else "Quiz CODE"): the same naming as the class statistics.
function quizByCode(store) {
  const out = {};
  body(store, RESPONSES, 14).forEach((r) => { const code = up(r[3]); if (!code) return; const wk = Number(r[13]) || 0; out[code] = wk ? "Week " + wk : "Quiz " + code; });
  return out;
}

function gather(store, only) { // only: a student ID to restrict to, or null for the whole class list
  const roster = {}; AC.rosterRows(store).forEach((r) => { const id = normalizeId(r[0]); if (id) roster[id] = true; });
  const hasRoster = Object.keys(roster).length > 0, keep = (id) => (only ? id === only : (!hasRoster || roster[id]));
  const rel = L.releasedSet(store), qz = quizByCode(store), rows = [];
  body(store, ITEMS, 11).forEach((r) => {
    const id = normalizeId(r[4]); if (!id || !keep(id)) return;
    const code = up(r[1]), rnd = Number(r[2]) || 0;
    if (!rel[String(r[4]).trim() + "|" + code + "|" + rnd]) return; // held results stay hidden until released
    const ans = String(r[7]).trim().toUpperCase(); if (!ans) return; // a blank is not an answer
    rows.push({ id, qid: String(r[6]).trim(), ok: Number(r[9]) ? 1 : 0, src: "live", quiz: qz[code] || "Quiz " + code, t: new Date(r[0]).getTime() || 0, option: ans, key: String(r[8]).trim().toUpperCase() });
  });
  const latest = {}, mock = {};
  L.attemptRows(store).filter((a) => keep(a.id)).sort((a, b) => a.ts - b.ts).forEach((a) => {
    if (a.missed) return;
    if (a.mock) { mock[a.id] = a; return; }
    if (a.lec !== null) latest[a.id + "|" + a.lec] = a;
  });
  const addAttempt = (a, src) => a.asked.forEach((q) => rows.push({ id: a.id, qid: q, ok: a.wrong.indexOf(q) < 0 ? 1 : 0, src, quiz: "", t: a.ts, option: "", key: "" }));
  Object.keys(latest).forEach((k) => addAttempt(latest[k], "practice"));
  Object.keys(mock).forEach((k) => addAttempt(mock[k], "mock"));
  return rows;
}

module.exports = { gather, quizByCode };
