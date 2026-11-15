# Course database

One SQLite file per course (`courses/<id>/data/course.db`), using the SQLite built into Node. Nothing to install, no server, no account.

- `store.js` opens the file, loads the course and saves changes in one transaction.
- `codec.js` seals each row with the vault key (AES-256-GCM), so student records are never readable in the file.
- `migrate.js` opens a course safely. If `data/workbook.json` exists it is imported into a new database, checked against the source, and only then put in place. The original is renamed `workbook.json.imported-<time>` and kept. A replaced database is renamed `course.replaced-<time>.db`. An unreadable database is renamed `course.unreadable-<time>.db`. Nothing is deleted.

To restore a backup by hand: put the workbook text in `data/workbook.json` and start CM.

Tests: `test/db.test.js`. To change the layout, edit `SCHEMA` in `store.js` and raise `SCHEMA_VERSION`.
