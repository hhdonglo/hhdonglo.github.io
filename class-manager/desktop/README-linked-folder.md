# Linked folder (module README)

**Purpose.** Keep an encrypted copy of one course's records in a folder that a cloud sync app (Google Drive, OneDrive, Dropbox, MEGA, iCloud Drive, Box, pCloud, Nextcloud) or a private git repository carries off the computer. Off until the lecturer links a folder.

**Places.** A synced folder, or one of the services in `storage/` (WebDAV, GitHub, Dropbox, S3-compatible). The lecturer registers with the service and pastes their own credentials; the app holds no developer keys. Google Drive and OneDrive sign-in (browser sign-in with the lecturer's own client ID) are the next providers to add; MEGA works through its desktop app's folder.

**Files**

| File | Responsibility |
| --- | --- |
| `linked-folder.js` | Link, copy now, automatic copy, list, open (restore) and unlink. Settings in the course's data folder (`linked-folder.json`, and `linked-folder.key` for a remembered passphrase). No Electron. |
| `storage/index.js` | The list of service providers, and what the screen needs from each (`describe`). |
| `storage/webdav.js`, `github.js`, `dropbox.js`, `s3.js` | One provider each: its form fields, its "how to get your credentials" text, and `create(creds, {fetch})` returning `check, put, list, get, remove`. `http.js` has the shared request helper. |
| `test/storage.test.js` | Provider tests with in-memory stand-ins for each service (S3 is checked against the AWS signing example). |
| `storage-providers.js` | Names the service from the folder path, and gives one sentence of advice. The list of services is the `PROVIDERS` array: add a line to support another. |
| `app/linked-folder.js` | The "Link storage" card in App Settings. |
| `main.js` (section "linked folder") | Folder dialog and the `cm:linked*` calls; copies run after each automatic backup. |
| `test/linked-folder.test.js` | Tests, run with `npm test`. |

**Rules to keep**

- Only encrypted files are written into the linked folder. Never write the workbook, class list or exports there in readable form.
- A passphrase has at least 10 characters. It is stored only encrypted by the system keychain, and never when no keychain exists.
- Every copy is read back with the passphrase before it counts.
- Copies are written under a temporary name and renamed, so a sync app never uploads a half-written file.
- The newest 14 copies are kept; older ones are removed from the linked folder only.
- Linking and unlinking never delete anything already in the folder.

**To change**

- A new synced-folder service: add it to `PROVIDERS` in `storage-providers.js` and a case to `test/linked-folder.test.js`.
- A new cloud service: copy `storage/webdav.js`, change `id`, `name`, `fields`, `help` and the five calls, add it to `storage/index.js` and add a test to `test/storage.test.js`. The screen needs no change.
- Credentials are stored in `linked-folder.cred` (keychain-encrypted), never in `linked-folder.json`.
- Copies are made asynchronously. A copy started as the app closes may not finish; the four-hourly copy and "Copy now" are the reliable ones.
- How many copies are kept: `KEEP` in `linked-folder.js`.
- The wording on screen: `app/home.html` (card `lf`) and `app/linked-folder.js`.
