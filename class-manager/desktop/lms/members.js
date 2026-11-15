/* Reads the course roster from the LMS (Names and Role Provisioning Service). Only learners are kept.
   The CM student ID is matched from the LMS's own student number (lis_person_sourcedid); a learner without one cannot be matched and is counted, never guessed. */
"use strict";
const { clean } = require("./ids");

const ACCEPT = "application/vnd.ims.lti-nrps.v2.membershipcontainer+json";
const isLearner = (m) => (m.roles || []).some((r) => /#Learner$|\/Learner$|^Learner$/i.test(String(r)));
const nextLink = (r) => { const h = r.headers && r.headers.get ? r.headers.get("link") : ""; const m = /<([^>]+)>\s*;\s*rel="?next"?/i.exec(h || ""); return m ? m[1] : ""; };

async function fetchMembers(url, token, fetchFn) {
  const students = [], seen = new Set(); let unmatched = 0, pages = 0, next = url;
  while (next && pages++ < 50) {
    const r = await fetchFn(next, { headers: { Authorization: "Bearer " + token, Accept: ACCEPT } });
    if (!r.ok) throw new Error("The LMS refused the roster request (" + r.status + ").");
    const j = await r.json();
    (j.members || []).filter(isLearner).forEach((m) => {
      const id = clean(m.lis_person_sourcedid || (m.message && m.message[0] && m.message[0]["https://purl.imsglobal.org/spec/lti/claim/lis"] && m.message[0]["https://purl.imsglobal.org/spec/lti/claim/lis"].person_sourcedid));
      if (!id || !m.user_id) { unmatched++; return; }
      if (seen.has(id)) return;
      seen.add(id);
      students.push({ id, name: [m.given_name, m.family_name].filter(Boolean).join(" ") || String(m.name || ""), userId: String(m.user_id) });
    });
    next = nextLink(r);
  }
  return { students, unmatched };
}

module.exports = { fetchMembers };
