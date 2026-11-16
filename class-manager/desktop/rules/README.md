# rules/ — the course rules as plain JavaScript

One file per area, each doing what one part of `apps_script/` does today, over a small store interface (`store.js`), so the same rule can later run on SQL, in CM, or in a hosted relay.
Every area is now ported and `router.js` answers every request. `backend.js` uses it by default (`engine` is `js`; `CM_ENGINE=script` selects the old Apps Script for comparison). The parity tests run the old script and the module on the same data and compare answers. The relay Worker has its own implementation of the attendance and quiz checks (`relay/hub/src/`), kept in step by `relay/hub/test/`.

| Module | Replaces (apps_script/src) | Status |
| --- | --- | --- |
| `access-codes.js` | `accessCodes_`, `codesMap_`, `codeExpired_`, `newAccessCode_` | ported, parity tested |
| `attendance.js` | `20-attendance.gs`: open, close, check-in (QR token, device, phone, location, one mark a day), submit, discard | ported, parity tested (`attendance-parity.test.js`) |
| `class-list.js` | `rosterSync_`, `rosterTidy_`, `rosterEdit_` (00-core.gs), `studentNoteAdd_` (35-records.gs) | ported, parity tested (`class-list-parity.test.js`) |
| `auth.js` | `05-auth.gs`, `06-password.gs`: sessions, host key and password with recovery, student sign-in, quiz receipts | ported, parity tested (`auth-parity.test.js`) |
| `quiz-control.js` | `10-assessment.gs` (control part): the lecturer's actions on a live quiz, the state students see, the choice of questions and letters | ported, parity tested (`quiz-control-parity.test.js`); held results and answers follow in step 3b |
| `quiz-results.js` | `10-assessment.gs` (results part): answers, compile into held results, release and discard, item log, presence | ported, parity tested (`quiz-results-parity.test.js`); Master, Scores and Totals are in `score-tables.js` |
| `quiz-submit.js` | `90-router.gs` (POST part): an answer, joining, progress, a timed submission, a practice attempt, a question report | ported, parity tested (`quiz-submit-parity.test.js`); finishes step 3 |
| `quiz-views.js` | `90-router.gs` (GET part), `60-portal.gs`, review and ranking: status, questions, review, ranking, result, host view, projector display, portal status, My results | ported, parity tested (`quiz-views-parity.test.js`); My results takes the groups, learning and progress parts from a hook until their steps land |
| `learning.js` | `30-analytics.gs` (evidence part), `35-records.gs`: questions to revisit, per-question statistics, Teaching insights, student records and notes | ported, parity tested (`learning-parity.test.js`) |
| `class-stats.js` | `30-analytics.gs` (class part): Class statistics, engagement groups, the learning verdict, areas to target | ported, parity tested (`class-stats-parity.test.js`) |
| `outcomes.js` | `30-analytics.gs` (objectives part): links from questions to objectives, answers as evidence, progress by objective, class by week, ask-discuss-revise | ported, parity tested (`outcomes-parity.test.js`); Learning progress and the student profile follow with group work |
| `score-tables.js` | `10-assessment.gs` (tables part): Master, Scores, Totals, practice and mock entries | ported, parity tested through a release (`quiz-results-parity.test.js`) |
| `attendance-review.js` | `attStatus_`, `attReview_`, `attRemove_`, `attApprove_`, `attPhoneReset_` | ported, parity tested (`attendance-review-parity.test.js`) |
| `text.js` | `calWhen_`, `calDate_`, `chatTxt_`, `safeLink_`, `fmtDay_`, `randInt_`, `shuffled_` | shared text, date and shuffle helpers (used by groups, assignments, calendar and chat) |
| `groups.js` | `groupsAct_`, `studentGroups_`, `groupsDisplay_` | ported, parity tested (`collaboration-parity.test.js`); random dealing takes `o.random` so tests can be exact |
| `assignments.js` | `assignmentsAct_`, `groupWork_`, `groupWorkOf_`, `asgSummary_` | ported, parity tested (`collaboration-parity.test.js`) |
| `chat.js` | `chat_` and helpers | ported, parity tested (`communication-parity.test.js`); rate limit and change counter use `o.counters` |
| `announcements.js` | `announcements_` | ported, parity tested (`communication-parity.test.js`) |
| `calendar.js` | `calendar_`, `calendarAct_`, `calendarIcs_` | ported, parity tested (`communication-parity.test.js`); `ics()` returns the text, the router sets the type |
| `progress.js` | `learningProgress_`, `studentProfile_`, `studentStats_`, My results extras | ported, parity tested (`progress-parity.test.js`); `portalExtras(store, id, o)` is what `quiz-views.portalResults` takes as `o.extras` (pass `(s, i) => portalExtras(s, i, o)`) |
| `router.js` | `doPost`, `doGet`, `route_` (`90-router.gs`) | ported, parity tested (`router-parity.test.js`, every action and POST kind); `createRouter({store, site, version, geoMode})` gives `get` and `post`; `backend.js` uses it when `engine` is `js` (or `CM_ENGINE=js`) |

Store interface (`store.js`): `rows(tab)` (header first, or null), `setRows(tab, rows)`, `prop(key)`, `setProp(key, value)`, `now()`.
Rule of the port: same input, same output as the script (`test/rules-parity.test.js` runs both on the same workbook). Do not change behaviour in a port; change it afterwards, with its own test.
