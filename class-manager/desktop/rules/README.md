# rules/ — the course rules as plain JavaScript

One file per area, each doing what one part of `apps_script/` does today, over a small store interface (`store.js`), so the same rule can later run on SQL, in CM, or in a hosted relay.
Stage 1 (this folder) only adds the modules and the tests that prove they give the same answers as the Apps Script; nothing in CM calls them yet.

| Module | Replaces (apps_script/src) | Status |
| --- | --- | --- |
| `access-codes.js` | `accessCodes_`, `codesMap_`, `codeExpired_`, `newAccessCode_` | ported, parity tested |
| `attendance.js` | `20-attendance.gs`: open, close, check-in (QR token, device, phone, location, one mark a day), submit, discard | ported, parity tested (`attendance-parity.test.js`) |
| `class-list.js` | `rosterSync_`, `rosterTidy_`, `rosterEdit_` (00-core.gs), `studentNoteAdd_` (35-records.gs) | ported, parity tested (`class-list-parity.test.js`) |
| `auth.js` | `05-auth.gs`, `06-password.gs`: sessions, host key and password with recovery, student sign-in, quiz receipts | ported, parity tested (`auth-parity.test.js`) |
| `quiz-control.js` | `10-assessment.gs` (control part): the lecturer's actions on a live quiz, the state students see, the choice of questions and letters | ported, parity tested (`quiz-control-parity.test.js`); held results and answers follow in step 3b |
| `quiz-results.js` | `10-assessment.gs` (results part): answers, compile into held results, release and discard, item log, presence | ported, parity tested (`quiz-results-parity.test.js`); Master, Scores and Totals follow (`score-tables.js`) |
| `attendance-review.js` | `attStatus_`, `attReview_`, `attRemove_`, `attApprove_`, `attPhoneReset_` | ported, parity tested (`attendance-review-parity.test.js`) |

Store interface (`store.js`): `rows(tab)` (header first, or null), `setRows(tab, rows)`, `prop(key)`, `setProp(key, value)`, `now()`.
Rule of the port: same input, same output as the script (`test/rules-parity.test.js` runs both on the same workbook). Do not change behaviour in a port; change it afterwards, with its own test.
