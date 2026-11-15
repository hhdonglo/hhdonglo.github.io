# Course database

One SQLite file per course (`courses/<id>/data/course.db`), using the SQLite built into Node. Nothing to install, no server, no account.

- `store.js` opens the file, loads the course and saves changes in one transaction.
- `codec.js` seals each row with the vault key (AES-256-GCM), so student records are never readable in the file.
- `migrate.js` opens a course safely. If `data/workbook.json` exists it is imported into a new database, checked against the source, and only then put in place. The original is renamed `workbook.json.imported-<time>` and kept. A replaced database is renamed `course.replaced-<time>.db`. An unreadable database is renamed `course.unreadable-<time>.db`. Nothing is deleted.

To restore a backup by hand: put the workbook text in `data/workbook.json` and start CM.

Tests: `test/db.test.js`. To change the layout, edit `SCHEMA` in `store.js` and raise `SCHEMA_VERSION`.

## Duplicate IDs (never two rows for one ID)

- `desktop/ids.js` decides when two IDs are the same: digits only, no trailing ".0", no leading zeros ("022583439", " 22583439 " and "22583439.0" are one ID).
- `db/id-guard.js` merges rows of the same ID in the class list, attendance, master, scores, totals and access codes, never overwriting a different value; log tabs keep every line but with one spelling of the ID.
- `db/notices.js` keeps a notice for each merge (both source rows, both names). `backend.idNotices()` lists them; `backend.resolveIdNotice(tab, id, name)` records the lecturer's choice of name.
- `db/students.js` holds a unique key on the keyed fingerprint of the normalised ID, so the database itself refuses a second row.
- Old data is checked when a course opens. Tests: `test/duplicate-ids.test.js` (one test per entry path).
