# Grades table

The clean table behind "Grades and Results".

- `build.js` reads the records (Roster, Attendance, Attendance_Log, Form Responses 1, Attempts, Assignments, Groups, Assignment_Marks) and returns one row per student on the class list. Each group is its own table: Quizzes (one column per quiz date, oldest first; same-day quizzes add the week or code), Attendance (one column per session date), Assignments, Practice. Each cell keeps the time of the entry it came from, and each student has a "last activity" and a dated timeline.
- `view-model.js` writes the times out (for example "12 Nov 2026, 14:05"), shows a blank as "no record", splits the groups into separate tables (ID, Name, one column per date), and makes the sheets for Excel (one per table, then Timeline).
- `times.js` reads the time formats found in the records.
- Screen: `app/grades-view.js`. Tests: `test/grades.test.js`.

Master, Scores and Totals are not used: they hold one overwritten value per quiz and one "last updated" time. They stay available as raw tabs in the tab list.

To add a column group, add a block in `build.js` that calls `setCell` and `add`, and list it in `groupsOut`; it becomes its own table automatically.
