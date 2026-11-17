
- `roster-shots/files.js`: class list from any standard file (CSV, Excel, Word, text, PDF text) by reusing `autoload/read-file.js` and `detect.js`.
- `autoload/file-types.js`: the shared list of accepted upload types.

- `lecture-progress/` and `rules/lecture-progress.js`, `rules/lecture-log.js`, `app/lecture-progress.js`: lectures held against the semester target (see lecture-progress/README.md).

Lecture detection: `desktop/autoload/lecture-names.js` finds lecture numbers in file and folder names (lecture1, Lecture_01, L1, Lec 2, week3, "08 Waves", numbers in folder names) and groups files by lecture, with gaps (one detector, uses the existing folder scan `autoload/scan.js`). `desktop/lecture-progress/overview.js` merges that with lectures.json and the banks into "Lecture 1" to the last, shown on Course and Content (`app/lecture-list.js`, call `cm:lectureOverview`). The last detected number pre-fills "Lectures planned" in Course settings. Tests: `test/lecture-names.test.js`, `test/lecture-overview.test.js`.
