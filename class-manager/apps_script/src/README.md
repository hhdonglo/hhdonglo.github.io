# apps_script/src: the server script, one module per responsibility

`node apps_script/build.js` joins these files, in name order, into `../quiz_receiver.gs` (what is pasted into Google Apps Script and what the desktop app runs). Edit here, never the built file.

| File | Responsibility |
| --- | --- |
| `00-core.gs` | Settings, Key tab, setup, shared helpers |
| `05-auth.gs` | Sessions, student access-code sign-in, lecturer sign-in check (`hostOk_`), receipts |
| `06-password.gs` | The lecturer password: slow hash, set, change, recover with the recovery code, owner reset. Limits are the constants at the top (`HOST_MAX_FAILS`, `RECOVERY_MAX_FAILS`, `PW_ROUNDS`). |
| `10-assessment.gs` | Quizzes, scoring, releasing results |
| `20-attendance.gs` | Attendance sessions, check-ins, review |
| `30-analytics.gs` | Class statistics, learning progress, insights |
| `35-records.gs` | Laboratory, assignment, practice and group assessment records, and notes about students |
| `40-collaboration.gs` | Groups and assignments |
| `50-communication.gs` | Calendar, messages, announcements |
| `60-portal.gs` | The student portal |
| `90-router.gs` | `doGet` and `doPost`: which action calls what |

Tests are in `desktop/test/` (`cd desktop && npm test`).
