/* Sends scores to the LMS gradebook (Assignment and Grade Services). Each assessment becomes one gradebook column (a line item), found or made by its CM name.
   Only the LMS's user id, the points and the maximum are sent; no names and no other student data. */
"use strict";

const LINEITEM = "application/vnd.ims.lis.v2.lineitem+json", SCORE = "application/vnd.ims.lis.v1.score+json";
const auth = (token, type) => ({ Authorization: "Bearer " + token, Accept: LINEITEM, "Content-Type": type || LINEITEM });

// Finds the column made earlier for this assessment (tagged with the CM name as resourceId), or makes it.
async function ensureLineItem(listUrl, token, fetchFn, a) {
  const q = listUrl + (listUrl.includes("?") ? "&" : "?") + "resource_id=" + encodeURIComponent(a.name);
  const r = await fetchFn(q, { headers: auth(token) });
  if (r.ok) { const list = await r.json(); const hit = (Array.isArray(list) ? list : []).find((x) => x.resourceId === a.name); if (hit && hit.id) return hit.id; }
  const c = await fetchFn(listUrl, { method: "POST", headers: auth(token), body: JSON.stringify({ label: a.name, scoreMaximum: a.outOf, resourceId: a.name }) });
  if (!c.ok) throw new Error("The LMS would not create the gradebook column \"" + a.name + "\" (" + c.status + ").");
  return (await c.json()).id;
}

const scoresUrl = (lineItemUrl) => { const [base, query] = lineItemUrl.split("?"); return base.replace(/\/$/, "") + "/scores" + (query ? "?" + query : ""); };

async function postScore(lineItemUrl, token, fetchFn, s, now) {
  const body = { userId: s.userId, scoreGiven: s.score, scoreMaximum: s.outOf, activityProgress: "Completed", gradingProgress: "FullyGraded", timestamp: new Date(now || Date.now()).toISOString() };
  const r = await fetchFn(scoresUrl(lineItemUrl), { method: "POST", headers: auth(token, SCORE), body: JSON.stringify(body) });
  return r.ok;
}

module.exports = { ensureLineItem, postScore, scoresUrl };
