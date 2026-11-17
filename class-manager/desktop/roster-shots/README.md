# roster-shots: the only way a roster enters CM (from any standard file)

For the person who maintains this code.

**Rule (Hope, 2026-11-16).** The class list is the fact the whole course depends on. It is entered on the Class Roster page and the first-run wizard step (one shared screen, `app/roster-shots.js`), from CSV, Excel, Word, text, pasted text, a PDF or screenshots, and nowhere else. Every other file (attendance sheets, grades, quiz exports, LMS files, a linked folder or repository, another computer) is only checked against the list: rows for students on it are used, IDs not on it are reported for the lecturer and never added, and no name on the list is changed.

**Duplicates.** The ID is the unique key. One ID read twice with the same name is one student (merged, counted). One ID with two different names is a conflict the lecturer settles before saving. The same name under different IDs is allowed. Saving the same screenshot again adds nobody.

| File | Job |
| --- | --- |
| `files.js` | Reads CSV, TSV, Excel, Word, text, pasted text and PDF text on this computer (no key, no upload) by reusing `autoload/read-file.js` and `autoload/detect.js` (heading rows, ID and name columns found by heading or content, first and last name columns joined, extra columns ignored). Lists of lines ("20000001 Ama Mensah", "Mensah, Ama - 20000001") are read line by line. Pictures and PDFs with no text are returned for vision. Also `tableOf` for the LMS roster comparison. |
| `vision.js` | Sends each screenshot or scanned PDF to Claude (the lecturer's own API key, `authoring.askJson`) and returns raw rows. Only the image and a fixed instruction are sent. |
| `review.js` | The one check: IDs read without guessing (`app/id-review.js`), unique per ID, conflicts and unreadable IDs listed. Pure. |
| `ipc.js` | `cm:rosterShotsRead` (screenshots to rows and review), `cm:rosterShotsPreview` (review of the corrected table), `cm:rosterShotsSave` (review again, backup first, `backend.rosterSync`, `buildFromRoster`). The only lecturer-facing code that adds students. |
| `update.js` | Updating a saved list: a student dropped under Replace is set aside with all their rows (Removed_Students, restorable), and a name changes only when the lecturer ticks it (Roster and Master, by ID). |
| `gate.js` | Page and script requests (`roster_sync`, `roster_edit` with `op=add`) are refused in `main.js`. Reading and removing stay. |
| `../app/roster-shots.js` | The screen: choose, drop or paste screenshots, correct the table, save. |

**Where files are only checked.** `import-plan.js` forces `addMissing` off and returns no roster rows; `import-ipc.js`, `autoload-ipc.js` (folder), `lms/ipc.js` (the LMS roster is compared, not applied), `sync/records.js` (the class list is never merged in; attendance for IDs not on this computer's list is left out).

**Which files go where.** Everything with real text is read locally. Only screenshots and scanned PDFs are sent to Anthropic, only with the lecturer's key, and the screen says which files were sent. **Reading the pictures.** With an API key, Claude reads the screenshots (accurate on tables and photos, needs the internet, the images leave the computer). Without a key the screen says so; the table can still be typed by hand. A local text reader (OCR) was not added: it needs a large download and is weaker on tables.

**To change.** Wording on screen: `app/setup.html` (step Class roster) and `app/roster-shots.js`. Instruction to the model: `vision.js` (`SYSTEM`). Rules: `review.js`. Tests: `test/roster-shots.test.js`.
