# lms: the LMS connector

Moves the class roster and grades between CM and a learning management system (LMS): Canvas, Moodle, Blackboard, Brightspace, Sakai or another that reads CSV. Everything is off until the lecturer switches it on. CM sends the LMS only its own user id and the points, never names. The student ID is the unique key throughout.

Two ways to use it, from the screen `app/lms.html`:

1. **By file** (no connection, no setup with the LMS): read the roster the LMS exported; save a gradebook CSV the LMS imports.
2. **Directly** (optional): CM calls the LMS's LTI Advantage services, Names and Role Provisioning (roster) and Assignment and Grade Services (gradebook). CM calls the LMS; the LMS never calls CM, so no public address is needed. The LMS administrator registers CM once with the file the screen saves (public key and services), then gives the lecturer a client ID and three https addresses.

| File | One job |
| --- | --- |
| `profiles.js` | What each LMS calls the ID and name columns, and its gradebook layout. Add an LMS here. |
| `ids.js` | What a valid student ID is. |
| `roster-read.js` | An LMS roster export into students (ID, name). |
| `roster-plan.js` | What would change in CM's class list. Changes nothing. |
| `roster-apply.js` | Adds the students the lecturer agreed to add. |
| `assessments.js` | The assessments and scores in CM's Master tab. |
| `gradebook.js` | The CSV to upload to the LMS gradebook. |
| `config.js` | The course's settings in `lms.json` (off by default, https only). |
| `keys.js`, `jwt.js` | The signing key made on this computer, and RS256 tokens. |
| `token.js` | The access token request. |
| `members.js` | The roster from the LMS (learners only). |
| `scores.js`, `push-grades.js` | Gradebook columns and scores sent to the LMS. |
| `tool-config.js` | The registration file for the LMS administrator. |
| `ipc.js` | The `cm:lms*` calls the screen uses. |

Rules the code keeps (tests in `desktop/test/lms.test.js`): nobody is removed from CM; an existing name is never overwritten; a student with no score is left empty, never zero; a repeated ID is one student; a student not matched in the LMS is reported and not sent; with the connection off nothing is sent.

Limits to know: the gradebook layouts follow each LMS's documented import format and should be tried once on a copy of the course. The direct connection has been tested against a mock LMS only, not a real one; the LMS must give each learner a student number (`lis_person_sourcedid`) so CM can match by ID.
