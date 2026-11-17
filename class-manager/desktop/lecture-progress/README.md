# lecture-progress/

Lectures held against the semester target. What the lecturer sees: a card at the top of Class Analytics (held, left, planned, week, and a verdict of On track, Ahead, Behind or Target met), and a red banner when the course is behind, saying how many lectures behind and how many extra sessions catch up. The banner can be closed; it returns when a lecture is saved or the expected number changes. An optional desktop notice at CM start is a switch in CM Settings (off by default). No email.

| File | Does |
| --- | --- |
| `../rules/lecture-progress.js` | The arithmetic and the wording. One function, `status()`, used by the card, the banner and the notice. |
| `../rules/lecture-log.js` | Finds the held dates (attendance sessions plus the lecturer's marks) and keeps the marks as the course setting `lecture_log`. |
| `ipc.js` | `cm:lectureProgress`, `cm:lectureMark`, `cm:lectureNotify`. |
| `notify.js` | The desktop notice at start, when switched on and behind. |
| `../app/lecture-progress.js` | The card, the banner and the switch on the home screen. |

Settings (per course, Course settings): `lectureTarget` (number of lectures, 0 = none), `startDate` and `endDate` (already there), `teachingDays` (weekday numbers, optional), `lectureNotify`.

## What counts as a lecture held

- A date with at least one attendance session that was closed or submitted. Several sessions on one date are one lecture. An open or discarded session does not count.
- A date the lecturer marks held (use this for a make-up or a lecture without attendance).
- A date the lecturer marks cancelled never counts, even if attendance was taken.
- The roster is not needed.

## Expected by today

Lectures before today only (today's lecture is not due until the day is over). With teaching days set, the target is spread over the real teaching days of the semester. Without them, it is spread evenly over the days. Behind = expected minus held. Catch-up = the extra sessions in the weeks that remain.

Tests: `test/lecture-progress.test.js`.

## Lecture list

Lecture detection: `desktop/autoload/lecture-names.js` finds lecture numbers in file and folder names (lecture1, Lecture_01, L1, Lec 2, week3, "08 Waves", numbers in folder names) and groups files by lecture, with gaps (one detector, uses the existing folder scan `autoload/scan.js`). `desktop/lecture-progress/overview.js` merges that with lectures.json and the banks into "Lecture 1" to the last, shown on Course and Content (`app/lecture-list.js`, call `cm:lectureOverview`). The last detected number pre-fills "Lectures planned" in Course settings. Tests: `test/lecture-names.test.js`, `test/lecture-overview.test.js`.
