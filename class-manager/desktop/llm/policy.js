// What may leave CM for an assistant. Only the tabs listed here are ever read; every other tab (host key, access codes,
// check-in log with device marks, notes, messages, answers by name) is never touched. Edit this file to change the rule.
"use strict";

const ALLOWED_TABS = ["Roster", "Attendance", "Form Responses 1", "Item_Log", "Attempts", "Master", "Scores", "Totals", "Question_Stats", "Groups"];

const ID_HEADING = /^(student\s*)?(id|number)$|student id/i;
const NAME_HEADING = /name/i;
const SECRET_HEADING = /key|code|secret|password|token|device|e-?mail|phone/i; // dropped always, even if a tab gains such a column
const JOIN_CODE = /^join code$/i; // a quiz join code is not a secret, but it is of no use to an assistant

const kindOf = (heading) => {
  const h = String(heading == null ? "" : heading).trim();
  if (ID_HEADING.test(h)) return "id";
  if (JOIN_CODE.test(h)) return "drop";
  if (SECRET_HEADING.test(h)) return "drop";
  if (NAME_HEADING.test(h)) return "name";
  return "data";
};

module.exports = { ALLOWED_TABS, kindOf };
