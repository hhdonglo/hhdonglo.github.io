# Grades table

The clean table behind "Grades and Results".

- `build.js` reads the records (Roster, Attendance, Attendance_Log, Form Responses 1, Attempts, Assignments, Groups, Assignment_Marks) and returns one row per student on the class list. Each group is its own table: Quizzes (one column per quiz date, oldest first; same-day quizzes add the week or code), Attendance (one column per session date), Assignments, Practice. Each cell keeps the time of the entry it came from, and each student has a "last activity" and a dated timeline.
- `view-model.js` writes the times out (for example "12 Nov 2026, 14:05"), shows a blank as "no record", splits the groups into separate tables (ID, Name, one column per date), and makes the sheets for Excel (one per table, then Timeline).
- `times.js` reads the time formats found in the records.
- Screen: `app/grades-view.js`. Tests: `test/grades.test.js`.

Master, Scores and Totals are not used: they hold one overwritten value per quiz and one "last updated" time. They stay available as raw tabs in the tab list.

To add a column group, add a block in `build.js` that calls `setCell` and `add`, and list it in `groupsOut`; it becomes its own table automatically.

## Roster with grades

`roster-table.js` adds one more table, always first: the class list with every result in one row per student (ID, Name, each quiz date, Quiz average, Sessions attended, Attendance %, assignments, Practice done). It reuses the columns `build.js` already made and works out four figures from them; a figure is blank when the student has nothing behind it. `view-model.js` applies it, so the screen, Excel (first sheet) and CSV (`Grades Roster with grades.csv`) all agree. Only students on the class list appear; unknown IDs are never rows. Refresh totals redraws it, since the Grades tables are built from the records each time. Tests: `test/roster-grades.test.js`.
