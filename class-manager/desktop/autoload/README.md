# autoload: load data from a folder

For the person who maintains this code. User instructions: `desktop/README.md`, "Load data from a folder".

## What it does

The lecturer points at a folder. The app lists the files, works out what each holds (class list, quiz results, attendance, quiz questions), keeps only the useful fields in a clean working file of its own, and previews the result with the existing import (`../import-plan.js`). No fixed template is needed.

## The modules, one job each

| File | Job | Pure (no disk) |
| --- | --- | --- |
| `fields.js` | The fields the app can use and the headings that mean each one. **Add a synonym here** and every file type understands it. | yes |
| `values.js` | IDs, marks (P, A, 1, 0, Present…) and names written one way. | yes |
| `detect.js` | What a sheet is: finds the heading row, maps columns by heading then by content, decides class list, scores, attendance or quiz bank, and names what is missing. | yes |
| `extract.js` | Takes the useful fields out of the sheets of one file into the clean tables. Passes a web export's own tabs through. | yes |
| `book.js` | Joins the sheets of several files for the existing import. | yes |
| `read-file.js` | Reads Excel, CSV, Word (tables and text), text and PDF (text) into sheets. Read only. | no |
| `analyze.js` | Reads one file and returns what it holds (calls `read-file.js` and `extract.js`). | no |
| `scan.js` | Lists readable files in a folder (depth 6, 1,500 files, 60 MB each; skips hidden, temporary and linked items) and watches it. | no |
| `store.js` | Remembers what each file held, keyed by size and date, so an unchanged file is not read again. | no |
| `folder.js` | Scans a folder: list, read only new or changed files, forget removed ones. | no |
| `working.js` | Merges the chosen files and writes the working file (`working-file.xlsx` and one CSV per table). | no |
| `../autoload-ipc.js` | The screen's calls (`cm:auto*`): pick, scan, watch, plan, questions, export. | no |
| `../app/folder.js` | The screen. | no |

## Rules

- **Originals are only read.** Nothing in `autoload/` opens a source file for writing.
- **Only useful fields are kept.** Extra columns (phone, email, level, remarks) never reach the working file.
- **Preview first, add only, no duplicates.** The preview and the import are the existing `plan` and `apply`: backup first, records already there are never changed, importing again adds nothing.
- **Questions need approval.** They go to the review queue, not straight to students.
- **Student data stays private.** The working folder (`<course data>/working/`, with `sources/`) is in the app's data folder, never in the repository; `class-manager/.gitignore` also ignores it. Tests use made-up data only.
- **Nothing happens by itself.** Watching only tells the screen that something changed.
- **Spreadsheet formulas.** A text cell starting with = + - @ is written as text in the CSV files.

## Not done

PDF tables are not read (a PDF is used for quiz questions only). Old `.xls` files must be saved as `.xlsx`. Pulling directly from Google Drive (not from a synced folder) is not built.

## Tests

`npm test` in `desktop/`; `test/autoload.test.js`.

`oversize.js` marks a file that lists many times more students than the other chosen files (probably a whole-course list). The screen leaves it unticked with a warning.
