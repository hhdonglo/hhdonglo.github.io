# Grades table

The clean table behind "Grades and Results".

- `build.js` reads the records (Roster, Attendance, Attendance_Log, Form Responses 1, Attempts, Assignments, Groups, Assignment_Marks) and returns one row per student on the class list. Columns are grouped: Attendance, Quizzes (one per week), Assignments, Practice. Each cell keeps the time of the entry it came from, and each student has a "last activity" and a dated timeline.
- `view-model.js` writes the times out (for example "12 Nov 2026, 14:05"), shows a blank as "no record", and makes the sheets for Excel (Grades, then Timeline).
- `times.js` reads the time formats found in the records.
- Screen: `app/grades-view.js`. Tests: `test/grades.test.js`.

Master, Scores and Totals are not used: they hold one overwritten value per quiz and one "last updated" time. They stay available as raw tabs in the tab list.

To add a column group, add a block in `build.js` that calls `setCell` and `add`, and list it in `groupsOut`.
