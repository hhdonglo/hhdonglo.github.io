/* What CM answers when its own quiz and attendance server hits an error while handling a request.
   One responsibility: turn the error into a JSON answer ({ok:false, why}) the pages show as a plain sentence, instead of the
   bare "server error" text they could not read (which they reported as "could not reach"). The details go to the log, never to the page. */
"use strict";

const WHY = "CM could not complete that. Nothing was changed. Try again, and if it keeps happening restart CM";

function failure(err, log) {
  try { (log || console.error)(err); } catch (e) { /* logging must never fail the answer */ }
  return { status: 500, body: JSON.stringify({ ok: false, why: WHY }) };
}

module.exports = { failure, WHY };
