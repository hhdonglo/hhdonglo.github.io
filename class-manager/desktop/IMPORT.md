# Importing results from the web version

For the person who maintains this code. User instructions are in README.md ("Import results from the web version").

## What it does

A lecturer who ran the course on the web has a Google Sheet with the tabs the server script writes (Form Responses 1, Attempts, Attendance_Log, Attendance, Item_Log and so on). CM's own workbook has the same tabs, because the same script runs in both places. The import reads such a workbook and adds the records that this course's workbook does not have yet.

## The five steps and where they live

| Step | File | Pure (no disk, no Electron) | Responsibility |
| --- | --- | --- | --- |
| Read | `xlsx-book.js` | no (reads a file) | Every visible sheet of an .xlsx, with text, numbers and dates kept apart; a CSV is one sheet. |
| Values | `import-values.js` | yes | IDs, codes, times and marks written one way, so the same record gives the same key. |
| Know the tabs | `import-specs.js` | yes | One entry per tab: its columns, the ID column, what makes two rows the same record. Marks tabs are not imported. |
| Plan | `import-plan.js` | yes | Compares the file with this course's workbook and returns `report` (what the lecturer sees) and `ops` (what to write). Writes nothing. |
| Apply | `import-apply.js` | needs a sheet interface | Writes `ops`: appends rows, writes the Attendance grid, adds students, then asks for the marks to be worked out again. |
| Screen | `import-ipc.js`, `app/import.js` | no | Choose, preview, import. The apply plans again from the stored file, makes a backup first, and refuses if the backup fails. |

`backend.js` offers the three small calls the writer needs: `sheet(name, create)`, `rows(name)` and `rebuildMarks()`.

## First-run paths (app/setup.html)

- **Start from scratch:** course details, then paste or load only student ID and name (the existing class list step). `build-from-roster.js` then gives every student a row in Attendance, Master and Scores, so the first session can start at once. Add only; run again after each class list change.
- **Use a template:** `import-template.js` is a workbook with the headings the import knows (Roster, Quiz scores, Attendance). Unfilled, it adds nothing. A filled one loads through the same preview and import. "Quiz scores" (Student ID, Quiz, Score, Out of, Date) is turned into live quiz results by `scoresAsResponses` in `import-plan.js`.
- **Continue from existing data:** the web export is loaded with the class list taken from the file (its Roster tab, or every ID that has records).

## Columns and large files

- Columns are found by heading, with other headings that mean the same (`ALIASES` in `import-specs.js`, for example Student Number for Student ID, Marks for Score). A required column that cannot be found is named in the preview together with the columns the file does have; the tab is then not imported. The preview also lists which file column was used for each required one.
- A sheet is read in chunks of 3,000 rows with a pause between chunks, and progress is sent to the screen, so a large file does not freeze CM. Up to 50,000 rows per sheet are read; beyond that the preview says so. In the tests, 40,000 rows read in about 0.3 s and plan in about 0.1 s.

## Rules

- **Add only.** A row that is already there is never changed or removed. A 1 in Attendance is never turned into a 0.
- **No duplicates.** Each log tab has a key (`import-specs.js`); a row whose key is already in the workbook, or earlier in the file, is counted as "already here". Importing the same file again gives `changes: 0`.
- **Matched by student ID**, digits only. The class list is the course's Roster tab. IDs not on it are counted and left out, unless the lecturer asks for them to be added.
- **Columns by name, with the script's layout as the target.** The script reads tabs by position, so the course's own heading row is kept and extra columns of the file are added to the right. "Form Responses 1" is read by position because its first heading is whatever the Google Form called it.
- **Sessions.** Only Submitted and Discarded sessions are copied; Open and Closed ones would restart or be submitted by mistake. The link secret is never copied. A code already used here by another session is not copied.
- **Not imported on purpose:** Answers and Presence (raw logs of a live quiz that could mix with a quiz running here), access codes, phones, settings, host key, and the marks tabs.

## To import another tab

Add an entry to `LOG_TABS` in `import-specs.js` (columns, `need`, `id`, `text`, `key`). Add a row to the tests in `test/import.test.js`. Nothing else changes.

## Tests

`npm test` in this folder. `test/import.test.js` builds a made-up web workbook (`test/sample-class.js` written by `test/web-export.js` as Google Sheets writes one) and checks the preview, the apply, a second import, attendance merging, open sessions, students not on the list, an empty class list, column names and the screen's calls. `test/packaging.test.js` checks that every module CM loads is listed in `package.json` (`build.files`).

## Files in any layout

The import above expects the web version's tabs or the template. `autoload/` accepts any file: it finds the columns, keeps only the useful fields, and either passes a web export's own tabs through this import unchanged or turns the clean data into the template's tables (Roster, Quiz scores, Attendance) and previews them here. See `autoload/README.md`. An ID that is not 4 to 12 digits long (a typo in a log) is never added to the class list.
